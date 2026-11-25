-- Add auditable sales and pickup-receivable context to the existing cash
-- summary. Pickup balances are informational and never included in cash due.
CREATE OR REPLACE FUNCTION public.obter_resumo_caixa(_caixa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_caixa public.caixas%ROWTYPE;
  v_dinheiro numeric := 0;
  v_pix numeric := 0;
  v_credito numeric := 0;
  v_debito numeric := 0;
  v_outros numeric := 0;
  v_vendas numeric := 0;
  v_sangrias numeric := 0;
  v_suprimentos numeric := 0;
  v_pendente_retirada numeric := 0;
  v_rols_pendentes_retirada integer := 0;
BEGIN
  IF NOT private.pdv_cash_access_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o caixa';
  END IF;

  SELECT c.* INTO v_caixa
    FROM public.caixas c
   WHERE c.id = _caixa_id
     AND c.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'PIX' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'PIX' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_CREDITO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_CREDITO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_DEBITO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_DEBITO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' THEN CASE WHEN COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'ESTORNO' THEN -m.valor ELSE m.valor END ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'SANGRIA' THEN m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'REFORCO' THEN m.valor ELSE 0 END), 0)
  INTO v_dinheiro, v_pix, v_credito, v_debito, v_outros, v_vendas, v_sangrias, v_suprimentos
  FROM public.caixa_movimentacoes m
  WHERE m.caixa_id = _caixa_id
    AND m.tenant_id = v_tenant_id;

  SELECT
    COALESCE(SUM(GREATEST(COALESCE(o.valor_total, 0) - COALESCE(o.valor_pago, 0), 0)), 0),
    COUNT(*)::integer
  INTO v_pendente_retirada, v_rols_pendentes_retirada
  FROM public.ordens_servico o
  WHERE o.tenant_id = v_tenant_id
    AND o.created_at >= v_caixa.data_abertura
    AND o.operation_type IS NOT DISTINCT FROM v_caixa.operation_type
    AND (v_caixa.unidade_id IS NULL OR o.unidade_id = v_caixa.unidade_id)
    AND COALESCE(o.condicao_pagamento, 'retirada') = 'retirada'
    AND lower(COALESCE(o.status, '')) NOT IN ('cancelado', 'cancelada')
    AND lower(COALESCE(o.status_pagamento, 'pendente')) NOT IN ('pago', 'quitado', 'cancelado')
    AND GREATEST(COALESCE(o.valor_total, 0) - COALESCE(o.valor_pago, 0), 0) > 0.009;

  RETURN jsonb_build_object(
    'caixaId', v_caixa.id,
    'status', v_caixa.status,
    'identificador', v_caixa.identificador_caixa,
    'operador', v_caixa.operador,
    'abertoEm', v_caixa.data_abertura,
    'fundoAbertura', COALESCE(v_caixa.valor_abertura, 0),
    'dinheiroVendas', v_dinheiro,
    'dinheiro', v_dinheiro + COALESCE(v_caixa.valor_abertura, 0) - v_sangrias + v_suprimentos,
    'pix', v_pix,
    'cartaoCredito', v_credito,
    'cartaoDebito', v_debito,
    'outros', v_outros,
    'vendasLiquidas', v_vendas,
    'sangrias', v_sangrias,
    'suprimentos', v_suprimentos,
    'pendenteRetirada', v_pendente_retirada,
    'rolsPendentesRetirada', v_rols_pendentes_retirada
  );
END
$function$;
