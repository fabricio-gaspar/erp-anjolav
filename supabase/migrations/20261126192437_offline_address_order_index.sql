-- A paginação do pacote offline deve usar a ordem solicitada sem ordenar
-- todos os endereços antes de aplicar o limite e as políticas existentes.
CREATE INDEX IF NOT EXISTS idx_enderecos_offline_order
  ON public.enderecos_clientes (tenant_id, ativo DESC, principal DESC, updated_at DESC);
