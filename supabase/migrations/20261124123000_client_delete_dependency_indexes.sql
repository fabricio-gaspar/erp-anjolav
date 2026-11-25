-- Keep the guarded client-deletion checks index-backed on tenant-scoped tables.
CREATE INDEX IF NOT EXISTS caixa_movimentacoes_tenant_cliente_idx
  ON public.caixa_movimentacoes (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS lancamentos_tenant_cliente_idx
  ON public.lancamentos (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS lancamentos_cliente_tenant_cliente_idx
  ON public.lancamentos_cliente (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS mensagens_log_tenant_cliente_idx
  ON public.mensagens_log (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS notificacoes_enviadas_tenant_cliente_idx
  ON public.notificacoes_enviadas (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS orcamentos_tenant_cliente_idx
  ON public.orcamentos (tenant_id, cliente_id);

CREATE INDEX IF NOT EXISTS paradas_rota_tenant_cliente_idx
  ON public.paradas_rota (tenant_id, cliente_id);
