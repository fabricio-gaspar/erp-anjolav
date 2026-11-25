\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','residencial',false);
SET ROLE authenticated;
DO $$ DECLARE refused boolean := false; BEGIN
  BEGIN PERFORM public.registrar_recebimento_fatura('33333333-3333-4333-8333-333333333333',10,current_date,'pix',null,'test-no-area-0001'); EXCEPTION WHEN OTHERS THEN refused := true; END;
  IF NOT refused THEN RAISE EXCEPTION 'Aceitou recebimento sem acesso à operação'; END IF;
END $$;
SELECT set_config('test.area','industrial',false),set_config('test.access','no',false);
DO $$ DECLARE refused boolean := false; BEGIN
  BEGIN PERFORM public.registrar_recebimento_fatura('33333333-3333-4333-8333-333333333333',10,current_date,'pix',null,'test-no-permission-0001'); EXCEPTION WHEN OTHERS THEN refused := true; END;
  IF NOT refused THEN RAISE EXCEPTION 'Aceitou recebimento sem permissão'; END IF;
END $$;
SELECT set_config('test.access','yes',false);
DO $$ DECLARE refused boolean := false; BEGIN
  BEGIN PERFORM public.registrar_recebimento_fatura('33333333-3333-4333-8333-333333333333',3000,current_date,'pix',null,'test-overpayment-0001'); EXCEPTION WHEN OTHERS THEN refused := true; END;
  IF NOT refused THEN RAISE EXCEPTION 'Aceitou valor acima do saldo'; END IF;
END $$;
RESET ROLE;
