-- Keep delivery KM origin scoped to the tenant and include delivery charges
-- in billed customer accounts. Collection and counter pickup remain free.
DO $migration$
DECLARE
  v_function_definition text;
  v_location_needle text := E'FROM public.configuracoes_gerais\n      LIMIT 1;';
  v_location_replacement text := E'FROM public.configuracoes_gerais\n      WHERE tenant_id = v_client.tenant_id\n      LIMIT 1;';
  v_billed_guard text := ' OR v_fee <> 0) THEN RAISE EXCEPTION ''No atendimento faturado utilize os preços da tabela do cliente''; END IF;';
BEGIN
  SELECT pg_get_functiondef(
    'public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean)'::regprocedure
  ) INTO v_function_definition;

  IF position(v_location_needle IN v_function_definition) > 0 THEN
    v_function_definition := replace(v_function_definition, v_location_needle, v_location_replacement);
    EXECUTE v_function_definition;
  ELSIF position('WHERE tenant_id = v_client.tenant_id' IN v_function_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a consulta das coordenadas de origem do delivery';
  END IF;

  SELECT pg_get_functiondef(
    'public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)'::regprocedure
  ) INTO v_function_definition;

  IF position(v_billed_guard IN v_function_definition) > 0 THEN
    v_function_definition := replace(v_function_definition, v_billed_guard,
      ') THEN RAISE EXCEPTION ''No atendimento faturado utilize os preços da tabela do cliente''; END IF;');
    EXECUTE v_function_definition;
  ELSIF position('No atendimento faturado utilize os preços da tabela do cliente' IN v_function_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível localizar a validação comercial do atendimento faturado';
  END IF;
END;
$migration$;
