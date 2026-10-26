-- Correção controlada de baixa manual do PDV.
-- A baixa original permanece no histórico como ESTORNADO e uma nova baixa
-- LEGACY é criada na mesma transação com o valor/forma corrigidos.

CREATE OR REPLACE FUNCTION public.editar_pagamento_pdv(
  _tenant_id uuid,
  _pagamento_id uuid,
  _novo_valor numeric,
  _novo_metodo text,
  _motivo text,
  _editado_por uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_os public.ordens_servico%ROWTYPE;
  v_novo_pagamento public.pdv_pagamentos%ROWTYPE;
  v_novo_metodo text := upper(trim(coalesce(_novo_metodo, '')));
  v_novo_valor numeric(12,2) := round(coalesce(_novo_valor, 0)::numeric, 2);
  v_outros_confirmados numeric(12,2);
  v_motivo text := left(trim(coalesce(_motivo, '')), 1000);
  v_idempotency_key text;
  v_resumo jsonb;
BEGIN
  IF _tenant_id IS NULL OR _pagamento_id IS NULL OR _editado_por IS NULL THEN
    RAISE EXCEPTION 'Dados da correção incompletos';
  END IF;

  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe um motivo de correção com ao menos 5 caracteres';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    JOIN public.tenants tenant ON tenant.id = membership.tenant_id
    WHERE membership.tenant_id = _tenant_id
      AND membership.user_id = _editado_por
      AND membership.enabled
      AND membership.is_active
      AND membership.role IN ('owner', 'admin')
      AND tenant.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado para editar pagamentos';
  END IF;

  IF v_novo_valor <= 0 THEN
    RAISE EXCEPTION 'O novo valor deve ser maior que zero';
  END IF;

  IF v_novo_metodo NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'OUTRO') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida para correção';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pdv_pagamentos
  WHERE id = _pagamento_id
    AND tenant_id = _tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado nesta empresa';
  END IF;

  IF v_pagamento.status NOT IN ('CONFIRMADO', 'EM_REVISAO') THEN
    RAISE EXCEPTION 'Somente pagamentos confirmados podem ser corrigidos';
  END IF;

  IF v_pagamento.provedor NOT IN ('MANUAL', 'LEGACY') THEN
    RAISE EXCEPTION 'Este pagamento depende de correção no provedor externo';
  END IF;

  IF v_pagamento.metodo = 'FIDELIDADE' THEN
    RAISE EXCEPTION 'Pagamentos com fidelidade exigem reversão específica dos pontos';
  END IF;

  SELECT * INTO v_os
  FROM public.ordens_servico
  WHERE id = v_pagamento.ordem_servico_id
    AND tenant_id = _tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS do pagamento não encontrada nesta empresa';
  END IF;

  SELECT round(coalesce(sum(valor), 0)::numeric, 2)
  INTO v_outros_confirmados
  FROM public.pdv_pagamentos
  WHERE ordem_servico_id = v_os.id
    AND id <> v_pagamento.id
    AND status IN ('CONFIRMADO', 'EM_REVISAO');

  IF v_novo_valor > round(coalesce(v_os.valor_total, 0)::numeric - v_outros_confirmados, 2) + 0.009 THEN
    RAISE EXCEPTION 'O novo valor excede o saldo disponível da OS';
  END IF;

  -- Reutiliza o estorno auditado: a baixa original não é apagada e o caixa
  -- recebe a movimentação inversa antes da nova baixa de correção.
  PERFORM public.estornar_pagamento_pdv(_tenant_id, v_pagamento.id, v_motivo, _editado_por);

  v_idempotency_key := 'correcao:' || v_pagamento.id::text || ':' || extract(epoch FROM clock_timestamp())::bigint::text;

  INSERT INTO public.pdv_pagamentos (
    ordem_servico_id, caixa_id, cliente_id, metodo, momento, status,
    valor, valor_recebido, troco, parcelas, bandeira, nsu, codigo_autorizacao,
    provedor, idempotency_key, metadata, confirmado_em, criado_por
  ) VALUES (
    v_os.id,
    v_pagamento.caixa_id,
    v_os.cliente_id,
    v_novo_metodo,
    v_pagamento.momento,
    'CONFIRMADO',
    v_novo_valor,
    CASE WHEN v_novo_metodo = 'DINHEIRO' THEN v_novo_valor ELSE NULL END,
    0,
    1,
    NULL,
    NULL,
    NULL,
    'LEGACY',
    v_idempotency_key,
    coalesce(v_pagamento.metadata, '{}'::jsonb) || jsonb_build_object(
      'correcao', jsonb_build_object(
        'pagamentoOriginalId', v_pagamento.id,
        'valorOriginal', v_pagamento.valor,
        'metodoOriginal', v_pagamento.metodo,
        'novoValor', v_novo_valor,
        'novoMetodo', v_novo_metodo,
        'motivo', v_motivo,
        'editadoPor', _editado_por::text,
        'editadoEm', now()
      )
    ),
    now(),
    _editado_por
  ) RETURNING * INTO v_novo_pagamento;

  IF v_novo_pagamento.caixa_id IS NOT NULL THEN
    INSERT INTO public.caixa_movimentacoes (
      caixa_id, tipo, valor, descricao, forma_pagamento, cliente_id,
      ordem_servico_id, pdv_pagamento_id, evento_pagamento, categoria_id, centro_custo_id
    ) VALUES (
      v_novo_pagamento.caixa_id,
      'VENDA',
      v_novo_pagamento.valor,
      left('Correção de pagamento OS ' || v_os.numero || ' - ' || v_motivo, 1200),
      v_novo_pagamento.metodo,
      v_os.cliente_id,
      v_os.id,
      v_novo_pagamento.id,
      'CONFIRMACAO',
      (SELECT id FROM public.categorias_financeiras WHERE tenant_id = _tenant_id AND nome = 'Venda PDV Loja' AND tipo = 'receita' LIMIT 1),
      (SELECT id FROM public.centros_custo WHERE tenant_id = _tenant_id AND nome = 'Loja' LIMIT 1)
    );

    UPDATE public.caixas
    SET valor_vendas = valor_vendas + v_novo_pagamento.valor,
        valor_esperado = valor_esperado + v_novo_pagamento.valor,
        diferenca = CASE
          WHEN status = 'FECHADO' AND valor_contado IS NOT NULL
            THEN valor_contado - (valor_esperado + v_novo_pagamento.valor)
          ELSE diferenca
        END
    WHERE id = v_novo_pagamento.caixa_id
      AND tenant_id = _tenant_id;
  END IF;

  v_resumo := private.recalcular_pagamento_os(v_os.id);
  RETURN jsonb_build_object(
    'paymentId', v_novo_pagamento.id,
    'originalPaymentId', v_pagamento.id,
    'paymentStatus', v_novo_pagamento.status,
    'correctedValue', v_novo_pagamento.valor,
    'correctedMethod', v_novo_pagamento.metodo,
    'reason', v_motivo
  ) || v_resumo;
END;
$$;

REVOKE ALL ON FUNCTION public.editar_pagamento_pdv(uuid, uuid, numeric, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.editar_pagamento_pdv(uuid, uuid, numeric, text, text, uuid) TO service_role;
