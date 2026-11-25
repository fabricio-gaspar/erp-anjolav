-- O vínculo histórico em lancamentos_fatura é preservado ao liberar os ROLs.
CREATE TABLE public.fatura_cancelamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fatura_id uuid NOT NULL REFERENCES public.faturas(id),
  motivo text NOT NULL CHECK (length(trim(motivo)) BETWEEN 5 AND 500),
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, fatura_id)
);
ALTER TABLE public.fatura_cancelamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fatura_cancelamentos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fatura_cancelamentos TO authenticated;
CREATE POLICY fatura_cancelamentos_select ON public.fatura_cancelamentos FOR SELECT TO authenticated
USING (tenant_id = (SELECT private.current_tenant_id())
  AND (SELECT private.has_any_module_access(ARRAY['faturamento']::text[]))
  AND private.can_access_invoice(fatura_id));

CREATE OR REPLACE FUNCTION public.cancelar_fatura_sem_documentos(_fatura_id uuid, _motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_user uuid := auth.uid();
  v_invoice public.faturas%rowtype;
  v_linked integer;
  v_historical integer;
BEGIN
  IF v_user IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['faturamento']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar fatura';
  END IF;
  IF _fatura_id IS NULL OR length(trim(coalesce(_motivo,''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Informe um motivo com 5 a 500 caracteres';
  END IF;
  SELECT * INTO v_invoice FROM public.faturas WHERE id=_fatura_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT private.can_access_client(v_invoice.cliente_id) THEN RAISE EXCEPTION 'Fatura indisponível'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.lancamentos_fatura lf
    JOIN public.lancamentos l ON l.id=lf.lancamento_id AND l.tenant_id=lf.tenant_id
    JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE lf.tenant_id=v_tenant AND lf.fatura_id=v_invoice.id
      AND NOT private.can_access_area(CASE WHEN lower(coalesce(o.origem,'industrial')) IN ('residencial','loja') THEN 'residencial' ELSE 'industrial' END)
  ) THEN RAISE EXCEPTION 'Sem permissão para a operação desta fatura'; END IF;
  IF v_invoice.status='cancelado' THEN
    IF EXISTS (SELECT 1 FROM public.fatura_cancelamentos WHERE tenant_id=v_tenant AND fatura_id=v_invoice.id AND motivo=trim(_motivo)) THEN
      RETURN jsonb_build_object('id',v_invoice.id,'idempotente',true);
    END IF;
    RAISE EXCEPTION 'Fatura já cancelada';
  END IF;
  IF v_invoice.status='pago' OR v_invoice.valor_recebido <> 0 THEN
    RAISE EXCEPTION 'Concilie e estorne todos os recebimentos antes de cancelar';
  END IF;
  IF v_invoice.cobranca_reservada_em IS NOT NULL OR v_invoice.asaas_charge_id IS NOT NULL THEN
    RAISE EXCEPTION 'Fatura com boleto ou cobrança em processamento exige conciliação antes do cancelamento';
  END IF;
  IF v_invoice.numero_nf IS NOT NULL OR coalesce(v_invoice.nfse_status,'nao_preparada') <> 'nao_preparada'
     OR EXISTS (SELECT 1 FROM public.nfse_documentos d WHERE d.tenant_id=v_tenant AND d.fatura_id=v_invoice.id) THEN
    RAISE EXCEPTION 'Fatura com documento fiscal exige conciliação fiscal antes do cancelamento';
  END IF;
  PERFORM l.id FROM public.lancamentos l
    JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id ORDER BY l.id FOR UPDATE OF l,o;
  SELECT count(*) INTO v_linked FROM public.lancamentos l WHERE l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id;
  SELECT count(*) INTO v_historical FROM public.lancamentos_fatura lf WHERE lf.tenant_id=v_tenant AND lf.fatura_id=v_invoice.id;
  IF v_linked=0 OR v_linked<>v_historical OR EXISTS (
    SELECT 1 FROM public.lancamentos l
    LEFT JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id
      AND (o.id IS NULL OR o.cliente_id<>v_invoice.cliente_id OR o.condicao_pagamento IS DISTINCT FROM 'faturado'
        OR o.status_pagamento='pago' OR coalesce(o.valor_pago,0)<>0
        OR NOT EXISTS (SELECT 1 FROM public.lancamentos_fatura lf WHERE lf.tenant_id=v_tenant AND lf.fatura_id=v_invoice.id AND lf.lancamento_id=l.id))
  ) THEN RAISE EXCEPTION 'Os vínculos ou pagamentos dos ROLs exigem revisão'; END IF;
  INSERT INTO public.fatura_cancelamentos(tenant_id,fatura_id,motivo,criado_por)
    VALUES(v_tenant,v_invoice.id,trim(_motivo),v_user);
  UPDATE public.lancamentos SET fatura_id=NULL,status='pendente'
    WHERE tenant_id=v_tenant AND fatura_id=v_invoice.id;
  UPDATE public.faturas SET status='cancelado',updated_at=now()
    WHERE tenant_id=v_tenant AND id=v_invoice.id;
  RETURN jsonb_build_object('id',v_invoice.id,'rols_liberados',v_linked,'idempotente',false);
END; $$;
REVOKE ALL ON FUNCTION public.cancelar_fatura_sem_documentos(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancelar_fatura_sem_documentos(uuid,text) TO authenticated;
