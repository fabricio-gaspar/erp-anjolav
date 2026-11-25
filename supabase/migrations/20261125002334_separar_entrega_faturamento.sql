-- A entrega e o recebimento são eventos distintos para clientes faturados.
CREATE OR REPLACE FUNCTION public.dar_baixa_rol_pdv(_ordem_servico_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.ordens_servico%rowtype; v_paid numeric(12,2); v_area text;
BEGIN
  IF auth.uid() IS NULL OR private.current_tenant_id() IS NULL OR NOT private.has_any_module_access(ARRAY['caixa','ordens','producao']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para dar baixa no ROL';
  END IF;
  SELECT * INTO v_order FROM public.ordens_servico WHERE id=_ordem_servico_id AND tenant_id=private.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROL não encontrado'; END IF;
  v_area := CASE WHEN lower(coalesce(v_order.origem,'industrial')) IN ('residencial','loja') THEN 'residencial' ELSE 'industrial' END;
  IF NOT private.can_access_area(v_area) THEN RAISE EXCEPTION 'Sem acesso à operação deste ROL'; END IF;
  IF v_order.status IN ('entregue','cancelada','cancelado') THEN RAISE EXCEPTION 'Este ROL já está encerrado'; END IF;
  IF v_order.condicao_pagamento IS DISTINCT FROM 'faturado' THEN
    SELECT coalesce(sum(valor),0) INTO v_paid FROM public.pdv_pagamentos
      WHERE tenant_id=v_order.tenant_id AND ordem_servico_id=v_order.id AND status='CONFIRMADO';
    IF v_paid + 0.009 < coalesce(v_order.valor_total,0) THEN RAISE EXCEPTION 'Receba o saldo confirmado antes de dar baixa neste ROL'; END IF;
  END IF;
  UPDATE public.ordens_servico SET status='entregue',data_entrega=coalesce(data_entrega,current_date),status_logistica='entregue',updated_at=now()
    WHERE id=v_order.id AND tenant_id=v_order.tenant_id;
  RETURN jsonb_build_object('id',v_order.id,'status','entregue','dataEntrega',current_date);
END; $$;
REVOKE ALL ON FUNCTION public.dar_baixa_rol_pdv(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dar_baixa_rol_pdv(uuid) TO authenticated;
