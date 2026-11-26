-- Prevent anonymous execution of permanent address deletion and index the
-- recurrence ledger's composite client/tenant foreign key.
revoke all on function public.excluir_endereco_cliente(uuid, uuid) from public, anon;
grant execute on function public.excluir_endereco_cliente(uuid, uuid) to authenticated;

create index if not exists agenda_recorrencia_operacoes_cliente_tenant_idx
  on public.agenda_recorrencia_operacoes (cliente_id, tenant_id);
