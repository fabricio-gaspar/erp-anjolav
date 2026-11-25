\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
SELECT set_config('test.tenant','11111111-1111-4111-8111-111111111111',false),set_config('test.user','22222222-2222-4222-8222-222222222222',false),set_config('test.access','yes',false),set_config('test.area','central',false);
INSERT INTO public.ordens_servico(id,tenant_id,cliente_id,numero,data_retirada,origem,condicao_pagamento,status,valor_total,valor_pago,status_pagamento) VALUES
('90000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','FAT-1',current_date,'industrial','faturado','lavagem',100,0,'pendente'),
('90000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','LOJA-1',current_date,'residencial','retirada','lavagem',100,0,'pendente');
SET ROLE authenticated;
SELECT public.dar_baixa_rol_pdv('90000000-0000-4000-8000-000000000001');
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN PERFORM public.dar_baixa_rol_pdv('90000000-0000-4000-8000-000000000002'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Entregou ROL do balcão sem recebimento confirmado'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.pdv_pagamentos(id,tenant_id,ordem_servico_id,status,valor) VALUES (gen_random_uuid(),'11111111-1111-4111-8111-111111111111','90000000-0000-4000-8000-000000000002','EM_REVISAO',100);
SET ROLE authenticated;
DO $$ DECLARE blocked boolean:=false; BEGIN
 BEGIN PERFORM public.dar_baixa_rol_pdv('90000000-0000-4000-8000-000000000002'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Pagamento em revisão foi considerado confirmado'; END IF;
END $$;
RESET ROLE;
UPDATE public.pdv_pagamentos SET status='CONFIRMADO' WHERE ordem_servico_id='90000000-0000-4000-8000-000000000002';
SET ROLE authenticated;
SELECT public.dar_baixa_rol_pdv('90000000-0000-4000-8000-000000000002');
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.ordens_servico WHERE id IN ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002') AND status<>'entregue') OR (SELECT status_pagamento FROM public.ordens_servico WHERE id='90000000-0000-4000-8000-000000000001')<>'pendente' THEN RAISE EXCEPTION 'Entrega alterou o pagamento ou não foi concluída'; END IF; END $$;
