-- Plataforma SaaS: metadados comerciais e ciclo de vida de empresas.
-- Esta migration não cria administradores de plataforma. O primeiro acesso deve
-- ser provisionado fora do navegador, com um UUID de Auth verificado e uma
-- operação de service role auditada.

CREATE TABLE IF NOT EXISTS public.platform_administrators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK ((NOT active AND revoked_at IS NOT NULL) OR (active AND revoked_at IS NULL))
);

CREATE TABLE IF NOT EXISTS public.saas_plan_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description text CHECK (description IS NULL OR length(trim(description)) <= 1000),
  max_users integer CHECK (max_users IS NULL OR max_users >= 1),
  max_orders_per_month integer CHECK (max_orders_per_month IS NULL OR max_orders_per_month >= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_service_subscriptions (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
  plan_id uuid REFERENCES public.saas_plan_catalog(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'cancelled') OR plan_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tenant_service_subscriptions_plan_status
  ON public.tenant_service_subscriptions(plan_id, status);

DROP TRIGGER IF EXISTS update_saas_plan_catalog_updated_at ON public.saas_plan_catalog;
CREATE TRIGGER update_saas_plan_catalog_updated_at
  BEFORE UPDATE ON public.saas_plan_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_service_subscriptions_updated_at ON public.tenant_service_subscriptions;
CREATE TRIGGER update_tenant_service_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_service_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.platform_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_service_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_administrators FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.saas_plan_catalog, public.tenant_service_subscriptions
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_administrators TO authenticated;
GRANT ALL ON TABLE public.platform_administrators TO service_role;
GRANT ALL ON TABLE public.saas_plan_catalog, public.tenant_service_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION private.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.platform_administrators administrator
      WHERE administrator.user_id = _user_id
        AND administrator.active
    )
$$;

REVOKE ALL ON FUNCTION private.is_platform_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO authenticated, service_role;

CREATE POLICY platform_administrator_read_self ON public.platform_administrators
  FOR SELECT TO authenticated
  USING (private.is_platform_admin(user_id));

-- Keep the platform capability in the authenticated context so route rendering
-- can fail closed without an additional browser request or a writable table.
CREATE OR REPLACE FUNCTION public.get_my_tenant_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'activeTenantId', private.current_tenant_id(),
    'platformAdmin', private.is_platform_admin(auth.uid()),
    'tenants', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', tenant.id,
        'name', tenant.nome,
        'slug', tenant.slug,
        'role', membership.role,
        'active', membership.is_active
      ) ORDER BY tenant.nome
    ), '[]'::jsonb)
  )
  FROM public.tenant_memberships membership
  JOIN public.tenants tenant ON tenant.id = membership.tenant_id
  WHERE membership.user_id = auth.uid()
    AND membership.enabled
    AND tenant.status = 'active'
$$;

REVOKE ALL ON FUNCTION public.get_my_tenant_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_set_tenant_service_subscription(
  _tenant_id uuid,
  _plan_id uuid,
  _status text,
  _actor_id uuid,
  _actor_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_subscription public.tenant_service_subscriptions%ROWTYPE;
  next_subscription public.tenant_service_subscriptions%ROWTYPE;
  previous_tenant_status text;
  next_tenant_status text;
BEGIN
  IF _tenant_id IS NULL OR _actor_id IS NULL OR _actor_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Empresa e administrador são obrigatórios';
  END IF;

  IF _status NOT IN ('trial', 'active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Status de assinatura inválido';
  END IF;

  IF _tenant_id = _actor_tenant_id AND _status IN ('suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Não é permitido bloquear a empresa ativa do administrador da plataforma';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users user_account WHERE user_account.id = _actor_id) THEN
    RAISE EXCEPTION 'Administrador inválido';
  END IF;

  SELECT tenant.status
  INTO previous_tenant_status
  FROM public.tenants tenant
  WHERE tenant.id = _tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF _status <> 'cancelled' AND _plan_id IS NULL THEN
    RAISE EXCEPTION 'Um plano é obrigatório para este status';
  END IF;

  IF _plan_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.saas_plan_catalog plan WHERE plan.id = _plan_id
  ) THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  IF _status IN ('trial', 'active') AND NOT EXISTS (
    SELECT 1 FROM public.saas_plan_catalog plan WHERE plan.id = _plan_id AND plan.active
  ) THEN
    RAISE EXCEPTION 'Plano indisponível para ativação';
  END IF;

  SELECT *
  INTO previous_subscription
  FROM public.tenant_service_subscriptions subscription
  WHERE subscription.tenant_id = _tenant_id
  FOR UPDATE;

  INSERT INTO public.tenant_service_subscriptions (
    tenant_id, plan_id, status, status_changed_at, updated_by
  ) VALUES (
    _tenant_id, _plan_id, _status, now(), _actor_id
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    status_changed_at = EXCLUDED.status_changed_at,
    updated_by = EXCLUDED.updated_by
  RETURNING * INTO next_subscription;

  next_tenant_status := CASE
    WHEN _status = 'suspended' THEN 'suspended'
    WHEN _status = 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END;

  UPDATE public.tenants
  SET status = next_tenant_status, updated_at = now()
  WHERE id = _tenant_id;

  INSERT INTO public.audit_events (
    tenant_id, actor_id, action, entity_schema, entity_table, entity_id, old_data, new_data
  ) VALUES (
    _tenant_id,
    _actor_id,
    CASE WHEN previous_subscription.tenant_id IS NULL THEN 'INSERT' ELSE 'UPDATE' END,
    'public',
    'tenant_service_subscriptions',
    _tenant_id::text,
    CASE WHEN previous_subscription.tenant_id IS NULL THEN NULL ELSE jsonb_build_object(
      'plan_id', previous_subscription.plan_id,
      'status', previous_subscription.status
    ) END,
    jsonb_build_object(
      'plan_id', next_subscription.plan_id,
      'status', next_subscription.status,
      'tenant_status', next_tenant_status
    )
  );

  IF previous_tenant_status IS DISTINCT FROM next_tenant_status THEN
    INSERT INTO public.audit_events (
      tenant_id, actor_id, action, entity_schema, entity_table, entity_id, old_data, new_data
    ) VALUES (
      _tenant_id,
      _actor_id,
      'UPDATE',
      'public',
      'tenants',
      _tenant_id::text,
      jsonb_build_object('status', previous_tenant_status),
      jsonb_build_object('status', next_tenant_status)
    );
  END IF;

  RETURN jsonb_build_object(
    'tenantId', next_subscription.tenant_id,
    'planId', next_subscription.plan_id,
    'status', next_subscription.status,
    'tenantStatus', next_tenant_status,
    'updatedAt', next_subscription.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_set_tenant_service_subscription(uuid, uuid, text, uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_tenant_service_subscription(uuid, uuid, text, uuid, uuid)
TO service_role;
