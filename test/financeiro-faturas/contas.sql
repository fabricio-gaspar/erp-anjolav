\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','industrial',false);
DO $$ DECLARE account record; invoice record; BEGIN
 SELECT * INTO invoice FROM public.faturas WHERE id='33333333-3333-4333-8333-333333333333';
 SELECT * INTO account FROM public.v_contas_receber WHERE id=invoice.id AND origem='fatura';
 IF account.valor_recebido IS DISTINCT FROM invoice.valor_recebido OR account.status <> 'parcial' THEN RAISE EXCEPTION 'Conta a receber não reflete o pagamento parcial'; END IF;
END $$;
