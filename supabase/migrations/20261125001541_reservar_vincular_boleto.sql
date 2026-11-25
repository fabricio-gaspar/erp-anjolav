CREATE OR REPLACE FUNCTION public.vincular_boleto_fatura(_fatura_id uuid, _charge_id uuid, _linha_digitavel text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not found or not private.can_access_client(v_fatura.cliente_id) then
    raise exception 'Fatura indisponível';
  end if;
  if exists (select 1 from public.lancamentos l join public.ordens_servico o on o.id=l.ordem_servico_id and o.tenant_id=l.tenant_id where l.fatura_id=v_fatura.id and l.tenant_id=v_tenant and not private.can_access_area(case when lower(coalesce(o.origem,'industrial')) in ('residencial','loja') then 'residencial' else 'industrial' end)) then raise exception 'Sem permissão para esta operação'; end if;
  if v_fatura.asaas_charge_id = _charge_id and v_fatura.boleto_url is not null then
    return jsonb_build_object('id', v_fatura.id, 'boletoUrl', v_fatura.boleto_url, 'idempotent', true);
  end if;
  if v_fatura.status in ('cancelado','pago') or v_fatura.valor_recebido <> 0 or v_fatura.cobranca_reservada_em is null then raise exception 'Fatura sem reserva válida para cobrança'; end if;
  if v_fatura.asaas_charge_id is not null then
    raise exception 'Esta fatura já possui outra cobrança';
  end if;
  select * into v_charge from public.asaas_charges
  where id = _charge_id and tenant_id = v_tenant for share;
  if not found
     or v_charge.cliente_id is distinct from v_fatura.cliente_id
     or v_charge.billing_type <> 'BOLETO'
     or v_charge.value is distinct from v_fatura.valor_total
     or v_charge.due_date is distinct from v_fatura.cobranca_reserva_vencimento
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
    cobranca_reservada_em = null, cobranca_reserva_vencimento = null,
    status = 'pagamento_configurado'
  where id = v_fatura.id;
  if v_charge.status = 'RECEIVED' then
    perform public.conciliar_recebimento_fatura_asaas(v_charge.id,gen_random_uuid(),'PAYMENT_RECEIVED','RECEIVED',v_charge.paid_at::date);
  end if;
  return jsonb_build_object('id', v_fatura.id, 'boletoUrl', v_charge.bank_slip_url, 'idempotent', false);
end;
$function$
;
REVOKE ALL ON FUNCTION public.vincular_boleto_fatura(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vincular_boleto_fatura(uuid,uuid,text) TO authenticated;

