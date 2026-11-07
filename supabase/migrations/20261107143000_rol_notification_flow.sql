-- ROL notifications: entry confirmation, ready-for-pickup, and ready-for-delivery.
-- The function runs as the invoking user, so existing RLS policies remain in force.

alter table public.mensagens_log
  add column if not exists idempotency_key text;

alter table public.mensagens_log
  add constraint mensagens_log_idempotency_key_check
  check (
    idempotency_key is null
    or idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'
  );

create unique index if not exists uq_mensagens_log_tenant_idempotency
  on public.mensagens_log (tenant_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.registrar_posicao_item_rol(
  _item_id uuid,
  _posicao_prateleira text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_order_id uuid;
  v_status text;
  v_delivery_mode text;
  v_logistics_status text;
  v_position text := nullif(btrim(coalesce(_posicao_prateleira, '')), '');
  v_all_items_positioned boolean := false;
  v_ready_for_customer boolean := false;
  v_delivery_queue_updated boolean := false;
  v_rows integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória' using errcode = '42501';
  end if;

  if not private.has_any_module_access(array['ordens', 'producao', 'faturamento', 'caixa', 'dashboard', 'relatorios']) then
    raise exception 'Sem permissão para atualizar a posição do ROL' using errcode = '42501';
  end if;

  select ordem.id, ordem.status, ordem.entrega_modalidade, ordem.status_logistica
    into v_order_id, v_status, v_delivery_mode, v_logistics_status
  from public.itens_ordem_servico item
  join public.ordens_servico ordem on ordem.id = item.ordem_servico_id
  where item.id = _item_id
  for update of item, ordem;

  if v_order_id is null then
    raise exception 'Item indisponível neste ROL' using errcode = 'P0002';
  end if;

  update public.itens_ordem_servico
     set posicao_prateleira = v_position
   where id = _item_id
     and ordem_servico_id = v_order_id;

  select coalesce(
    bool_and(nullif(btrim(coalesce(posicao_prateleira, '')), '') is not null),
    false
  )
    into v_all_items_positioned
  from public.itens_ordem_servico
  where ordem_servico_id = v_order_id;

  v_ready_for_customer := v_all_items_positioned and v_status = 'expedicao';

  if v_ready_for_customer
     and v_delivery_mode = 'entrega'
     and v_logistics_status in ('nao_iniciada', 'aguardando_coleta') then
    update public.ordens_servico
       set status_logistica = 'aguardando_entrega'
     where id = v_order_id
       and status_logistica in ('nao_iniciada', 'aguardando_coleta');
    get diagnostics v_rows = row_count;
    v_delivery_queue_updated := v_rows > 0;
  end if;

  return jsonb_build_object(
    'orderId', v_order_id,
    'allItemsPositioned', v_all_items_positioned,
    'readyForCustomer', v_ready_for_customer,
    'deliveryMode', v_delivery_mode,
    'deliveryQueueUpdated', v_delivery_queue_updated
  );
end;
$function$;

revoke all on function public.registrar_posicao_item_rol(uuid, text) from public;
grant execute on function public.registrar_posicao_item_rol(uuid, text) to authenticated;

-- Preserve custom templates while normalizing the user-facing term to ROL.
update public.notificacoes_config
   set template = replace(template, 'OS', 'ROL'),
       updated_at = now()
 where template like '%OS%';

-- Every active tenant receives editable templates. The Edge Function also has
-- safe fallbacks for a future tenant that has not yet received these rows.
with defaults(evento, template, variaveis) as (
  values
    (
      'rol_entrada'::text,
      $entry$Olá, {cliente}! Recebemos seu ROL de entrada nº {numero}.

Peças lançadas:
{itens}

Total de peças: {total_pecas}
Valor do ROL: {valor}
Previsão: {previsao}
Modalidade: {modalidade}$entry$::text,
      jsonb_build_array('cliente', 'numero', 'itens', 'total_pecas', 'valor', 'previsao', 'modalidade')
    ),
    (
      'rol_pronto_retirada'::text,
      'Olá, {cliente}! Seu ROL nº {numero} está pronto e disponível para retirada na loja. Total: {total_pecas} peça(s).',
      jsonb_build_array('cliente', 'numero', 'total_pecas')
    ),
    (
      'rol_pronto_delivery'::text,
      'Olá, {cliente}! Seu ROL nº {numero} está pronto. Ele foi encaminhado para Entregas e Coletas e seguirá por delivery para o endereço combinado. Previsão: {previsao}.',
      jsonb_build_array('cliente', 'numero', 'previsao')
    )
)
insert into public.notificacoes_config (tenant_id, canal, evento, ativo, template, variaveis)
select tenant.id, 'whatsapp', defaults.evento, true, defaults.template, defaults.variaveis
from public.tenants tenant
cross join defaults
where tenant.status = 'active'
  and not exists (
    select 1
    from public.notificacoes_config existing
    where existing.tenant_id = tenant.id
      and existing.canal = 'whatsapp'
      and existing.evento = defaults.evento
  );
