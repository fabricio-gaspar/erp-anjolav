-- Run only in an isolated test database; all fixture data is rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
  t uuid := gen_random_uuid(); a uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  employee uuid; driver uuid; vehicle uuid; customer uuid; product uuid; item_id uuid;
  order_id uuid := gen_random_uuid(); route_id uuid; stop_id uuid;
  result jsonb; retry jsonb; prefix text := 'report-route-' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public.tenants(id,nome,slug) VALUES(t,'Route report test','report-route-'||t);
  INSERT INTO auth.users(id) VALUES(a),(d);
  INSERT INTO public.tenant_memberships(tenant_id,user_id,role,enabled,is_active)
    VALUES(t,a,'admin',true,true),(t,d,'member',true,true);
  INSERT INTO public.funcionarios(tenant_id,user_id,nome,cargo,login,ativo)
    VALUES(t,d,'Motorista teste','motorista','route-driver-'||d,true) RETURNING id INTO employee;
  INSERT INTO public.modulo_permissoes(tenant_id,funcionario_id,modulo_key,tem_acesso)
    VALUES(t,employee,'agenda',true);
  INSERT INTO public.area_permissoes(tenant_id,user_id,area) VALUES(t,d,'residencial');
  INSERT INTO public.motoristas(tenant_id,funcionario_id,nome,ativo)
    VALUES(t,employee,'Motorista teste',true) RETURNING id INTO driver;
  INSERT INTO public.veiculos(tenant_id,placa,modelo,ativo) VALUES(t,'RPT1A99','Teste',true) RETURNING id INTO vehicle;
  INSERT INTO public.clientes(tenant_id,razao_social,classificacao) VALUES(t,'Cliente teste','residencial') RETURNING id INTO customer;
  INSERT INTO public.enderecos_clientes(tenant_id,cliente_id,tipo,nome,logradouro,numero,bairro,cidade,uf)
    VALUES(t,customer,'entrega','Entrega','Rua teste','1','Centro','São Paulo','SP');
  INSERT INTO public.produtos(tenant_id,nome,preco,unidade,unidade_negocio)
    VALUES(t,'Item teste',20,'peca','ID2') RETURNING id INTO product;
  INSERT INTO public.ordens_servico(id,tenant_id,numero,cliente_id,origem,condicao_pagamento,valor_total,valor_pago,status_pagamento,status,status_logistica,entrega_modalidade)
    VALUES(order_id,t,'REPORT-DELIVERY',customer,'residencial','retirada',20,0,'pendente','expedicao','aguardando_entrega','entrega');
  INSERT INTO public.itens_ordem_servico(tenant_id,ordem_servico_id,produto_id,quantidade,preco_unitario,subtotal)
    VALUES(t,order_id,product,1,20,20) RETURNING id INTO item_id;

  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  result := public.criar_rota_planejada(current_date,driver,vehicle,100,NULL,prefix||':create','domestico');
  route_id := (result->>'routeId')::uuid;
  result := public.adicionar_parada_planejada(route_id,'entrega',customer,order_id,NULL,NULL,NULL,NULL,prefix||':stop');
  stop_id := (result->>'stopId')::uuid;
  PERFORM public.iniciar_rota_planejada(route_id,100,prefix||':start');

  PERFORM set_config('request.jwt.claim.sub',d::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',d,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.registrar_evento_parada_rota(stop_id,0,'CHEGADA',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,prefix||':arrival');
  BEGIN
    PERFORM public.registrar_evento_parada_rota(stop_id,1,'CONCLUIDA',NULL,NULL,'Recebedor','RG',NULL,NULL,NULL,NULL,prefix||':unready');
    RAISE EXCEPTION 'TEST expected unpositioned items rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Todos os itens devem estar disponibilizados e sem pendências de qualidade' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  UPDATE public.itens_ordem_servico SET posicao_prateleira='A-1' WHERE id=item_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.registrar_evento_parada_rota(stop_id,1,'CONCLUIDA',NULL,NULL,'Recebedor','RG',NULL,NULL,NULL,NULL,prefix||':unpaid');
    RAISE EXCEPTION 'TEST expected unpaid delivery rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Pedido com saldo exige autorização explícita para entrega' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  IF EXISTS (SELECT 1 FROM public.entregas_pedido WHERE ordem_servico_id=order_id) THEN RAISE EXCEPTION 'TEST rejected delivery persisted'; END IF;
  UPDATE public.ordens_servico SET status_pagamento='pago',valor_pago=20 WHERE id=order_id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  result := public.registrar_evento_parada_rota(stop_id,1,'CONCLUIDA',NULL,NULL,'Recebedor','RG',NULL,NULL,NULL,NULL,prefix||':complete');
  retry := public.registrar_evento_parada_rota(stop_id,1,'CONCLUIDA',NULL,NULL,'Recebedor','RG',NULL,NULL,NULL,NULL,prefix||':complete');
  IF result->>'stopStatus'<>'realizada' OR retry->>'idempotent'<>'true' THEN RAISE EXCEPTION 'TEST route event or retry failed'; END IF;
  EXECUTE 'RESET ROLE';
  IF (SELECT status FROM public.ordens_servico WHERE id=order_id)<>'entregue'
    OR (SELECT quantidade_entregue FROM public.itens_ordem_servico WHERE id=item_id)<>1
    OR (SELECT count(*) FROM public.entregas_pedido WHERE ordem_servico_id=order_id)<>1
    OR (SELECT entrega_id FROM public.paradas_rota WHERE id=stop_id) IS NULL THEN
    RAISE EXCEPTION 'TEST item delivery and route event were not recorded together';
  END IF;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
  result := public.finalizar_rota_planejada(route_id,125,prefix||':finish');
  IF (SELECT km_final-km_inicial FROM public.rotas_entrega WHERE id=route_id)<>25 THEN
    RAISE EXCEPTION 'TEST actual mileage differs from odometer readings';
  END IF;
END;
$test$;
ROLLBACK;
SELECT 'Atomic route delivery, payment validation, idempotence and mileage passed' AS result;
