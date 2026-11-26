-- Restore the operational metrics queried by the administrative dashboard.
-- The function is SECURITY INVOKER so the caller's RLS policies remain in effect.

CREATE OR REPLACE FUNCTION public.consultar_metricas_producao(
  _setor text,
  _inicio_hoje timestamptz,
  _trinta_dias_atras timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_setor text := lower(btrim(coalesce(_setor, '')));
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação e empresa ativa são obrigatórias para consultar métricas.'
      USING ERRCODE = '42501';
  END IF;

  IF v_setor NOT IN ('central', 'industrial', 'residencial') THEN
    RAISE EXCEPTION 'Setor de métricas inválido: %', _setor
      USING ERRCODE = '22023';
  END IF;

  IF _inicio_hoje IS NULL
    OR _trinta_dias_atras IS NULL
    OR _trinta_dias_atras > _inicio_hoje THEN
    RAISE EXCEPTION 'Intervalo de métricas inválido.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT private.has_any_module_access(ARRAY['ordens', 'producao', 'dashboard', 'relatorios', 'caixa']) THEN
    RAISE EXCEPTION 'Você não tem permissão para consultar métricas operacionais.'
      USING ERRCODE = '42501';
  END IF;

  WITH ordens_no_escopo AS MATERIALIZED (
    SELECT
      ordem.id,
      ordem.cliente_id,
      ordem.status,
      ordem.data_previsao_entrega,
      ordem.created_at
    FROM public.ordens_servico AS ordem
    WHERE ordem.tenant_id = v_tenant_id
      AND (
        v_setor = 'central'
        OR (
          v_setor = 'industrial'
          AND lower(coalesce(ordem.origem, '')) = 'industrial'
        )
        OR (
          v_setor = 'residencial'
          AND lower(coalesce(ordem.origem, '')) IN ('residencial', 'loja')
        )
      )
  ),
  gargalos AS (
    SELECT coalesce(jsonb_object_agg(etapa, quantidade), '{}'::jsonb) AS dados
    FROM (
      SELECT
        coalesce(nullif(lower(btrim(status)), ''), 'sem_etapa') AS etapa,
        count(*)::integer AS quantidade
      FROM ordens_no_escopo
      WHERE lower(coalesce(status, '')) NOT IN ('entregue', 'cancelado')
      GROUP BY 1
    ) AS etapas
  )
  SELECT jsonb_build_object(
    'osEmAberto', (
      SELECT count(*)::integer
      FROM ordens_no_escopo
      WHERE lower(coalesce(status, '')) NOT IN ('entregue', 'cancelado')
    ),
    'entregasAtrasadas', (
      SELECT count(*)::integer
      FROM ordens_no_escopo
      WHERE data_previsao_entrega < current_date
        AND lower(coalesce(status, '')) NOT IN ('entregue', 'cancelado')
    ),
    'clientesAtivos', (
      SELECT count(DISTINCT cliente_id)::integer
      FROM ordens_no_escopo
      WHERE created_at >= _trinta_dias_atras
    ),
    'pecasProcessadasHoje', coalesce((
      SELECT sum(item.quantidade)
      FROM public.itens_ordem_servico AS item
      INNER JOIN ordens_no_escopo AS ordem ON ordem.id = item.ordem_servico_id
      WHERE item.tenant_id = v_tenant_id
        AND item.created_at >= _inicio_hoje
    ), 0),
    'gargalos', (SELECT dados FROM gargalos)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_metricas_producao(text, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_metricas_producao(text, timestamptz, timestamptz) TO authenticated;
