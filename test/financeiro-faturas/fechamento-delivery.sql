\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);
INSERT INTO public.clientes VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Cliente fictício',null,null,null,true);
INSERT INTO public.ordens_servico(id,tenant_id,cliente_id,numero,data_retirada,origem,condicao_pagamento,status,valor_total,valor_pago,status_pagamento,taxa_entrega) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TESTE-1',current_date,'industrial','faturado','entregue',115,0,'pendente',15);
INSERT INTO public.lancamentos(id,tenant_id,ordem_servico_id,valor_total,status) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',115,'pendente');
INSERT INTO public.itens_lancamento VALUES (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Serviço fictício',1,'un',100,100);
SET ROLE authenticated;
SELECT public.fechar_faturamento_rols('industrial','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,current_date,ARRAY['cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid],'test-delivery-billing-0001',null);
RESET ROLE;
DO $$ DECLARE f public.faturas%rowtype; BEGIN SELECT * INTO f FROM public.faturas WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF f.operation_type <> 'industrial' OR f.valor_total<>115 OR jsonb_array_length(f.itens_snapshot)<>2 OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(f.itens_snapshot) i WHERE i->>'produto'='Taxa de delivery' AND (i->>'valor_total')::numeric=15) THEN RAISE EXCEPTION 'Operação, taxa de delivery ou total incorreto'; END IF;
END $$;
