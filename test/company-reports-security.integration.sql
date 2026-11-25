-- Run transactionally: fixtures and their audit events are rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
 t uuid:=gen_random_uuid(); other_t uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
 supplier uuid; other_supplier uuid; result jsonb; n integer;
BEGIN
 INSERT INTO public.tenants(id,nome,slug) VALUES(t,'Empresa relatório teste','report-company-'||t),(other_t,'Outra empresa teste','report-company-'||other_t);
 INSERT INTO auth.users(id) VALUES(a),(m);
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role,enabled,is_active) VALUES(t,a,'admin',true,true),(t,m,'member',true,true);
 INSERT INTO public.fornecedores(tenant_id,nome) VALUES(t,'Fornecedor teste') RETURNING id INTO supplier;
 INSERT INTO public.fornecedores(tenant_id,nome) VALUES(other_t,'Fornecedor de outra empresa') RETURNING id INTO other_supplier;
 INSERT INTO public.pedidos_compra(tenant_id,numero,fornecedor_id,status,data_pedido,valor_total,criado_por)
 VALUES(t,123,supplier,'rascunho',current_date,50,a),(other_t,124,other_supplier,'rascunho',current_date,70,a);
 INSERT INTO public.contas_pagar(tenant_id,descricao,valor,vencimento) VALUES(t,'Despesa teste',40,current_date),(other_t,'Outra despesa',90,current_date);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 result:=public.consultar_diretorio_pedidos_compra(NULL,'all',1,25);
 IF (result->>'total')::integer<>1 OR (result->'items'->0->>'valor_total')::numeric<>50 THEN RAISE EXCEPTION 'TEST purchase isolation failed: %',result; END IF;
 result:=public.consultar_diretorio_contas_pagar(NULL,NULL,NULL,1,'todos',25);
 IF (result->>'total')::integer<>1 OR (result->'items'->0->>'valor')::numeric<>40 THEN RAISE EXCEPTION 'TEST payable isolation failed: %',result; END IF;
 SELECT count(*) INTO n FROM public.audit_events WHERE tenant_id=t;
 IF n=0 THEN RAISE EXCEPTION 'TEST admin audit visibility failed'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub',m::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',m,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.audit_events WHERE tenant_id=t;
 IF n<>0 THEN RAISE EXCEPTION 'TEST non-admin can read audit events'; END IF;
 BEGIN
   PERFORM public.consultar_diretorio_pedidos_compra(NULL,'all',1,25);
   RAISE EXCEPTION 'TEST unauthorized user can read purchases';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'Acesso ao estoque não autorizado' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.consultar_diretorio_contas_pagar(NULL,NULL,NULL,1,'todos',25);
   RAISE EXCEPTION 'TEST unauthorized user can read payables';
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM <> 'Sem permissão para consultar contas a pagar' THEN RAISE; END IF;
 END;
 EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;
SELECT 'Company isolation and purchase/audit permissions passed' AS result;
