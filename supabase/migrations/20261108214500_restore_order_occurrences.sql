-- One occurrence per order and request key, even after a retry or double click.
CREATE UNIQUE INDEX IF NOT EXISTS historico_producao_ocorrencia_key_idx
ON public.historico_producao
  (tenant_id, ordem_servico_id, (dados_formulario->>'idempotency_key'))
WHERE dados_formulario ? 'idempotency_key';

CREATE OR REPLACE FUNCTION public.registrar_ocorrencia_producao(
  _ordem_ids uuid[], _etapa_esperada text, _funcionario_id uuid,
  _ocorrencia text, _nova_previsao date, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_ids uuid[];
  v_order record;
  v_count integer := 0;
  v_existing_count integer;
  v_same_request boolean;
  v_area text;
  v_request jsonb;
  v_capacity jsonb;
  v_new_load numeric := 0;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
    OR NOT private.has_any_module_access(ARRAY['ordens', 'producao']::text[])
  THEN RAISE EXCEPTION 'Acesso à operação do ROL não autorizado'; END IF;
  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_ids
  FROM unnest(_ordem_ids) AS id WHERE id IS NOT NULL;
  IF coalesce(array_length(v_ids, 1), 0) NOT BETWEEN 1 AND 100
    OR nullif(trim(_ocorrencia), '') IS NULL
    OR char_length(trim(_ocorrencia)) NOT BETWEEN 3 AND 2000
    OR nullif(trim(_idempotency_key), '') IS NULL
    OR char_length(_idempotency_key) > 200
    OR nullif(trim(_etapa_esperada), '') IS NULL
  THEN RAISE EXCEPTION 'Dados da ocorrência inválidos'; END IF;
  IF _nova_previsao IS NOT NULL AND _nova_previsao < current_date THEN
    RAISE EXCEPTION 'A nova previsão não pode estar no passado';
  END IF;
  IF _funcionario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = _funcionario_id AND f.tenant_id = v_tenant AND f.ativo
  ) THEN RAISE EXCEPTION 'Funcionário fora do escopo autorizado'; END IF;

  v_request := jsonb_build_object(
    'ordem_ids', to_jsonb(v_ids), 'etapa', _etapa_esperada,
    'funcionario_id', _funcionario_id, 'ocorrencia', trim(_ocorrencia),
    'nova_previsao', _nova_previsao, 'actor_id', auth.uid()
  );
  SELECT count(*), bool_and(h.dados_formulario->'request' = v_request)
    INTO v_existing_count, v_same_request
  FROM public.historico_producao h
  WHERE h.tenant_id = v_tenant
    AND h.dados_formulario->>'idempotency_key' = _idempotency_key;
  IF v_existing_count > 0 THEN
    IF v_existing_count = array_length(v_ids, 1) AND v_same_request THEN
      RETURN jsonb_build_object('orderCount', v_existing_count, 'idempotent', true);
    END IF;
    RAISE EXCEPTION 'Chave de repetição reutilizada com dados diferentes';
  END IF;

  FOR v_order IN
    SELECT o.id, o.status, o.origem, o.data_previsao_entrega
    FROM public.ordens_servico o
    WHERE o.id = ANY(v_ids) AND o.tenant_id = v_tenant
    ORDER BY o.id FOR UPDATE
  LOOP
    v_count := v_count + 1;
    IF v_order.status IS DISTINCT FROM _etapa_esperada THEN
      RAISE EXCEPTION 'A etapa do ROL mudou. Reabra a ficha antes de registrar';
    END IF;
    IF v_order.status = 'cancelada' THEN
      RAISE EXCEPTION 'Não é possível registrar ocorrência em ROL cancelado';
    END IF;
    IF _nova_previsao IS NOT NULL AND v_order.status = 'entregue' THEN
      RAISE EXCEPTION 'Não é possível alterar a previsão de ROL entregue';
    END IF;
    IF v_area IS NULL THEN
      v_area := CASE WHEN lower(coalesce(v_order.origem, 'industrial'))
        IN ('residencial', 'loja') THEN 'residencial' ELSE 'industrial' END;
    ELSIF v_area IS DISTINCT FROM (CASE WHEN lower(coalesce(v_order.origem, 'industrial'))
        IN ('residencial', 'loja') THEN 'residencial' ELSE 'industrial' END) THEN
      RAISE EXCEPTION 'Selecione ROLs de uma única operação';
    END IF;
    IF NOT private.can_access_area(v_area) THEN
      RAISE EXCEPTION 'ROL fora da operação autorizada';
    END IF;
  END LOOP;
  IF v_count <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Um ou mais ROLs não foram encontrados nesta empresa';
  END IF;

  IF _nova_previsao IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      v_tenant::text || ':' || v_area || ':' || _nova_previsao::text, 0));
    SELECT coalesce(sum(i.quantidade), 0) INTO v_new_load
    FROM public.ordens_servico o
    JOIN public.itens_ordem_servico i
      ON i.ordem_servico_id = o.id AND i.tenant_id = o.tenant_id
    WHERE o.id = ANY(v_ids) AND o.tenant_id = v_tenant
      AND o.data_previsao_entrega IS DISTINCT FROM _nova_previsao;
    v_capacity := public.consultar_capacidade_pdv(v_tenant, v_area, _nova_previsao);
    IF coalesce((v_capacity->>'configured')::boolean, false)
      AND v_new_load > (v_capacity->>'available')::numeric THEN
      RAISE EXCEPTION 'Capacidade insuficiente na nova previsão';
    END IF;
    UPDATE public.ordens_servico o
    SET data_previsao_entrega = _nova_previsao
    WHERE o.id = ANY(v_ids) AND o.tenant_id = v_tenant
      AND o.data_previsao_entrega IS DISTINCT FROM _nova_previsao;
  END IF;

  INSERT INTO public.historico_producao (
    tenant_id, ordem_servico_id, etapa_anterior, etapa_nova,
    funcionario_id, observacoes, dados_formulario
  )
  SELECT v_tenant, o.id, o.status, o.status, _funcionario_id,
    trim(_ocorrencia), jsonb_build_object(
      'tipo', 'ocorrencia', 'idempotency_key', _idempotency_key,
      'request', v_request, 'actor_id', auth.uid(),
      'nova_previsao', _nova_previsao
    )
  FROM public.ordens_servico o
  WHERE o.id = ANY(v_ids) AND o.tenant_id = v_tenant;
  RETURN jsonb_build_object('orderCount', v_count, 'idempotent', false);
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_ocorrencia_producao(
  uuid[], text, uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ocorrencia_producao(
  uuid[], text, uuid, text, date, text) TO authenticated;
