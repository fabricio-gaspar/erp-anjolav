\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);
INSERT INTO public.faturas(id,tenant_id,cliente_id,valor_total,status) VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',2000,'relatorio_gerado');
INSERT INTO public.ordens_servico(id,tenant_id,cliente_id,origem,condicao_pagamento,status,valor_total,valor_pago,status_pagamento) VALUES
('50000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','industrial','faturado','entregue',500,0,'pendente'),
('50000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','industrial','faturado','lavagem',700,0,'pendente'),
('50000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','industrial','faturado','entregue',800,0,'pendente');
INSERT INTO public.lancamentos(id,tenant_id,fatura_id,ordem_servico_id,valor_total) SELECT gen_random_uuid(),tenant_id,'33333333-3333-4333-8333-333333333333',id,valor_total FROM public.ordens_servico;
SET ROLE authenticated;
SELECT public.registrar_recebimento_fatura('33333333-3333-4333-8333-333333333333',1000,current_date,'pix',null,'fixture-payment-0001');
SELECT public.registrar_recebimento_fatura('33333333-3333-4333-8333-333333333333',1000,current_date,'pix',null,'fixture-payment-0001');
RESET ROLE;
DO $$ BEGIN IF (SELECT valor_recebido FROM public.faturas LIMIT 1)<>1000 OR EXISTS(SELECT 1 FROM public.ordens_servico WHERE status_pagamento='pago') OR (SELECT count(*) FROM public.fatura_recebimentos)<>1 THEN RAISE EXCEPTION 'Parcial ou idempotência incorreta'; END IF; END $$;
SET ROLE authenticated;
SELECT public.registrar_recebimento_fatura('33333333-3333-4333-8333-333333333333',1000,current_date,'pix',null,'fixture-payment-0002');
RESET ROLE;
DO $$ BEGIN IF (SELECT status FROM public.faturas LIMIT 1)<>'pago' OR (SELECT count(*) FROM public.ordens_servico WHERE valor_pago=valor_total AND status_pagamento='pago')<>3 OR (SELECT count(*) FROM public.ordens_servico WHERE status='entregue')<>2 THEN RAISE EXCEPTION 'Quitação ou estado operacional incorreto'; END IF; END $$;
