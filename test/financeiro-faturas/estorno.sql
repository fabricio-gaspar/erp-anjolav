\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);
SET ROLE authenticated;
SELECT public.estornar_recebimento_fatura((SELECT id FROM public.fatura_recebimentos WHERE idempotency_key='fixture-payment-0002'),'Correção teste','fixture-reversal-0001');
SELECT public.estornar_recebimento_fatura((SELECT id FROM public.fatura_recebimentos WHERE idempotency_key='fixture-payment-0002'),'Correção teste','fixture-reversal-0001');
RESET ROLE;
DO $$ BEGIN IF (SELECT valor_recebido FROM public.faturas LIMIT 1)<>1000 OR (SELECT status FROM public.faturas LIMIT 1)<>'relatorio_gerado' OR EXISTS(SELECT 1 FROM public.ordens_servico WHERE status_pagamento='pago') OR (SELECT count(*) FROM public.ordens_servico WHERE status='entregue')<>2 THEN RAISE EXCEPTION 'Estorno incorreto'; END IF; END $$;
