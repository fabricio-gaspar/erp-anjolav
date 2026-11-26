-- Allow the PDV consultation flow to edit a ROL atomically without bypassing RLS.
-- The function is SECURITY INVOKER on purpose: table policies remain the final
-- tenant, area and permission boundary.
create or replace function public.editar_ordem_servico_pdv(
  _ordem_servico_id uuid,
  _ordem jsonb,
  _itens jsonb,
  _motivo text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $function$
declare
  v_order public.ordens_servico%rowtype;
  v_existing_item public.itens_ordem_servico%rowtype;
  v_item_json jsonb;
  v_item_id uuid;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_item_subtotal numeric;
  v_total numeric := 0;
  v_discount numeric;
  v_new_data_retirada date;
  v_new_data_previsao date;
  v_new_prioridade text;
  v_new_recebimento_modalidade text;
  v_new_entrega_modalidade text;
  v_has_confirmed_payment boolean := false;
  v_pricing_change boolean := false;
  v_seen_ids uuid[] := array[]::uuid[];
  v_item_count integer := 0;
  v_created_items integer := 0;
  v_updated_items integer := 0;
  v_deleted_items integer := 0;
  v_processed_quantity numeric;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada obrigatória' using errcode = '42501';
  end if;

  if not private.has_any_module_access(array['ordens', 'caixa']) then
    raise exception 'Sem permissão para editar ROLs neste painel' using errcode = '42501';
  end if;

  if jsonb_typeof(_ordem) <> 'object' or jsonb_typeof(_itens) <> 'array' then
    raise exception 'Dados inválidos para edição do ROL';
  end if;

  if jsonb_array_length(_itens) = 0 then
    raise exception 'O ROL precisa ter ao menos um item';
  end if;

  if length(trim(coalesce(_motivo, ''))) < 5 then
    raise exception 'Informe o motivo da alteração com ao menos 5 caracteres';
  end if;

  select * into v_order
    from public.ordens_servico
   where id = _ordem_servico_id
     and tenant_id = private.current_tenant_id()
     and private.can_access_order(id)
   for update;

  if not found then
    raise exception 'ROL não encontrado nesta empresa ou neste painel';
  end if;

  if v_order.status in ('entregue', 'cancelada') then
    raise exception 'Este ROL não pode mais ser editado no status atual';
  end if;

  v_new_data_retirada := coalesce(nullif(_ordem->>'data_retirada', '')::date, v_order.data_retirada);
  v_new_data_previsao := case
    when _ordem ? 'data_previsao_entrega' then nullif(_ordem->>'data_previsao_entrega', '')::date
    else v_order.data_previsao_entrega
  end;
  v_new_prioridade := coalesce(nullif(_ordem->>'prioridade', ''), v_order.prioridade);
  v_new_recebimento_modalidade := coalesce(nullif(_ordem->>'recebimento_modalidade', ''), v_order.recebimento_modalidade);
  v_new_entrega_modalidade := coalesce(nullif(_ordem->>'entrega_modalidade', ''), v_order.entrega_modalidade);
  v_discount := coalesce(nullif(_ordem->>'valor_desconto', '')::numeric, coalesce(v_order.valor_desconto, 0));

  if v_new_data_previsao is not null and v_new_data_previsao < v_new_data_retirada then
    raise exception 'A previsão de entrega não pode ser anterior à data de entrada';
  end if;
  if v_new_prioridade not in ('baixa', 'normal', 'alta', 'urgente') then
    raise exception 'Prioridade inválida';
  end if;
  if v_new_recebimento_modalidade not in ('balcao', 'coleta') then
    raise exception 'Modalidade de recebimento inválida';
  end if;
  if v_new_entrega_modalidade not in ('balcao', 'entrega') then
    raise exception 'Modalidade de entrega inválida';
  end if;
  if v_discount < 0 then
    raise exception 'O desconto não pode ser negativo';
  end if;

  select exists (
    select 1
      from public.pdv_pagamentos
     where ordem_servico_id = v_order.id
       and tenant_id = v_order.tenant_id
       and status in ('CONFIRMADO', 'EM_REVISAO')
  ) into v_has_confirmed_payment;

  for v_item_json in select value from jsonb_array_elements(_itens)
  loop
    v_item_count := v_item_count + 1;
    v_item_id := nullif(v_item_json->>'id', '')::uuid;
    v_product_id := nullif(v_item_json->>'produto_id', '')::uuid;
    v_quantity := nullif(v_item_json->>'quantidade', '')::numeric;
    v_unit_price := nullif(v_item_json->>'preco_unitario', '')::numeric;

    if v_quantity is null or v_quantity <= 0 or v_quantity > 999999 then
      raise exception 'Quantidade inválida no item %', v_item_count;
    end if;
    if v_unit_price is null or v_unit_price < 0 or v_unit_price > 100000000 then
      raise exception 'Preço unitário inválido no item %', v_item_count;
    end if;

    v_item_subtotal := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_item_subtotal;

    if v_item_id is not null then
      select * into v_existing_item
        from public.itens_ordem_servico
       where id = v_item_id
         and ordem_servico_id = v_order.id
         and tenant_id = v_order.tenant_id
       for update;

      if not found then
        raise exception 'Item do ROL não encontrado';
      end if;

      v_seen_ids := array_append(v_seen_ids, v_existing_item.id);
      v_processed_quantity := greatest(
        coalesce(v_existing_item.quantidade_aprovada, 0),
        coalesce(v_existing_item.quantidade_retida, 0),
        coalesce(v_existing_item.quantidade_retrabalho, 0),
        coalesce(v_existing_item.quantidade_entregue, 0)
      );

      if v_quantity < v_processed_quantity then
        raise exception 'A quantidade do item não pode ser menor que a quantidade já processada';
      end if;

      if v_quantity <> v_existing_item.quantidade or v_unit_price <> v_existing_item.preco_unitario then
        v_pricing_change := true;
      end if;

      update public.itens_ordem_servico
         set quantidade = v_quantity,
             preco_unitario = v_unit_price,
             subtotal = v_item_subtotal,
             cor_item = nullif(left(coalesce(v_item_json->>'cor_item', ''), 120), ''),
             marca_item = nullif(left(coalesce(v_item_json->>'marca_item', ''), 120), ''),
             avarias = nullif(left(coalesce(v_item_json->>'avarias', ''), 1000), ''),
             observacoes = nullif(left(coalesce(v_item_json->>'observacoes', ''), 2000), ''),
             posicao_prateleira = nullif(left(coalesce(v_item_json->>'posicao_prateleira', ''), 120), '')
       where id = v_existing_item.id;
      v_updated_items := v_updated_items + 1;
    else
      if v_product_id is null then
        raise exception 'Produto obrigatório para novo item';
      end if;
      if not exists (
        select 1 from public.produtos
         where id = v_product_id
           and tenant_id = v_order.tenant_id
           and status = 'ativo'
      ) then
        raise exception 'Produto não encontrado ou inativo neste painel';
      end if;

      insert into public.itens_ordem_servico (
        ordem_servico_id, produto_id, quantidade, preco_unitario, subtotal,
        observacoes, cor_item, marca_item, avarias, posicao_prateleira,
        tenant_id, unidade_id, operation_type
      ) values (
        v_order.id, v_product_id, v_quantity, v_unit_price, v_item_subtotal,
        nullif(left(coalesce(v_item_json->>'observacoes', ''), 2000), ''),
        nullif(left(coalesce(v_item_json->>'cor_item', ''), 120), ''),
        nullif(left(coalesce(v_item_json->>'marca_item', ''), 120), ''),
        nullif(left(coalesce(v_item_json->>'avarias', ''), 1000), ''),
        nullif(left(coalesce(v_item_json->>'posicao_prateleira', ''), 120), ''),
        v_order.tenant_id, v_order.unidade_id, v_order.operation_type
      );
      v_created_items := v_created_items + 1;
      v_pricing_change := true;
    end if;
  end loop;

  if v_has_confirmed_payment and v_pricing_change then
    raise exception 'Estorne os pagamentos confirmados antes de alterar quantidades ou preços';
  end if;

  if v_has_confirmed_payment and round(coalesce(v_order.valor_total, 0), 2) <> round(v_total - v_discount, 2) then
    raise exception 'O total atual não pode ser recalculado enquanto houver pagamento confirmado';
  end if;

  for v_existing_item in
    select * from public.itens_ordem_servico where ordem_servico_id = v_order.id and tenant_id = v_order.tenant_id
  loop
    if not (v_existing_item.id = any(v_seen_ids)) then
      if greatest(
        coalesce(v_existing_item.quantidade_aprovada, 0),
        coalesce(v_existing_item.quantidade_retida, 0),
        coalesce(v_existing_item.quantidade_retrabalho, 0),
        coalesce(v_existing_item.quantidade_entregue, 0)
      ) > 0 then
        raise exception 'Não é possível remover um item já processado';
      end if;
      delete from public.itens_ordem_servico where id = v_existing_item.id;
      v_deleted_items := v_deleted_items + 1;
      v_pricing_change := true;
    end if;
  end loop;

  if v_has_confirmed_payment and v_pricing_change then
    raise exception 'Estorne os pagamentos confirmados antes de incluir ou remover itens';
  end if;

  if v_total - v_discount < 0 then
    raise exception 'O desconto não pode superar o total dos itens';
  end if;

  update public.ordens_servico
     set data_retirada = v_new_data_retirada,
         data_previsao_entrega = v_new_data_previsao,
         observacoes = nullif(left(coalesce(_ordem->>'observacoes', coalesce(v_order.observacoes, '')), 3000), ''),
         urgente = coalesce((_ordem->>'urgente')::boolean, v_order.urgente),
         percentual_urgencia = coalesce(nullif(_ordem->>'percentual_urgencia', '')::numeric, coalesce(v_order.percentual_urgencia, 0)),
         prioridade = v_new_prioridade,
         recebimento_modalidade = v_new_recebimento_modalidade,
         entrega_modalidade = v_new_entrega_modalidade,
         valor_desconto = round(v_discount, 2),
         valor_total = round(v_total - v_discount, 2),
         updated_at = now()
   where id = v_order.id;

  return jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'itemsCreated', v_created_items,
    'itemsUpdated', v_updated_items,
    'itemsDeleted', v_deleted_items,
    'total', round(v_total - v_discount, 2)
  );
end;
$function$;

revoke all on function public.editar_ordem_servico_pdv(uuid, jsonb, jsonb, text) from public;
grant execute on function public.editar_ordem_servico_pdv(uuid, jsonb, jsonb, text) to authenticated;
