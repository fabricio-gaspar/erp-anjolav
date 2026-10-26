-- Estorno seguro de pagamentos confirmados do PDV.
-- O pagamento original permanece no histórico; o caixa recebe uma movimentação inversa.

CREATE OR REPLACE FUNCTION public.estornar_pagamento_pdv(
  _tenant_id uuid,
  _pagamento_id uuid,
  _motivo text,
  _estornado_por uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_os public.ordens_servico%ROWTYPE;
  v_resumo jsonb;
  v_motivo text := left(trim(coalesce(_motivo, '')), 1000);
BEGIN
  IF _tenant_id IS NULL OR _pagamento_id IS NULL OR _estornado_por IS NULL THEN
    RAISE EXCEPTION 'Dados do estorno incompletos';
  END IF;

  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe um motivo de estorno com ao menos 5 caracteres';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    JOIN public.tenants tenant ON tenant.id = membership.tenant_id
    WHERE membership.tenant_id = _tenant_id
      AND membership.user_id = _estornado_por
      AND membership.enabled
      AND membership.is_active
      AND membership.role IN ('owner', 'admin')
      AND tenant.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado para estornar pagamentos';
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
    RAISE EXCEPTION 'Somente pagamentos confirmados podem ser estornados';
  END IF;

  IF v_pagamento.provedor NOT IN ('MANUAL', 'LEGACY') THEN
    RAISE EXCEPTION 'Este pagamento depende de estorno no provedor externo';
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

  UPDATE public.pdv_pagamentos
  SET status = 'ESTORNADO',
      cancelado_em = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'estorno', jsonb_build_object(
          'motivo', v_motivo,
          'estornadoPor', _estornado_por::text,
          'estornadoEm', now()
        )
      )
  WHERE id = v_pagamento.id;

  IF v_pagamento.caixa_id IS NOT NULL THEN
    INSERT INTO public.caixa_movimentacoes (
      caixa_id, tipo, valor, descricao, forma_pagamento, cliente_id,
      ordem_servico_id, pdv_pagamento_id, evento_pagamento, categoria_id, centro_custo_id
    ) VALUES (
      v_pagamento.caixa_id,
      'ESTORNO',
      v_pagamento.valor,
      left('Estorno pagamento OS ' || v_os.numero || ' - ' || v_motivo, 1200),
      v_pagamento.metodo,
      v_pagamento.cliente_id,
      v_pagamento.ordem_servico_id,
      v_pagamento.id,
      'ESTORNO',
      (SELECT id FROM public.categorias_financeiras WHERE tenant_id = _tenant_id AND nome = 'Venda PDV Loja' AND tipo = 'receita' LIMIT 1),
      (SELECT id FROM public.centros_custo WHERE tenant_id = _tenant_id AND nome = 'Loja' LIMIT 1)
    ) ON CONFLICT (pdv_pagamento_id, evento_pagamento)
      WHERE pdv_pagamento_id IS NOT NULL AND evento_pagamento IS NOT NULL
      DO NOTHING;

    UPDATE public.caixas
    SET valor_vendas = valor_vendas - v_pagamento.valor,
        valor_esperado = valor_esperado - v_pagamento.valor,
        diferenca = CASE
          WHEN status = 'FECHADO' AND valor_contado IS NOT NULL
            THEN valor_contado - (valor_esperado - v_pagamento.valor)
          ELSE diferenca
        END
    WHERE id = v_pagamento.caixa_id
      AND tenant_id = _tenant_id;
  END IF;

  v_resumo := private.recalcular_pagamento_os(v_pagamento.ordem_servico_id);
  RETURN jsonb_build_object(
    'paymentId', v_pagamento.id,
    'paymentStatus', 'ESTORNADO',
    'reversedValue', v_pagamento.valor,
    'reason', v_motivo
  ) || v_resumo;
END;
$$;

REVOKE ALL ON FUNCTION public.estornar_pagamento_pdv(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_pdv(uuid, uuid, text, uuid) TO service_role;
