-- Livro de recebimentos da fatura. Nunca altera a etapa operacional do ROL.
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS valor_recebido numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS data_recebimento date;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS status_antes_quitacao text;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS cobranca_reservada_em timestamptz;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS cobranca_reserva_vencimento date;

-- Preserva faturas legadas já marcadas como pagas, sem inventar lançamentos históricos.
UPDATE public.faturas SET valor_recebido = valor_total
WHERE status = 'pago' AND valor_recebido = 0;

CREATE TABLE public.fatura_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fatura_id uuid NOT NULL REFERENCES public.faturas(id),
  tipo text NOT NULL CHECK (tipo IN ('recebimento', 'estorno')),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  data_recebimento date NOT NULL,
  forma_pagamento text NOT NULL,
  referencia text,
  motivo text,
  estorno_de uuid REFERENCES public.fatura_recebimentos(id),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','asaas')),
  criado_por uuid,
  idempotency_key text NOT NULL,
  fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (estorno_de),
  CHECK ((tipo = 'estorno') = (estorno_de IS NOT NULL)),
  CHECK (origem <> 'manual' OR criado_por IS NOT NULL)
);
CREATE INDEX fatura_recebimentos_fatura_idx ON public.fatura_recebimentos(tenant_id, fatura_id, created_at);
ALTER TABLE public.fatura_recebimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fatura_recebimentos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fatura_recebimentos TO authenticated;
CREATE POLICY fatura_recebimentos_select ON public.fatura_recebimentos FOR SELECT TO authenticated
USING (tenant_id = (SELECT private.current_tenant_id())
  AND (SELECT private.has_any_module_access(ARRAY['faturamento','contas_receber']::text[]))
  AND private.can_access_invoice(fatura_id));

-- Operação transacional: idempotência, validação da fatura e atualização dos ROLs.
CREATE OR REPLACE FUNCTION public.registrar_recebimento_fatura(
  _fatura_id uuid, _valor numeric, _data date, _forma text, _referencia text,
  _idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_user uuid := auth.uid();
  v_invoice public.faturas%rowtype;
  v_old public.fatura_recebimentos%rowtype;
  v_id uuid;
  v_fingerprint text;
  v_count integer;
  v_total numeric;
  v_paid numeric;
BEGIN
  IF v_user IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['faturamento','contas_receber']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para registrar recebimento';
  END IF;
  IF _fatura_id IS NULL OR _valor IS NULL OR _valor <= 0 OR round(_valor,2) <> _valor OR _data IS NULL
     OR _data > current_date OR _forma NOT IN ('pix','transferencia')
     OR length(coalesce(_referencia,'')) > 200 OR coalesce(_idempotency_key,'') !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Dados do recebimento inválidos';
  END IF;
  v_fingerprint := md5(jsonb_build_array(_fatura_id,_valor,_data,_forma,nullif(trim(coalesce(_referencia,'')),'') )::text);
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(v_tenant::text || ':' || _idempotency_key,0));
  SELECT * INTO v_invoice FROM public.faturas WHERE id=_fatura_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT private.can_access_client(v_invoice.cliente_id) THEN RAISE EXCEPTION 'Fatura indisponível'; END IF;
  SELECT * INTO v_old FROM public.fatura_recebimentos WHERE tenant_id=v_tenant AND idempotency_key=_idempotency_key;
  IF FOUND THEN
    IF v_old.fatura_id <> _fatura_id OR v_old.tipo <> 'recebimento' OR v_old.fingerprint <> v_fingerprint THEN RAISE EXCEPTION 'Chave já utilizada para outra operação'; END IF;
    RETURN jsonb_build_object('id',v_old.id,'valor_recebido',v_invoice.valor_recebido,'idempotente',true);
  END IF;
  IF v_invoice.status IN ('cancelado','pago') OR v_invoice.valor_total <= 0 THEN RAISE EXCEPTION 'Fatura indisponível para recebimento'; END IF;
  IF v_invoice.cobranca_reservada_em IS NOT NULL THEN RAISE EXCEPTION 'Boleto em processamento; confira o resultado antes de registrar baixa manual'; END IF;
  IF v_invoice.asaas_charge_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.asaas_charges ac WHERE ac.id=v_invoice.asaas_charge_id AND ac.tenant_id=v_tenant
      AND upper(coalesce(ac.status,'')) IN ('CANCELLED','CANCELED','DELETED','REFUNDED')
  ) THEN RAISE EXCEPTION 'Existe cobrança ativa no Asaas; concilie ou cancele a cobrança antes da baixa manual'; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos l JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE l.fatura_id=_fatura_id AND l.tenant_id=v_tenant AND NOT private.can_access_area(CASE WHEN lower(coalesce(o.origem,'industrial')) IN ('residencial','loja') THEN 'residencial' ELSE 'industrial' END)) THEN
    RAISE EXCEPTION 'Sem permissão para a operação desta fatura';
  END IF;
  PERFORM o.id FROM public.ordens_servico o JOIN public.lancamentos l ON l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id
    WHERE l.tenant_id=v_tenant AND l.fatura_id=_fatura_id ORDER BY o.id FOR UPDATE OF o;
  SELECT count(*),coalesce(sum(l.valor_total),0) INTO v_count,v_total
    FROM public.lancamentos l JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE l.tenant_id=v_tenant AND l.fatura_id=_fatura_id AND o.cliente_id=v_invoice.cliente_id
      AND o.condicao_pagamento='faturado' AND o.status<>'cancelada' AND o.valor_total=l.valor_total;
  IF v_count=0 OR round(v_total,2)<>round(v_invoice.valor_total,2) OR EXISTS (
    SELECT 1 FROM public.lancamentos l WHERE l.tenant_id=v_tenant AND l.fatura_id=_fatura_id
      AND NOT EXISTS (SELECT 1 FROM public.ordens_servico o WHERE o.id=l.ordem_servico_id AND o.tenant_id=v_tenant AND o.cliente_id=v_invoice.cliente_id AND o.condicao_pagamento='faturado' AND o.status<>'cancelada' AND o.valor_total=l.valor_total)
  ) THEN RAISE EXCEPTION 'Vínculos ou valores dos ROLs não conferem com a fatura'; END IF;
  v_paid := coalesce(v_invoice.valor_recebido,0)+_valor;
  IF v_paid > v_invoice.valor_total THEN RAISE EXCEPTION 'Valor excede o saldo da fatura'; END IF;
  INSERT INTO public.fatura_recebimentos(tenant_id,fatura_id,tipo,valor,data_recebimento,forma_pagamento,referencia,criado_por,idempotency_key,fingerprint)
    VALUES(v_tenant,_fatura_id,'recebimento',_valor,_data,_forma,nullif(trim(coalesce(_referencia,'')),''),v_user,_idempotency_key,v_fingerprint) RETURNING id INTO v_id;
  UPDATE public.faturas SET valor_recebido=v_paid,data_recebimento=greatest(coalesce(data_recebimento,_data),_data),
    status_antes_quitacao=CASE WHEN v_paid=valor_total THEN status ELSE status_antes_quitacao END,
    status=CASE WHEN v_paid=valor_total THEN 'pago' ELSE status END,updated_at=now()
    WHERE id=_fatura_id AND tenant_id=v_tenant;
  IF v_paid=v_invoice.valor_total THEN
    UPDATE public.ordens_servico o SET valor_pago=o.valor_total,status_pagamento='pago',updated_at=now()
      FROM public.lancamentos l WHERE l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id AND l.tenant_id=v_tenant AND l.fatura_id=_fatura_id;
  END IF;
  RETURN jsonb_build_object('id',v_id,'valor_recebido',v_paid,'saldo',v_invoice.valor_total-v_paid,'quitada',v_paid=v_invoice.valor_total,'idempotente',false);
END; $$;
REVOKE ALL ON FUNCTION public.registrar_recebimento_fatura(uuid,numeric,date,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_fatura(uuid,numeric,date,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.estornar_recebimento_fatura(_recebimento_id uuid, _motivo text, _idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid := private.current_tenant_id(); v_user uuid := auth.uid();
  v_payment public.fatura_recebimentos%rowtype; v_old public.fatura_recebimentos%rowtype;
  v_invoice public.faturas%rowtype; v_paid numeric; v_id uuid; v_last_date date; v_fingerprint text;
BEGIN
  IF v_user IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['faturamento','contas_receber']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para estornar recebimento';
  END IF;
  IF _recebimento_id IS NULL OR length(trim(coalesce(_motivo,''))) NOT BETWEEN 5 AND 500
     OR coalesce(_idempotency_key,'') !~ '^[A-Za-z0-9:._-]{8,200}$' THEN RAISE EXCEPTION 'Dados de estorno inválidos'; END IF;
  v_fingerprint := md5(jsonb_build_array(_recebimento_id,trim(_motivo))::text);
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(v_tenant::text || ':' || _idempotency_key,0));
  SELECT * INTO v_payment FROM public.fatura_recebimentos WHERE id=_recebimento_id AND tenant_id=v_tenant AND tipo='recebimento';
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento indisponível'; END IF;
  IF v_payment.origem <> 'manual' THEN RAISE EXCEPTION 'Recebimento do Asaas deve ser estornado no provedor e conciliado'; END IF;
  SELECT * INTO v_invoice FROM public.faturas WHERE id=v_payment.fatura_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT private.can_access_client(v_invoice.cliente_id) THEN RAISE EXCEPTION 'Fatura indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM public.lancamentos l JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE l.fatura_id=v_invoice.id AND l.tenant_id=v_tenant AND NOT private.can_access_area(CASE WHEN lower(coalesce(o.origem,'industrial')) IN ('residencial','loja') THEN 'residencial' ELSE 'industrial' END)) THEN
    RAISE EXCEPTION 'Sem permissão para a operação desta fatura';
  END IF;
  SELECT * INTO v_old FROM public.fatura_recebimentos WHERE tenant_id=v_tenant AND idempotency_key=_idempotency_key;
  IF FOUND THEN
    IF v_old.tipo<>'estorno' OR v_old.fingerprint<>v_fingerprint OR v_old.fatura_id<>v_invoice.id THEN RAISE EXCEPTION 'Chave já utilizada para outra operação'; END IF;
    RETURN jsonb_build_object('id',v_old.id,'valor_recebido',v_invoice.valor_recebido,'idempotente',true);
  END IF;
  IF v_invoice.status='cancelado' THEN RAISE EXCEPTION 'Fatura cancelada'; END IF;
  IF EXISTS (SELECT 1 FROM public.fatura_recebimentos WHERE estorno_de=v_payment.id) THEN RAISE EXCEPTION 'Recebimento já estornado'; END IF;
  IF v_invoice.valor_recebido < v_payment.valor THEN RAISE EXCEPTION 'Saldo de recebimentos inconsistente'; END IF;
  PERFORM o.id FROM public.ordens_servico o JOIN public.lancamentos l ON l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id
    WHERE l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id ORDER BY o.id FOR UPDATE OF o;
  v_paid:=v_invoice.valor_recebido-v_payment.valor;
  INSERT INTO public.fatura_recebimentos(tenant_id,fatura_id,tipo,valor,data_recebimento,forma_pagamento,motivo,estorno_de,criado_por,idempotency_key,fingerprint)
    VALUES(v_tenant,v_invoice.id,'estorno',v_payment.valor,current_date,v_payment.forma_pagamento,trim(_motivo),v_payment.id,v_user,_idempotency_key,v_fingerprint) RETURNING id INTO v_id;
  SELECT max(p.data_recebimento) INTO v_last_date FROM public.fatura_recebimentos p WHERE p.tenant_id=v_tenant AND p.fatura_id=v_invoice.id AND p.tipo='recebimento'
    AND NOT EXISTS (SELECT 1 FROM public.fatura_recebimentos e WHERE e.estorno_de=p.id);
  UPDATE public.faturas SET valor_recebido=v_paid,data_recebimento=v_last_date,
    status=CASE WHEN status='pago' THEN coalesce(status_antes_quitacao,'pendente') ELSE status END,
    status_antes_quitacao=CASE WHEN status='pago' THEN NULL ELSE status_antes_quitacao END,updated_at=now()
    WHERE id=v_invoice.id AND tenant_id=v_tenant;
  IF v_invoice.valor_total > 0 AND v_invoice.valor_recebido >= v_invoice.valor_total THEN
    UPDATE public.ordens_servico o SET valor_pago=0,status_pagamento='pendente',updated_at=now()
      FROM public.lancamentos l WHERE l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id AND l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id;
  END IF;
  RETURN jsonb_build_object('id',v_id,'valor_recebido',v_paid,'saldo',v_invoice.valor_total-v_paid,'idempotente',false);
END; $$;
REVOKE ALL ON FUNCTION public.estornar_recebimento_fatura(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.estornar_recebimento_fatura(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.consultar_recebimentos_fatura(_fatura_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_tenant uuid := private.current_tenant_id(); v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['faturamento','contas_receber']::text[])
     OR NOT private.can_access_invoice(_fatura_id) THEN RAISE EXCEPTION 'Sem permissão para consultar a fatura'; END IF;
  SELECT jsonb_build_object(
    'valor_total',f.valor_total,'valor_recebido',f.valor_recebido,'data_recebimento',f.data_recebimento,'status',f.status,
    'recebimentos',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',p.id,'tipo',p.tipo,'valor',p.valor,'data',p.data_recebimento,'forma',p.forma_pagamento,
      'referencia',p.referencia,'motivo',p.motivo,'estorno_de',p.estorno_de,'origem',p.origem,'criado_por',p.criado_por,'created_at',p.created_at
    ) ORDER BY p.created_at DESC) FROM public.fatura_recebimentos p WHERE p.fatura_id=f.id AND p.tenant_id=v_tenant),'[]'::jsonb),
    'rols',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'numero',o.numero,'data',o.data_retirada,
      'valor',o.valor_total,'situacao',o.status,'pagamento',o.status_pagamento) ORDER BY o.data_retirada,o.numero)
      FROM public.lancamentos l JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
      WHERE l.tenant_id=v_tenant AND (l.fatura_id=f.id OR EXISTS (
        SELECT 1 FROM public.lancamentos_fatura lf WHERE lf.tenant_id=v_tenant AND lf.fatura_id=f.id AND lf.lancamento_id=l.id
      ))),'[]'::jsonb)
  ) INTO v_result FROM public.faturas f WHERE f.id=_fatura_id AND f.tenant_id=v_tenant;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Fatura indisponível'; END IF;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.consultar_recebimentos_fatura(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_recebimentos_fatura(uuid) TO authenticated;

-- Somente o webhook autenticado, após consultar o estado atual no Asaas, pode chamar esta função.
CREATE OR REPLACE FUNCTION public.conciliar_recebimento_fatura_asaas(_charge_id uuid, _evento_id uuid, _evento text, _status text, _data date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_charge public.asaas_charges%rowtype; v_invoice public.faturas%rowtype;
  v_payment public.fatura_recebimentos%rowtype; v_rollback public.fatura_recebimentos%rowtype;
  v_count integer; v_total numeric; v_key text;
BEGIN
  IF _charge_id IS NULL OR _evento_id IS NULL OR _evento IS NULL OR _status IS NULL THEN RAISE EXCEPTION 'Evento incompleto'; END IF;
  SELECT * INTO v_charge FROM public.asaas_charges WHERE id=_charge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;
  IF v_charge.status IS DISTINCT FROM _status THEN RAISE EXCEPTION 'Estado da cobrança exige nova conferência'; END IF;
  SELECT * INTO v_invoice FROM public.faturas WHERE asaas_charge_id=v_charge.id AND tenant_id=v_charge.tenant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('fatura',false); END IF;
  IF v_invoice.status='cancelado' OR round(v_charge.value,2)<>round(v_invoice.valor_total,2) THEN RAISE EXCEPTION 'Cobrança e fatura exigem revisão'; END IF;
  IF _evento IN ('PAYMENT_PARTIALLY_REFUNDED','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_CHARGEBACK_REQUESTED') THEN
    RAISE EXCEPTION 'Estorno parcial ou contestação exige conciliação assistida';
  END IF;
  IF EXISTS (SELECT 1 FROM public.fatura_recebimentos WHERE tenant_id=v_invoice.tenant_id AND fatura_id=v_invoice.id AND origem='manual') THEN
    RAISE EXCEPTION 'Fatura com recebimento manual exige conciliação assistida';
  END IF;
  PERFORM o.id FROM public.ordens_servico o JOIN public.lancamentos l ON l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id
    WHERE l.tenant_id=v_invoice.tenant_id AND l.fatura_id=v_invoice.id ORDER BY o.id FOR UPDATE OF o;
  SELECT count(*),coalesce(sum(l.valor_total),0) INTO v_count,v_total FROM public.lancamentos l
    JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
    WHERE l.tenant_id=v_invoice.tenant_id AND l.fatura_id=v_invoice.id AND o.cliente_id=v_invoice.cliente_id
      AND o.condicao_pagamento='faturado' AND o.status<>'cancelada' AND o.valor_total=l.valor_total;
  IF v_count=0 OR round(v_total,2)<>round(v_invoice.valor_total,2) OR EXISTS (
    SELECT 1 FROM public.lancamentos l WHERE l.tenant_id=v_invoice.tenant_id AND l.fatura_id=v_invoice.id
      AND NOT EXISTS (SELECT 1 FROM public.ordens_servico o WHERE o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
        AND o.cliente_id=v_invoice.cliente_id AND o.condicao_pagamento='faturado' AND o.status<>'cancelada' AND o.valor_total=l.valor_total)
  ) THEN RAISE EXCEPTION 'Vínculos ou valores dos ROLs não conferem'; END IF;
  SELECT p.* INTO v_payment FROM public.fatura_recebimentos p
    WHERE p.tenant_id=v_invoice.tenant_id AND p.fatura_id=v_invoice.id AND p.origem='asaas' AND p.tipo='recebimento'
      AND NOT EXISTS (SELECT 1 FROM public.fatura_recebimentos e WHERE e.estorno_de=p.id)
    ORDER BY p.created_at DESC LIMIT 1;
  IF _status='RECEIVED' THEN
    IF v_payment.id IS NOT NULL THEN RETURN jsonb_build_object('fatura',true,'idempotente',true); END IF;
    IF v_invoice.valor_recebido<>0 OR v_invoice.status='pago' THEN RAISE EXCEPTION 'Fatura previamente paga exige conciliação assistida'; END IF;
    v_key:='asaas-event:' || _evento_id::text;
    INSERT INTO public.fatura_recebimentos(tenant_id,fatura_id,tipo,valor,data_recebimento,forma_pagamento,referencia,origem,idempotency_key,fingerprint)
      VALUES(v_invoice.tenant_id,v_invoice.id,'recebimento',v_invoice.valor_total,coalesce(_data,current_date),lower(coalesce(v_charge.billing_type,'outro')),v_charge.asaas_id,'asaas',v_key,md5(v_charge.id::text || ':' || _evento_id::text));
    UPDATE public.faturas SET valor_recebido=valor_total,data_recebimento=coalesce(_data,current_date),status_antes_quitacao=status,status='pago',updated_at=now() WHERE id=v_invoice.id AND tenant_id=v_invoice.tenant_id;
    UPDATE public.ordens_servico o SET valor_pago=o.valor_total,status_pagamento='pago',updated_at=now() FROM public.lancamentos l
      WHERE l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id AND l.tenant_id=v_invoice.tenant_id AND l.fatura_id=v_invoice.id;
    RETURN jsonb_build_object('fatura',true,'quitada',true);
  END IF;
  IF _evento IN ('PAYMENT_REFUNDED','PAYMENT_RECEIVED_IN_CASH_UNDONE') AND v_payment.id IS NOT NULL THEN
    v_key:='asaas-event:' || _evento_id::text;
    INSERT INTO public.fatura_recebimentos(tenant_id,fatura_id,tipo,valor,data_recebimento,forma_pagamento,referencia,motivo,estorno_de,origem,idempotency_key,fingerprint)
      VALUES(v_invoice.tenant_id,v_invoice.id,'estorno',v_payment.valor,current_date,v_payment.forma_pagamento,v_charge.asaas_id,_evento,v_payment.id,'asaas',v_key,md5(v_charge.id::text || ':' || _evento_id::text)) RETURNING * INTO v_rollback;
    UPDATE public.faturas SET valor_recebido=0,data_recebimento=NULL,status=CASE WHEN status='pago' THEN coalesce(status_antes_quitacao,'pendente') ELSE status END,status_antes_quitacao=NULL,updated_at=now() WHERE id=v_invoice.id AND tenant_id=v_invoice.tenant_id;
    UPDATE public.ordens_servico o SET valor_pago=0,status_pagamento='pendente',updated_at=now() FROM public.lancamentos l
      WHERE l.ordem_servico_id=o.id AND l.tenant_id=o.tenant_id AND l.tenant_id=v_invoice.tenant_id AND l.fatura_id=v_invoice.id;
    RETURN jsonb_build_object('fatura',true,'estornada',true);
  END IF;
  RETURN jsonb_build_object('fatura',true,'alterada',false);
END; $$;
REVOKE ALL ON FUNCTION public.conciliar_recebimento_fatura_asaas(uuid,uuid,text,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.conciliar_recebimento_fatura_asaas(uuid,uuid,text,text,date) TO service_role;

CREATE OR REPLACE FUNCTION public.reservar_boleto_fatura(_fatura_id uuid, _vencimento date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant uuid := private.current_tenant_id(); v_invoice public.faturas%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['faturamento']::text[]) THEN RAISE EXCEPTION 'Sem permissão para gerar boleto'; END IF;
  IF _vencimento IS NULL THEN RAISE EXCEPTION 'Vencimento inválido'; END IF;
  SELECT * INTO v_invoice FROM public.faturas WHERE id=_fatura_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT private.can_access_client(v_invoice.cliente_id) THEN RAISE EXCEPTION 'Fatura indisponível'; END IF;
  IF v_invoice.status IN ('cancelado','pago') OR v_invoice.valor_total <= 0 OR v_invoice.valor_recebido <> 0 OR v_invoice.asaas_charge_id IS NOT NULL THEN RAISE EXCEPTION 'Fatura indisponível para nova cobrança'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lancamentos l WHERE l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id)
    OR EXISTS (SELECT 1 FROM public.lancamentos l JOIN public.ordens_servico o ON o.id=l.ordem_servico_id AND o.tenant_id=l.tenant_id
      WHERE l.tenant_id=v_tenant AND l.fatura_id=v_invoice.id AND NOT private.can_access_area(CASE WHEN lower(coalesce(o.origem,'industrial')) IN ('residencial','loja') THEN 'residencial' ELSE 'industrial' END)) THEN RAISE EXCEPTION 'Sem acesso à operação da fatura'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes_pagamento_cliente cfg WHERE cfg.tenant_id=v_tenant AND cfg.cliente_id=v_invoice.cliente_id AND cfg.forma_pagamento='boleto' AND cfg.condicao_pagamento='faturado') THEN RAISE EXCEPTION 'Boleto não está configurado para este cliente'; END IF;
  IF v_invoice.cobranca_reservada_em IS NOT NULL THEN
    IF v_invoice.cobranca_reserva_vencimento IS DISTINCT FROM _vencimento THEN RAISE EXCEPTION 'Existe cobrança pendente de conferência com outro vencimento'; END IF;
    RETURN jsonb_build_object('id',v_invoice.id,'idempotente',true);
  END IF;
  IF _vencimento < current_date THEN RAISE EXCEPTION 'Vencimento inválido'; END IF;
  UPDATE public.faturas SET cobranca_reservada_em=now(),cobranca_reserva_vencimento=_vencimento,updated_at=now() WHERE id=v_invoice.id AND tenant_id=v_tenant;
  RETURN jsonb_build_object('id',v_invoice.id,'idempotente',false);
END; $$;
REVOKE ALL ON FUNCTION public.reservar_boleto_fatura(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reservar_boleto_fatura(uuid,date) TO authenticated;

create or replace function public.consultar_faturas_faturamento_filtradas(
  _area text, _inicio date, _fim date, _pagina integer default 1, _tamanho integer default 25,
  _busca text default null, _situacao text default 'todos'
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tenant uuid := private.current_tenant_id();
  v_result jsonb;
begin
  if auth.uid() is null or v_tenant is null
     or _area not in ('central', 'industrial', 'residencial')
     or not private.can_access_area(_area)
     or not private.has_any_module_access(array['faturamento']::text[]) then
    raise exception 'Sem permissão para consultar as faturas';
  end if;
  if _inicio is null or _fim is null or _fim < _inicio or _fim > _inicio + 366 then
    raise exception 'Informe um período válido de até 366 dias';
  end if;
  if _pagina < 1 or _tamanho < 1 or _tamanho > 100 then
    raise exception 'Paginação inválida';
  end if;
  if length(coalesce(_busca,'')) > 100 or coalesce(_situacao,'todos') not in ('todos','pendente','parcial','pago','atrasado','cancelado') then
    raise exception 'Filtros inválidos';
  end if;
  with filtradas as (
    select f.id, f.cliente_id, f.periodo_inicio, f.periodo_fim, f.valor_total, f.valor_recebido, f.data_recebimento,
      f.cobranca_reservada_em, f.cobranca_reserva_vencimento,
      f.status, f.tipo_relatorio, f.itens_snapshot, f.numero_nf, f.link_pdf_nf,
      f.protocolo_nfse, f.asaas_charge_id, f.boleto_url, f.boleto_linha_digitavel,
      f.forma_pagamento, f.data_vencimento, f.data_envio, f.created_at,
      f.configuracao_fiscal_id, f.nfse_status, f.operation_type,
      case when d.id is null then null else jsonb_build_object(
        'id', d.id, 'status', d.status, 'ambiente', d.ambiente,
        'numero', d.numero, 'chave_acesso', d.chave_acesso,
        'protocolo', d.protocolo, 'tentativas', d.tentativas,
        'autorizado_em', d.autorizado_em, 'cancelado_em', d.cancelado_em,
        'erros', d.erros
      ) end as nfse,
      case when cf.id is null then null else jsonb_build_object(
        'id', cf.id, 'nome', cf.nome, 'cnpj_final', right(regexp_replace(cf.cnpj, '\D', '', 'g'), 4),
        'ambiente', cf.ambiente, 'credencial_status', cf.credencial_status,
        'operation_type', cf.operation_type
      ) end as emitente,
      jsonb_build_object('razao_social', c.razao_social, 'cpf_cnpj', c.cpf_cnpj,
        'email', c.email, 'telefone', c.telefone, 'classificacao', c.classificacao) as cliente
    from public.faturas f
    join public.clientes c on c.id = f.cliente_id and c.tenant_id = f.tenant_id
    left join public.nfse_documentos d on d.fatura_id = f.id and d.tenant_id = f.tenant_id
    left join public.configuracoes_fiscais cf on cf.id = f.configuracao_fiscal_id and cf.tenant_id = f.tenant_id
    where f.tenant_id = v_tenant
      and f.periodo_inicio <= _fim and f.periodo_fim >= _inicio
      and (nullif(trim(coalesce(_busca,'')),'') is null or c.razao_social ilike '%' || trim(_busca) || '%' or coalesce(c.cpf_cnpj,'') ilike '%' || trim(_busca) || '%')
      and (coalesce(_situacao,'todos')='todos' or case
        when f.status='cancelado' then 'cancelado'
        when f.valor_total > 0 and f.valor_recebido >= f.valor_total then 'pago'
        when f.data_vencimento < current_date then 'atrasado'
        when f.valor_recebido > 0 then 'parcial'
        else 'pendente' end = _situacao)
      and (_area = 'central' or exists (
        select 1 from public.lancamentos l
        join public.ordens_servico os on os.id = l.ordem_servico_id and os.tenant_id = l.tenant_id
        where l.tenant_id = v_tenant and (l.fatura_id = f.id or exists (
          select 1 from public.lancamentos_fatura lf where lf.tenant_id = v_tenant and lf.fatura_id = f.id and lf.lancamento_id = l.id
        ))
          and case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja')
            then 'residencial' else 'industrial' end = _area
      ))
  ), pagina as (
    select * from filtradas order by created_at desc, id desc
    limit _tamanho offset (_pagina - 1) * _tamanho
  )
  select jsonb_build_object(
    'total', (select count(*) from filtradas),
    'items', coalesce((select jsonb_agg(to_jsonb(pagina) order by created_at desc, id desc)
      from pagina), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.consultar_faturas_faturamento_filtradas(text,date,date,integer,integer,text,text)
  from public, anon;
grant execute on function public.consultar_faturas_faturamento_filtradas(text,date,date,integer,integer,text,text)
  to authenticated;


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
      and (_area = 'central' or
        case when lower(coalesce(os.origem, 'industrial')) in ('residencial', 'loja')
          then 'residencial' else 'industrial' end = _area)
  ), agrupado as (
    select id as cliente_id, razao_social, cpf_cnpj, classificacao,
      max(tipo_relatorio) as tipo_relatorio,
      max(forma_pagamento) as forma_pagamento,
      count(*)::integer as movimentos,
      count(*) filter (where elegivel)::integer as faturaveis,
      count(*) filter (where not elegivel)::integer as nao_faturaveis,
      coalesce(sum(valor_total), 0) as valor_movimentado,
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


