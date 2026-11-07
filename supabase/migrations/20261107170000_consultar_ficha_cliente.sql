create or replace function public.consultar_ficha_cliente(_cliente_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private, pg_temp
as $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_cliente public.clientes%rowtype;
  v_orders_allowed boolean := private.has_any_module_access(array['ordens', 'caixa', 'dashboard', 'relatorios']);
  v_finance_allowed boolean := private.has_any_module_access(array['faturamento', 'caixa', 'dashboard', 'relatorios']);
  v_operations_allowed boolean := private.has_any_module_access(array['ordens', 'producao', 'caixa', 'dashboard', 'relatorios']);
  v_agenda_allowed boolean := private.has_any_module_access(array['agenda', 'ordens', 'caixa', 'dashboard', 'relatorios']);
begin
  if auth.uid() is null
     or v_tenant_id is null
     or not private.has_any_module_access(array['clientes', 'ordens', 'agenda', 'faturamento', 'caixa', 'dashboard', 'relatorios'])
  then
    raise exception 'Sem permissão para consultar a ficha do cliente' using errcode = '42501';
  end if;

  select c.*
    into v_cliente
    from public.clientes c
   where c.id = _cliente_id
     and c.tenant_id = v_tenant_id
     and private.can_access_area(c.classificacao);

  if not found then
    raise exception 'Cliente não encontrado ou sem permissão' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_cliente.id,
      'personType', case when lower(coalesce(v_cliente.tipo_pessoa, '')) in ('pj', 'cnpj', 'juridica', 'jurídica') then 'cnpj' else 'cpf' end,
      'classification', lower(coalesce(v_cliente.classificacao, 'residencial')),
      'document', v_cliente.cpf_cnpj,
      'legalName', coalesce(v_cliente.razao_social, v_cliente.nome_fantasia, 'Cliente'),
      'tradeName', v_cliente.nome_fantasia,
      'email', v_cliente.email,
      'phone', v_cliente.telefone,
      'secondaryPhone', v_cliente.telefone2,
      'contactName', v_cliente.contato,
      'notes', v_cliente.observacoes,
      'active', coalesce(v_cliente.ativo, false),
      'createdAt', v_cliente.created_at,
      'updatedAt', v_cliente.updated_at
    ),
    'addresses', jsonb_build_object(
      'activeCount', (
        select count(*)::integer
          from public.enderecos_clientes e
         where e.cliente_id = v_cliente.id
           and e.tenant_id = v_tenant_id
           and e.ativo
      ),
      'primary', (
        select jsonb_build_object(
          'id', e.id,
          'type', coalesce(e.tipo, 'principal'),
          'name', e.nome,
          'postalCode', e.cep,
          'street', e.logradouro,
          'number', e.numero,
          'complement', e.complemento,
          'neighborhood', e.bairro,
          'city', e.cidade,
          'state', e.uf,
          'country', e.pais,
          'instructions', e.instrucoes
        )
          from public.enderecos_clientes e
         where e.cliente_id = v_cliente.id
           and e.tenant_id = v_tenant_id
           and e.ativo
         order by e.principal desc, e.updated_at desc nulls last, e.created_at desc
         limit 1
      )
    ),
    'commercialTerms', jsonb_build_object(
      'configured', exists (
        select 1 from public.configuracoes_pagamento_cliente p
         where p.cliente_id = v_cliente.id
           and p.tenant_id = v_tenant_id
      ),
      'condition', (
        select p.condicao_pagamento
          from public.configuracoes_pagamento_cliente p
         where p.cliente_id = v_cliente.id
           and p.tenant_id = v_tenant_id
         order by p.updated_at desc nulls last, p.created_at desc
         limit 1
      ),
      'preferredMethod', (
        select p.forma_pagamento
          from public.configuracoes_pagamento_cliente p
         where p.cliente_id = v_cliente.id
           and p.tenant_id = v_tenant_id
         order by p.updated_at desc nulls last, p.created_at desc
         limit 1
      ),
      'frequency', (
        select c.frequencia
          from public.configuracoes_cliente c
         where c.cliente_id = v_cliente.id
           and c.tenant_id = v_tenant_id
         order by c.updated_at desc nulls last, c.created_at desc
         limit 1
      ),
      'closingDay', (
        select p.dia_fechamento
          from public.configuracoes_pagamento_cliente p
         where p.cliente_id = v_cliente.id
           and p.tenant_id = v_tenant_id
         order by p.updated_at desc nulls last, p.created_at desc
         limit 1
      ),
      'dueDay', (
        select p.dia_vencimento
          from public.configuracoes_pagamento_cliente p
         where p.cliente_id = v_cliente.id
           and p.tenant_id = v_tenant_id
         order by p.updated_at desc nulls last, p.created_at desc
         limit 1
      ),
      'priceTable', case
        when lower(coalesce(v_cliente.tabela_preco_tipo, '')) in ('cesto', 'personalizada') then lower(v_cliente.tabela_preco_tipo)
        else 'padrao'
      end
    ),
    'contract', (
      select jsonb_build_object(
        'id', c.id,
        'description', c.descricao,
        'startDate', c.data_inicio,
        'endDate', c.data_fim,
        'billingAuthorized', coalesce(c.ativo, false),
        'frequency', 'avulso',
        'closingDay', null,
        'dueDay', 0,
        'paymentMethod', null,
        'version', 0
      )
        from public.contratos_aluguel c
       where c.cliente_id = v_cliente.id
         and c.tenant_id = v_tenant_id
         and c.ativo
       order by c.updated_at desc nulls last, c.created_at desc
       limit 1
    ),
    'orders', jsonb_build_object(
      'allowed', v_orders_allowed,
      'summary', case when v_orders_allowed then (
        select jsonb_build_object(
          'total', count(*)::integer,
          'open', count(*) filter (where lower(coalesce(o.status, '')) not in ('entregue', 'cancelada', 'cancelado'))::integer,
          'late', count(*) filter (
            where o.data_previsao_entrega < current_date
              and lower(coalesce(o.status, '')) not in ('entregue', 'cancelada', 'cancelado')
          )::integer,
          'pendingPayment', count(*) filter (
            where lower(coalesce(o.status_pagamento, 'pendente')) not in ('pago', 'quitado', 'cancelado')
          )::integer,
          'openBalance', coalesce(sum(greatest(coalesce(o.valor_total, 0) - coalesce(o.valor_pago, 0), 0)), 0)
        )
          from public.ordens_servico o
         where o.cliente_id = v_cliente.id
           and o.tenant_id = v_tenant_id
      ) else null end,
      'recent', case when v_orders_allowed then coalesce((
        select jsonb_agg(to_jsonb(order_row) order by order_row.created_at desc)
          from (
            select
              o.id,
              coalesce(o.numero, o.id::text) as "number",
              coalesce(o.status, 'retirada') as status,
              coalesce(o.status_pagamento, 'pendente') as "paymentStatus",
              'nao_informado' as "qualityStatus",
              coalesce(o.status_logistica, 'nao_informado') as "logisticsStatus",
              'nao_informado' as "fiscalStatus",
              o.data_previsao_entrega as "promisedDate",
              coalesce(o.valor_total, 0) as "totalValue",
              coalesce(o.valor_pago, 0) as "paidValue",
              greatest(coalesce(o.valor_total, 0) - coalesce(o.valor_pago, 0), 0) as "openBalance",
              o.created_at
            from public.ordens_servico o
            where o.cliente_id = v_cliente.id
              and o.tenant_id = v_tenant_id
            order by o.created_at desc
            limit 5
          ) order_row
      ), '[]'::jsonb) else '[]'::jsonb end
    ),
    'finance', jsonb_build_object(
      'allowed', v_finance_allowed,
      'summary', case when v_finance_allowed then (
        select jsonb_build_object(
          'invoiceCount', count(*)::integer,
          'openInvoiceCount', count(*) filter (where lower(coalesce(f.status, '')) not in ('pago', 'paga', 'quitado', 'cancelado', 'cancelada'))::integer,
          'overdueInvoiceCount', count(*) filter (
            where f.data_vencimento < current_date
              and lower(coalesce(f.status, '')) not in ('pago', 'paga', 'quitado', 'cancelado', 'cancelada')
          )::integer,
          'openBalance', coalesce(sum(case when lower(coalesce(f.status, '')) in ('pago', 'paga', 'quitado') then 0 else coalesce(f.valor_total, 0) end), 0),
          'receivedTotal', coalesce(sum(case when lower(coalesce(f.status, '')) in ('pago', 'paga', 'quitado') then coalesce(f.valor_total, 0) else 0 end), 0)
        )
          from public.faturas f
         where f.cliente_id = v_cliente.id
           and f.tenant_id = v_tenant_id
      ) else null end,
      'recentInvoices', case when v_finance_allowed then coalesce((
        select jsonb_agg(to_jsonb(invoice_row) order by invoice_row.created_at desc)
          from (
            select
              f.id,
              coalesce(f.status, 'pendente') as status,
              coalesce(f.status, 'pendente') as "paymentStatus",
              f.periodo_inicio as "periodStart",
              f.periodo_fim as "periodEnd",
              f.data_vencimento as "dueDate",
              coalesce(f.valor_total, 0) as "totalValue",
              case when lower(coalesce(f.status, '')) in ('pago', 'paga', 'quitado') then coalesce(f.valor_total, 0) else 0 end as "paidValue",
              case when lower(coalesce(f.status, '')) in ('pago', 'paga', 'quitado') then 0 else coalesce(f.valor_total, 0) end as "openBalance",
              f.created_at
            from public.faturas f
            where f.cliente_id = v_cliente.id
              and f.tenant_id = v_tenant_id
            order by f.created_at desc
            limit 5
          ) invoice_row
      ), '[]'::jsonb) else '[]'::jsonb end,
      'recentPayments', case when v_finance_allowed then coalesce((
        select jsonb_agg(to_jsonb(payment_row) order by payment_row."paymentDate" desc)
          from (
            select
              p.id,
              null::uuid as "invoiceId",
              coalesce(p.valor, 0) as value,
              coalesce(p.confirmado_em, p.created_at) as "paymentDate",
              coalesce(p.metodo, 'nao_informado') as "paymentMethod",
              coalesce(p.status, 'pendente') as status,
              p.created_at
            from public.pdv_pagamentos p
            where p.cliente_id = v_cliente.id
              and p.tenant_id = v_tenant_id
              and lower(coalesce(p.status, '')) not in ('cancelado', 'cancelada')
            order by coalesce(p.confirmado_em, p.created_at) desc
            limit 5
          ) payment_row
      ), '[]'::jsonb) else '[]'::jsonb end
    ),
    'occurrences', jsonb_build_object(
      'allowed', v_operations_allowed,
      'recent', case when v_operations_allowed then coalesce((
        select jsonb_agg(to_jsonb(occurrence_row) order by occurrence_row.created_at desc)
          from (
            select
              h.id,
              h.ordem_servico_id as "orderId",
              coalesce(o.numero, o.id::text) as "orderNumber",
              coalesce(h.etapa_nova, 'Atualização') as stage,
              coalesce(h.observacoes, 'Etapa do pedido atualizada.') as description,
              null::date as "newPromisedDate",
              null::text as "employeeName",
              h.created_at
            from public.historico_producao h
            join public.ordens_servico o on o.id = h.ordem_servico_id
            where o.cliente_id = v_cliente.id
              and h.tenant_id = v_tenant_id
              and o.tenant_id = v_tenant_id
            order by h.created_at desc
            limit 5
          ) occurrence_row
      ), '[]'::jsonb) else '[]'::jsonb end
    ),
    'appointments', jsonb_build_object(
      'allowed', v_agenda_allowed,
      'recent', case when v_agenda_allowed then coalesce((
        select jsonb_agg(to_jsonb(appointment_row) order by appointment_row.date asc, appointment_row.time asc nulls last)
          from (
            select
              a.id,
              case when lower(coalesce(a.tipo, 'retirada')) = 'entrega' then 'entrega' else 'retirada' end as type,
              a.data as date,
              a.horario as time,
              coalesce(a.status, 'agendado') as status,
              a.observacoes as notes
            from public.agendamentos a
            where a.cliente_id = v_cliente.id
              and a.tenant_id = v_tenant_id
              and a.data >= current_date
            order by a.data asc, a.horario asc nulls last
            limit 5
          ) appointment_row
      ), '[]'::jsonb) else '[]'::jsonb end
    )
  );
end;
$function$;

grant execute on function public.consultar_ficha_cliente(uuid) to authenticated;
