-- Run against a local database after the ADM-05 migration. No fixtures persist.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
  v_tenant uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_employee uuid;
  v_permission uuid;
  v_event public.audit_events%ROWTYPE;
  v_count integer;
  v_access boolean;
BEGIN
  INSERT INTO public.tenants (id, nome, slug)
  VALUES (v_tenant, 'Empresa de teste ADM-05', 'adm-05-' || v_tenant);
  INSERT INTO auth.users (id) VALUES (v_admin), (v_member);
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, enabled, is_active)
  VALUES (v_tenant, v_admin, 'admin', true, true),
         (v_tenant, v_member, 'member', true, true);
  INSERT INTO public.funcionarios (tenant_id, nome, cargo, login)
  VALUES (v_tenant, 'Funcionário de teste ADM-05', 'OPERADOR', 'adm-05-' || v_tenant)
  RETURNING id INTO v_employee;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- Saving the settings screen inserts many explicit false rows. They grant
  -- nothing and must not create misleading permission-change events.
  INSERT INTO public.modulo_permissoes (tenant_id, funcionario_id, modulo_key, tem_acesso)
  VALUES (v_tenant, v_employee, 'dashboard', false)
  RETURNING id INTO v_permission;
  SELECT count(*) INTO v_count FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text;
  IF v_count <> 0 THEN RAISE EXCEPTION 'False insert produced an audit event'; END IF;

  UPDATE public.modulo_permissoes SET tem_acesso = true WHERE id = v_permission;
  SELECT * INTO v_event FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text;
  IF v_event.action IS DISTINCT FROM 'UPDATE'
     OR v_event.actor_id IS DISTINCT FROM v_admin
     OR v_event.tenant_id IS DISTINCT FROM v_tenant
     OR v_event.old_data IS DISTINCT FROM jsonb_build_object(
       'funcionario_id', v_employee, 'modulo_key', 'dashboard', 'tem_acesso', false)
     OR v_event.new_data IS DISTINCT FROM jsonb_build_object(
       'funcionario_id', v_employee, 'modulo_key', 'dashboard', 'tem_acesso', true)
  THEN RAISE EXCEPTION 'Grant audit is missing actor, tenant or allowlisted before/after data'; END IF;

  INSERT INTO public.modulo_permissoes (tenant_id, funcionario_id, modulo_key, tem_acesso)
  VALUES (v_tenant, v_employee, 'dashboard', true)
  ON CONFLICT (funcionario_id, modulo_key) DO UPDATE
  SET tem_acesso = EXCLUDED.tem_acesso;
  SELECT count(*) INTO v_count FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text;
  IF v_count <> 1 THEN RAISE EXCEPTION 'No-op upsert produced another event'; END IF;

  UPDATE public.modulo_permissoes SET tem_acesso = false WHERE id = v_permission;
  SELECT * INTO v_event FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text
    AND action = 'UPDATE' AND old_data->>'tem_acesso' = 'true';
  IF v_event.action IS DISTINCT FROM 'UPDATE'
     OR v_event.old_data->>'tem_acesso' IS DISTINCT FROM 'true'
     OR v_event.new_data->>'tem_acesso' IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'Revoke audit does not show the before/after state'; END IF;
  DELETE FROM public.modulo_permissoes WHERE id = v_permission;
  SELECT count(*) INTO v_count FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text;
  IF v_count <> 2 THEN RAISE EXCEPTION 'False delete produced an audit event'; END IF;

  INSERT INTO public.modulo_permissoes (tenant_id, funcionario_id, modulo_key, tem_acesso)
  VALUES (v_tenant, v_employee, 'dashboard', true)
  RETURNING id INTO v_permission;
  SELECT * INTO v_event FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text
    AND action = 'INSERT';
  IF v_event.actor_id IS DISTINCT FROM v_admin
     OR v_event.tenant_id IS DISTINCT FROM v_tenant
     OR v_event.old_data IS NOT NULL
     OR v_event.new_data IS DISTINCT FROM jsonb_build_object(
       'funcionario_id', v_employee, 'modulo_key', 'dashboard', 'tem_acesso', true)
  THEN RAISE EXCEPTION 'New grant was not audited exactly with actor and tenant'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  UPDATE public.modulo_permissoes SET tem_acesso = false WHERE id = v_permission;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Non-admin changed a permission'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SELECT tem_acesso INTO v_access FROM public.modulo_permissoes WHERE id = v_permission;
  IF v_access IS DISTINCT FROM true THEN RAISE EXCEPTION 'Denied write changed access'; END IF;
  DELETE FROM public.modulo_permissoes WHERE id = v_permission;
  SELECT * INTO v_event FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text
    AND action = 'DELETE';
  IF v_event.action IS DISTINCT FROM 'DELETE'
     OR v_event.old_data->>'tem_acesso' IS DISTINCT FROM 'true'
     OR v_event.new_data IS NOT NULL
  THEN RAISE EXCEPTION 'True delete was not audited as a revoke'; END IF;
  SELECT count(*) INTO v_count FROM public.audit_events
  WHERE entity_table = 'modulo_permissoes' AND entity_id = v_permission::text;
  IF v_count <> 2 THEN RAISE EXCEPTION 'True insert/delete was not audited exactly once each'; END IF;

  EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;
SELECT 'ADM-05 permission audit passed' AS result;
