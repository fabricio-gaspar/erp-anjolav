-- Staged tenant MFA enforcement for administrative access.
-- Existing tenants remain compatible because the policy defaults to disabled.

CREATE TABLE public.tenant_security_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  require_mfa_for_admins boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.tenant_security_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_security_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tenant_security_settings TO service_role;

COMMENT ON TABLE public.tenant_security_settings IS
  'Tenant-scoped security controls. Read and mutation are exposed only through guarded RPCs.';
COMMENT ON COLUMN public.tenant_security_settings.require_mfa_for_admins IS
  'When enabled, administrative authorization requires an AAL2 access token.';

CREATE OR REPLACE FUNCTION private.current_authenticator_assurance_level()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT CASE
    WHEN auth.jwt()->>'aal' = 'aal2' THEN 'aal2'
    ELSE 'aal1'
  END
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_admin_member(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    JOIN public.tenants tenant ON tenant.id = membership.tenant_id
    WHERE membership.user_id = auth.uid()
      AND membership.tenant_id = _tenant_id
      AND membership.enabled
      AND membership.is_active
      AND membership.role IN ('owner', 'admin')
      AND tenant.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION private.admin_mfa_satisfied(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT NOT coalesce((
    SELECT settings.require_mfa_for_admins
    FROM public.tenant_security_settings settings
    WHERE settings.tenant_id = _tenant_id
  ), false)
  OR private.current_authenticator_assurance_level() = 'aal2'
$$;

-- Preserve the established authorization contract while making the tenant
-- policy effective in every RLS policy and RPC that already uses this helper.
CREATE OR REPLACE FUNCTION private.is_tenant_admin(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin_member(_tenant_id)
    AND private.admin_mfa_satisfied(_tenant_id)
$$;

REVOKE ALL ON FUNCTION private.current_authenticator_assurance_level() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_tenant_admin_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.admin_mfa_satisfied(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_authenticator_assurance_level() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_tenant_admin_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_mfa_satisfied(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_security_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  current_tenant uuid := private.current_tenant_id();
  is_admin boolean;
  requires_mfa boolean;
  current_aal text := private.current_authenticator_assurance_level();
  policy_updated_at timestamptz;
BEGIN
  IF actor_id IS NULL OR current_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa ativa autorizada';
  END IF;

  is_admin := private.is_tenant_admin_member(current_tenant);
  SELECT settings.require_mfa_for_admins, settings.updated_at
    INTO requires_mfa, policy_updated_at
  FROM public.tenant_security_settings settings
  WHERE settings.tenant_id = current_tenant;
  requires_mfa := coalesce(requires_mfa, false);

  RETURN jsonb_build_object(
    'tenantId', current_tenant,
    'isAdmin', is_admin,
    'requireMfaForAdmins', requires_mfa,
    'currentAal', current_aal,
    'mfaSatisfied', NOT is_admin OR NOT requires_mfa OR current_aal = 'aal2',
    'policyUpdatedAt', policy_updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_admin_mfa_requirement(_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  actor_id uuid := auth.uid();
  current_tenant uuid := private.current_tenant_id();
BEGIN
  IF actor_id IS NULL OR current_tenant IS NULL
     OR NOT private.is_tenant_admin_member(current_tenant) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _enabled IS NULL THEN
    RAISE EXCEPTION 'Informe a política de autenticação';
  END IF;
  IF private.current_authenticator_assurance_level() <> 'aal2' THEN
    RAISE EXCEPTION 'MFA_REQUIRED: confirme sua autenticação em duas etapas';
  END IF;

  INSERT INTO public.tenant_security_settings (
    tenant_id, require_mfa_for_admins, updated_at, updated_by
  ) VALUES (
    current_tenant, _enabled, now(), actor_id
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    require_mfa_for_admins = EXCLUDED.require_mfa_for_admins,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  RETURN public.get_my_security_context();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_security_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_admin_mfa_requirement(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_security_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_mfa_requirement(boolean) TO authenticated;

DROP TRIGGER IF EXISTS audit_mutation ON public.tenant_security_settings;
CREATE TRIGGER audit_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_security_settings
FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();
