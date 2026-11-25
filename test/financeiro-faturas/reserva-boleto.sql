\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);
INSERT INTO public.configuracoes_pagamento_cliente VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','boleto','faturado');
SET ROLE authenticated;
SELECT public.reservar_boleto_fatura((SELECT fatura_id FROM public.lancamentos WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),current_date+5);
SELECT public.reservar_boleto_fatura((SELECT fatura_id FROM public.lancamentos WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),current_date+5);
DO $$ DECLARE blocked boolean := false; invoice uuid; BEGIN
 SELECT fatura_id INTO invoice FROM public.lancamentos WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 BEGIN PERFORM public.registrar_recebimento_fatura(invoice,115,current_date,'pix',null,'teste-reserva-bloqueio'); EXCEPTION WHEN OTHERS THEN blocked := true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Aceitou pagamento enquanto boleto estava reservado'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.asaas_charges(id,tenant_id,cliente_id,status,value,billing_type,asaas_id,due_date,bank_slip_url) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PENDING',115,'BOLETO','pay_fake_02',current_date+5,'https://example.com/boleto.pdf');
SET ROLE authenticated;
SELECT public.vincular_boleto_fatura((SELECT fatura_id FROM public.lancamentos WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'dddddddd-dddd-4ddd-8ddd-dddddddddddd','123456789');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.faturas WHERE cliente_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND (cobranca_reservada_em IS NOT NULL OR asaas_charge_id IS DISTINCT FROM 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid)) THEN RAISE EXCEPTION 'Boleto não foi vinculado'; END IF; END $$;
