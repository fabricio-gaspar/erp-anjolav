-- REL-02: canonical, read-only industrial statement for the client report.
CREATE OR REPLACE FUNCTION public.obter_demonstrativo_industrial(
  _cliente_id uuid,
  _periodo_inicio date,
  _periodo_fim date,
  _fatura_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_cliente public.clientes%ROWTYPE;
  v_fatura public.faturas%ROWTYPE;
  v_inicio date := _periodo_inicio;
  v_fim date := _periodo_fim;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.can_access_area('industrial')
     OR NOT private.has_any_module_access(ARRAY['relatorios', 'faturamento']::text[])
  THEN
    RAISE EXCEPTION 'Sem permissão para consultar o demonstrativo industrial' USING ERRCODE = '42501';
  END IF;

  IF _cliente_id IS NULL OR _periodo_inicio IS NULL OR _periodo_fim IS NULL
     OR _periodo_fim < _periodo_inicio OR _periodo_fim > _periodo_inicio + 366
  THEN
    RAISE EXCEPTION 'Informe um cliente e um período válido de até 366 dias' USING ERRCODE = '22023';
  END IF;

  SELECT c.* INTO v_cliente
  FROM public.clientes c
  WHERE c.id = _cliente_id AND c.tenant_id = v_tenant
    AND c.classificacao = 'industrial';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente industrial não encontrado neste painel' USING ERRCODE = '42501';
  END IF;

  IF _fatura_id IS NOT NULL THEN
    SELECT f.* INTO v_fatura
    FROM public.faturas f
    WHERE f.id = _fatura_id AND f.tenant_id = v_tenant
      AND f.cliente_id = _cliente_id
      AND f.operation_type = 'industrial'::public.operation_type;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Fatura industrial não encontrada para este cliente' USING ERRCODE = '42501';
    END IF;
    IF v_fatura.periodo_inicio > _periodo_fim OR v_fatura.periodo_fim < _periodo_inicio THEN
      RAISE EXCEPTION 'A fatura não pertence ao período consultado' USING ERRCODE = '22023';
    END IF;
    -- An invoice scope always reports its full billing period and linked origins.
    v_inicio := v_fatura.periodo_inicio;
    v_fim := v_fatura.periodo_fim;
  END IF;

  WITH origens_base AS MATERIALIZED (
    SELECT l.id, l.ordem_servico_id, l.fatura_id, l.etapa, l.valor_total,
      l.observacao,
      COALESCE(os.numero, l.numero_rol, 'ROL ' || upper(left(l.id::text, 8))) AS numero,
      COALESCE(os.data_retirada, l.data_lancamento) AS data_origem,
      COALESCE(os.data_entrega, l.data_entrega) AS data_entrega_origem,
      COALESCE(os.status, l.status) AS status_origem
    FROM public.lancamentos l
    LEFT JOIN public.ordens_servico os
      ON os.id = l.ordem_servico_id AND os.tenant_id = l.tenant_id
      AND os.cliente_id = l.cliente_id
    WHERE l.tenant_id = v_tenant AND l.cliente_id = _cliente_id
      AND COALESCE(os.operation_type, l.operation_type) = 'industrial'::public.operation_type
      AND l.status NOT IN ('cancelado', 'cancelada')
      AND COALESCE(os.status, '') NOT IN ('cancelado', 'cancelada')
      AND (
        (_fatura_id IS NULL AND COALESCE(os.data_retirada, l.data_lancamento) BETWEEN v_inicio AND v_fim)
        OR (_fatura_id IS NOT NULL AND (
          l.fatura_id = _fatura_id
          OR EXISTS (
            SELECT 1 FROM public.lancamentos_fatura lf
            WHERE lf.tenant_id = v_tenant AND lf.lancamento_id = l.id
              AND lf.fatura_id = _fatura_id
          )
        ))
      )
  ), item_rows AS MATERIALIZED (
    SELECT i.id, i.lancamento_id, i.produto_nome AS descricao, i.quantidade,
      i.unidade, i.preco_unitario, i.subtotal
    FROM public.itens_lancamento i
    JOIN origens_base o ON o.id = i.lancamento_id
    WHERE i.tenant_id = v_tenant
  ), items_by_origin AS (
    SELECT i.lancamento_id, sum(i.subtotal) AS valor,
      jsonb_agg(jsonb_build_object(
        'id', i.id, 'descricao', i.descricao, 'quantidade', i.quantidade,
        'unidade', i.unidade, 'valorUnitario', i.preco_unitario,
        'valorTotal', i.subtotal
      ) ORDER BY i.id) AS itens
    FROM item_rows i GROUP BY i.lancamento_id
  ), origens AS (
    SELECT o.*, COALESCE(i.valor, 0) AS valor_itens,
      COALESCE(i.itens, '[]'::jsonb) AS itens
    FROM origens_base o LEFT JOIN items_by_origin i ON i.lancamento_id = o.id
  ), servicos AS (
    SELECT i.descricao, i.unidade, i.preco_unitario,
      sum(i.quantidade) AS quantidade, sum(i.subtotal) AS valor_total,
      count(DISTINCT i.lancamento_id) AS quantidade_origens
    FROM item_rows i
    GROUP BY i.descricao, i.unidade, i.preco_unitario
  ), faturas AS MATERIALIZED (
    SELECT f.id, f.valor_total, f.valor_pago,
      jsonb_build_object(
        'id', f.id,
        'numero', COALESCE(NULLIF(f.numero_nf, ''), 'Fatura ' || upper(left(f.id::text, 8))),
        'periodoInicio', f.periodo_inicio, 'periodoFim', f.periodo_fim,
        'status', f.status,
        'statusPagamento', CASE WHEN f.status IN ('cancelado', 'cancelada')
          OR f.status_pagamento = 'cancelado' THEN 'cancelado'
          ELSE COALESCE(f.status_pagamento, 'pendente') END,
        'valor', f.valor_total, 'valorPago', COALESCE(f.valor_pago, 0),
        'saldo', CASE WHEN f.status IN ('cancelado', 'cancelada')
          OR f.status_pagamento = 'cancelado' THEN 0
          ELSE greatest(f.valor_total - COALESCE(f.valor_pago, 0), 0) END,
        'vencimento', f.data_vencimento,
        'cancelamentoMotivo', NULL::text
      ) AS payload,
      (f.status NOT IN ('cancelado', 'cancelada')
        AND f.status_pagamento <> 'cancelado') AS contabilizar
    FROM public.faturas f
    WHERE f.tenant_id = v_tenant AND f.cliente_id = _cliente_id
      AND f.operation_type = 'industrial'::public.operation_type
      AND ((_fatura_id IS NOT NULL AND f.id = _fatura_id)
        OR (_fatura_id IS NULL AND f.periodo_inicio <= v_fim AND f.periodo_fim >= v_inicio))
  )
  SELECT jsonb_build_object(
    'cliente', jsonb_build_object(
      'id', v_cliente.id, 'razaoSocial', v_cliente.razao_social,
      'nomeFantasia', v_cliente.nome_fantasia, 'documento', v_cliente.cpf_cnpj
    ),
    'periodo', jsonb_build_object('inicio', v_inicio, 'fim', v_fim),
    'escopo', CASE WHEN _fatura_id IS NULL THEN 'periodo' ELSE 'fatura' END,
    'contratos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'descricao', c.descricao, 'ativo', c.ativo,
        'periodicidade', c.periodicidade_fechamento,
        'valorFixoReferencia', c.valor_servico,
        'autorizaFaturamento', c.autoriza_faturamento,
        'vigenciaInicio', c.data_inicio, 'vigenciaFim', c.data_fim
      ) ORDER BY c.data_inicio, c.id)
      FROM public.contratos_aluguel c
      WHERE c.tenant_id = v_tenant AND c.cliente_id = _cliente_id
        AND c.data_inicio <= v_fim
        AND (c.data_fim IS NULL OR c.data_fim >= v_inicio)
    ), '[]'::jsonb),
    'fatura', (SELECT f.payload FROM faturas f WHERE f.id = _fatura_id),
    'totais', jsonb_build_object(
      'quantidadeOrigens', (SELECT count(*) FROM origens),
      'quantidadeItens', (SELECT COALESCE(sum(i.quantidade), 0) FROM item_rows i),
      'quantidadeServicos', (SELECT count(*) FROM servicos),
      'valorItens', (SELECT COALESCE(sum(i.subtotal), 0) FROM item_rows i),
      'valorOrigens', (SELECT COALESCE(sum(o.valor_total), 0) FROM origens o),
      'valorAjustes', (SELECT COALESCE(sum(o.valor_total - o.valor_itens), 0) FROM origens o),
      'valorFaturado', (SELECT COALESCE(sum(f.valor_total) FILTER (WHERE f.contabilizar), 0) FROM faturas f),
      'valorPago', (SELECT COALESCE(sum(f.valor_pago) FILTER (WHERE f.contabilizar), 0) FROM faturas f),
      'saldoFaturado', (SELECT COALESCE(sum(greatest(f.valor_total - COALESCE(f.valor_pago, 0), 0))
        FILTER (WHERE f.contabilizar), 0) FROM faturas f)
    ),
    'servicos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', s.descricao, 'unidade', s.unidade,
        'valorUnitario', s.preco_unitario, 'quantidade', s.quantidade,
        'valorTotal', s.valor_total, 'quantidadeOrigens', s.quantidade_origens
      ) ORDER BY lower(s.descricao), s.unidade, s.preco_unitario)
      FROM servicos s
    ), '[]'::jsonb),
    'origens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'numero', o.numero, 'data', o.data_origem,
        'dataEntrega', o.data_entrega_origem, 'status', o.status_origem,
        'etapa', o.etapa, 'valor', o.valor_total,
        'ajuste', o.valor_total - o.valor_itens,
        'faturaId', COALESCE(_fatura_id, o.fatura_id),
        'ordemServicoId', o.ordem_servico_id,
        'observacao', o.observacao, 'itens', o.itens
      ) ORDER BY o.data_origem, o.numero, o.id)
      FROM origens o
    ), '[]'::jsonb),
    'faturas', COALESCE((SELECT jsonb_agg(f.payload ORDER BY f.id) FROM faturas f), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.obter_demonstrativo_industrial(uuid,date,date,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_demonstrativo_industrial(uuid,date,date,uuid) TO authenticated;
