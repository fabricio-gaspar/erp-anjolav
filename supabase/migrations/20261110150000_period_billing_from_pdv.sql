-- Fechamento por período: os ROLs e valores são sempre originados no PDV.
-- Os leitores e o comando executam com os privilégios do usuário e com RLS.
alter table public.faturas
  add column if not exists billing_idempotency_key text,
  add column if not exists fechamento_aprovado_em timestamptz,
  add column if not exists fechamento_aprovado_por uuid;

create unique index if not exists faturas_tenant_billing_key_uidx
  on public.faturas (tenant_id, billing_idempotency_key)
  where billing_idempotency_key is not null;

create index if not exists ordens_servico_tenant_periodo_cliente_idx
  on public.ordens_servico (tenant_id, data_retirada, cliente_id);

create or replace function public.consultar_clientes_faturamento_periodo(
  _area text, _inicio date, _fim date, _pagina integer default 1, _tamanho integer default 25
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_tenant is null
     or _area not in ('central', 'industrial', 'residencial')
     or not private.can_access_area(_area)
     or not private.has_any_module_access(array['faturamento']::text[]) then
    raise exception 'Sem permissão para consultar o faturamento';
  end if;
  if _inicio is null or _fim is null or _fim < _inicio or _fim > _inicio + 366 then
    raise exception 'Informe um período válido de até 366 dias';
  end if;
  if _pagina < 1 or _tamanho < 1 or _tamanho > 100 then
    raise exception 'Paginação inválida';
  end if;

  with movimentos as (
    select
      c.id, c.razao_social, c.cpf_cnpj, c.classificacao,
      coalesce(cfg.tipo_relatorio, 'detalhado') as tipo_relatorio,
      pag.forma_pagamento,
      os.valor_total,
      os.status,
      (
        os.condicao_pagamento = 'faturado'
        and os.status <> 'cancelada'
        and coalesce(os.valor_total, 0) > 0
        and coalesce(os.valor_pago, 0) = 0
        and coalesce(os.status_pagamento, 'pendente') <> 'pago'
        and l.id is not null and l.status = 'pendente' and l.fatura_id is null
      ) as elegivel
    from public.ordens_servico os
    join public.clientes c on c.id = os.cliente_id and c.tenant_id = os.tenant_id
    left join public.lancamentos l on l.ordem_servico_id = os.id and l.tenant_id = os.tenant_id
    left join lateral (
      select tipo_relatorio from public.configuracoes_cliente
      where cliente_id = c.id and tenant_id = v_tenant limit 1
    ) cfg on true
    left join lateral (
      select forma_pagamento from public.configuracoes_pagamento_cliente
      where cliente_id = c.id and tenant_id = v_tenant limit 1
    ) pag on true
    where os.tenant_id = v_tenant
      and os.data_retirada between _inicio and _fim
      and (_area = 'central' or c.classificacao = _area)
  ), agrupado as (
    select id as cliente_id, razao_social, cpf_cnpj, classificacao,
      max(tipo_relatorio) as tipo_relatorio,
      max(forma_pagamento) as forma_pagamento,
      count(*)::integer as movimentos,
      count(*) filter (where elegivel)::integer as faturaveis,
      count(*) filter (where not elegivel)::integer as nao_faturaveis,
      coalesce(sum(valor_total) filter (where elegivel), 0) as valor_faturavel
    from movimentos
    group by id, razao_social, cpf_cnpj, classificacao
  ), pagina as (
    select * from agrupado
    order by lower(razao_social), cliente_id
    limit _tamanho offset (_pagina - 1) * _tamanho
  )
  select jsonb_build_object(
    'total', (select count(*) from agrupado),
    'items', coalesce((select jsonb_agg(to_jsonb(pagina) order by lower(razao_social), cliente_id) from pagina), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.consultar_rols_faturamento_periodo(
  _area text, _cliente_id uuid, _inicio date, _fim date,
  _pagina integer default 1, _tamanho integer default 50
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_tenant is null
     or _area not in ('central', 'industrial', 'residencial')
     or not private.can_access_area(_area)
     or not private.has_any_module_access(array['faturamento']::text[]) then
    raise exception 'Sem permissão para consultar os ROLs';
  end if;
  if _cliente_id is null or _inicio is null or _fim is null
     or _fim < _inicio or _fim > _inicio + 366 then
    raise exception 'Cliente ou período inválido';
  end if;
  if _pagina < 1 or _tamanho < 1 or _tamanho > 100 then
    raise exception 'Paginação inválida';
  end if;

  with movimentos as (
    select
      os.id as ordem_id, os.numero, os.data_retirada, os.status,
      os.condicao_pagamento, os.valor_total, os.valor_pago,
      l.id as lancamento_id, l.fatura_id,
      case
        when os.status = 'cancelada' then 'ROL cancelado'
        when os.condicao_pagamento is distinct from 'faturado' then 'Pagamento fora do faturamento'
        when coalesce(os.valor_total, 0) <= 0 then 'Valor inválido'
        when coalesce(os.valor_pago, 0) > 0 or os.status_pagamento = 'pago' then 'ROL já pago'
        when l.id is null then 'Lançamento do PDV ausente'
        when l.fatura_id is not null or l.status = 'faturado' then 'Já incluído em fatura'
        when l.status <> 'pendente' then 'Lançamento indisponível'
        else null
      end as motivo_bloqueio
    from public.ordens_servico os
    join public.clientes c on c.id = os.cliente_id and c.tenant_id = os.tenant_id
    left join public.lancamentos l on l.ordem_servico_id = os.id and l.tenant_id = os.tenant_id
    where os.tenant_id = v_tenant and os.cliente_id = _cliente_id
      and os.data_retirada between _inicio and _fim
      and (_area = 'central' or c.classificacao = _area)
  ), pagina as (
    select * from movimentos order by data_retirada, numero, ordem_id
    limit _tamanho offset (_pagina - 1) * _tamanho
  )
  select jsonb_build_object(
    'total', (select count(*) from movimentos),
    'items', coalesce((select jsonb_agg(to_jsonb(pagina) order by data_retirada, numero, ordem_id) from pagina), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.fechar_faturamento_rols(
  _area text, _cliente_id uuid, _periodo_inicio date, _periodo_fim date,
  _lancamento_ids uuid[], _idempotency_key text, _observacao text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_ids uuid[];
  v_previous public.faturas%rowtype;
  v_previous_ids uuid[];
  v_cliente public.clientes%rowtype;
  v_fatura_id uuid;
  v_count integer := 0;
  v_total numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_launch_items jsonb;
  v_item_total numeric;
  v_item_count integer;
  v_tipo_relatorio text;
  v_row record;
begin
  if auth.uid() is null or v_tenant is null
     or _area not in ('central', 'industrial', 'residencial')
     or not private.can_access_area(_area)
     or not private.has_any_module_access(array['faturamento']::text[]) then
    raise exception 'Sem permissão para fechar o faturamento';
  end if;
  if _cliente_id is null or _periodo_inicio is null or _periodo_fim is null
     or _periodo_fim < _periodo_inicio or _periodo_fim > _periodo_inicio + 366 then
    raise exception 'Cliente ou período inválido';
  end if;
  if _idempotency_key is null or _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'Chave de idempotência inválida';
  end if;
  if length(coalesce(_observacao, '')) > 2000 then
    raise exception 'Observação muito longa';
  end if;
  select array_agg(distinct item order by item) into v_ids
  from unnest(_lancamento_ids) item;
  if coalesce(array_length(v_ids, 1), 0) < 1
     or array_length(v_ids, 1) > 100
     or array_length(v_ids, 1) is distinct from array_length(_lancamento_ids, 1) then
    raise exception 'Selecione entre 1 e 100 ROLs distintos';
  end if;

  perform pg_advisory_xact_lock(pg_catalog.hashtextextended(v_tenant::text || ':' || _idempotency_key, 0));
  select * into v_previous from public.faturas
  where tenant_id = v_tenant and billing_idempotency_key = _idempotency_key;
  if found then
    select array_agg(lancamento_id order by lancamento_id) into v_previous_ids
    from public.lancamentos_fatura where fatura_id = v_previous.id and tenant_id = v_tenant;
    if v_previous.cliente_id <> _cliente_id
       or v_previous.periodo_inicio <> _periodo_inicio
       or v_previous.periodo_fim <> _periodo_fim
       or v_previous_ids is distinct from v_ids then
      raise exception 'Chave de idempotência já utilizada com outros dados';
    end if;
    return jsonb_build_object('id', v_previous.id, 'valorTotal', v_previous.valor_total,
      'quantidadeLancamentos', array_length(v_ids, 1), 'idempotent', true);
  end if;

  select * into v_cliente from public.clientes
  where id = _cliente_id and tenant_id = v_tenant for share;
  if not found or not v_cliente.ativo
     or (_area <> 'central' and v_cliente.classificacao <> _area) then
    raise exception 'Cliente fora do painel ou inativo';
  end if;
  select coalesce(nullif(tipo_relatorio, ''), 'detalhado') into v_tipo_relatorio
  from public.configuracoes_cliente
  where cliente_id = _cliente_id and tenant_id = v_tenant limit 1;
  v_tipo_relatorio := coalesce(v_tipo_relatorio, 'detalhado');

  for v_row in
    select l.id, l.valor_total, l.status as launch_status, l.fatura_id,
      os.id as ordem_id, os.numero, os.data_retirada, os.status as ordem_status,
      os.condicao_pagamento, os.status_pagamento, os.valor_pago,
      os.valor_total as ordem_valor, os.cliente_id, os.tenant_id
    from public.lancamentos l
    join public.ordens_servico os on os.id = l.ordem_servico_id and os.tenant_id = l.tenant_id
    where l.id = any(v_ids) and l.tenant_id = v_tenant
    order by l.id for update of l, os
  loop
    v_count := v_count + 1;
    if v_row.cliente_id <> _cliente_id
       or v_row.tenant_id <> v_tenant
       or v_row.data_retirada not between _periodo_inicio and _periodo_fim
       or v_row.condicao_pagamento is distinct from 'faturado'
       or v_row.ordem_status = 'cancelada'
       or v_row.launch_status <> 'pendente'
       or v_row.fatura_id is not null
       or coalesce(v_row.valor_pago, 0) > 0
       or v_row.status_pagamento = 'pago'
       or v_row.valor_total <= 0
       or v_row.ordem_valor is distinct from v_row.valor_total then
      raise exception 'ROL % não está disponível para faturamento', v_row.numero;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id, 'lancamento_id', v_row.id, 'ordem_servico_id', v_row.ordem_id,
      'numero_rol', v_row.numero, 'data_rol', v_row.data_retirada,
      'produto', item.produto_nome, 'quantidade', item.quantidade,
      'unidade', item.unidade, 'valor_unitario', item.preco_unitario,
      'valor_total', item.subtotal
    ) order by item.id), '[]'::jsonb), coalesce(sum(item.subtotal), 0), count(*)
    into v_launch_items, v_item_total, v_item_count
    from public.itens_lancamento item
    where item.lancamento_id = v_row.id and item.tenant_id = v_tenant;
    if v_item_count = 0 or round(v_item_total, 2) <> round(v_row.valor_total, 2) then
      raise exception 'Itens e valor do ROL % não conferem', v_row.numero;
    end if;
    v_total := v_total + v_row.valor_total;
    v_items := v_items || v_launch_items;
  end loop;
  if v_count <> array_length(v_ids, 1) then
    raise exception 'Alguns ROLs não existem ou não estão disponíveis neste painel';
  end if;

  insert into public.faturas (
    tenant_id, cliente_id, periodo_inicio, periodo_fim, valor_total, status,
    relatorio_gerado, relatorio_data, tipo_relatorio, itens_snapshot,
    snapshot_cliente, observacao_fatura, billing_idempotency_key,
    fechamento_aprovado_em, fechamento_aprovado_por
  ) values (
    v_tenant, _cliente_id, _periodo_inicio, _periodo_fim, v_total, 'relatorio_gerado',
    true, now(), v_tipo_relatorio, v_items,
    jsonb_build_object('razao_social', v_cliente.razao_social, 'cpf_cnpj', v_cliente.cpf_cnpj,
      'email', v_cliente.email, 'telefone', v_cliente.telefone),
    nullif(trim(coalesce(_observacao, '')), ''), _idempotency_key, now(), auth.uid()
  ) returning id into v_fatura_id;

  update public.lancamentos set fatura_id = v_fatura_id, status = 'faturado'
  where id = any(v_ids) and tenant_id = v_tenant;
  if not found then
    raise exception 'Não foi possível vincular os ROLs';
  end if;
  insert into public.lancamentos_fatura (tenant_id, lancamento_id, fatura_id)
  select v_tenant, item, v_fatura_id from unnest(v_ids) item;

  return jsonb_build_object('id', v_fatura_id, 'valorTotal', v_total,
    'quantidadeLancamentos', v_count, 'idempotent', false);
end;
$$;

create or replace function public.vincular_boleto_fatura(
  _fatura_id uuid, _charge_id uuid, _linha_digitavel text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_fatura public.faturas%rowtype;
  v_charge public.asaas_charges%rowtype;
begin
  if auth.uid() is null or v_tenant is null
     or not private.has_any_module_access(array['faturamento']::text[])
     or not (
       private.can_access_area('central')
       or private.can_access_area('industrial')
       or private.can_access_area('residencial')
     ) then
    raise exception 'Sem permissão para vincular o boleto';
  end if;
  select * into v_fatura from public.faturas
  where id = _fatura_id and tenant_id = v_tenant for update;
  if not found or v_fatura.status in ('cancelado', 'pago') then
    raise exception 'Fatura indisponível';
  end if;
  if v_fatura.asaas_charge_id = _charge_id and v_fatura.boleto_url is not null then
    return jsonb_build_object('id', v_fatura.id, 'boletoUrl', v_fatura.boleto_url, 'idempotent', true);
  end if;
  if v_fatura.asaas_charge_id is not null then
    raise exception 'Esta fatura já possui outra cobrança';
  end if;
  select * into v_charge from public.asaas_charges
  where id = _charge_id and tenant_id = v_tenant for share;
  if not found
     or v_charge.cliente_id is distinct from v_fatura.cliente_id
     or v_charge.billing_type <> 'BOLETO'
     or v_charge.value is distinct from v_fatura.valor_total
     or v_charge.asaas_id is null
     or v_charge.bank_slip_url is null
     or v_charge.bank_slip_url !~ '^https://'
     or nullif(trim(coalesce(_linha_digitavel, '')), '') is null then
    raise exception 'Cobrança Asaas incompatível ou sem boleto confirmado';
  end if;
  if not exists (
    select 1 from public.configuracoes_pagamento_cliente cfg
    where cfg.tenant_id = v_tenant and cfg.cliente_id = v_fatura.cliente_id
      and cfg.forma_pagamento = 'boleto' and cfg.condicao_pagamento = 'faturado'
  ) then
    raise exception 'Boleto não está configurado para este cliente';
  end if;
  update public.faturas set asaas_charge_id = v_charge.id,
    boleto_url = v_charge.bank_slip_url,
    boleto_linha_digitavel = trim(_linha_digitavel),
    forma_pagamento = 'boleto',
    data_vencimento = v_charge.due_date,
    status = 'pagamento_configurado'
  where id = v_fatura.id;
  return jsonb_build_object('id', v_fatura.id, 'boletoUrl', v_charge.bank_slip_url, 'idempotent', false);
end;
$$;

revoke all on function public.consultar_clientes_faturamento_periodo(text,date,date,integer,integer) from public, anon;
revoke all on function public.consultar_rols_faturamento_periodo(text,uuid,date,date,integer,integer) from public, anon;
revoke all on function public.fechar_faturamento_rols(text,uuid,date,date,uuid[],text,text) from public, anon;
revoke all on function public.vincular_boleto_fatura(uuid,uuid,text) from public, anon;
grant execute on function public.consultar_clientes_faturamento_periodo(text,date,date,integer,integer) to authenticated;
grant execute on function public.consultar_rols_faturamento_periodo(text,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.fechar_faturamento_rols(text,uuid,date,date,uuid[],text,text) to authenticated;
grant execute on function public.vincular_boleto_fatura(uuid,uuid,text) to authenticated;
