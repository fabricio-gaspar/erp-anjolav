CREATE INDEX IF NOT EXISTS idx_clientes_pdv_tenant_nome
  ON public.clientes (tenant_id, razao_social);
