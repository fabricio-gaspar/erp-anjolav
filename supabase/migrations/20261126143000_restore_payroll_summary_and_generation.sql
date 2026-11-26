-- ADM-01: restore the two RPCs used by the team/payroll screen.
-- This migration follows the P0 payroll migration. Never create an incomplete
-- payroll workflow if its versioning, audit ledger or editing RPCs are absent.
DO $migration$
BEGIN
  IF to_regclass('public.folha_pagamento_operacoes') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_class c
       WHERE c.oid = to_regclass('public.folha_pagamento_operacoes') AND c.relrowsecurity
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_constraint c
       WHERE c.conrelid = 'public.folha_pagamento'::regclass
         AND c.conname = 'folha_pagamento_funcionario_id_competencia_key'
         AND c.contype = 'u'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'folha_pagamento' AND column_name = 'versao'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'folha_beneficios' AND column_name = 'ativo'
     )
     OR (
       SELECT count(DISTINCT p.proname)
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = ANY (ARRAY[
           'atualizar_folha_aberta', 'cancelar_folha_aberta',
           'definir_beneficio_folha', 'fechar_folha_competencia',
           'salvar_beneficio_catalogo'
         ])
     ) <> 5 THEN
    RAISE EXCEPTION 'ADM-01 requer a migracao P0 de folha (versoes, operacoes e RPCs de edicao/fechamento) antes desta migracao';
  END IF;
END;
$migration$;

CREATE FUNCTION public.consultar_resumo_folha_pagamento(_competencia date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para consultar o resumo da folha' USING ERRCODE = '42501';
  END IF;
  IF _competencia IS NULL OR EXTRACT(DAY FROM _competencia) <> 1 THEN
    RAISE EXCEPTION 'Competência deve ser o primeiro dia do mês' USING ERRCODE = '22023';
  END IF;

  WITH folhas AS (
    SELECT f.id, f.status, f.salario_base
    FROM public.folha_pagamento f
    WHERE f.tenant_id = v_tenant AND f.competencia = _competencia
  ), beneficios AS (
    SELECT b.folha_id, sum(b.valor) AS valor
    FROM public.folha_beneficios b
    JOIN folhas f ON f.id = b.folha_id
    WHERE b.tenant_id = v_tenant AND b.ativo AND b.tipo = 'beneficio'
    GROUP BY b.folha_id
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'abertas', count(*) FILTER (WHERE f.status = 'aberto')::integer,
    'fechadas', count(*) FILTER (WHERE f.status = 'fechado')::integer,
    'canceladas', count(*) FILTER (WHERE f.status = 'cancelado')::integer,
    'salarios', coalesce(round(sum(f.salario_base) FILTER (WHERE f.status IN ('aberto', 'fechado')), 2), 0),
    'beneficios', coalesce(round(sum(coalesce(b.valor, 0)) FILTER (WHERE f.status IN ('aberto', 'fechado')), 2), 0),
    'valor_operacional', coalesce(round(sum(f.salario_base + coalesce(b.valor, 0)) FILTER (WHERE f.status IN ('aberto', 'fechado')), 2), 0)
  ) INTO v_result
  FROM folhas f
  LEFT JOIN beneficios b ON b.folha_id = f.id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_resumo_folha_pagamento(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_resumo_folha_pagamento(date) TO authenticated;

CREATE FUNCTION public.gerar_folha_competencia(_competencia date, _idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_actor uuid := auth.uid();
  v_request jsonb := jsonb_build_object('competencia', _competencia);
  v_request_hash text := md5(jsonb_build_object('competencia', _competencia)::text);
  v_previous public.folha_pagamento_operacoes%ROWTYPE;
  v_result jsonb;
  v_inserted integer := 0;
  v_total integer;
  v_canceled integer;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Sem permissão para gerar a folha' USING ERRCODE = '42501';
  END IF;
  IF _competencia IS NULL OR EXTRACT(DAY FROM _competencia) <> 1 THEN
    RAISE EXCEPTION 'Competência deve ser o primeiro dia do mês' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(_idempotency_key), '') IS NULL OR length(_idempotency_key) > 180 THEN
    RAISE EXCEPTION 'Chave de operação inválida' USING ERRCODE = '22023';
  END IF;

  -- The request lock makes replay deterministic. The month lock serializes
  -- generation under different keys for the same tenant and competence.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('folha_requisicao:' || v_tenant::text || ':' || _idempotency_key, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('gerar_folha:' || v_tenant::text || ':' || _competencia::text, 0)
  );

  SELECT * INTO v_previous
  FROM public.folha_pagamento_operacoes o
  WHERE o.tenant_id = v_tenant AND o.idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_previous.tipo IS DISTINCT FROM 'gerar'
       OR v_previous.competencia IS DISTINCT FROM _competencia
       OR v_previous.request_hash IS DISTINCT FROM v_request_hash THEN
      RAISE EXCEPTION 'Chave de operação já usada com outros dados' USING ERRCODE = '22023';
    END IF;
    RETURN v_previous.resultado;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.funcionarios e
    WHERE e.tenant_id = v_tenant AND e.ativo
      AND (e.data_admissao IS NULL OR e.data_admissao < (_competencia + INTERVAL '1 month')::date)
      AND (e.data_demissao IS NULL OR e.data_demissao >= _competencia)
      AND (e.salario_base < 0 OR e.salario_base::text IN ('NaN', 'Infinity', '-Infinity'))
  ) THEN
    RAISE EXCEPTION 'Há salário cadastral inválido para a competência' USING ERRCODE = '22023';
  END IF;

  -- Benefits are edited and counted in folha_beneficios. Do not duplicate
  -- employee profile benefits in both payroll columns and benefit entries.
  INSERT INTO public.folha_pagamento (
    tenant_id, funcionario_id, competencia, salario_base,
    total_proventos, liquido, custo_total_empresa
  )
  SELECT
    v_tenant, e.id, _competencia, round(coalesce(e.salario_base, 0), 2),
    round(coalesce(e.salario_base, 0), 2),
    round(coalesce(e.salario_base, 0), 2),
    round(coalesce(e.salario_base, 0), 2)
  FROM public.funcionarios e
  WHERE e.tenant_id = v_tenant AND e.ativo
    AND (e.data_admissao IS NULL OR e.data_admissao < (_competencia + INTERVAL '1 month')::date)
    AND (e.data_demissao IS NULL OR e.data_demissao >= _competencia)
  ORDER BY e.id
  -- The unique employee/competence constraint preserves existing open,
  -- closed and canceled rows without recalculation, even across retries.
  ON CONFLICT (funcionario_id, competencia) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE f.status = 'cancelado')::integer
    INTO v_total, v_canceled
  FROM public.folha_pagamento f
  WHERE f.tenant_id = v_tenant AND f.competencia = _competencia;

  v_result := jsonb_build_object(
    'inserted', v_inserted,
    'existing', v_total - v_inserted - v_canceled,
    'canceled', v_canceled,
    'total', v_total
  );
  INSERT INTO public.folha_pagamento_operacoes (
    tenant_id, competencia, folha_id, tipo, idempotency_key,
    request_hash, dados, resultado, criado_por
  ) VALUES (
    v_tenant, _competencia, NULL, 'gerar', _idempotency_key,
    v_request_hash, v_request, v_result, v_actor
  );
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.gerar_folha_competencia(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_folha_competencia(date, text) TO authenticated;
