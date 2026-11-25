\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
INSERT INTO public.asaas_charges(id,tenant_id,status,value,billing_type,asaas_id) VALUES ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','RECEIVED',2000,'BOLETO','pay_test_01');
INSERT INTO public.faturas(id,tenant_id,cliente_id,valor_total,status,asaas_charge_id) VALUES ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',2000,'relatorio_gerado','77777777-7777-4777-8777-777777777777');
INSERT INTO public.ordens_servico(id,tenant_id,cliente_id,origem,condicao_pagamento,status,valor_total,valor_pago,status_pagamento) VALUES
('80000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','industrial','faturado','entregue',1200,0,'pendente'),
('80000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','industrial','faturado','lavagem',800,0,'pendente');
INSERT INTO public.lancamentos(id,tenant_id,fatura_id,ordem_servico_id,valor_total) SELECT gen_random_uuid(),tenant_id,'66666666-6666-4666-8666-666666666666',id,valor_total FROM public.ordens_servico WHERE id::text LIKE '80000000%';
SET ROLE service_role;
SELECT public.conciliar_recebimento_fatura_asaas('77777777-7777-4777-8777-777777777777','90000000-0000-4000-8000-000000000001','PAYMENT_RECEIVED','RECEIVED',current_date);
SELECT public.conciliar_recebimento_fatura_asaas('77777777-7777-4777-8777-777777777777','90000000-0000-4000-8000-000000000002','PAYMENT_RECEIVED','RECEIVED',current_date);
RESET ROLE;
DO $$ BEGIN IF (SELECT valor_recebido FROM public.faturas WHERE id='66666666-6666-4666-8666-666666666666')<>2000 OR (SELECT count(*) FROM public.ordens_servico WHERE id::text LIKE '80000000%' AND status_pagamento='pago')<>2 OR (SELECT count(*) FROM public.fatura_recebimentos WHERE fatura_id='66666666-6666-4666-8666-666666666666')<>1 THEN RAISE EXCEPTION 'Conciliação duplicada ou incorreta'; END IF; END $$;
UPDATE public.asaas_charges SET status='REFUNDED' WHERE id='77777777-7777-4777-8777-777777777777';
SET ROLE service_role;
SELECT public.conciliar_recebimento_fatura_asaas('77777777-7777-4777-8777-777777777777','90000000-0000-4000-8000-000000000003','PAYMENT_REFUNDED','REFUNDED',current_date);
RESET ROLE;
DO $$ BEGIN IF (SELECT valor_recebido FROM public.faturas WHERE id='66666666-6666-4666-8666-666666666666')<>0 OR EXISTS(SELECT 1 FROM public.ordens_servico WHERE id::text LIKE '80000000%' AND status_pagamento='pago') OR (SELECT count(*) FROM public.ordens_servico WHERE id::text LIKE '80000000%' AND status='entregue')<>1 THEN RAISE EXCEPTION 'Estorno do provedor incorreto'; END IF; END $$;
