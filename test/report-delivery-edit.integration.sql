\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
  t uuid := gen_random_uuid(); a uuid := gen_random_uuid(); customer uuid; product uuid; item_id uuid;
  order_id uuid := gen_random_uuid(); address_id uuid; result jsonb; items jsonb;
BEGIN
  INSERT INTO public.tenants(id,nome,slug) VALUES(t,'Edit report test','edit-report-'||t);
  INSERT INTO auth.users(id) VALUES(a);
  INSERT INTO public.tenant_memberships(tenant_id,user_id,role,enabled,is_active) VALUES(t,a,'admin',true,true);
  INSERT INTO public.clientes(tenant_id,razao_social,classificacao) VALUES(t,'Cliente teste','residencial') RETURNING id INTO customer;
  INSERT INTO public.enderecos_clientes(tenant_id,cliente_id,tipo,nome,logradouro,numero,cidade,uf,latitude,longitude,ativo) VALUES(t,customer,'entrega','Teste','Rua teste','1','São Paulo','SP',-23.5,-46.6,true) RETURNING id INTO address_id;
  INSERT INTO public.pdv_regras_comerciais(tenant_id,area,delivery_pricing_model,delivery_fee_base,delivery_fee_per_km) VALUES(t,'residencial','fixo',7,2);
  INSERT INTO public.configuracoes_gerais(tenant_id,endereco_latitude,endereco_longitude) VALUES(t,-23.6,-46.6);
  INSERT INTO public.produtos(tenant_id,nome,preco,unidade,unidade_negocio) VALUES(t,'Item teste',20,'peca','ID2') RETURNING id INTO product;
  INSERT INTO public.ordens_servico(id,tenant_id,numero,cliente_id,origem,condicao_pagamento,valor_total,valor_pago,status_pagamento,status,entrega_modalidade,taxa_entrega,urgente,percentual_urgencia,data_retirada)
    VALUES(order_id,t,'REPORT-EDIT',customer,'residencial','retirada',27,0,'pendente','retirada','entrega',5,true,10,current_date);
  INSERT INTO public.itens_ordem_servico(tenant_id,ordem_servico_id,produto_id,quantidade,preco_unitario,subtotal)
    VALUES(t,order_id,product,1,20,20) RETURNING id INTO item_id;
  items := jsonb_build_array(jsonb_build_object('id',item_id,'produto_id',product,'quantidade',1,'preco_unitario',20));
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  result := public.editar_ordem_servico_pdv(order_id,'{}'::jsonb,items,'teste de edição');
  IF (result->>'total')::numeric <> 27 THEN RAISE EXCEPTION 'TEST fee or urgency was omitted: %',result; END IF;
  result := public.editar_ordem_servico_pdv(order_id,'{"entrega_modalidade":"balcao"}'::jsonb,items,'teste de edição');
  IF (result->>'total')::numeric <> 22 THEN RAISE EXCEPTION 'TEST pickup still has a delivery fee: %',result; END IF;
  result := public.editar_ordem_servico_pdv(order_id,jsonb_build_object('entrega_modalidade','entrega','endereco_id',address_id),items,'teste de edição');
  IF (result->>'total')::numeric <> 29 THEN RAISE EXCEPTION 'TEST recalculated delivery fee incorrect: %',result; END IF;
  BEGIN
    PERFORM public.cotar_entrega_edicao_rol(order_id,gen_random_uuid());
    RAISE EXCEPTION 'TEST accepted address of another customer';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Selecione um endereço ativo deste cliente' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  UPDATE public.pdv_regras_comerciais SET delivery_pricing_model='km' WHERE tenant_id=t;
  EXECUTE 'SET LOCAL ROLE authenticated';
  result := public.cotar_entrega_edicao_rol(order_id,address_id);
  IF (result->>'distanceKm')::numeric < 11 OR (result->>'distanceKm')::numeric > 12
     OR (result->>'fee')::numeric < 29 OR (result->>'fee')::numeric > 31 THEN
    RAISE EXCEPTION 'TEST kilometer quote incorrect: %',result;
  END IF;
  EXECUTE 'RESET ROLE';
  IF (SELECT valor_total FROM public.ordens_servico WHERE id=order_id)<>29 THEN RAISE EXCEPTION 'TEST persisted order total incorrect'; END IF;
  INSERT INTO public.pdv_pagamentos(tenant_id,ordem_servico_id,cliente_id,metodo,status,valor,provedor,idempotency_key,confirmado_em,valor_recebido)
    VALUES(t,order_id,customer,'DINHEIRO','CONFIRMADO',10,'MANUAL','edit-pay-'||order_id,now(),10);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.editar_ordem_servico_pdv(order_id,'{"entrega_modalidade":"balcao"}'::jsonb,items,'teste de edição');
    RAISE EXCEPTION 'TEST altered a paid total';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'O total atual não pode ser recalculado enquanto houver pagamento confirmado' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;
SELECT 'Delivery fee and urgency preserved and recalculated on edit' AS result;
