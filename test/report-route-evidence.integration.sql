-- Integration test for private proof-of-delivery media, including object-path
-- validation, tenant/driver isolation and immutability after linking.
\set ON_ERROR_STOP on

BEGIN;
DO $test$
DECLARE
  tenant_fixture uuid := gen_random_uuid();
  foreign_tenant uuid := gen_random_uuid();
  driver_user uuid := gen_random_uuid();
  other_driver_user uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  driver_employee uuid;
  other_employee uuid;
  driver_id uuid;
  other_driver_id uuid;
  vehicle_id uuid;
  customer_id uuid;
  route_id uuid := gen_random_uuid();
  stop_id uuid := gen_random_uuid();
  evidence_path text;
  missing_path text;
  result jsonb;
  key_prefix text := 'test-evidence-' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public.tenants(id, nome, slug)
  VALUES
    (tenant_fixture, 'Evidence tenant', 'evidence-' || tenant_fixture),
    (foreign_tenant, 'Foreign evidence tenant', 'evidence-foreign-' || foreign_tenant);
  INSERT INTO auth.users(id) VALUES (driver_user), (other_driver_user), (admin_user);
  INSERT INTO public.tenant_memberships(tenant_id, user_id, role, enabled, is_active)
  VALUES
    (tenant_fixture, driver_user, 'member', true, true),
    (tenant_fixture, other_driver_user, 'member', true, true),
    (tenant_fixture, admin_user, 'admin', true, true);
  INSERT INTO public.funcionarios(tenant_id, user_id, nome, cargo, login, ativo)
  VALUES (
    tenant_fixture, driver_user, 'Evidence driver', 'motorista',
    'evidence-driver-' || driver_user, true
  ) RETURNING id INTO driver_employee;
  INSERT INTO public.funcionarios(tenant_id, user_id, nome, cargo, login, ativo)
  VALUES (
    tenant_fixture, other_driver_user, 'Other driver', 'motorista',
    'evidence-other-' || other_driver_user, true
  ) RETURNING id INTO other_employee;
  INSERT INTO public.modulo_permissoes(tenant_id, funcionario_id, modulo_key, tem_acesso)
  VALUES
    (tenant_fixture, driver_employee, 'agenda', true),
    (tenant_fixture, other_employee, 'agenda', true);
  INSERT INTO public.area_permissoes(tenant_id,user_id,area) VALUES (tenant_fixture,driver_user,'residencial'), (tenant_fixture,other_driver_user,'residencial');
  INSERT INTO public.motoristas(tenant_id, funcionario_id, nome, ativo)
  VALUES (tenant_fixture, driver_employee, 'Evidence driver', true)
  RETURNING id INTO driver_id;
  INSERT INTO public.motoristas(tenant_id, funcionario_id, nome, ativo)
  VALUES (tenant_fixture, other_employee, 'Other driver', true)
  RETURNING id INTO other_driver_id;
  INSERT INTO public.veiculos(tenant_id, placa, modelo, ativo)
  VALUES (tenant_fixture, 'PRV1A17', 'Evidence van', true)
  RETURNING id INTO vehicle_id;
  INSERT INTO public.clientes(tenant_id, razao_social, classificacao)
  VALUES (tenant_fixture, 'Evidence customer', 'residencial')
  RETURNING id INTO customer_id;
  INSERT INTO public.rotas_entrega(
    id, tenant_id, data, motorista_id, veiculo_id, status, km_inicial,
    hora_saida, criado_por, operation_type
  ) VALUES (
    route_id, tenant_fixture, current_date, driver_id, vehicle_id, 'em_rota',
    100, now(), driver_user, 'domestico'
  );
  INSERT INTO public.paradas_rota(
    id, tenant_id, rota_id, ordem, tipo, cliente_id, status,
    hora_chegada, endereco_snapshot, atualizado_por
  ) VALUES (
    stop_id, tenant_fixture, route_id, 1, 'retirada', customer_id,
    'em_atendimento', now(), '{}'::jsonb, driver_user
  );

  evidence_path := tenant_fixture::text || '/' || route_id::text || '/' ||
    stop_id::text || '/photo/' || gen_random_uuid()::text || '.png';
  missing_path := tenant_fixture::text || '/' || route_id::text || '/' ||
    stop_id::text || '/photo/' || gen_random_uuid()::text || '.png';

  IF (SELECT public FROM storage.buckets WHERE id = 'delivery-evidence')
     OR (SELECT file_size_limit FROM storage.buckets WHERE id = 'delivery-evidence') <> 8388608
     OR (SELECT allowed_mime_types FROM storage.buckets WHERE id = 'delivery-evidence')
       IS DISTINCT FROM ARRAY['image/jpeg', 'image/png', 'image/webp']::text[] THEN
    RAISE EXCEPTION 'TEST delivery-evidence bucket is not private and constrained';
  END IF;
  IF NOT private.delivery_evidence_path_matches(
    evidence_path, tenant_fixture, route_id, stop_id, 'photo'
  ) OR private.delivery_evidence_path_matches(
    evidence_path, foreign_tenant, route_id, stop_id, 'photo'
  ) THEN
    RAISE EXCEPTION 'TEST evidence path validation does not bind tenant/route/stop';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', driver_user::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', driver_user, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO storage.objects(bucket_id, name, owner_id, metadata)
  VALUES (
    'delivery-evidence', evidence_path, driver_user::text,
    jsonb_build_object('mimetype', 'image/png', 'size', 1024)
  );
  IF (SELECT count(*) FROM storage.objects WHERE bucket_id = 'delivery-evidence') <> 1 THEN
    RAISE EXCEPTION 'TEST assigned driver could not store valid evidence';
  END IF;
  BEGIN
    INSERT INTO storage.objects(bucket_id, name, owner_id, metadata)
    VALUES (
      'delivery-evidence',
      foreign_tenant::text || '/' || route_id::text || '/' || stop_id::text ||
        '/photo/' || gen_random_uuid()::text || '.png',
      driver_user::text,
      jsonb_build_object('mimetype', 'image/png', 'size', 1024)
    );
    RAISE EXCEPTION 'TEST expected cross-tenant storage insert rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', other_driver_user::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', other_driver_user, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF (SELECT count(*) FROM storage.objects WHERE name = evidence_path) <> 0 THEN
    RAISE EXCEPTION 'TEST another driver read assigned route evidence';
  END IF;
  BEGIN
    INSERT INTO storage.objects(bucket_id, name, owner_id, metadata)
    VALUES (
      'delivery-evidence',
      tenant_fixture::text || '/' || route_id::text || '/' || stop_id::text ||
        '/signature/' || gen_random_uuid()::text || '.png',
      other_driver_user::text,
      jsonb_build_object('mimetype', 'image/png', 'size', 1024)
    );
    RAISE EXCEPTION 'TEST expected unassigned driver storage rejection';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', admin_user::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', admin_user, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF (SELECT count(*) FROM storage.objects WHERE name = evidence_path) <> 1 THEN
    RAISE EXCEPTION 'TEST tenant admin could not read evidence';
  END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', driver_user::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', driver_user, 'role', 'authenticated')::text,
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.registrar_evento_parada_rota(
      stop_id, 0, 'CONCLUIDA', NULL, NULL, 'Receiver', NULL,
      'https://public.invalid/proof.png', NULL, NULL, NULL,
      key_prefix || ':public-url'
    );
    RAISE EXCEPTION 'TEST expected arbitrary public URL rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Foto de comprovação inválida ou inexistente' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_evento_parada_rota(
      stop_id, 0, 'CONCLUIDA', NULL, NULL, 'Receiver', NULL,
      missing_path, NULL, NULL, NULL, key_prefix || ':missing-object'
    );
    RAISE EXCEPTION 'TEST expected missing object rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Foto de comprovação inválida ou inexistente' THEN RAISE; END IF;
  END;

  result := public.registrar_evento_parada_rota(
    stop_id, 0, 'CONCLUIDA', NULL, NULL, 'Receiver', NULL,
    evidence_path, NULL, NULL, NULL, key_prefix || ':complete'
  );
  IF result->>'stopStatus' <> 'realizada'
     OR (SELECT foto_comprovante_url FROM public.paradas_rota WHERE id = stop_id) <> evidence_path THEN
    RAISE EXCEPTION 'TEST valid evidence was not linked to completed stop';
  END IF;

  IF private.can_delete_delivery_evidence(evidence_path) THEN
    RAISE EXCEPTION 'TEST linked evidence remained deletable';
  END IF;
  UPDATE storage.objects SET metadata = metadata || '{"tampered":true}'::jsonb
  WHERE bucket_id = 'delivery-evidence' AND name = evidence_path;
  IF EXISTS (
    SELECT 1 FROM storage.objects
    WHERE name = evidence_path AND metadata ? 'tampered'
  ) THEN
    RAISE EXCEPTION 'TEST evidence object was overwritten without an update policy';
  END IF;
  EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;

SELECT 'Private delivery evidence isolation, validation and immutability passed; fixtures rolled back' AS result;
