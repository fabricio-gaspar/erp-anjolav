-- Fundação aditiva para o painel único e o PDV operacional.
-- Esta migração não remove colunas legadas nem altera os valores históricos
-- que ainda não podem ser classificados com segurança.

DO $$
BEGIN
  CREATE TYPE public.operation_type AS ENUM ('industrial', 'domestico');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unidades_tenant_codigo_key UNIQUE (tenant_id, codigo),
  CONSTRAINT unidades_id_tenant_key UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS public.usuario_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_unidades_tenant_user_unidade_key UNIQUE (tenant_id, user_id, unidade_id),
  CONSTRAINT usuario_unidades_unidade_tenant_fkey
    FOREIGN KEY (unidade_id, tenant_id) REFERENCES public.unidades(id, tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.usuario_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type public.operation_type NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuario_operacoes_tenant_user_operation_key UNIQUE (tenant_id, user_id, operation_type)
);

CREATE TABLE IF NOT EXISTS public.cliente_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL,
  operation_type public.operation_type NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_operacoes_tenant_cliente_operation_key UNIQUE (tenant_id, cliente_id, operation_type),
  CONSTRAINT cliente_operacoes_cliente_tenant_fkey
    FOREIGN KEY (cliente_id, tenant_id) REFERENCES public.clientes(id, tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.produto_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  operation_type public.operation_type NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_operacoes_tenant_produto_operation_key UNIQUE (tenant_id, produto_id, operation_type),
  CONSTRAINT produto_operacoes_produto_tenant_fkey
    FOREIGN KEY (produto_id, tenant_id) REFERENCES public.produtos(id, tenant_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.operacao_migracao_ambiguidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  source_column text NOT NULL,
  source_value text,
  reason text NOT NULL,
  suggested_operation public.operation_type,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operacao_migracao_ambiguidades_source_key
    UNIQUE (tenant_id, source_table, source_id, source_column)
);

CREATE INDEX IF NOT EXISTS unidades_tenant_ativa_idx
  ON public.unidades (tenant_id, ativa);
CREATE INDEX IF NOT EXISTS usuario_unidades_tenant_user_idx
  ON public.usuario_unidades (tenant_id, user_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS usuario_operacoes_tenant_user_idx
  ON public.usuario_operacoes (tenant_id, user_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS cliente_operacoes_tenant_cliente_idx
  ON public.cliente_operacoes (tenant_id, cliente_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS produto_operacoes_tenant_produto_idx
  ON public.produto_operacoes (tenant_id, produto_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS operacao_migracao_ambiguidades_pending_idx
  ON public.operacao_migracao_ambiguidades (tenant_id, source_table)
  WHERE resolved_at IS NULL;

ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS unidade_ativa_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_mode text,
  ADD COLUMN IF NOT EXISTS default_route text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'funcionarios_unidade_ativa_tenant_fkey'
      AND conrelid = 'public.funcionarios'::regclass
  ) THEN
    ALTER TABLE public.funcionarios
      ADD CONSTRAINT funcionarios_unidade_ativa_tenant_fkey
      FOREIGN KEY (unidade_ativa_id, tenant_id)
      REFERENCES public.unidades(id, tenant_id)
      ON DELETE SET NULL (unidade_ativa_id)
      NOT VALID;
  END IF;
END
$$;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'clientes',
    'produtos',
    'ordens_servico',
    'agendamentos',
    'faturas',
    'lancamentos',
    'lancamentos_cliente',
    'caixas',
    'pagamentos_os',
    'itens_ordem_servico',
    'audit_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = target_table
          AND column_name = 'tenant_id'
      )
    THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL',
        target_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS operation_type public.operation_type',
        target_table
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, operation_type) WHERE operation_type IS NOT NULL',
        format('%s_tenant_operation_idx', target_table),
        target_table
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, unidade_id) WHERE unidade_id IS NOT NULL',
        format('%s_tenant_unidade_idx', target_table),
        target_table
      );
    END IF;
  END LOOP;
END
$$;

-- Backfill only values whose legacy classification is unambiguous. The
-- unresolved values are explicitly recorded below instead of being guessed.
UPDATE public.clientes
SET operation_type = CASE
  WHEN lower(coalesce(classificacao, '')) IN ('industrial', 'industria', 'id1') THEN 'industrial'::public.operation_type
  WHEN lower(coalesce(classificacao, '')) IN ('residencial', 'domestico', 'doméstico', 'loja', 'id2') THEN 'domestico'::public.operation_type
  ELSE operation_type
END
WHERE operation_type IS NULL;

INSERT INTO public.cliente_operacoes (tenant_id, cliente_id, operation_type, padrao)
SELECT tenant_id, id, operation_type, true
FROM public.clientes
WHERE operation_type IS NOT NULL
ON CONFLICT (tenant_id, cliente_id, operation_type) DO UPDATE
SET padrao = EXCLUDED.padrao,
    updated_at = now();

INSERT INTO public.operacao_migracao_ambiguidades (
  tenant_id, source_table, source_id, source_column, source_value, reason
)
SELECT
  tenant_id,
  'clientes',
  id,
  'classificacao',
  classificacao,
  'Classificação legada ausente ou não mapeada para uma operação canônica.'
FROM public.clientes
WHERE operation_type IS NULL
ON CONFLICT (tenant_id, source_table, source_id, source_column) DO UPDATE
SET source_value = EXCLUDED.source_value,
    reason = EXCLUDED.reason,
    updated_at = now();

UPDATE public.produtos
SET operation_type = CASE
  WHEN lower(coalesce(unidade_negocio, '')) IN ('id1', 'industrial', 'industria') THEN 'industrial'::public.operation_type
  WHEN lower(coalesce(unidade_negocio, '')) IN ('id2', 'residencial', 'domestico', 'doméstico', 'loja') THEN 'domestico'::public.operation_type
  ELSE operation_type
END
WHERE operation_type IS NULL;

INSERT INTO public.produto_operacoes (tenant_id, produto_id, operation_type, padrao)
SELECT tenant_id, id, 'industrial'::public.operation_type, lower(coalesce(unidade_negocio, '')) <> 'ambos'
FROM public.produtos
WHERE lower(coalesce(unidade_negocio, '')) IN ('id1', 'industrial', 'industria', 'ambos', 'todas', 'todos')
ON CONFLICT (tenant_id, produto_id, operation_type) DO UPDATE
SET padrao = EXCLUDED.padrao,
    updated_at = now();

INSERT INTO public.produto_operacoes (tenant_id, produto_id, operation_type, padrao)
SELECT tenant_id, id, 'domestico'::public.operation_type, lower(coalesce(unidade_negocio, '')) <> 'ambos'
FROM public.produtos
WHERE lower(coalesce(unidade_negocio, '')) IN ('id2', 'residencial', 'domestico', 'doméstico', 'loja', 'ambos', 'todas', 'todos')
ON CONFLICT (tenant_id, produto_id, operation_type) DO UPDATE
SET padrao = EXCLUDED.padrao,
    updated_at = now();

INSERT INTO public.operacao_migracao_ambiguidades (
  tenant_id, source_table, source_id, source_column, source_value, reason
)
SELECT
  tenant_id,
  'produtos',
  id,
  'unidade_negocio',
  unidade_negocio,
  'Unidade de negócio legada ausente ou não mapeada para uma operação canônica.'
FROM public.produtos
WHERE operation_type IS NULL
  AND lower(coalesce(unidade_negocio, '')) NOT IN ('ambos', 'todas', 'todos')
ON CONFLICT (tenant_id, source_table, source_id, source_column) DO UPDATE
SET source_value = EXCLUDED.source_value,
    reason = EXCLUDED.reason,
    updated_at = now();

UPDATE public.ordens_servico
SET operation_type = CASE
  WHEN lower(coalesce(origem, '')) IN ('industrial', 'industria', 'id1') THEN 'industrial'::public.operation_type
  WHEN lower(coalesce(origem, '')) IN ('residencial', 'domestico', 'doméstico', 'loja', 'id2') THEN 'domestico'::public.operation_type
  ELSE operation_type
END
WHERE operation_type IS NULL;

INSERT INTO public.operacao_migracao_ambiguidades (
  tenant_id, source_table, source_id, source_column, source_value, reason
)
SELECT
  tenant_id,
  'ordens_servico',
  id,
  'origem',
  origem,
  'Origem legada ausente ou não mapeada; a ROL exige revisão antes da classificação.'
FROM public.ordens_servico
WHERE operation_type IS NULL
ON CONFLICT (tenant_id, source_table, source_id, source_column) DO UPDATE
SET source_value = EXCLUDED.source_value,
    reason = EXCLUDED.reason,
    updated_at = now();

UPDATE public.agendamentos AS appointment
SET operation_type = client.operation_type
FROM public.clientes AS client
WHERE appointment.operation_type IS NULL
  AND appointment.tenant_id = client.tenant_id
  AND appointment.cliente_id = client.id
  AND client.operation_type IS NOT NULL;

UPDATE public.faturas AS invoice
SET operation_type = client.operation_type
FROM public.clientes AS client
WHERE invoice.operation_type IS NULL
  AND invoice.tenant_id = client.tenant_id
  AND invoice.cliente_id = client.id
  AND client.operation_type IS NOT NULL;

UPDATE public.lancamentos AS launch
SET operation_type = service_order.operation_type
FROM public.ordens_servico AS service_order
WHERE launch.operation_type IS NULL
  AND launch.tenant_id = service_order.tenant_id
  AND launch.ordem_servico_id = service_order.id
  AND service_order.operation_type IS NOT NULL;

UPDATE public.lancamentos AS launch
SET operation_type = client.operation_type
FROM public.clientes AS client
WHERE launch.operation_type IS NULL
  AND launch.tenant_id = client.tenant_id
  AND launch.cliente_id = client.id
  AND client.operation_type IS NOT NULL;

-- Preserve existing operator assignments by projecting the legacy area grants
-- into the new operation association. Central administrators continue to be
-- resolved as having both operations by get_my_access_context().
INSERT INTO public.usuario_operacoes (tenant_id, user_id, operation_type, ativo)
SELECT
  permission.tenant_id,
  permission.user_id,
  CASE permission.area
    WHEN 'industrial' THEN 'industrial'::public.operation_type
    ELSE 'domestico'::public.operation_type
  END,
  true
FROM public.area_permissoes AS permission
WHERE permission.area IN ('industrial', 'residencial')
ON CONFLICT (tenant_id, user_id, operation_type) DO UPDATE
SET ativo = true,
    updated_at = now();

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacao_migracao_ambiguidades ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.unidades, public.usuario_unidades, public.usuario_operacoes,
  public.cliente_operacoes, public.produto_operacoes, public.operacao_migracao_ambiguidades
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.unidades, public.usuario_unidades, public.usuario_operacoes,
  public.cliente_operacoes, public.produto_operacoes, public.operacao_migracao_ambiguidades
  TO authenticated;
GRANT ALL ON public.unidades, public.usuario_unidades, public.usuario_operacoes,
  public.cliente_operacoes, public.produto_operacoes, public.operacao_migracao_ambiguidades
  TO service_role;

CREATE POLICY unidades_tenant_select ON public.unidades
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id());
CREATE POLICY unidades_tenant_admin_manage ON public.unidades
  FOR ALL TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

CREATE POLICY usuario_unidades_self_or_admin_select ON public.usuario_unidades
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND (user_id = auth.uid() OR private.is_tenant_admin(tenant_id))
  );
CREATE POLICY usuario_unidades_tenant_admin_manage ON public.usuario_unidades
  FOR ALL TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

CREATE POLICY usuario_operacoes_self_or_admin_select ON public.usuario_operacoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND (user_id = auth.uid() OR private.is_tenant_admin(tenant_id))
  );
CREATE POLICY usuario_operacoes_tenant_admin_manage ON public.usuario_operacoes
  FOR ALL TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

CREATE POLICY cliente_operacoes_select ON public.cliente_operacoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND (private.is_tenant_admin(tenant_id) OR private.can_access_client(cliente_id))
  );
CREATE POLICY cliente_operacoes_tenant_admin_manage ON public.cliente_operacoes
  FOR ALL TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

CREATE POLICY produto_operacoes_select ON public.produto_operacoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND (private.is_tenant_admin(tenant_id) OR private.can_access_product(produto_id))
  );
CREATE POLICY produto_operacoes_tenant_admin_manage ON public.produto_operacoes
  FOR ALL TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

CREATE POLICY operacao_migracao_ambiguidades_tenant_admin_manage
  ON public.operacao_migracao_ambiguidades
  FOR ALL TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

-- Preserve the operational context on every sensitive event written through
-- the existing append-only audit trigger. Tables without the new fields simply
-- contribute NULL, keeping their historical trigger contract intact.
CREATE OR REPLACE FUNCTION private.write_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  source jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
BEGIN
  INSERT INTO public.audit_events (
    tenant_id,
    unidade_id,
    operation_type,
    actor_id,
    action,
    entity_schema,
    entity_table,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    (source->>'tenant_id')::uuid,
    NULLIF(source->>'unidade_id', '')::uuid,
    NULLIF(source->>'operation_type', '')::public.operation_type,
    auth.uid(),
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    NULLIF(source->>'id', '')::uuid,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN private.redact_audit_data(to_jsonb(OLD)) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN private.redact_audit_data(to_jsonb(NEW)) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.write_audit_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.write_audit_event() TO service_role;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'unidades',
    'usuario_unidades',
    'usuario_operacoes',
    'cliente_operacoes',
    'produto_operacoes',
    'operacao_migracao_ambiguidades'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_mutation ON public.%I', target_table);
    EXECUTE format(
      'CREATE TRIGGER audit_mutation AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.write_audit_event()',
      target_table
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.get_my_access_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_is_admin boolean := false;
  v_operations jsonb := '[]'::jsonb;
  v_units jsonb := '[]'::jsonb;
  v_access_mode text := 'pdv';
  v_default_route text;
BEGIN
  IF auth.uid() IS NULL OR v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'tenantId', NULL,
      'isAdmin', false,
      'operations', '[]'::jsonb,
      'units', '[]'::jsonb,
      'unitScope', 'assigned',
      'accessMode', 'pdv',
      'defaultRoute', NULL
    );
  END IF;

  v_is_admin := private.is_tenant_admin(v_tenant_id);

  SELECT COALESCE(jsonb_agg(DISTINCT scope.operation), '[]'::jsonb)
  INTO v_operations
  FROM (
    SELECT assignment.operation_type::text AS operation
    FROM public.usuario_operacoes AS assignment
    WHERE assignment.tenant_id = v_tenant_id
      AND assignment.user_id = auth.uid()
      AND assignment.ativo
    UNION
    SELECT CASE permission.area
      WHEN 'industrial' THEN 'industrial'
      ELSE 'domestico'
    END AS operation
    FROM public.area_permissoes AS permission
    WHERE permission.tenant_id = v_tenant_id
      AND permission.user_id = auth.uid()
      AND permission.area IN ('industrial', 'residencial')
    UNION
    SELECT enum_value::text
    FROM unnest(enum_range(NULL::public.operation_type)) AS enum_value
    WHERE v_is_admin
  ) AS scope;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', unit.id, 'code', unit.codigo, 'name', unit.nome)
    ORDER BY unit.nome
  ), '[]'::jsonb)
  INTO v_units
  FROM public.unidades AS unit
  WHERE unit.tenant_id = v_tenant_id
    AND unit.ativa
    AND (
      v_is_admin
      OR EXISTS (
        SELECT 1
        FROM public.usuario_unidades AS assignment
        WHERE assignment.tenant_id = unit.tenant_id
          AND assignment.unidade_id = unit.id
          AND assignment.user_id = auth.uid()
          AND assignment.ativo
      )
    );

  SELECT employee.access_mode, employee.default_route
  INTO v_access_mode, v_default_route
  FROM public.funcionarios AS employee
  WHERE employee.tenant_id = v_tenant_id
    AND employee.user_id = auth.uid()
    AND employee.ativo
  LIMIT 1;

  v_access_mode := COALESCE(v_access_mode, CASE WHEN v_is_admin THEN 'admin' ELSE 'pdv' END);
  v_default_route := COALESCE(
    v_default_route,
    CASE
      WHEN v_is_admin THEN '/admin/visao-geral'
      WHEN v_operations ? 'industrial' THEN '/pdv/industrial'
      WHEN v_operations ? 'domestico' THEN '/pdv/domestico'
      ELSE NULL
    END
  );

  RETURN jsonb_build_object(
    'tenantId', v_tenant_id,
    'isAdmin', v_is_admin,
    'operations', v_operations,
    'units', v_units,
    'unitScope', CASE WHEN v_is_admin THEN 'all' ELSE 'assigned' END,
    'accessMode', v_access_mode,
    'defaultRoute', v_default_route
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_access_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_context() TO authenticated;

COMMENT ON FUNCTION public.get_my_access_context() IS
  'Returns the authenticated user tenant, allowed operations, unit scope, and canonical default route.';
