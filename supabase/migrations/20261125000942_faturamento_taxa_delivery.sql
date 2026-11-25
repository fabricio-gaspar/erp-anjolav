-- Inclui taxa de delivery confirmada no relatório e no total da fatura.
create or replace function public.fechar_faturamento_rols(
  _area text, _cliente_id uuid, _periodo_inicio date, _periodo_fim date,
  _lancamento_ids uuid[], _idempotency_key text, _observacao text default null
) returns jsonb
language plpgsql security definer set search_path = ''
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
  v_operacao text;
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
    if not private.can_access_client(v_previous.cliente_id) or exists (
      select 1 from public.lancamentos l
      join public.ordens_servico os on os.id=l.ordem_servico_id and os.tenant_id=l.tenant_id
      where l.fatura_id=v_previous.id and l.tenant_id=v_tenant
        and not private.can_access_area(case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja') then 'residencial' else 'industrial' end)
    ) then raise exception 'Sem permissão para esta fatura'; end if;
    select array_agg(lancamento_id order by lancamento_id) into v_previous_ids
    from public.lancamentos_fatura where fatura_id = v_previous.id and tenant_id = v_tenant;
    if v_previous.cliente_id <> _cliente_id
       or v_previous.periodo_inicio <> _periodo_inicio
       or v_previous.periodo_fim <> _periodo_fim
       or v_previous_ids is distinct from v_ids then
      raise exception 'Chave de idempotência já utilizada com outros dados';
    end if;
    if _area <> 'central' and exists (
      select 1 from public.lancamentos_fatura lf
      join public.lancamentos l on l.id = lf.lancamento_id and l.tenant_id = lf.tenant_id
      join public.ordens_servico os on os.id = l.ordem_servico_id and os.tenant_id = l.tenant_id
      where lf.fatura_id = v_previous.id and lf.tenant_id = v_tenant
        and case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja')
          then 'residencial' else 'industrial' end <> _area
    ) then
      raise exception 'A fatura pertence a outra operação';
    end if;
    return jsonb_build_object('id', v_previous.id, 'valorTotal', v_previous.valor_total,
      'quantidadeLancamentos', array_length(v_ids, 1), 'idempotent', true);
  end if;

  select * into v_cliente from public.clientes
  where id = _cliente_id and tenant_id = v_tenant for share;
  if not found or not v_cliente.ativo or not private.can_access_client(v_cliente.id) then
    raise exception 'Cliente indisponível ou inativo';
  end if;
  select coalesce(nullif(tipo_relatorio, ''), 'detalhado') into v_tipo_relatorio
  from public.configuracoes_cliente
  where cliente_id = _cliente_id and tenant_id = v_tenant limit 1;
  v_tipo_relatorio := coalesce(v_tipo_relatorio, 'detalhado');

  for v_row in
    select l.id, l.valor_total, l.status as launch_status, l.fatura_id,
      os.id as ordem_id, os.numero, os.data_retirada, os.status as ordem_status,
      os.condicao_pagamento, os.status_pagamento, os.valor_pago, os.taxa_entrega,
      os.valor_total as ordem_valor, os.cliente_id, os.tenant_id,
      case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja')
        then 'residencial' else 'industrial' end as operacao
    from public.lancamentos l
    join public.ordens_servico os on os.id = l.ordem_servico_id and os.tenant_id = l.tenant_id
    where l.id = any(v_ids) and l.tenant_id = v_tenant
    order by l.id for update of l, os
  loop
    v_count := v_count + 1;
    if not private.can_access_area(v_row.operacao)
       or (_area <> 'central' and v_row.operacao <> _area)
       or (v_operacao is not null and v_operacao <> v_row.operacao) then
      raise exception 'Selecione ROLs de uma mesma operação autorizada';
    end if;
    v_operacao := v_row.operacao;
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
    if v_item_count = 0 or round(v_item_total + coalesce(v_row.taxa_entrega, 0), 2) <> round(v_row.valor_total, 2) then
      raise exception 'Itens e valor do ROL % não conferem', v_row.numero;
    end if;
    if coalesce(v_row.taxa_entrega, 0) > 0 then
      v_launch_items := v_launch_items || jsonb_build_array(jsonb_build_object(
        'id', v_row.ordem_id::text || ':delivery', 'lancamento_id', v_row.id, 'ordem_servico_id', v_row.ordem_id,
        'numero_rol', v_row.numero, 'data_rol', v_row.data_retirada,
        'produto', 'Taxa de delivery', 'quantidade', 1, 'unidade', 'serviço',
        'valor_unitario', v_row.taxa_entrega, 'valor_total', v_row.taxa_entrega
      ));
    end if;
    v_total := v_total + v_row.valor_total;
    v_items := v_items || v_launch_items;
  end loop;
  if v_count <> array_length(v_ids, 1) then
    raise exception 'Alguns ROLs não existem ou não estão disponíveis neste painel';
  end if;

  insert into public.faturas (
    tenant_id, cliente_id, periodo_inicio, periodo_fim, valor_total, status, operation_type,
    relatorio_gerado, relatorio_data, tipo_relatorio, itens_snapshot,
    snapshot_cliente, observacao_fatura, billing_idempotency_key,
    fechamento_aprovado_em, fechamento_aprovado_por
  ) values (
    v_tenant, _cliente_id, _periodo_inicio, _periodo_fim, v_total, 'relatorio_gerado',
    (case when v_operacao = 'residencial' then 'domestico' else 'industrial' end)::public.operation_type,
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

revoke all on function public.fechar_faturamento_rols(text,uuid,date,date,uuid[],text,text) from public, anon;
grant execute on function public.fechar_faturamento_rols(text,uuid,date,date,uuid[],text,text) to authenticated;

