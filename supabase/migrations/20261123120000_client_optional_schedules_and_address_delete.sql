-- Retirada e entrega recorrentes são opcionais por cliente.
alter table public.configuracoes_cliente
  add column if not exists retirada_ativa boolean not null default false,
  add column if not exists entrega_ativa boolean not null default false;

-- Mantém as agendas que já estavam configuradas antes da inclusão dos controles.
update public.configuracoes_cliente
set retirada_ativa = coalesce(cardinality(dias_retirada), 0) > 0,
    entrega_ativa = coalesce(cardinality(dias_entrega), 0) > 0
where retirada_ativa = false or entrega_ativa = false;

comment on column public.configuracoes_cliente.retirada_ativa is
  'Indica se a retirada recorrente deve gerar eventos na agenda para este cliente.';
comment on column public.configuracoes_cliente.entrega_ativa is
  'Indica se a entrega recorrente deve gerar eventos na agenda e no Delivery para este cliente.';

alter table public.agendamentos
  add column if not exists gerado_por_configuracao_cliente boolean not null default false;

comment on column public.agendamentos.gerado_por_configuracao_cliente is
  'Marca agendamentos recorrentes criados pela configuração de retirada e entrega do cadastro do cliente.';

create table if not exists public.agenda_recorrencia_operacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cliente_id uuid not null,
  criado_por uuid not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agenda_recorrencia_operacoes_cliente_unique unique (tenant_id, cliente_id),
  constraint agenda_recorrencia_operacoes_key_unique unique (tenant_id, idempotency_key),
  constraint agenda_recorrencia_operacoes_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint agenda_recorrencia_operacoes_cliente_fk
    foreign key (cliente_id, tenant_id) references public.clientes(id, tenant_id) on delete cascade
);

alter table public.agenda_recorrencia_operacoes enable row level security;
revoke all on table public.agenda_recorrencia_operacoes from public, anon;
drop policy if exists agenda_recorrencia_operacoes_access on public.agenda_recorrencia_operacoes;
create policy agenda_recorrencia_operacoes_access
  on public.agenda_recorrencia_operacoes
  for all to authenticated
  using (
    tenant_id = private.current_tenant_id()
    and private.has_any_module_access(array['agenda'])
    and private.can_access_client(cliente_id)
  )
  with check (
    tenant_id = private.current_tenant_id()
    and private.has_any_module_access(array['agenda'])
    and private.can_access_client(cliente_id)
  );
grant select, insert, update on public.agenda_recorrencia_operacoes to authenticated;
create index if not exists agenda_recorrencia_operacoes_cliente_tenant_idx
  on public.agenda_recorrencia_operacoes (cliente_id, tenant_id);

create or replace function public.excluir_endereco_cliente(
  _endereco_id uuid,
  _cliente_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_was_primary boolean;
  v_promoted_id uuid;
begin
  if auth.uid() is null
     or v_tenant_id is null
     or not private.has_any_module_access(array['clientes', 'ordens', 'agenda'])
     or not private.can_access_client(_cliente_id) then
    raise exception 'Acesso negado ao endereço do cliente' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_tenant_id::text || ':client-address:' || _cliente_id::text,
    0
  ));

  select address.principal
    into v_was_primary
  from public.enderecos_clientes address
  where address.id = _endereco_id
    and address.cliente_id = _cliente_id
    and address.tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Endereço não encontrado neste cliente';
  end if;

  delete from public.enderecos_clientes address
  where address.id = _endereco_id
    and address.cliente_id = _cliente_id
    and address.tenant_id = v_tenant_id;

  if v_was_primary then
    update public.enderecos_clientes
       set principal = false
     where cliente_id = _cliente_id
       and tenant_id = v_tenant_id
       and principal;

    select address.id
      into v_promoted_id
    from public.enderecos_clientes address
    where address.cliente_id = _cliente_id
      and address.tenant_id = v_tenant_id
      and address.ativo
    order by address.updated_at desc, address.created_at desc, address.id
    limit 1
    for update;

    if v_promoted_id is not null then
      update public.enderecos_clientes
         set principal = true
       where id = v_promoted_id
         and cliente_id = _cliente_id
         and tenant_id = v_tenant_id;
    end if;
  end if;

  return jsonb_build_object(
    'deleted', true,
    'promoted_address_id', v_promoted_id
  );
end;
$function$;

revoke all on function public.excluir_endereco_cliente(uuid, uuid) from public, anon;
grant execute on function public.excluir_endereco_cliente(uuid, uuid) to authenticated;

create or replace function public.regenerar_agendamentos_recorrentes(
  _cliente_id uuid,
  _agendamentos jsonb,
  _idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, auth, pg_temp
as $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_classificacao text;
  v_unidade_id uuid;
  v_operation_type public.operation_type;
  v_existing public.agenda_recorrencia_operacoes%rowtype;
  v_schedule jsonb;
  v_normalized jsonb := '[]'::jsonb;
  v_payload_hash text;
  v_data_text text;
  v_data date;
  v_horario_text text;
  v_horario time;
  v_tipo text;
  v_frequencia text;
  v_preserved boolean;
  v_criados integer := 0;
  v_cancelados integer := 0;
  v_preservados integer := 0;
  v_result jsonb;
begin
  if auth.uid() is null
     or v_tenant_id is null
     or not private.has_any_module_access(array['agenda'])
     or not private.can_access_client(_cliente_id) then
    raise exception 'Acesso negado à agenda recorrente deste cliente' using errcode = '42501';
  end if;

  if _idempotency_key is null
     or _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'Chave de idempotência inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(_agendamentos) is distinct from 'array' then
    raise exception 'A lista de agendamentos deve ser um array JSON' using errcode = '22023';
  end if;
  if jsonb_array_length(_agendamentos) > 400 then
    raise exception 'O limite é 400 agendamentos por atualização' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_tenant_id::text || ':client-schedule:' || _cliente_id::text,
    0
  ));

  select c.classificacao, c.unidade_id
    into v_classificacao, v_unidade_id
  from public.clientes c
  where c.id = _cliente_id
    and c.tenant_id = v_tenant_id;
  if not found then
    raise exception 'Cliente não encontrado nesta empresa' using errcode = 'P0002';
  end if;

  v_operation_type := case
    when lower(v_classificacao) = 'industrial' then 'industrial'::public.operation_type
    else 'domestico'::public.operation_type
  end;
  v_payload_hash := md5(_agendamentos::text);

  select * into v_existing
  from public.agenda_recorrencia_operacoes r
  where r.tenant_id = v_tenant_id
    and r.cliente_id = _cliente_id;
  if found and v_existing.idempotency_key = _idempotency_key then
    if v_existing.request_fingerprint <> v_payload_hash then
      raise exception 'Chave de idempotência reutilizada com dados diferentes' using errcode = '22023';
    end if;
    return v_existing.resultado || jsonb_build_object('idempotent', true);
  end if;

  for v_schedule in select value from jsonb_array_elements(_agendamentos) as items(value)
  loop
    if jsonb_typeof(v_schedule) is distinct from 'object' then
      raise exception 'Cada agendamento precisa ser um objeto' using errcode = '22023';
    end if;

    v_tipo := v_schedule->>'tipo';
    v_frequencia := v_schedule->>'frequencia';
    v_data_text := v_schedule->>'data';
    v_horario_text := nullif(btrim(coalesce(v_schedule->>'horario', '')), '');
    if v_tipo not in ('retirada', 'entrega') then
      raise exception 'Tipo de agendamento inválido' using errcode = '22023';
    end if;
    if v_frequencia not in ('diaria', 'semanal', 'quinzenal', 'mensal') then
      raise exception 'Frequência de agendamento inválida' using errcode = '22023';
    end if;
    if v_data_text is null or v_data_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Data de agendamento inválida' using errcode = '22023';
    end if;
    v_data := v_data_text::date;
    if v_data < current_date or v_data > current_date + 180 then
      raise exception 'As datas devem estar entre hoje e os próximos 180 dias' using errcode = '22023';
    end if;
    if v_horario_text is null then
      v_horario := null;
    else
      v_horario := v_horario_text::time;
    end if;

    v_normalized := v_normalized || jsonb_build_array(jsonb_build_object(
      'tipo', v_tipo,
      'data', v_data::text,
      'horario', v_horario,
      'frequencia', v_frequencia
    ));
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(v_normalized) as items(value)
    group by value->>'tipo', value->>'data'
    having count(*) > 1
  ) then
    raise exception 'A lista contém datas repetidas para o mesmo tipo de agendamento' using errcode = '22023';
  end if;

  -- Atualiza a hora dos eventos automáticos ainda não roteirizados e cancela
  -- somente eventos futuros pendentes que saíram da configuração do cliente.
  update public.agendamentos a
     set horario = (items.value->>'horario')::time,
         frequencia = items.value->>'frequencia',
         updated_at = now()
    from jsonb_array_elements(v_normalized) as items(value)
   where a.tenant_id = v_tenant_id
     and a.cliente_id = _cliente_id
     and a.gerado_por_configuracao_cliente
     and a.recorrente
     and a.status = 'agendado'
     and a.data >= current_date
     and a.tipo = items.value->>'tipo'
     and a.data = (items.value->>'data')::date
     and not exists (
       select 1 from public.paradas_rota p
       where p.tenant_id = v_tenant_id and p.agendamento_id = a.id
     );

  update public.agendamentos a
     set status = 'cancelado',
         observacoes = 'Programação automática do cadastro removida ou desativada.',
         updated_at = now()
   where a.tenant_id = v_tenant_id
     and a.cliente_id = _cliente_id
     and a.gerado_por_configuracao_cliente
     and a.recorrente
     and a.status = 'agendado'
     and a.data >= current_date
     and not exists (
       select 1 from jsonb_array_elements(v_normalized) as items(value)
       where items.value->>'tipo' = a.tipo
         and (items.value->>'data')::date = a.data
     )
     and not exists (
       select 1 from public.paradas_rota p
       where p.tenant_id = v_tenant_id and p.agendamento_id = a.id
     );
  get diagnostics v_cancelados = row_count;

  for v_schedule in select value from jsonb_array_elements(v_normalized) as items(value)
  loop
    select exists (
      select 1
      from public.agendamentos a
      where a.tenant_id = v_tenant_id
        and a.cliente_id = _cliente_id
        and a.tipo = v_schedule->>'tipo'
        and a.data = (v_schedule->>'data')::date
        and (
          a.status in ('agendado', 'confirmado', 'realizado')
          or (a.status = 'cancelado' and not a.gerado_por_configuracao_cliente)
        )
    ) into v_preserved;

    if v_preserved then
      v_preservados := v_preservados + 1;
    else
      insert into public.agendamentos (
        tenant_id, cliente_id, unidade_id, operation_type, tipo, data, horario,
        frequencia, recorrente, status, observacoes, gerado_por_configuracao_cliente
      ) values (
        v_tenant_id,
        _cliente_id,
        v_unidade_id,
        v_operation_type,
        v_schedule->>'tipo',
        (v_schedule->>'data')::date,
        (v_schedule->>'horario')::time,
        v_schedule->>'frequencia',
        true,
        'agendado',
        'Programação automática do cadastro do cliente.',
        true
      );
      v_criados := v_criados + 1;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'cancelados', v_cancelados,
    'criados', v_criados,
    'preservados', v_preservados,
    'idempotent', false
  );

  insert into public.agenda_recorrencia_operacoes (
    tenant_id, cliente_id, criado_por, idempotency_key, request_fingerprint, resultado
  ) values (
    v_tenant_id, _cliente_id, auth.uid(), _idempotency_key, v_payload_hash, v_result
  ) on conflict (tenant_id, cliente_id) do update
    set idempotency_key = excluded.idempotency_key,
        criado_por = excluded.criado_por,
        request_fingerprint = excluded.request_fingerprint,
        resultado = excluded.resultado,
        created_at = now();

  return v_result;
end;
$function$;

revoke all on function public.regenerar_agendamentos_recorrentes(uuid, jsonb, text) from public, anon;
grant execute on function public.regenerar_agendamentos_recorrentes(uuid, jsonb, text) to authenticated;
