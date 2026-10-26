-- Based on the live definitions inspected on 2026-10-26.
-- Preserve the RPC signature, JSON keys and view columns. receitas_loja remains
-- the legacy API key for direct PDV receipts (now both sectors).
-- Deploy only after 20261026203123_unified_pdv_customer_terms.sql.
-- No data rewrite, policies disabled, or ledger entries synthesized.
BEGIN;

CREATE OR REPLACE FUNCTION public.consultar_dashboard_financeiro(_inicio date, _fim date, _setor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_tenant_id uuid;
  v_setor text := lower(btrim(coalesce(_setor, '')));
  v_area_necessaria text;
  v_hoje date := current_date;
  v_proximos_7_dias date := current_date + 7;
  v_resultado jsonb;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária para consultar o financeiro';
  END IF;

  IF _inicio IS NULL OR _fim IS NULL OR _fim < _inicio THEN
    RAISE EXCEPTION 'Intervalo financeiro inválido';
  END IF;

  IF _fim - _inicio > 366 THEN
    RAISE EXCEPTION 'O intervalo financeiro máximo é de 366 dias';
  END IF;

  v_area_necessaria := CASE v_setor
    WHEN 'todos' THEN 'central'
    WHEN 'industrial' THEN 'industrial'
    WHEN 'loja' THEN 'residencial'
    ELSE NULL
  END;

  IF v_area_necessaria IS NULL THEN
    RAISE EXCEPTION 'Setor financeiro inválido';
  END IF;

  v_tenant_id := private.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa ativa foi encontrada';
  END IF;

  IF NOT private.has_any_module_access(ARRAY['faturamento']) THEN
    RAISE EXCEPTION 'Acesso ao módulo financeiro negado';
  END IF;

  IF NOT private.can_access_area(v_area_necessaria) THEN
    RAISE EXCEPTION 'Acesso negado para a área financeira solicitada';
  END IF;

  WITH
  faturas_no_escopo AS MATERIALIZED (
    SELECT
      fatura.id,
      fatura.status,
      fatura.valor_total,
      fatura.data_vencimento,
      coalesce(cliente.razao_social, cliente.nome_fantasia, 'Cliente') AS cliente
    FROM public.faturas AS fatura
    INNER JOIN public.clientes AS cliente
      ON cliente.id = fatura.cliente_id
      AND cliente.tenant_id = fatura.tenant_id
    WHERE fatura.tenant_id = v_tenant_id
      AND fatura.data_vencimento >= _inicio
      AND fatura.data_vencimento <= _fim
      AND (
        v_setor = 'todos'
        OR lower(coalesce(cliente.classificacao, '')) = CASE WHEN v_setor = 'loja' THEN 'residencial' ELSE v_setor END
      )
  ),
  contas_no_escopo AS MATERIALIZED (
    SELECT
      conta.id,
      conta.status,
      conta.descricao,
      conta.fornecedor,
      conta.valor,
      conta.valor_pago,
      conta.vencimento
    FROM public.contas_pagar AS conta
    LEFT JOIN public.centros_custo AS centro_custo
      ON centro_custo.id = conta.centro_custo_id
      AND centro_custo.tenant_id = conta.tenant_id
    WHERE conta.tenant_id = v_tenant_id
      AND conta.vencimento >= _inicio
      AND conta.vencimento <= _fim
      AND (
        v_setor = 'todos'
        OR (v_setor = 'industrial' AND lower(coalesce(centro_custo.nome, '')) = 'industrial')
        OR (v_setor = 'loja' AND lower(coalesce(centro_custo.nome, '')) = 'loja')
      )
  ),
  vendas_caixa_no_escopo AS MATERIALIZED (
    SELECT movimentacao.id, movimentacao.tipo,
      CASE WHEN upper(movimentacao.tipo) = 'ESTORNO' THEN -abs(movimentacao.valor)
        ELSE movimentacao.valor END AS valor
    FROM public.caixa_movimentacoes AS movimentacao
    LEFT JOIN public.ordens_servico AS os
      ON os.id = movimentacao.ordem_servico_id AND os.tenant_id = movimentacao.tenant_id
    LEFT JOIN public.clientes AS cliente
      ON cliente.id = coalesce(os.cliente_id, movimentacao.cliente_id)
      AND cliente.tenant_id = movimentacao.tenant_id
    LEFT JOIN public.centros_custo AS centro
      ON centro.id = movimentacao.centro_custo_id AND centro.tenant_id = movimentacao.tenant_id
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN os.id IS NOT NULL THEN CASE
          WHEN lower(os.origem) = 'industrial' THEN 'industrial'
          WHEN lower(os.origem) IN ('residencial', 'loja') THEN 'residencial' END
        WHEN lower(cliente.classificacao) IN ('industrial', 'residencial') THEN lower(cliente.classificacao)
        WHEN lower(centro.nome) = 'industrial' THEN 'industrial'
        WHEN lower(centro.nome) IN ('loja', 'residencial') THEN 'residencial'
        ELSE NULL END AS area
    ) AS setor_movimento
    WHERE movimentacao.tenant_id = v_tenant_id
      AND upper(movimentacao.tipo) IN ('VENDA', 'ESTORNO')
      AND movimentacao.created_at >= _inicio::timestamptz
      AND movimentacao.created_at < (_fim + 1)::timestamptz
      AND (v_setor = 'todos' OR setor_movimento.area = CASE WHEN v_setor = 'loja' THEN 'residencial' ELSE v_setor END)
      -- An invoice is the canonical receivable if a legacy payment also
      -- points to its Asaas charge. Never count it again as a direct sale.
      AND NOT EXISTS (
        SELECT 1 FROM public.pdv_pagamentos AS pagamento
        JOIN public.faturas AS fatura
          ON fatura.asaas_charge_id = pagamento.asaas_charge_id
          AND fatura.tenant_id = pagamento.tenant_id
        WHERE pagamento.id = movimentacao.pdv_pagamento_id
          AND pagamento.tenant_id = movimentacao.tenant_id
      )
  ),
  totais_faturas AS (
    SELECT
      coalesce(sum(valor_total) FILTER (WHERE status = 'pago'), 0) AS receitas_faturas,
      count(*) FILTER (WHERE status = 'pago') AS receitas_faturas_count,
      coalesce(sum(valor_total) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND data_vencimento < v_hoje
      ), 0) AS a_receber_vencido,
      count(*) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND data_vencimento < v_hoje
      ) AS a_receber_vencido_count,
      coalesce(sum(valor_total) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND data_vencimento = v_hoje
      ), 0) AS a_receber_hoje,
      count(*) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND data_vencimento = v_hoje
      ) AS a_receber_hoje_count,
      coalesce(sum(valor_total) FILTER (
        WHERE status NOT IN ('pago', 'cancelado')
          AND data_vencimento > v_hoje
          AND data_vencimento <= v_proximos_7_dias
      ), 0) AS a_receber_proximos_7_dias,
      count(*) FILTER (
        WHERE status NOT IN ('pago', 'cancelado')
          AND data_vencimento > v_hoje
          AND data_vencimento <= v_proximos_7_dias
      ) AS a_receber_proximos_7_dias_count
    FROM faturas_no_escopo
  ),
  totais_contas AS (
    SELECT
      coalesce(sum(valor_pago) FILTER (
        WHERE status IN ('pago', 'parcial') AND valor_pago > 0
      ), 0) AS despesas_pagas,
      count(*) FILTER (
        WHERE status IN ('pago', 'parcial') AND valor_pago > 0
      ) AS despesas_pagas_count,
      coalesce(sum(greatest(valor - coalesce(valor_pago, 0), 0)) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND vencimento < v_hoje
      ), 0) AS a_pagar_vencido,
      count(*) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND vencimento < v_hoje
      ) AS a_pagar_vencido_count,
      coalesce(sum(greatest(valor - coalesce(valor_pago, 0), 0)) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND vencimento = v_hoje
      ), 0) AS a_pagar_hoje,
      count(*) FILTER (
        WHERE status NOT IN ('pago', 'cancelado') AND vencimento = v_hoje
      ) AS a_pagar_hoje_count,
      coalesce(sum(greatest(valor - coalesce(valor_pago, 0), 0)) FILTER (
        WHERE status NOT IN ('pago', 'cancelado')
          AND vencimento > v_hoje
          AND vencimento <= v_proximos_7_dias
      ), 0) AS a_pagar_proximos_7_dias,
      count(*) FILTER (
        WHERE status NOT IN ('pago', 'cancelado')
          AND vencimento > v_hoje
          AND vencimento <= v_proximos_7_dias
      ) AS a_pagar_proximos_7_dias_count
    FROM contas_no_escopo
  ),
  totais_caixa AS (
    SELECT
      coalesce(sum(valor), 0) AS receitas_loja,
      count(*) FILTER (WHERE upper(tipo) = 'VENDA') AS receitas_loja_count
    FROM vendas_caixa_no_escopo
  ),
  movimentacoes_vencidas AS (
    SELECT
      fatura.id,
      'fatura'::text AS tipo,
      concat('Fatura ', coalesce(fatura.id::text, '')) AS descricao,
      fatura.cliente,
      fatura.data_vencimento,
      fatura.valor_total AS valor
    FROM faturas_no_escopo AS fatura
    WHERE fatura.status NOT IN ('pago', 'cancelado')
      AND fatura.data_vencimento < v_hoje

    UNION ALL

    SELECT
      conta.id,
      'despesa'::text AS tipo,
      conta.descricao,
      coalesce(conta.fornecedor, 'Fornecedor') AS cliente,
      conta.vencimento AS data_vencimento,
      greatest(conta.valor - coalesce(conta.valor_pago, 0), 0) AS valor
    FROM contas_no_escopo AS conta
    WHERE conta.status NOT IN ('pago', 'cancelado')
      AND conta.vencimento < v_hoje
  ),
  movimentacoes_vencidas_limitadas AS (
    SELECT *
    FROM movimentacoes_vencidas
    ORDER BY data_vencimento ASC, id ASC
    LIMIT 20
  )
  SELECT jsonb_build_object(
    'resultado_registrado', (faturas.receitas_faturas + caixa.receitas_loja) - contas.despesas_pagas,
    'receitas_totais', faturas.receitas_faturas + caixa.receitas_loja,
    'receitas_count', faturas.receitas_faturas_count + caixa.receitas_loja_count,
    'despesas_totais', contas.despesas_pagas,
    'despesas_count', contas.despesas_pagas_count,
    'margem_operacional_registrada', CASE
      WHEN faturas.receitas_faturas + caixa.receitas_loja > 0 THEN round(
        (((faturas.receitas_faturas + caixa.receitas_loja - contas.despesas_pagas)
          / (faturas.receitas_faturas + caixa.receitas_loja)) * 100
      )::numeric, 0)
      ELSE 0
    END,
    'a_receber_vencido', faturas.a_receber_vencido,
    'a_receber_hoje', faturas.a_receber_hoje,
    'a_receber_proximos_7_dias', faturas.a_receber_proximos_7_dias,
    'a_pagar_vencido', contas.a_pagar_vencido,
    'a_pagar_hoje', contas.a_pagar_hoje,
    'a_pagar_proximos_7_dias', contas.a_pagar_proximos_7_dias,
    'vencidas_total', faturas.a_receber_vencido + contas.a_pagar_vencido,
    'vencidas_count', faturas.a_receber_vencido_count + contas.a_pagar_vencido_count,
    'vencem_hoje', faturas.a_receber_hoje + contas.a_pagar_hoje,
    'vencem_hoje_count', faturas.a_receber_hoje_count + contas.a_pagar_hoje_count,
    'proximos_7_dias', faturas.a_receber_proximos_7_dias + contas.a_pagar_proximos_7_dias,
    'proximos_7_dias_count', faturas.a_receber_proximos_7_dias_count + contas.a_pagar_proximos_7_dias_count,
    'receitas_loja', caixa.receitas_loja,
    'receitas_loja_count', caixa.receitas_loja_count,
    'movimentacoes_vencidas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', vencida.id,
        'tipo', vencida.tipo,
        'descricao', vencida.descricao,
        'cliente', vencida.cliente,
        'data_vencimento', vencida.data_vencimento,
        'valor', vencida.valor
      ) ORDER BY vencida.data_vencimento ASC, vencida.id ASC)
      FROM movimentacoes_vencidas_limitadas AS vencida
    ), '[]'::jsonb)
  ) INTO v_resultado
  FROM totais_faturas AS faturas
  CROSS JOIN totais_contas AS contas
  CROSS JOIN totais_caixa AS caixa;

  RETURN coalesce(v_resultado, '{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_dashboard_financeiro(date, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.consultar_dashboard_financeiro(date, date, text) TO authenticated;

-- Replace in place: dependent consumers and existing grants remain intact.
CREATE OR REPLACE VIEW public.v_contas_receber WITH (security_invoker = true) AS
 SELECT f.id,
    'fatura'::text AS origem,
    f.cliente_id,
    c.razao_social AS cliente_nome,
    COALESCE(f.numero_nf, 'Fatura '::text || substr(f.id::text, 1, 8)) AS descricao,
    f.valor_total AS valor,
        CASE
            WHEN f.status = 'pago'::text THEN f.valor_total
            ELSE 0::numeric
        END AS valor_recebido,
    COALESCE(f.data_vencimento, f.periodo_fim) AS data_vencimento,
        CASE
            WHEN f.status = 'pago'::text THEN COALESCE(fatura_charge.paid_at, f.updated_at)::date
            ELSE NULL::date
        END AS data_recebimento,
    CASE WHEN f.status = 'pago' THEN 'recebido' ELSE lower(f.status) END AS status,
    f.categoria_id,
    f.centro_custo_id,
    f.created_at
   FROM public.faturas f
     LEFT JOIN public.clientes c ON c.id = f.cliente_id AND c.tenant_id = f.tenant_id
     LEFT JOIN public.asaas_charges fatura_charge ON fatura_charge.id = f.asaas_charge_id AND fatura_charge.tenant_id = f.tenant_id
  WHERE f.tenant_id = (SELECT private.current_tenant_id()) AND private.can_access_client(f.cliente_id)
UNION ALL
 SELECT cm.id,
    CASE WHEN setor_movimento.area = 'industrial' THEN 'pdv_industrial'::text
      WHEN setor_movimento.area = 'residencial' THEN 'pdv_loja'::text ELSE 'manual'::text END AS origem,
    cm.cliente_id,
    COALESCE(cl.razao_social, 'Venda Balcão'::text) AS cliente_nome,
    COALESCE(cm.descricao, 'Venda PDV'::text) AS descricao,
    CASE WHEN upper(cm.tipo) = 'ESTORNO' THEN -abs(cm.valor) ELSE cm.valor END AS valor,
    CASE WHEN upper(cm.tipo) = 'ESTORNO' THEN -abs(cm.valor) ELSE cm.valor END AS valor_recebido,
    cm.created_at::date AS data_vencimento,
    cm.created_at::date AS data_recebimento,
    CASE WHEN upper(cm.tipo) = 'ESTORNO' THEN 'estornado'::text ELSE 'recebido'::text END AS status,
    cm.categoria_id,
    cm.centro_custo_id,
    cm.created_at
   FROM public.caixa_movimentacoes cm
     LEFT JOIN public.ordens_servico os ON os.id = cm.ordem_servico_id AND os.tenant_id = cm.tenant_id
     LEFT JOIN public.clientes cl ON cl.id = coalesce(os.cliente_id, cm.cliente_id) AND cl.tenant_id = cm.tenant_id
     LEFT JOIN public.centros_custo centro ON centro.id = cm.centro_custo_id AND centro.tenant_id = cm.tenant_id
     CROSS JOIN LATERAL (
       SELECT CASE
         WHEN os.id IS NOT NULL THEN CASE
           WHEN lower(os.origem) = 'industrial' THEN 'industrial'
           WHEN lower(os.origem) IN ('residencial', 'loja') THEN 'residencial' END
         WHEN lower(cl.classificacao) IN ('industrial', 'residencial') THEN lower(cl.classificacao)
         WHEN lower(centro.nome) = 'industrial' THEN 'industrial'
         WHEN lower(centro.nome) IN ('loja', 'residencial') THEN 'residencial'
         ELSE NULL END AS area
     ) setor_movimento
  WHERE upper(cm.tipo) IN ('VENDA', 'ESTORNO')
    AND cm.tenant_id = (SELECT private.current_tenant_id())
    -- RLS-hidden linked records must not become unclassified/visible fallback rows.
    AND (cm.ordem_servico_id IS NULL OR os.id IS NOT NULL)
    AND (coalesce(os.cliente_id, cm.cliente_id) IS NULL OR cl.id IS NOT NULL)
    AND private.can_access_area(coalesce(setor_movimento.area, 'central'))
    AND NOT EXISTS (
      SELECT 1 FROM public.pdv_pagamentos pagamento
      JOIN public.faturas fatura ON fatura.asaas_charge_id = pagamento.asaas_charge_id
        AND fatura.tenant_id = pagamento.tenant_id
      WHERE pagamento.id = cm.pdv_pagamento_id AND pagamento.tenant_id = cm.tenant_id
    )
UNION ALL
 SELECT ac.id,
    'asaas'::text AS origem,
    ac.cliente_id,
    ac.customer_name AS cliente_nome,
    ac.description AS descricao,
    ac.value AS valor,
        CASE
            WHEN ac.status = 'RECEIVED'::text THEN ac.value
            ELSE 0::numeric
        END AS valor_recebido,
    ac.due_date AS data_vencimento,
    ac.paid_at::date AS data_recebimento,
        CASE ac.status
            WHEN 'RECEIVED'::text THEN 'recebido'::text
            WHEN 'CONFIRMED'::text THEN 'pendente'::text
            WHEN 'OVERDUE'::text THEN 'atrasado'::text
            WHEN 'PENDING'::text THEN 'pendente'::text
            ELSE lower(ac.status)
        END AS status,
    ac.categoria_id,
    ac.centro_custo_id,
    ac.created_at
   FROM public.asaas_charges ac
  WHERE ac.tenant_id = (SELECT private.current_tenant_id())
    AND CASE WHEN ac.cliente_id IS NULL THEN private.can_access_area('central')
      ELSE private.can_access_client(ac.cliente_id) END
    AND NOT EXISTS (
      SELECT 1 FROM public.faturas f
      WHERE f.asaas_charge_id = ac.id AND f.tenant_id = ac.tenant_id
    )
    -- Pending standalone/PDV charges remain visible until a cash receipt exists.
    -- Use the explicit payment link, never a fuzzy client/date/value match.
    AND NOT EXISTS (
      SELECT 1 FROM public.pdv_pagamentos pp
      JOIN public.caixa_movimentacoes cm
        ON cm.pdv_pagamento_id = pp.id AND cm.tenant_id = pp.tenant_id
      WHERE pp.asaas_charge_id = ac.id AND pp.tenant_id = ac.tenant_id
        AND upper(cm.tipo) = 'VENDA'
    )
UNION ALL
 SELECT ct.id,
    'contrato'::text AS origem,
    ct.cliente_id,
    c.razao_social AS cliente_nome,
    ct.descricao,
    ct.valor_servico AS valor,
    0::numeric AS valor_recebido,
    (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon -1 days'::interval)::date AS data_vencimento,
    NULL::date AS data_recebimento,
    'pendente'::text AS status,
    ( SELECT categorias_financeiras.id
           FROM public.categorias_financeiras
          WHERE categorias_financeiras.tenant_id = ct.tenant_id AND categorias_financeiras.nome = 'Aluguel / Contrato'::text AND categorias_financeiras.tipo = 'receita'::text
         LIMIT 1) AS categoria_id,
    ( SELECT centros_custo.id
           FROM public.centros_custo
          WHERE centros_custo.tenant_id = ct.tenant_id AND centros_custo.nome = 'Industrial'::text
         LIMIT 1) AS centro_custo_id,
    ct.created_at
   FROM public.contratos_aluguel ct
     LEFT JOIN public.clientes c ON c.id = ct.cliente_id AND c.tenant_id = ct.tenant_id
  WHERE ct.ativo = true AND ct.tenant_id = (SELECT private.current_tenant_id())
    AND private.can_access_client(ct.cliente_id);

-- Signed reversal receipts reduce cash flow on the reversal date.
CREATE OR REPLACE VIEW public.v_fluxo_caixa WITH (security_invoker = true) AS
 SELECT 'R-'::text || vr.id::text AS id,
    vr.origem,
    'receita'::text AS tipo,
    vr.descricao,
    vr.valor_recebido AS valor,
    COALESCE(vr.data_recebimento, vr.data_vencimento) AS data,
    vr.categoria_id,
    vr.centro_custo_id,
    vr.cliente_id,
    NULL::uuid AS fornecedor_id
   FROM public.v_contas_receber vr
  WHERE vr.valor_recebido <> 0::numeric
UNION ALL
 SELECT 'P-'::text || cp.id::text AS id,
    'conta_pagar'::text AS origem,
    'despesa'::text AS tipo,
    cp.descricao,
        CASE
            WHEN cp.valor_pago > 0::numeric THEN cp.valor_pago
            ELSE cp.valor
        END AS valor,
    COALESCE(cp.data_pagamento, cp.vencimento) AS data,
    cp.categoria_id,
    cp.centro_custo_id,
    NULL::uuid AS cliente_id,
    cp.fornecedor_id
   FROM public.contas_pagar cp
  WHERE cp.tenant_id = (SELECT private.current_tenant_id()) AND cp.status = ANY (ARRAY['pago'::text, 'parcial'::text]);

REVOKE ALL ON public.v_contas_receber, public.v_fluxo_caixa FROM anon;
GRANT SELECT ON public.v_contas_receber, public.v_fluxo_caixa TO authenticated;
COMMIT;
