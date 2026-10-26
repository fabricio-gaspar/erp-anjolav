-- Aggregate-only read model for the financial dashboard. The dashboard must
-- never need to download the tenant's complete financial history to the
-- browser merely to calculate its cards.
--
-- Existing migrations provide single-column tenant and date indexes. These
-- composites cover this RPC's equality (tenant/status) plus date-range shape.
CREATE INDEX IF NOT EXISTS idx_faturas_tenant_data_vencimento
  ON public.faturas (tenant_id, data_vencimento)
  WHERE data_vencimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_faturas_tenant_status_data_vencimento
  ON public.faturas (tenant_id, status, data_vencimento)
  WHERE data_vencimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_tenant_vencimento
  ON public.contas_pagar (tenant_id, vencimento);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_tenant_status_vencimento
  ON public.contas_pagar (tenant_id, status, vencimento);

CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_tenant_created_at
  ON public.caixa_movimentacoes (tenant_id, created_at);

CREATE OR REPLACE FUNCTION public.consultar_dashboard_financeiro(
  _inicio date,
  _fim date,
  _setor text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
      AND v_setor IN ('todos', 'industrial')
      AND (
        v_setor = 'todos'
        OR lower(coalesce(cliente.classificacao, '')) = 'industrial'
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
    SELECT movimentacao.id, movimentacao.valor
    FROM public.caixa_movimentacoes AS movimentacao
    WHERE movimentacao.tenant_id = v_tenant_id
      AND movimentacao.tipo = 'VENDA'
      AND movimentacao.created_at >= _inicio::timestamptz
      AND movimentacao.created_at < (_fim + 1)::timestamptz
      AND v_setor IN ('todos', 'loja')
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
      count(*) AS receitas_loja_count
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
$$;

REVOKE ALL ON FUNCTION public.consultar_dashboard_financeiro(date, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.consultar_dashboard_financeiro(date, date, text) TO authenticated;
