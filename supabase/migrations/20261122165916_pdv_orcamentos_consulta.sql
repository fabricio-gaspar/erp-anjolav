-- Give PDV quotes a stable reference and preserve the operation and actor
-- that created each proposal. Older rows keep NULL for unknown context.
ALTER TABLE public.orcamentos
  ADD COLUMN codigo text GENERATED ALWAYS AS (
    'ORC-' || upper(substr(replace(id::text, '-', ''), 1, 12))
  ) STORED,
  ADD COLUMN area_operacao text,
  ADD COLUMN criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_area_operacao_check
  CHECK (area_operacao IS NULL OR area_operacao IN ('residencial', 'industrial'));

CREATE UNIQUE INDEX orcamentos_tenant_codigo_uidx
  ON public.orcamentos (tenant_id, codigo);

CREATE INDEX orcamentos_tenant_area_created_at_idx
  ON public.orcamentos (tenant_id, area_operacao, created_at DESC);

-- Keep existing tenant, module, and client-area protections. These additive
-- policies let users with the cashier module save and consult proposals from
-- the PDV, while preserving all current dashboard policies.
CREATE POLICY caixa_orcamentos_select
  ON public.orcamentos
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['caixa']::text[])
    AND private.can_access_client(cliente_id)
  );

CREATE POLICY caixa_orcamentos_insert
  ON public.orcamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['caixa']::text[])
    AND private.can_access_client(cliente_id)
    AND criado_por = auth.uid()
  );
