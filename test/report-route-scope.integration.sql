-- Integration test for acceptance scenario A17: planned route, manual ordering,
-- failed attempt, authorized address correction, rescheduling and physical proof.
\set ON_ERROR_STOP on

BEGIN;
DO $test$
DECLARE
  tenant_fixture uuid := gen_random_uuid();
  foreign_tenant uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  employee uuid;
  outsider_employee uuid;
  driver uuid;
  vehicle uuid;
  customer uuid;
  foreign_customer uuid;
  appointment uuid;
  order_id uuid := gen_random_uuid();
  foreign_order uuid := gen_random_uuid();
  product uuid;
  order_item uuid;
  route_id uuid;
  second_route uuid;
  industrial_route uuid;
  pickup_stop uuid;
  delivery_stop uuid;
  delivery_id uuid;
  result jsonb;
  retry jsonb;
  key_prefix text := 'test-route-' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public.tenants(id, nome, slug)
  VALUES
    (tenant_fixture, 'Route rollback test', 'route-test-' || tenant_fixture),
    (foreign_tenant, 'Route foreign tenant', 'route-foreign-' || foreign_tenant);
  INSERT INTO auth.users(id) VALUES (actor), (outsider);
  INSERT INTO public.tenant_memberships(tenant_id, user_id, role, enabled, is_active)
  VALUES
    (tenant_fixture, actor, 'admin', true, true),
    (tenant_fixture, outsider, 'member', true, true);
  INSERT INTO public.funcionarios(tenant_id, user_id, nome, cargo, login, ativo)
  VALUES (
    tenant_fixture, actor, 'Route test driver', 'motorista',
    'route-test-' || actor, true
  ) RETURNING id INTO employee;
  -- The employee sync trigger normalizes a linked membership to member. This
  -- fixture needs both the explicit agenda grant and admin authority to prove
  -- the restricted address-correction path.
  INSERT INTO public.modulo_permissoes(
    tenant_id, funcionario_id, modulo_key, tem_acesso
  ) VALUES (tenant_fixture, employee, 'agenda', true);
  UPDATE public.tenant_memberships
  SET role = 'admin'
  WHERE tenant_id = tenant_fixture AND user_id = actor;
  INSERT INTO public.funcionarios(tenant_id, user_id, nome, cargo, login, ativo)
  VALUES (
    tenant_fixture, outsider, 'Route test outsider', 'atendente',
    'route-outsider-' || outsider, true
  ) RETURNING id INTO outsider_employee;
  INSERT INTO public.modulo_permissoes(
    tenant_id, funcionario_id, modulo_key, tem_acesso
  ) VALUES (tenant_fixture, outsider_employee, 'agenda', true);
  INSERT INTO public.area_permissoes(tenant_id, user_id, area) VALUES (tenant_fixture, outsider, 'residencial');
  INSERT INTO public.motoristas(tenant_id, funcionario_id, nome, ativo)
  VALUES (tenant_fixture, employee, 'Route test driver', true)
  RETURNING id INTO driver;
  INSERT INTO public.veiculos(tenant_id, placa, modelo, ativo)
  VALUES (tenant_fixture, 'TST1A17', 'Van A17', true)
  RETURNING id INTO vehicle;
  INSERT INTO public.clientes(tenant_id, razao_social, classificacao)
  VALUES (tenant_fixture, 'Route test customer', 'residencial')
  RETURNING id INTO customer;
  INSERT INTO public.enderecos_clientes(
    tenant_id, cliente_id, tipo, nome, cep, logradouro, numero, bairro, cidade, uf
  ) VALUES (
    tenant_fixture, customer, 'principal', 'Matriz', '01001000', 'Rua Original', '10',
    'Centro', 'São Paulo', 'SP'
  );
  INSERT INTO public.enderecos_clientes(
    tenant_id, cliente_id, tipo, nome, cep, logradouro, numero, bairro, cidade, uf
  ) VALUES
    (tenant_fixture, customer, 'coleta', 'Doca de coleta', '01001001', 'Rua Coleta', '20', 'Centro', 'São Paulo', 'SP'),
    (tenant_fixture, customer, 'entrega', 'Doca de entrega', '01001002', 'Rua Entrega', '30', 'Centro', 'São Paulo', 'SP');
  INSERT INTO public.agendamentos(
    tenant_id, cliente_id, tipo, data, horario, status, motorista_id
  ) VALUES (
    tenant_fixture, customer, 'retirada', current_date, '09:00', 'agendado', driver
  ) RETURNING id INTO appointment;
  INSERT INTO public.produtos(tenant_id, nome, preco, unidade, unidade_negocio)
  VALUES (tenant_fixture, 'Volume de teste', 20, 'peca', 'ID2')
  RETURNING id INTO product;
  INSERT INTO public.ordens_servico(
    id, tenant_id, numero, cliente_id, origem, condicao_pagamento,
    valor_total, valor_pago, status_pagamento, status, status_qualidade,
    status_logistica
  ) VALUES (
    order_id, tenant_fixture, 'ROUTE-A17', customer, 'residencial', 'retirada',
    20, 20, 'pago', 'expedicao', 'aprovada', 'aguardando_entrega'
  );
  INSERT INTO public.itens_ordem_servico(
    tenant_id, ordem_servico_id, produto_id, quantidade, preco_unitario,
    subtotal, quantidade_aprovada
  ) VALUES (
    tenant_fixture, order_id, product, 1, 20, 20, 1
  ) RETURNING id INTO order_item;

  INSERT INTO public.clientes(tenant_id, razao_social, classificacao)
  VALUES (foreign_tenant, 'Foreign route customer', 'residencial')
  RETURNING id INTO foreign_customer;
  INSERT INTO public.ordens_servico(
    id, tenant_id, numero, cliente_id, origem, valor_total, valor_pago,
    status_pagamento, status
  ) VALUES (
    foreign_order, foreign_tenant, 'ROUTE-FOREIGN', foreign_customer,
    'residencial', 1, 1, 'pago', 'expedicao'
  );

  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );

  BEGIN
    PERFORM public.criar_rota_planejada(
      current_date, NULL, vehicle, 1000, NULL, key_prefix || ':missing-driver', 'domestico'
    );
    RAISE EXCEPTION 'TEST expected route assignment validation';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Informe motorista e veículo para a rota' THEN RAISE; END IF;
  END;

  UPDATE public.ordens_servico SET endereco_atendimento_snapshot = jsonb_build_object('logradouro','Rua Congelada','cidade','São Paulo') WHERE id = order_id;
  result := public.criar_rota_planejada(
    current_date, driver, vehicle, 1000, 'Rota da fixture A17',
    key_prefix || ':create', 'domestico'
  );
  route_id := (result->>'routeId')::uuid;
  retry := public.criar_rota_planejada(
    current_date, driver, vehicle, 1000, 'Rota da fixture A17',
    key_prefix || ':create', 'domestico'
  );
  IF retry->>'idempotent' <> 'true' OR retry->>'routeId' <> route_id::text THEN
    RAISE EXCEPTION 'TEST route creation was not idempotent: %', retry;
  END IF;
  BEGIN
    PERFORM public.criar_rota_planejada(
      current_date, driver, vehicle, 1001, 'Conteúdo diferente',
      key_prefix || ':create', 'domestico'
    );
    RAISE EXCEPTION 'TEST expected content-sensitive route idempotency rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'A chave de idempotência já pertence%' THEN RAISE; END IF;
  END;

  result := public.adicionar_parada_planejada(
    route_id, 'retirada', customer, NULL, appointment,
    '09:00', '10:00', 'Coletar dois volumes', key_prefix || ':pickup'
  );
  pickup_stop := (result->>'stopId')::uuid;
  result := public.adicionar_parada_planejada(
    route_id, 'entrega', customer, order_id, NULL,
    '14:00', '16:00', 'Entregar após conferência física', key_prefix || ':delivery-stop'
  );
  delivery_stop := (result->>'stopId')::uuid;

  IF (SELECT endereco_snapshot->>'logradouro' FROM public.paradas_rota WHERE id = pickup_stop) <> 'Rua Coleta'
     OR (SELECT endereco_snapshot->>'logradouro' FROM public.paradas_rota WHERE id = delivery_stop) <> 'Rua Congelada'
     OR (SELECT count(*) FROM public.paradas_rota WHERE rota_id = route_id) <> 2 THEN
    RAISE EXCEPTION 'TEST route stops did not select the matching typed address snapshot';
  END IF;
  BEGIN
    PERFORM public.adicionar_parada_planejada(
      route_id, 'entrega', foreign_customer, foreign_order, NULL,
      NULL, NULL, NULL, key_prefix || ':foreign'
    );
    RAISE EXCEPTION 'TEST expected foreign-tenant order rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Pedido inválido para esta empresa ou área' THEN RAISE; END IF;
  END;

  result := public.reordenar_paradas_rota(
    route_id, jsonb_build_array(delivery_stop, pickup_stop), key_prefix || ':reorder'
  );
  IF (SELECT ordem FROM public.paradas_rota WHERE id = delivery_stop) <> 1
     OR (SELECT ordem FROM public.paradas_rota WHERE id = pickup_stop) <> 2 THEN
    RAISE EXCEPTION 'TEST manual route ordering was not persisted';
  END IF;

  result := public.registrar_entrega_parcial_pedido(
    order_id,
    jsonb_build_array(jsonb_build_object('item_id', order_item, 'quantidade', 1)),
    'Recebedora da fixture', 'DOC-A17', 'Comprovante de itens da rota',
    false, NULL, employee, key_prefix || ':item-delivery'
  );
  delivery_id := (result->>'deliveryId')::uuid;

  retry := public.registrar_entrega_parcial_pedido(
    order_id, jsonb_build_array(jsonb_build_object('item_id', order_item, 'quantidade', 1)),
    'Recebedora da fixture', 'DOC-A17', 'Comprovante de itens da rota', false, NULL, employee, key_prefix || ':item-delivery');
  IF retry->>'idempotent' <> 'true' OR retry->>'deliveryId' <> delivery_id::text THEN
    RAISE EXCEPTION 'TEST completed delivery retry was not idempotent';
  END IF;
  result := public.criar_rota_planejada(current_date, driver, vehicle, 1000, 'Rota industrial', key_prefix || ':industrial', 'industrial');
  industrial_route := (result->>'routeId')::uuid;
  BEGIN
    PERFORM public.adicionar_parada_planejada(industrial_route, 'retirada', customer, NULL, appointment, NULL, NULL, NULL, key_prefix || ':mixed');
    RAISE EXCEPTION 'TEST mixed-operation stop should fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'A parada pertence a outra operação ou não tem operação identificada' THEN RAISE; END IF;
  END;

  result := public.criar_rota_planejada(
    current_date, driver, vehicle, 1000, 'Rota concorrente de recurso',
    key_prefix || ':second-route', 'domestico'
  );
  second_route := (result->>'routeId')::uuid;
  PERFORM public.adicionar_parada_planejada(
    second_route, 'retirada', customer, NULL, NULL,
    '17:00', '18:00', 'Parada para validar exclusividade',
    key_prefix || ':second-stop'
  );

  PERFORM set_config('request.jwt.claim.sub', outsider::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', outsider, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF EXISTS (SELECT 1 FROM public.rotas_entrega WHERE id=industrial_route) THEN
    RAISE EXCEPTION 'TEST industrial route leaked to domestic user';
  END IF;
  BEGIN
    PERFORM public.iniciar_rota_planejada(industrial_route, 1000, key_prefix || ':wrong-area');
    RAISE EXCEPTION 'TEST unauthorized area must not start route';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Rota não encontrada nesta empresa ou área' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  BEGIN
    PERFORM public.iniciar_rota_planejada(
      route_id, 1000, key_prefix || ':unauthorized-start'
    );
    RAISE EXCEPTION 'TEST expected non-driver route start rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Somente o motorista designado ou administrador pode iniciar a rota' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );

  result := public.iniciar_rota_planejada(
    route_id, 1000, key_prefix || ':start'
  );
  IF result->>'status' <> 'em_rota'
     OR (result->>'stopCount')::integer <> 2 THEN
    RAISE EXCEPTION 'TEST route did not start: %', result;
  END IF;
  BEGIN
    PERFORM public.iniciar_rota_planejada(
      second_route, 1000, key_prefix || ':resource-conflict'
    );
    RAISE EXCEPTION 'TEST expected active driver/vehicle conflict';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Motorista ou veículo já está em outra rota ativa' THEN RAISE; END IF;
  END;

  result := public.registrar_evento_parada_rota(
    pickup_stop, 0, 'ENDERECO_CORRIGIDO', 'Número corrigido após contato', NULL,
    NULL, NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'logradouro', 'Rua Corrigida', 'numero', '25', 'bairro', 'Centro',
      'cidade', 'São Paulo', 'uf', 'SP', 'cep', '01001000'
    ),
    key_prefix || ':address'
  );
  IF (result->>'version')::integer <> 1
     OR (SELECT endereco_snapshot->>'logradouro' FROM public.paradas_rota WHERE id = pickup_stop) <> 'Rua Corrigida'
     OR NOT EXISTS (
       SELECT 1 FROM public.rota_operacoes operation
       WHERE operation.parada_id = pickup_stop
         AND operation.tipo = 'ENDERECO_CORRIGIDO'
         AND operation.endereco_anterior->>'logradouro' = 'Rua Coleta'
         AND operation.endereco_novo->>'logradouro' = 'Rua Corrigida'
     ) THEN
    RAISE EXCEPTION 'TEST authorized address correction lost its history';
  END IF;
  PERFORM public.registrar_evento_parada_rota(
    pickup_stop, 1, 'CHEGADA', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    key_prefix || ':pickup-arrival'
  );
  result := public.registrar_evento_parada_rota(
    pickup_stop, 2, 'TENTATIVA_FALHA', 'Cliente ausente no endereço', now() + interval '1 day',
    NULL, NULL, NULL, NULL, NULL, NULL, key_prefix || ':pickup-failed'
  );
  IF result->>'stopStatus' <> 'reagendada'
     OR (result->>'attempts')::integer <> 1
     OR (result->>'version')::integer <> 3
     OR (SELECT status FROM public.agendamentos WHERE id = appointment) <> 'agendado' THEN
    RAISE EXCEPTION 'TEST failed attempt/rescheduling was not preserved: %', result;
  END IF;

  PERFORM public.registrar_evento_parada_rota(
    delivery_stop, 0, 'CHEGADA', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    key_prefix || ':delivery-arrival'
  );
  result := public.registrar_evento_parada_rota(
    delivery_stop, 1, 'CONCLUIDA', NULL, NULL,
    'Recebedora da fixture', 'DOC-A17', NULL, NULL, delivery_id, NULL,
    key_prefix || ':delivery-complete'
  );
  retry := public.registrar_evento_parada_rota(
    delivery_stop, 1, 'CONCLUIDA', NULL, NULL,
    'Recebedora da fixture', 'DOC-A17', NULL, NULL, delivery_id, NULL,
    key_prefix || ':delivery-complete'
  );
  IF result->>'stopStatus' <> 'realizada'
     OR retry->>'idempotent' <> 'true'
     OR (SELECT entrega_id FROM public.paradas_rota WHERE id = delivery_stop) <> delivery_id
     OR (SELECT count(*) FROM public.rota_operacoes WHERE parada_id = delivery_stop AND tipo = 'CONCLUIDA') <> 1 THEN
    RAISE EXCEPTION 'TEST physical delivery proof was not linked idempotently';
  END IF;
  BEGIN
    PERFORM public.registrar_evento_parada_rota(
      delivery_stop, 1, 'CONCLUIDA', NULL, NULL,
      'Outra pessoa', 'DOC-OTHER', NULL, NULL, delivery_id, NULL,
      key_prefix || ':stale-version'
    );
    RAISE EXCEPTION 'TEST expected stale stop version rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Parada foi atualizada por outra operação; recarregue os dados' THEN RAISE; END IF;
  END;

  result := public.finalizar_rota_planejada(route_id, 1032.5, key_prefix || ':finish');
  retry := public.finalizar_rota_planejada(route_id, 1032.5, key_prefix || ':finish');
  IF result->>'status' <> 'concluida'
     OR (result->>'distanceKm')::numeric <> 32.5
     OR retry->>'idempotent' <> 'true'
     OR (SELECT status FROM public.paradas_rota WHERE id = pickup_stop) <> 'reagendada'
     OR (SELECT status FROM public.paradas_rota WHERE id = delivery_stop) <> 'realizada' THEN
    RAISE EXCEPTION 'TEST route closure lost stop outcomes: %, %', result, retry;
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    UPDATE public.rotas_entrega SET status = 'cancelada' WHERE id = route_id;
    RAISE EXCEPTION 'TEST expected direct route update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.paradas_rota(tenant_id, rota_id, ordem, tipo, cliente_id)
    VALUES (tenant_fixture, route_id, 99, 'retirada', customer);
    RAISE EXCEPTION 'TEST expected direct stop insert to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.rota_operacoes(
      tenant_id, rota_id, tipo, idempotency_key, request_fingerprint, criado_por
    ) VALUES (
      tenant_fixture, route_id, 'OCORRENCIA', key_prefix || ':bypass', 'x', actor
    );
    RAISE EXCEPTION 'TEST expected direct logistics ledger insert to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  IF (SELECT count(*) FROM public.rota_operacoes WHERE rota_id = route_id) <> 11 THEN
    RAISE EXCEPTION 'TEST logistics operations were lost or duplicated';
  END IF;
END;
$test$;
ROLLBACK;

SELECT 'A17 route planning, ordering, failed attempt, rescheduling, address history and proof passed; fixtures rolled back' AS result;
