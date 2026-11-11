-- WA-AKG delivery journal. Existing messages and Evolution settings remain
-- readable for audit; no provider is enabled by this migration.
alter table public.clientes
  add column if not exists whatsapp_opt_out boolean not null default false;

-- Only replace the exact legacy seed templates; preserve custom tenant text.
update public.notificacoes_config
set template = 'Olá, {cliente}! Seu ROL nº {numero} está pronto e disponível para retirada. Total: {total_pecas} peça(s).'
where evento = 'rol_pronto_retirada'
  and canal = 'whatsapp'
  and template = 'Olá, {cliente}! Seu ROL nº {numero} está pronto e disponível para retirada na loja. Total: {total_pecas} peça(s).';
update public.notificacoes_config
set template = 'Olá, {cliente}! Seu ROL nº {numero} está pronto para entrega.' || E'\n' || 'Previsão: {previsao}'
where evento = 'rol_pronto_delivery'
  and canal = 'whatsapp'
  and template = 'Olá, {cliente}! Seu ROL nº {numero} está pronto. Ele foi encaminhado para Entregas e Coletas e seguirá por delivery para o endereço combinado. Previsão: {previsao}.';

alter table public.mensagens_log
  add column if not exists provider_message_id text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists provider_attempted_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciliation_result text,
  add column if not exists reconciliation_reason text,
  add column if not exists last_error_code text,
  add column if not exists requested_by uuid,
  add column if not exists manual_parent_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists fatura_id uuid;

create index if not exists idx_mensagens_log_provider_message
  on public.mensagens_log (tenant_id, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_mensagens_log_order_timeline
  on public.mensagens_log (tenant_id, ordem_servico_id, created_at desc)
  where ordem_servico_id is not null;

create unique index if not exists uq_whatsapp_instancias_tenant
  on public.whatsapp_instancias (tenant_id);

-- Statuses are owned by the backend. An authenticated browser must not be
-- able to forge a provider acknowledgement or reconciliation result.
drop policy if exists tenant_update on public.mensagens_log;
drop policy if exists tenant_insert on public.mensagens_log;
revoke insert, update on public.mensagens_log from authenticated;
drop policy if exists tenant_select on public.mensagens_log;
create policy tenant_select on public.mensagens_log
  for select to authenticated using (
    tenant_id = (select private.current_tenant_id())
    and (
      private.is_tenant_admin(tenant_id)
      or (
        (select private.has_any_module_access('{ordens,faturamento,agenda,dashboard}'::text[]))
        and (private.can_access_order(ordem_servico_id) or private.can_access_client(cliente_id))
      )
    )
  );

create table if not exists public.mensagens_log_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  mensagem_id uuid not null references public.mensagens_log(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  motivo text,
  ator_id uuid,
  ocorrido_em timestamptz not null default now()
);
create index if not exists idx_mensagens_log_eventos_mensagem
  on public.mensagens_log_eventos (tenant_id, mensagem_id, ocorrido_em desc);
alter table public.mensagens_log_eventos enable row level security;
drop policy if exists tenant_admin_read on public.mensagens_log_eventos;
create policy tenant_admin_read on public.mensagens_log_eventos
  for select to authenticated using (private.is_tenant_admin(tenant_id));
revoke all on public.mensagens_log_eventos from anon, authenticated;
grant select on public.mensagens_log_eventos to authenticated;

create or replace function private.audit_whatsapp_delivery_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.mensagens_log_eventos
      (tenant_id, mensagem_id, status_anterior, status_novo, motivo, ator_id)
    values (new.tenant_id, new.id, null, new.status, new.last_error_code, new.requested_by);
  elsif old.status is distinct from new.status then
    insert into public.mensagens_log_eventos
      (tenant_id, mensagem_id, status_anterior, status_novo, motivo, ator_id)
    values (new.tenant_id, new.id, old.status, new.status, new.last_error_code, new.requested_by);
  end if;
  return new;
end;
$$;
revoke all on function private.audit_whatsapp_delivery_status() from public, anon, authenticated;
drop trigger if exists audit_whatsapp_delivery_status on public.mensagens_log;
create trigger audit_whatsapp_delivery_status
  after insert or update of status on public.mensagens_log
  for each row execute function private.audit_whatsapp_delivery_status();

create or replace function public.touch_mensagens_log_updated_at()
returns trigger language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_mensagens_log on public.mensagens_log;
create trigger trg_touch_mensagens_log
  before update on public.mensagens_log
  for each row execute function public.touch_mensagens_log_updated_at();

revoke all on function public.touch_mensagens_log_updated_at() from public, anon, authenticated;
