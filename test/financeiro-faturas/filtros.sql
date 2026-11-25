\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);
SET ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result := public.consultar_faturas_faturamento_filtradas('industrial',current_date,current_date,1,25,'Cliente fictício','pendente');
 IF (result->>'total')::integer <> 1 OR (result->'items'->0->>'valor_total')::numeric <> 115 THEN RAISE EXCEPTION 'Filtro de fatura pendente incorreto'; END IF;
 result := public.consultar_faturas_faturamento_filtradas('industrial',current_date,current_date,1,25,'Cliente inexistente','todos');
 IF (result->>'total')::integer <> 0 THEN RAISE EXCEPTION 'Filtro de cliente incorreto'; END IF;
 result := public.consultar_faturas_faturamento_filtradas('industrial',current_date,current_date,1,25,'Cliente fictício','pago');
 IF (result->>'total')::integer <> 0 THEN RAISE EXCEPTION 'Filtro de situação incorreto'; END IF;
END $$;
RESET ROLE;
