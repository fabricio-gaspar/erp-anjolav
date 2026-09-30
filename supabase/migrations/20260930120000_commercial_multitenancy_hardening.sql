-- Commercial hardening: tenant isolation, append-only audit and atomic workflows.
-- Existing records are assigned to a deterministic bootstrap tenant. New records
-- receive the active tenant from the authenticated membership or a tenant parent.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 2 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  enabled boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_memberships_active_user
  ON public.tenant_memberships(user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user
  ON public.tenant_memberships(user_id, tenant_id);

INSERT INTO public.tenants (id, nome, slug)
VALUES ('00000000-0000-4000-8000-000000000001', 'AnjoLav', 'anjolav')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  users.id,
  CASE WHEN EXISTS (
    SELECT 1 FROM public.user_roles roles
    WHERE roles.user_id = users.id AND roles.role = 'admin'::public.app_role
  ) THEN 'admin' ELSE 'member' END,
  true
FROM auth.users users
ON CONFLICT (tenant_id, user_id) DO UPDATE
SET is_active = true,
    updated_at = now();

CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT membership.tenant_id
  FROM public.tenant_memberships membership
  JOIN public.tenants tenant ON tenant.id = membership.tenant_id
  WHERE membership.user_id = auth.uid()
    AND membership.enabled
    AND membership.is_active
    AND tenant.status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_member(_tenant_id uuid)
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
      AND tenant.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION private.is_tenant_admin(_tenant_id uuid)
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

REVOKE ALL ON FUNCTION private.current_tenant_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_tenant_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_tenant_admin(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_tenant_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_tenant_admin(uuid) TO authenticated, service_role;

-- Add the tenant discriminator to every business table without rewriting the
-- historical migrations. The bootstrap value is removed as a default after
-- backfill; authenticated writes then use the active membership.
DO $migration$
DECLARE
  table_name text;
  tenant_tables constant text[] := ARRAY[
    'agendamentos', 'area_permissoes', 'asaas_charges', 'asaas_webhook_events',
    'automacoes_config', 'beneficios_catalogo', 'caixa_movimentacoes', 'caixas',
    'categorias_financeiras', 'centros_custo', 'clientes', 'configuracoes_cliente',
    'configuracoes_fiscais', 'configuracoes_gerais', 'configuracoes_pagamento_cliente',
    'contas_pagar', 'contratos_aluguel', 'descricoes_servicos_fiscais', 'enderecos_clientes',
    'estoque_produtos', 'etiquetas_configuracoes', 'eventos_agenda', 'faturas',
    'folha_beneficios', 'folha_pagamento', 'folha_pagamento_historico', 'fornecedores',
    'funcionarios', 'historico_envios', 'historico_producao', 'itens_contrato_aluguel',
    'itens_lancamento', 'itens_lancamento_cliente', 'itens_ordem_servico',
    'lancamentos', 'lancamentos_cliente', 'lancamentos_fatura', 'lotes_ordens',
    'lotes_producao', 'mensagens_log', 'modulo_permissoes', 'motoristas',
    'movimentacoes_estoque', 'notificacoes_config', 'notificacoes_enviadas',
    'orcamentos', 'ordens_servico', 'paradas_rota', 'pdv_pagamentos', 'portal_config',
    'precos_especiais', 'produtos', 'rol_configuracoes', 'rotas_entrega', 'user_roles',
    'veiculos', 'whatsapp_instancias'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Tabela obrigatória ausente durante tenancy: %', table_name;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', table_name);
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL', table_name
    ) USING '00000000-0000-4000-8000-000000000001'::uuid;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', table_name);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT private.current_tenant_id()',
      table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
      'idx_' || table_name || '_tenant', table_name
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (id, tenant_id)',
      'uq_' || table_name || '_id_tenant', table_name
    );
  END LOOP;
END
$migration$;

-- Any FK between two tenant tables must point to a row from the same tenant.
-- The original FK remains responsible for its configured delete behaviour.
DO $tenant_fks$
DECLARE
  relation record;
  constraint_name text;
BEGIN
  FOR relation IN
    SELECT
      child_ns.nspname AS child_schema,
      child.relname AS child_table,
      child_col.attname AS child_column,
      parent_ns.nspname AS parent_schema,
      parent.relname AS parent_table,
      parent_col.attname AS parent_column
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN pg_attribute child_col
      ON child_col.attrelid = child.oid AND child_col.attnum = fk.conkey[1]
    JOIN pg_attribute parent_col
      ON parent_col.attrelid = parent.oid AND parent_col.attnum = fk.confkey[1]
    WHERE fk.contype = 'f'
      AND cardinality(fk.conkey) = 1
      AND child_ns.nspname = 'public'
      AND parent_ns.nspname = 'public'
      AND parent_col.attname = 'id'
      AND EXISTS (
        SELECT 1 FROM pg_attribute attribute
        WHERE attribute.attrelid = child.oid AND attribute.attname = 'tenant_id' AND NOT attribute.attisdropped
      )
      AND EXISTS (
        SELECT 1 FROM pg_attribute attribute
        WHERE attribute.attrelid = parent.oid AND attribute.attname = 'tenant_id' AND NOT attribute.attisdropped
      )
  LOOP
    constraint_name := 'tenant_fk_' || substr(md5(
      relation.child_table || ':' || relation.child_column || ':' || relation.parent_table
    ), 1, 20);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I, tenant_id) REFERENCES %I.%I (%I, tenant_id) NOT VALID',
        relation.child_schema, relation.child_table, constraint_name, relation.child_column,
        relation.parent_schema, relation.parent_table, relation.parent_column
      );
      EXECUTE format(
        'ALTER TABLE %I.%I VALIDATE CONSTRAINT %I',
        relation.child_schema, relation.child_table, constraint_name
      );
    END IF;
  END LOOP;
END
$tenant_fks$;

-- SECURITY DEFINER workflows (payments, webhooks and employee management) use
-- service_role and therefore have no auth.uid(). Derive their tenant from a
-- tenant-scoped parent FK, while rejecting mixed-tenant relationships.
CREATE OR REPLACE FUNCTION private.assign_and_validate_row_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  target_tenant uuid := nullif(to_jsonb(NEW)->>'tenant_id', '')::uuid;
  session_tenant uuid := private.current_tenant_id();
  parent_tenant uuid;
  relation record;
  foreign_value text;
BEGIN
  IF target_tenant IS NULL THEN target_tenant := session_tenant; END IF;
  IF TG_OP = 'UPDATE'
    AND nullif(to_jsonb(OLD)->>'tenant_id', '')::uuid IS DISTINCT FROM target_tenant
  THEN
    RAISE EXCEPTION 'A empresa de um registro existente não pode ser alterada';
  END IF;

  FOR relation IN
    SELECT
      child_column.attname AS child_column,
      parent_ns.nspname AS parent_schema,
      parent.relname AS parent_table,
      parent_column.attname AS parent_column
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN pg_attribute child_column
      ON child_column.attrelid = child.oid AND child_column.attnum = fk.conkey[1]
    JOIN pg_attribute parent_column
      ON parent_column.attrelid = parent.oid AND parent_column.attnum = fk.confkey[1]
    WHERE fk.contype = 'f'
      AND cardinality(fk.conkey) = 1
      AND fk.conrelid = TG_RELID
      AND parent_ns.nspname = 'public'
      AND parent_column.attname = 'id'
      AND EXISTS (
        SELECT 1 FROM pg_attribute attribute
        WHERE attribute.attrelid = parent.oid
          AND attribute.attname = 'tenant_id'
          AND NOT attribute.attisdropped
      )
  LOOP
    foreign_value := to_jsonb(NEW)->>relation.child_column;
    IF foreign_value IS NULL OR foreign_value = '' THEN CONTINUE; END IF;

    EXECUTE format(
      'SELECT tenant_id FROM %I.%I WHERE %I::text = $1',
      relation.parent_schema, relation.parent_table, relation.parent_column
    ) INTO parent_tenant USING foreign_value;

    IF parent_tenant IS NOT NULL AND target_tenant IS NULL THEN
      target_tenant := parent_tenant;
    ELSIF parent_tenant IS NOT NULL AND parent_tenant IS DISTINCT FROM target_tenant THEN
      RAISE EXCEPTION 'Relacionamento entre empresas diferentes bloqueado em %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME;
    END IF;
  END LOOP;

  IF target_tenant IS NULL THEN
    SELECT min(id) INTO target_tenant
    FROM public.tenants
    WHERE status = 'active'
    HAVING count(*) = 1;
  END IF;
  IF target_tenant IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar a empresa para %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME;
  END IF;
  IF session_tenant IS NOT NULL AND target_tenant IS DISTINCT FROM session_tenant THEN
    RAISE EXCEPTION 'Operação fora da empresa ativa bloqueada';
  END IF;

  NEW := jsonb_populate_record(NEW, jsonb_build_object('tenant_id', target_tenant));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.assign_and_validate_row_tenant() FROM PUBLIC, anon, authenticated;

DO $tenant_triggers$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT columns.table_name
    FROM information_schema.columns columns
    WHERE columns.table_schema = 'public'
      AND columns.column_name = 'tenant_id'
      AND columns.table_name NOT IN ('tenants', 'tenant_memberships', 'audit_events')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_row_tenant ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER enforce_row_tenant BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.assign_and_validate_row_tenant()',
      table_name
    );
  END LOOP;
END
$tenant_triggers$;

-- Uniqueness that previously leaked or coupled separate companies.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_tenant_user_role
  ON public.user_roles(tenant_id, user_id, role);
ALTER TABLE public.area_permissoes DROP CONSTRAINT IF EXISTS area_permissoes_user_id_area_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_area_permissoes_tenant_user_area
  ON public.area_permissoes(tenant_id, user_id, area);
ALTER TABLE public.funcionarios DROP CONSTRAINT IF EXISTS funcionarios_login_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_funcionarios_tenant_login
  ON public.funcionarios(tenant_id, lower(login));
ALTER TABLE public.veiculos DROP CONSTRAINT IF EXISTS veiculos_placa_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_veiculos_tenant_placa
  ON public.veiculos(tenant_id, upper(placa));
ALTER TABLE public.ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_numero_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ordens_servico_tenant_numero
  ON public.ordens_servico(tenant_id, numero);
DROP INDEX IF EXISTS public.idx_clientes_cpf_cnpj_unique;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_tenant_documento
  ON public.clientes(tenant_id, regexp_replace(cpf_cnpj, '\D', '', 'g'))
  WHERE cpf_cnpj IS NOT NULL AND regexp_replace(cpf_cnpj, '\D', '', 'g') <> '';
UPDATE public.produtos SET unidade_negocio = 'ambos' WHERE unidade_negocio IS NULL;
ALTER TABLE public.produtos ALTER COLUMN unidade_negocio SET DEFAULT 'ambos';
ALTER TABLE public.produtos ALTER COLUMN unidade_negocio SET NOT NULL;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.user_roles roles
    WHERE roles.user_id = _user_id
      AND roles.tenant_id = private.current_tenant_id()
      AND roles.role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_funcionario_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT employee.id
  FROM public.funcionarios employee
  WHERE employee.user_id = _user_id
    AND employee.tenant_id = private.current_tenant_id()
    AND (_user_id = auth.uid() OR private.is_tenant_admin(employee.tenant_id))
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_area_access(_user_id uuid, _area text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT _user_id = auth.uid() AND (
    private.is_tenant_admin(private.current_tenant_id())
    OR EXISTS (
      SELECT 1 FROM public.area_permissoes permission
      WHERE permission.user_id = _user_id
        AND permission.tenant_id = private.current_tenant_id()
        AND permission.area = _area
    )
  )
$$;

CREATE OR REPLACE FUNCTION private.has_any_module_access(_modules text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND private.is_tenant_member(private.current_tenant_id())
    AND (
      private.is_tenant_admin(private.current_tenant_id())
      OR EXISTS (
        SELECT 1
        FROM public.funcionarios employee
        JOIN public.modulo_permissoes permission
          ON permission.funcionario_id = employee.id
         AND permission.tenant_id = employee.tenant_id
        WHERE employee.user_id = auth.uid()
          AND employee.tenant_id = private.current_tenant_id()
          AND employee.ativo
          AND permission.tem_acesso
          AND permission.modulo_key = ANY(_modules)
      )
    )
$$;

-- Area authorization is enforced in the database as well as in the UI. A
-- central-area user has the consolidated view; operational users only see
-- records connected to their permitted business area.
CREATE OR REPLACE FUNCTION private.can_access_area(_area text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND private.is_tenant_member(private.current_tenant_id())
    AND (
      private.is_tenant_admin(private.current_tenant_id())
      OR EXISTS (
        SELECT 1
        FROM public.area_permissoes permission
        WHERE permission.user_id = auth.uid()
          AND permission.tenant_id = private.current_tenant_id()
          AND (
            permission.area = 'central'
            OR permission.area = lower(coalesce(_area, ''))
          )
      )
    )
$$;

CREATE OR REPLACE FUNCTION private.can_access_client(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.clientes client
    WHERE client.id = _cliente_id
      AND client.tenant_id = private.current_tenant_id()
      AND private.can_access_area(client.classificacao)
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_order(_ordem_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.ordens_servico service_order
    WHERE service_order.id = _ordem_id
      AND service_order.tenant_id = private.current_tenant_id()
      AND private.can_access_area(
        CASE
          WHEN lower(coalesce(service_order.origem, 'industrial')) IN ('residencial', 'loja')
            THEN 'residencial'
          ELSE 'industrial'
        END
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_product(_produto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.produtos product
    WHERE product.id = _produto_id
      AND product.tenant_id = private.current_tenant_id()
      AND CASE coalesce(product.unidade_negocio, 'ambos')
        WHEN 'ID1' THEN private.can_access_area('industrial')
        WHEN 'ID2' THEN private.can_access_area('residencial')
        ELSE private.can_access_area('industrial') OR private.can_access_area('residencial')
      END
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_invoice(_fatura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.faturas invoice
    WHERE invoice.id = _fatura_id
      AND invoice.tenant_id = private.current_tenant_id()
      AND private.can_access_client(invoice.cliente_id)
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_launch(_lancamento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.lancamentos launch
    WHERE launch.id = _lancamento_id
      AND launch.tenant_id = private.current_tenant_id()
      AND private.can_access_client(launch.cliente_id)
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_portal_launch(_lancamento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.lancamentos_cliente launch
    WHERE launch.id = _lancamento_id
      AND launch.tenant_id = private.current_tenant_id()
      AND private.can_access_client(launch.cliente_id)
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_contract(_contrato_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.contratos_aluguel contract
    WHERE contract.id = _contrato_id
      AND contract.tenant_id = private.current_tenant_id()
      AND private.can_access_client(contract.cliente_id)
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_appointment(_agendamento_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.is_tenant_admin(private.current_tenant_id()) OR EXISTS (
    SELECT 1
    FROM public.agendamentos appointment
    WHERE appointment.id = _agendamento_id
      AND appointment.tenant_id = private.current_tenant_id()
      AND private.can_access_client(appointment.cliente_id)
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_funcionario_for_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_area_access(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_any_module_access(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_area(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_client(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_product(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_invoice(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_launch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_portal_launch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_contract(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_funcionario_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_area_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_module_access(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_area(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_product(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_invoice(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_launch(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_portal_launch(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_contract(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_appointment(uuid) TO authenticated, service_role;

-- Operational billing screens receive only the fiscal fields required to
-- prepare an invoice. Certificate locations, encrypted passwords, CSC data and
-- provider endpoints remain restricted to tenant administrators/service code.
CREATE OR REPLACE FUNCTION public.get_fiscal_configs_for_operations()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT CASE
    WHEN NOT private.has_any_module_access(ARRAY['clientes', 'faturamento']) THEN
      '[]'::jsonb
    ELSE coalesce(jsonb_agg(
      jsonb_build_object(
        'id', config.id,
        'nome', config.nome,
        'cnpj', config.cnpj,
        'razao_social', config.razao_social,
        'inscricao_municipal', config.inscricao_municipal,
        'inscricao_estadual', config.inscricao_estadual,
        'endereco', config.endereco,
        'aliquota_iss', config.aliquota_iss,
        'codigo_servico', config.codigo_servico,
        'ambiente', config.ambiente,
        'ativo', config.ativo,
        'validade_certificado', config.validade_certificado,
        'regime_tributario', config.regime_tributario,
        'codigo_municipio_ibge', config.codigo_municipio_ibge,
        'modo_emissao', config.modo_emissao,
        'created_at', config.created_at,
        'updated_at', config.updated_at
      ) ORDER BY config.nome
    ), '[]'::jsonb)
  END
  FROM public.configuracoes_fiscais config
  WHERE config.tenant_id = private.current_tenant_id()
$$;
REVOKE ALL ON FUNCTION public.get_fiscal_configs_for_operations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fiscal_configs_for_operations() TO authenticated;

-- Login aliases are resolved only by the rate-limitable Edge Function. The
-- historical RPC disclosed employee e-mail addresses and must not remain
-- callable from the browser.
REVOKE ALL ON FUNCTION public.get_employee_email_by_login(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_email_by_login(text) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  target_role public.app_role;
BEGIN
  IF NEW.user_id IS NOT NULL AND (
    TG_OP = 'INSERT'
    OR OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.cargo IS DISTINCT FROM NEW.cargo
  ) THEN
    target_role := CASE
      WHEN upper(coalesce(NEW.cargo, '')) = 'ADMINISTRADOR' THEN 'admin'::public.app_role
      WHEN upper(coalesce(NEW.cargo, '')) IN ('PRODUCAO', 'PRODUÇÃO') THEN 'producao'::public.app_role
      ELSE 'operador'::public.app_role
    END;

    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, is_active)
    VALUES (
      NEW.tenant_id,
      NEW.user_id,
      CASE WHEN target_role = 'admin'::public.app_role THEN 'admin' ELSE 'member' END,
      NOT EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = NEW.user_id AND is_active)
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE
      SET role = EXCLUDED.role, updated_at = now();

    DELETE FROM public.user_roles
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id;

    INSERT INTO public.user_roles (tenant_id, user_id, role)
    VALUES (NEW.tenant_id, NEW.user_id, target_role)
    ON CONFLICT (tenant_id, user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_tenant_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT jsonb_build_object(
    'activeTenantId', private.current_tenant_id(),
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

CREATE OR REPLACE FUNCTION public.switch_active_tenant(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id AND enabled
  ) THEN
    RAISE EXCEPTION 'Empresa não autorizada';
  END IF;

  UPDATE public.tenant_memberships
  SET is_active = false, updated_at = now()
  WHERE user_id = auth.uid() AND is_active;

  UPDATE public.tenant_memberships
  SET is_active = true, updated_at = now()
  WHERE user_id = auth.uid() AND tenant_id = _tenant_id;

  RETURN public.get_my_tenant_context();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_tenant_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.switch_active_tenant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_tenant_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_active_tenant(uuid) TO authenticated;

-- Remove every historical permissive policy before rebuilding tenant-aware RLS.
DO $drop_policies$
DECLARE policy record;
BEGIN
  FOR policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'tenant_id'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy.policyname, policy.schemaname, policy.tablename);
  END LOOP;
END
$drop_policies$;

DO $tenant_rls$
DECLARE
  table_name text;
  admin_table text;
  service_table text;
  no_delete_table text;
  allowed_modules text[];
  module_check text;
  area_check text;
  access_check text;
  tenant_tables text[];
  admin_tables constant text[] := ARRAY[
    'area_permissoes', 'automacoes_config', 'beneficios_catalogo',
    'categorias_financeiras', 'centros_custo', 'configuracoes_fiscais',
    'configuracoes_gerais', 'descricoes_servicos_fiscais', 'etiquetas_configuracoes',
    'folha_beneficios', 'folha_pagamento', 'folha_pagamento_historico',
    'funcionarios', 'modulo_permissoes', 'notificacoes_config', 'portal_config',
    'rol_configuracoes', 'user_roles', 'whatsapp_instancias'
  ];
  service_tables constant text[] := ARRAY[
    'asaas_charges', 'asaas_webhook_events', 'pdv_pagamentos'
  ];
  no_delete_tables constant text[] := ARRAY[
    'caixa_movimentacoes', 'faturas', 'historico_envios', 'historico_producao',
    'lancamentos', 'lancamentos_cliente', 'mensagens_log', 'movimentacoes_estoque',
    'notificacoes_enviadas', 'ordens_servico'
  ];
BEGIN
  SELECT array_agg(columns.table_name ORDER BY columns.table_name) INTO tenant_tables
  FROM information_schema.columns columns
  WHERE columns.table_schema = 'public' AND columns.column_name = 'tenant_id'
    AND columns.table_name NOT IN ('tenants', 'tenant_memberships');

  FOREACH table_name IN ARRAY tenant_tables LOOP
    allowed_modules := CASE
      WHEN table_name = ANY(ARRAY[
        'agendamentos', 'eventos_agenda', 'rotas_entrega', 'paradas_rota'
      ]) THEN ARRAY['agenda', 'ordens', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'clientes', 'enderecos_clientes', 'configuracoes_cliente',
        'configuracoes_pagamento_cliente', 'contratos_aluguel',
        'itens_contrato_aluguel', 'precos_especiais'
      ]) THEN ARRAY['clientes', 'ordens', 'agenda', 'faturamento', 'caixa', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'produtos', 'estoque_produtos', 'movimentacoes_estoque', 'fornecedores'
      ]) THEN ARRAY['produtos', 'ordens', 'producao', 'caixa', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'ordens_servico', 'itens_ordem_servico', 'historico_producao',
        'lotes_ordens', 'lotes_producao'
      ]) THEN ARRAY['ordens', 'producao', 'faturamento', 'caixa', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'caixas', 'caixa_movimentacoes', 'contas_pagar', 'faturas',
        'historico_envios', 'itens_lancamento', 'itens_lancamento_cliente',
        'lancamentos', 'lancamentos_cliente', 'lancamentos_fatura'
      ]) THEN ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'mensagens_log', 'notificacoes_enviadas'
      ]) THEN ARRAY['ordens', 'faturamento', 'agenda', 'dashboard']
      WHEN table_name = ANY(ARRAY['motoristas', 'veiculos'])
        THEN ARRAY['agenda', 'ordens', 'producao', 'configuracoes']
      ELSE ARRAY['dashboard']
    END;
    module_check := format('private.has_any_module_access(%L::text[])', allowed_modules);
    area_check := CASE
      WHEN table_name = 'clientes'
        THEN 'private.can_access_area(classificacao)'
      WHEN table_name = 'ordens_servico'
        THEN 'private.can_access_area(CASE WHEN lower(coalesce(origem, ''industrial'')) IN (''residencial'', ''loja'') THEN ''residencial'' ELSE ''industrial'' END)'
      WHEN table_name = 'produtos'
        THEN 'CASE coalesce(unidade_negocio, ''ambos'') WHEN ''ID1'' THEN private.can_access_area(''industrial'') WHEN ''ID2'' THEN private.can_access_area(''residencial'') ELSE private.can_access_area(''industrial'') OR private.can_access_area(''residencial'') END'
      WHEN table_name = ANY(ARRAY[
        'agendamentos', 'configuracoes_cliente', 'configuracoes_pagamento_cliente',
        'contratos_aluguel', 'enderecos_clientes', 'faturas', 'lancamentos',
        'lancamentos_cliente', 'orcamentos'
      ]) THEN 'private.can_access_client(cliente_id)'
      WHEN table_name = 'precos_especiais'
        THEN 'private.can_access_client(cliente_id) AND private.can_access_product(produto_id)'
      WHEN table_name = ANY(ARRAY[
        'historico_producao', 'itens_ordem_servico', 'lotes_ordens',
        'notificacoes_enviadas'
      ]) THEN 'private.can_access_order(ordem_servico_id)'
      WHEN table_name = 'mensagens_log'
        THEN '(private.can_access_order(ordem_servico_id) OR private.can_access_client(cliente_id))'
      WHEN table_name = 'paradas_rota'
        THEN '(private.can_access_order(ordem_servico_id) OR private.can_access_client(cliente_id) OR private.can_access_appointment(agendamento_id))'
      WHEN table_name = 'historico_envios'
        THEN 'private.can_access_invoice(fatura_id)'
      WHEN table_name = 'itens_lancamento'
        THEN 'private.can_access_launch(lancamento_id)'
      WHEN table_name = 'itens_lancamento_cliente'
        THEN 'private.can_access_portal_launch(lancamento_id)'
      WHEN table_name = 'lancamentos_fatura'
        THEN 'private.can_access_launch(lancamento_id) AND private.can_access_invoice(fatura_id)'
      WHEN table_name = 'itens_contrato_aluguel'
        THEN 'private.can_access_contract(contrato_id)'
      ELSE 'true'
    END;
    access_check := format('(%s) AND (%s)', module_check, area_check);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);

    IF NOT table_name = ANY(service_tables) AND NOT table_name = ANY(admin_tables) AND table_name NOT IN (
      'configuracoes_fiscais', 'folha_pagamento', 'folha_beneficios',
      'folha_pagamento_historico', 'funcionarios', 'user_roles',
      'area_permissoes', 'modulo_permissoes', 'whatsapp_instancias'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (tenant_id = private.current_tenant_id() AND %s)',
        table_name, access_check
      );
    END IF;

    IF NOT table_name = ANY(admin_tables) AND NOT table_name = ANY(service_tables) THEN
      EXECUTE format(
        'CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = private.current_tenant_id() AND %s)',
        table_name, access_check
      );
      EXECUTE format(
        'CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (tenant_id = private.current_tenant_id() AND %s) WITH CHECK (tenant_id = private.current_tenant_id() AND %s)',
        table_name, access_check, access_check
      );
      IF NOT table_name = ANY(no_delete_tables) THEN
        EXECUTE format(
          'CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (tenant_id = private.current_tenant_id() AND %s)',
          table_name, access_check
        );
      END IF;
    END IF;
  END LOOP;

  FOREACH admin_table IN ARRAY admin_tables LOOP
    EXECUTE format(
      'CREATE POLICY tenant_admin_manage ON public.%I FOR ALL TO authenticated USING (private.is_tenant_admin(tenant_id)) WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))',
      admin_table
    );
  END LOOP;

  FOREACH service_table IN ARRAY service_tables LOOP
    EXECUTE format(
      'CREATE POLICY tenant_admin_read ON public.%I FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id))',
      service_table
    );
  END LOOP;
END
$tenant_rls$;

-- Historical reporting views must execute with the caller's RLS instead of the
-- view owner's privileges, otherwise they can bypass tenant and area policies.
ALTER VIEW public.v_contas_receber SET (security_invoker = true);
ALTER VIEW public.v_fluxo_caixa SET (security_invoker = true);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenants, public.tenant_memberships FROM PUBLIC, anon;
GRANT SELECT ON public.tenants, public.tenant_memberships TO authenticated;
GRANT ALL ON public.tenants, public.tenant_memberships TO service_role;

CREATE POLICY tenant_member_read_tenant ON public.tenants
  FOR SELECT TO authenticated USING (private.is_tenant_member(id));
CREATE POLICY tenant_member_read_membership ON public.tenant_memberships
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR private.is_tenant_admin(tenant_id)
  );
CREATE POLICY tenant_admin_manage_membership ON public.tenant_memberships
  FOR ALL TO authenticated
  USING (private.is_tenant_admin(tenant_id))
  WITH CHECK (private.is_tenant_admin(tenant_id));

CREATE POLICY employee_self_read ON public.funcionarios
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY own_roles_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY own_areas_read ON public.area_permissoes
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND user_id = auth.uid());
CREATE POLICY own_module_permissions_read ON public.modulo_permissoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND funcionario_id = public.get_funcionario_for_user(auth.uid())
  );
CREATE POLICY tenant_member_read_general_config ON public.configuracoes_gerais
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.is_tenant_member(tenant_id)
  );
CREATE POLICY tenant_finance_read_categories ON public.categorias_financeiras
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'relatorios'])
  );
CREATE POLICY tenant_finance_read_cost_centers ON public.centros_custo
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'relatorios'])
  );
CREATE POLICY tenant_billing_read_service_descriptions ON public.descricoes_servicos_fiscais
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['clientes', 'faturamento'])
  );
CREATE POLICY tenant_operations_read_label_config ON public.etiquetas_configuracoes
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['ordens', 'producao', 'caixa'])
  );
CREATE POLICY tenant_operations_read_rol_config ON public.rol_configuracoes
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['ordens', 'producao', 'faturamento'])
  );
CREATE POLICY tenant_clients_read_portal_config ON public.portal_config
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['clientes'])
  );
CREATE POLICY tenant_admin_read_fiscal ON public.configuracoes_fiscais
  FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id));
CREATE POLICY tenant_admin_read_whatsapp ON public.whatsapp_instancias
  FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id));
CREATE POLICY tenant_admin_read_payroll ON public.folha_pagamento
  FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id));
CREATE POLICY employee_read_own_payroll ON public.folha_pagamento
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND funcionario_id = public.get_funcionario_for_user(auth.uid())
  );
CREATE POLICY tenant_admin_read_benefits ON public.folha_beneficios
  FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id));
CREATE POLICY employee_read_own_benefits ON public.folha_beneficios
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND funcionario_id = public.get_funcionario_for_user(auth.uid())
  );
CREATE POLICY tenant_admin_read_payroll_history ON public.folha_pagamento_historico
  FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id));
CREATE POLICY employee_read_own_payroll_history ON public.folha_pagamento_historico
  FOR SELECT TO authenticated USING (
    tenant_id = private.current_tenant_id()
    AND funcionario_id = public.get_funcionario_for_user(auth.uid())
  );

-- Append-only audit trail for sensitive mutations.
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_schema text NOT NULL,
  entity_table text NOT NULL,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_events_tenant_occurred
  ON public.audit_events(tenant_id, occurred_at DESC);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
CREATE POLICY tenant_admin_read_audit ON public.audit_events
  FOR SELECT TO authenticated USING (private.is_tenant_admin(tenant_id));

CREATE OR REPLACE FUNCTION private.redact_audit_data(_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, private, pg_temp
AS $$
  SELECT CASE WHEN _data IS NULL THEN NULL ELSE _data - ARRAY[
    'api_key', 'api_key_encrypted', 'access_token', 'refresh_token', 'token',
    'webhook_token', 'senha', 'password', 'senha_certificado_encrypted',
    'certificado', 'certificado_base64', 'certificate', 'certificate_secret'
  ]::text[] END
$$;
REVOKE ALL ON FUNCTION private.redact_audit_data(jsonb) FROM PUBLIC, anon, authenticated;

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
    tenant_id, actor_id, action, entity_schema, entity_table, entity_id, old_data, new_data
  ) VALUES (
    (source->>'tenant_id')::uuid,
    auth.uid(),
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    source->>'id',
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN private.redact_audit_data(to_jsonb(OLD)) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN private.redact_audit_data(to_jsonb(NEW)) END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.write_audit_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.redact_audit_data(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.write_audit_event() TO service_role;

DO $audit_triggers$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'asaas_charges', 'configuracoes_fiscais', 'faturas', 'ordens_servico',
    'pdv_pagamentos', 'tenant_memberships', 'user_roles', 'whatsapp_instancias'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_mutation ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER audit_mutation AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.write_audit_event()',
      table_name
    );
  END LOOP;
END
$audit_triggers$;

-- Business records are cancelled, never physically erased with their payments.
ALTER TABLE public.pdv_pagamentos
  DROP CONSTRAINT IF EXISTS pdv_pagamentos_ordem_servico_id_fkey;
ALTER TABLE public.pdv_pagamentos
  ADD CONSTRAINT pdv_pagamentos_ordem_servico_id_fkey
  FOREIGN KEY (ordem_servico_id) REFERENCES public.ordens_servico(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.cancelar_ordem_servico(
  _ordem_servico_id uuid,
  _motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE order_row public.ordens_servico%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_any_module_access(ARRAY['ordens']) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF length(trim(coalesce(_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Informe um motivo de cancelamento com ao menos 5 caracteres';
  END IF;

  SELECT * INTO order_row
  FROM public.ordens_servico
  WHERE id = _ordem_servico_id
    AND tenant_id = private.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada nesta empresa'; END IF;
  IF NOT private.can_access_order(order_row.id) THEN RAISE EXCEPTION 'Acesso negado para esta área'; END IF;
  IF order_row.status IN ('entregue', 'cancelada') THEN
    RAISE EXCEPTION 'Esta OS não pode ser cancelada no status atual';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pdv_pagamentos
    WHERE ordem_servico_id = order_row.id
      AND tenant_id = order_row.tenant_id
      AND status IN ('CONFIRMADO', 'EM_REVISAO')
  ) THEN
    RAISE EXCEPTION 'Estorne os pagamentos confirmados antes de cancelar a OS';
  END IF;

  UPDATE public.ordens_servico SET status = 'cancelada' WHERE id = order_row.id;
  UPDATE public.historico_producao
  SET observacoes = left(trim(_motivo), 1000),
      dados_formulario = coalesce(dados_formulario, '{}'::jsonb) || jsonb_build_object('cancelledBy', auth.uid())
  WHERE id = (
    SELECT id FROM public.historico_producao
    WHERE ordem_servico_id = order_row.id AND etapa_nova = 'cancelada'
    ORDER BY created_at DESC LIMIT 1
  );

  RETURN jsonb_build_object('id', order_row.id, 'status', 'cancelada');
END;
$$;

CREATE OR REPLACE FUNCTION public.avancar_etapa_producao(
  _ordem_servico_id uuid,
  _etapa_esperada text,
  _proxima_etapa text,
  _funcionario_id uuid,
  _observacoes text,
  _dados_formulario jsonb,
  _itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  order_row public.ordens_servico%ROWTYPE;
  item jsonb;
  product_row public.produtos%ROWTYPE;
  quantity numeric;
  unit_price numeric;
  allowed_next text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_any_module_access(ARRAY['ordens', 'producao']) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO order_row
  FROM public.ordens_servico
  WHERE id = _ordem_servico_id
    AND tenant_id = private.current_tenant_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada nesta empresa'; END IF;
  IF NOT private.can_access_order(order_row.id) THEN RAISE EXCEPTION 'Acesso negado para esta área'; END IF;
  IF order_row.status IS DISTINCT FROM _etapa_esperada THEN
    RAISE EXCEPTION 'A OS foi alterada por outro usuário; atualize a tela';
  END IF;

  allowed_next := CASE _etapa_esperada
    WHEN 'retirada' THEN 'separacao'
    WHEN 'separacao' THEN 'lavagem'
    WHEN 'lavagem' THEN 'secagem'
    WHEN 'secagem' THEN 'passadoria'
    WHEN 'passadoria' THEN 'embalagem'
    WHEN 'embalagem' THEN 'expedicao'
    WHEN 'expedicao' THEN 'entregue'
    ELSE NULL
  END;
  IF allowed_next IS NULL OR allowed_next <> _proxima_etapa THEN
    RAISE EXCEPTION 'Transição de produção inválida';
  END IF;
  IF _funcionario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios
    WHERE id = _funcionario_id AND tenant_id = order_row.tenant_id AND ativo
  ) THEN
    RAISE EXCEPTION 'Funcionário inválido para esta empresa';
  END IF;
  IF jsonb_typeof(coalesce(_dados_formulario, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Dados da etapa inválidos';
  END IF;
  IF octet_length(coalesce(_dados_formulario, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Dados da etapa excedem o limite permitido';
  END IF;
  IF jsonb_typeof(coalesce(_itens, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(_itens, '[]'::jsonb)) > 200 THEN
    RAISE EXCEPTION 'Itens da etapa inválidos';
  END IF;
  IF _etapa_esperada <> 'separacao' AND jsonb_array_length(coalesce(_itens, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Itens só podem ser incluídos durante a separação';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(_itens, '[]'::jsonb)) LOOP
    BEGIN
      quantity := (item->>'quantidade')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Quantidade inválida';
    END;
    IF quantity <= 0 OR quantity > 999 OR coalesce(item->>'produto_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Item de separação inválido';
    END IF;

    SELECT * INTO product_row FROM public.produtos
    WHERE id = (item->>'produto_id')::uuid
      AND tenant_id = order_row.tenant_id
      AND status = 'ativo'
      AND CASE
        WHEN lower(coalesce(order_row.origem, 'industrial')) IN ('residencial', 'loja')
          THEN coalesce(unidade_negocio, 'ambos') IN ('ID2', 'ambos')
        ELSE coalesce(unidade_negocio, 'ambos') IN ('ID1', 'ambos')
      END;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido ou inativo'; END IF;

    SELECT coalesce(price.preco_especial, product_row.preco)
    INTO unit_price
    FROM (SELECT 1) source
    LEFT JOIN public.precos_especiais price
      ON price.tenant_id = order_row.tenant_id
     AND price.cliente_id = order_row.cliente_id
     AND price.produto_id = product_row.id
    LIMIT 1;

    INSERT INTO public.itens_ordem_servico (
      tenant_id, ordem_servico_id, produto_id, quantidade, preco_unitario, subtotal
    ) VALUES (
      order_row.tenant_id, order_row.id, product_row.id, quantity,
      round(unit_price::numeric, 2), round(unit_price::numeric * quantity, 2)
    );
  END LOOP;

  UPDATE public.ordens_servico
  SET status = _proxima_etapa,
      data_entrega = CASE WHEN _proxima_etapa = 'entregue' THEN current_date ELSE data_entrega END
  WHERE id = order_row.id;

  UPDATE public.historico_producao
  SET funcionario_id = _funcionario_id,
      observacoes = nullif(left(trim(coalesce(_observacoes, '')), 1000), ''),
      dados_formulario = coalesce(_dados_formulario, '{}'::jsonb)
  WHERE id = (
    SELECT id FROM public.historico_producao
    WHERE ordem_servico_id = order_row.id
      AND etapa_anterior = _etapa_esperada
      AND etapa_nova = _proxima_etapa
    ORDER BY created_at DESC LIMIT 1
  );

  RETURN jsonb_build_object('id', order_row.id, 'status', _proxima_etapa);
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_ordem_servico(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.avancar_etapa_producao(uuid, text, text, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_servico(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avancar_etapa_producao(uuid, text, text, uuid, text, jsonb, jsonb) TO authenticated;

-- Portal controls: revocation/expiry, rate-limit ledger and idempotent launches.
ALTER TABLE public.configuracoes_cliente
  ADD COLUMN IF NOT EXISTS portal_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS portal_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS portal_revogado_em timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_configuracoes_cliente_portal_code
  ON public.configuracoes_cliente(codigo_acesso)
  WHERE codigo_acesso IS NOT NULL;
ALTER TABLE public.lancamentos_cliente
  ADD COLUMN IF NOT EXISTS portal_idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lancamentos_cliente_tenant_portal_idempotency
  ON public.lancamentos_cliente(tenant_id, portal_idempotency_key)
  WHERE portal_idempotency_key IS NOT NULL;

CREATE TABLE public.portal_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  client_hash text NOT NULL CHECK (client_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  UNIQUE (tenant_id, code_hash, client_hash)
);
ALTER TABLE public.portal_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.portal_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_portal_rate_limit(
  _tenant_id uuid,
  _code_hash text,
  _client_hash text,
  _limit integer DEFAULT 60,
  _window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE rate_row public.portal_rate_limits%ROWTYPE;
BEGIN
  IF _limit < 1 OR _limit > 1000 OR _window_seconds < 10 OR _window_seconds > 3600 OR
     _code_hash !~ '^[a-f0-9]{64}$' OR _client_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Parâmetros de rate limit inválidos';
  END IF;

  INSERT INTO public.portal_rate_limits (tenant_id, code_hash, client_hash)
  VALUES (_tenant_id, _code_hash, _client_hash)
  ON CONFLICT (tenant_id, code_hash, client_hash) DO NOTHING;

  SELECT * INTO rate_row
  FROM public.portal_rate_limits
  WHERE tenant_id = _tenant_id AND code_hash = _code_hash AND client_hash = _client_hash
  FOR UPDATE;

  IF rate_row.window_started_at < now() - make_interval(secs => _window_seconds) THEN
    UPDATE public.portal_rate_limits
    SET window_started_at = now(), request_count = 1
    WHERE id = rate_row.id;
    RETURN true;
  END IF;
  IF rate_row.request_count >= _limit THEN RETURN false; END IF;

  UPDATE public.portal_rate_limits
  SET request_count = request_count + 1
  WHERE id = rate_row.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_lancamento_portal(
  _tenant_id uuid,
  _cliente_id uuid,
  _observacoes text,
  _itens jsonb,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE launch_row public.lancamentos_cliente%ROWTYPE;
DECLARE item jsonb;
BEGIN
  IF _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' OR jsonb_typeof(_itens) <> 'array' OR
     jsonb_array_length(_itens) < 1 OR jsonb_array_length(_itens) > 100 THEN
    RAISE EXCEPTION 'Lançamento do portal inválido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.clientes
    WHERE id = _cliente_id AND tenant_id = _tenant_id AND ativo
  ) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;

  SELECT * INTO launch_row FROM public.lancamentos_cliente
  WHERE tenant_id = _tenant_id AND portal_idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF launch_row.cliente_id <> _cliente_id THEN RAISE EXCEPTION 'Chave de idempotência inválida'; END IF;
    RETURN jsonb_build_object('id', launch_row.id, 'idempotent', true);
  END IF;

  INSERT INTO public.lancamentos_cliente (
    tenant_id, cliente_id, observacoes, status, portal_idempotency_key
  ) VALUES (
    _tenant_id, _cliente_id, nullif(left(trim(coalesce(_observacoes, '')), 500), ''),
    'pendente', _idempotency_key
  ) RETURNING * INTO launch_row;

  FOR item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    IF coalesce(item->>'produto_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      OR (item->>'quantidade')::integer < 1 OR (item->>'quantidade')::integer > 100000
      OR NOT EXISTS (
        SELECT 1 FROM public.produtos
        WHERE id = (item->>'produto_id')::uuid AND tenant_id = _tenant_id AND status = 'ativo'
      ) THEN
      RAISE EXCEPTION 'Item inválido no lançamento';
    END IF;
    INSERT INTO public.itens_lancamento_cliente (
      tenant_id, lancamento_id, produto_id, quantidade, observacoes
    ) VALUES (
      _tenant_id, launch_row.id, (item->>'produto_id')::uuid, (item->>'quantidade')::integer,
      nullif(left(trim(coalesce(item->>'observacoes', '')), 250), '')
    );
  END LOOP;

  RETURN jsonb_build_object('id', launch_row.id, 'idempotent', false);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO launch_row FROM public.lancamentos_cliente
  WHERE tenant_id = _tenant_id AND portal_idempotency_key = _idempotency_key;
  IF NOT FOUND OR launch_row.cliente_id <> _cliente_id THEN RAISE; END IF;
  RETURN jsonb_build_object('id', launch_row.id, 'idempotent', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_portal_rate_limit(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_lancamento_portal(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_portal_rate_limit(uuid, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.criar_lancamento_portal(uuid, uuid, text, jsonb, text) TO service_role;

-- Storage writes must use <tenant-id>/... paths. Public company assets remain
-- intentionally public; certificate objects remain private and admin-only.
DROP POLICY IF EXISTS "Admins can upload company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatar or admin" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar or admin" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar or admin" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete certificates" ON storage.objects;

CREATE POLICY tenant_admin_upload_company_assets ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
);
CREATE POLICY tenant_admin_update_company_assets ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
)
WITH CHECK (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
);
CREATE POLICY tenant_admin_delete_company_assets ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
);
CREATE POLICY tenant_admin_manage_avatars ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
);
CREATE POLICY tenant_admin_read_certificates ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
);
CREATE POLICY tenant_admin_write_certificates ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
)
WITH CHECK (
  bucket_id = 'certificates'
  AND (storage.foldername(name))[1] = private.current_tenant_id()::text
  AND private.is_tenant_admin(private.current_tenant_id())
);

COMMENT ON TABLE public.tenants IS 'Commercial SaaS tenants. Never trust a tenant id supplied by the browser.';
COMMENT ON TABLE public.audit_events IS 'Append-only audit evidence for sensitive commercial operations.';
COMMENT ON FUNCTION public.switch_active_tenant(uuid) IS 'Changes the server-side active membership and requires a full client cache reset.';
