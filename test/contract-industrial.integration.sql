-- Run against a local database after CAD-11 migration; all fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  second_actor uuid := gen_random_uuid();
  denied_actor uuid := gen_random_uuid();
  second_employee uuid;
  customer uuid;
  second_customer uuid;
  foreign_customer uuid;
  product uuid;
  foreign_product uuid;
  contract_id uuid;
  result jsonb;
  retry jsonb;
  key_prefix text := 'cad11-' || gen_random_uuid()::text;
  operation_count integer;
BEGIN
  INSERT INTO public.tenants(id, nome, slug) VALUES
    (tenant_a, 'CAD11 local A', 'cad11-a-' || tenant_a),
    (tenant_b, 'CAD11 local B', 'cad11-b-' || tenant_b);
  INSERT INTO auth.users(id) VALUES (actor), (second_actor), (denied_actor);
  INSERT INTO public.tenant_memberships(tenant_id, user_id, role, enabled, is_active) VALUES
    (tenant_a, actor, 'admin', true, true),
    (tenant_a, second_actor, 'member', true, true),
    (tenant_a, denied_actor, 'member', true, true);
  INSERT INTO public.funcionarios(tenant_id, user_id, nome, cargo, login, ativo)
  VALUES (tenant_a, second_actor, 'CAD11 second operator', 'atendente', 'cad11-' || second_actor, true)
  RETURNING id INTO second_employee;
  INSERT INTO public.modulo_permissoes(tenant_id, funcionario_id, modulo_key, tem_acesso)
  VALUES (tenant_a, second_employee, 'alterar_condicoes_comerciais', true),
    (tenant_a, second_employee, 'clientes', true);
  INSERT INTO public.area_permissoes(tenant_id, user_id, area)
  VALUES (tenant_a, second_actor, 'industrial');
  INSERT INTO public.clientes(tenant_id, razao_social, classificacao) VALUES
    (tenant_a, 'CAD11 industrial customer', 'industrial') RETURNING id INTO customer;
  INSERT INTO public.clientes(tenant_id, razao_social, classificacao) VALUES
    (tenant_a, 'CAD11 second customer', 'industrial') RETURNING id INTO second_customer;
  INSERT INTO public.clientes(tenant_id, razao_social, classificacao) VALUES
    (tenant_b, 'CAD11 foreign customer', 'industrial') RETURNING id INTO foreign_customer;
  INSERT INTO public.produtos(tenant_id, nome, preco, unidade, unidade_negocio) VALUES
    (tenant_a, 'CAD11 industrial service', 12.50, 'kg', 'ID1') RETURNING id INTO product;
  INSERT INTO public.produtos(tenant_id, nome, preco, unidade, unidade_negocio) VALUES
    (tenant_b, 'CAD11 foreign service', 9, 'kg', 'ID1') RETURNING id INTO foreign_product;

  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF has_table_privilege('authenticated', 'public.contratos_aluguel', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.itens_contrato_aluguel', 'DELETE')
     OR has_table_privilege('authenticated', 'public.contrato_operacoes', 'INSERT')
     OR has_function_privilege('anon', 'public.salvar_contrato_industrial(uuid,uuid,text,numeric,date,date,text,integer,integer,text,boolean,text,text,jsonb,integer,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'CAD11 direct mutation or anonymous RPC privilege remains';
  END IF;

  result := public.salvar_contrato_industrial(
    NULL, customer, 'Industrial agreement', 100, current_date, NULL,
    'mensal', 31, 10, 'boleto', true, 'Measured monthly', NULL,
    jsonb_build_array(jsonb_build_object('produtoId', product, 'quantidade', 1.5, 'valorUnitario', 12.50)),
    NULL, key_prefix || ':create');
  contract_id := (result->>'id')::uuid;
  IF (result->>'versao')::integer <> 0 OR (result->>'valorReferencia')::numeric <> 118.75
     OR (result->>'idempotent')::boolean OR NOT (result->>'ativo')::boolean THEN
    RAISE EXCEPTION 'CAD11 create result invalid: %', result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes_pagamento_cliente
      WHERE cliente_id = customer AND tenant_id = tenant_a AND condicao_pagamento = 'faturado'
        AND tipo_faturamento = 'mensal' AND dia_fechamento = 31 AND forma_pagamento = 'boleto') THEN
    RAISE EXCEPTION 'CAD11 payment terms did not follow the contract';
  END IF;
  BEGIN
    UPDATE public.configuracoes_pagamento_cliente SET condicao_pagamento = 'retirada'
    WHERE cliente_id = customer AND tenant_id = tenant_a;
    RAISE EXCEPTION 'CAD11 direct payment terms update accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.configuracoes_pagamento_cliente
  SET observacao_faturamento = 'Fiscal preference may change'
  WHERE cliente_id = customer AND tenant_id = tenant_a;
  IF (SELECT observacao_faturamento FROM public.configuracoes_pagamento_cliente
      WHERE cliente_id = customer) <> 'Fiscal preference may change' THEN
    RAISE EXCEPTION 'CAD11 fiscal preferences were blocked';
  END IF;
  BEGIN
    DELETE FROM public.configuracoes_pagamento_cliente
    WHERE cliente_id = customer AND tenant_id = tenant_a;
    RAISE EXCEPTION 'CAD11 active contract payment config deleted';
  EXCEPTION WHEN check_violation OR insufficient_privilege THEN NULL;
  END;
  retry := public.salvar_contrato_industrial(
    NULL, customer, 'Industrial agreement', 100, current_date, NULL,
    'mensal', 31, 10, 'boleto', true, 'Measured monthly', NULL,
    jsonb_build_array(jsonb_build_object('produtoId', product, 'quantidade', 1.5, 'valorUnitario', 12.50)),
    NULL, key_prefix || ':create');
  IF retry->>'id' <> contract_id::text OR NOT (retry->>'idempotent')::boolean THEN
    RAISE EXCEPTION 'CAD11 create replay failed: %', retry;
  END IF;
  SELECT count(*) INTO operation_count FROM public.contrato_operacoes WHERE contrato_id = contract_id;
  IF operation_count <> 1 THEN RAISE EXCEPTION 'CAD11 replay added an audit row'; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', second_actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', second_actor, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.salvar_contrato_industrial(
      NULL, customer, 'Industrial agreement', 100, current_date, NULL,
      'mensal', 31, 10, 'boleto', true, 'Measured monthly', NULL,
      jsonb_build_array(jsonb_build_object('produtoId', product, 'quantidade', 1.5, 'valorUnitario', 12.50)),
      NULL, key_prefix || ':create');
    RAISE EXCEPTION 'CAD11 another operator replayed the key';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.salvar_contrato_industrial(
      NULL, customer, 'Different agreement', 100, current_date, NULL,
      'mensal', 31, 10, 'boleto', true, 'Measured monthly', NULL,
      jsonb_build_array(jsonb_build_object('produtoId', product, 'quantidade', 1.5, 'valorUnitario', 12.50)),
      NULL, key_prefix || ':create');
    RAISE EXCEPTION 'CAD11 reused key accepted different request';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.salvar_contrato_industrial(
      contract_id, customer, 'Industrial agreement', 110, current_date, NULL,
      'mensal', 31, 10, 'boleto', true, NULL, NULL, '[]'::jsonb,
      99, key_prefix || ':stale');
    RAISE EXCEPTION 'CAD11 stale version accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;

  result := public.salvar_contrato_industrial(
    contract_id, customer, 'Industrial agreement updated', 110, current_date, NULL,
    'quinzenal', 16, 10, 'pix', true, NULL, NULL,
    jsonb_build_array(jsonb_build_object('produtoId', product, 'quantidade', 2, 'valorUnitario', 15)),
    0, key_prefix || ':update');
  IF (result->>'versao')::integer <> 1
     OR (SELECT count(*) FROM public.itens_contrato_aluguel WHERE contrato_id = contract_id) <> 1
     OR (SELECT quantidade FROM public.itens_contrato_aluguel WHERE contrato_id = contract_id) <> 2 THEN
    RAISE EXCEPTION 'CAD11 update or item replacement failed: %', result;
  END IF;
  result := public.encerrar_contrato_industrial(contract_id, 'End of service', 1, key_prefix || ':end');
  IF (result->>'versao')::integer <> 2 OR (result->>'ativo')::boolean
     OR (SELECT count(*) FROM public.contrato_operacoes WHERE contrato_id = contract_id) <> 3
     OR (SELECT count(*) FROM public.itens_contrato_aluguel WHERE contrato_id = contract_id) <> 1
     OR (SELECT condicao_pagamento FROM public.configuracoes_pagamento_cliente WHERE cliente_id = customer) <> 'retirada' THEN
    RAISE EXCEPTION 'CAD11 end did not preserve history or stop billing: %', result;
  END IF;
  retry := public.encerrar_contrato_industrial(contract_id, 'End of service', 1, key_prefix || ':end');
  IF NOT (retry->>'idempotent')::boolean THEN RAISE EXCEPTION 'CAD11 end replay failed'; END IF;

  BEGIN
    PERFORM public.salvar_contrato_industrial(
      NULL, foreign_customer, 'Foreign agreement', 1, current_date, NULL,
      'avulso', NULL, 10, NULL, false, NULL, NULL, '[]'::jsonb,
      NULL, key_prefix || ':foreign-customer');
    RAISE EXCEPTION 'CAD11 foreign customer accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.salvar_contrato_industrial(
      NULL, second_customer, 'Foreign product agreement', 0, current_date, NULL,
      'avulso', NULL, 10, NULL, false, NULL, NULL,
      jsonb_build_array(jsonb_build_object('produtoId', foreign_product, 'quantidade', 1, 'valorUnitario', 9)),
      NULL, key_prefix || ':foreign-product');
    RAISE EXCEPTION 'CAD11 foreign product accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', denied_actor::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', denied_actor, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.encerrar_contrato_industrial(contract_id, 'Unauthorized retry', 2, key_prefix || ':denied');
    RAISE EXCEPTION 'CAD11 unprivileged member accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;
SELECT 'CAD11 industrial contract command checks passed' AS result;
