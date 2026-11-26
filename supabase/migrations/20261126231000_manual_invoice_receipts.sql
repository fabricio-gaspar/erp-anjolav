-- FAT-05 follow-up. A receipt is a ledger event, not a billing workflow step.
-- Apply after 20261126230000_invoice_receivables_coherence.sql.

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS valor_pago numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS versao_financeira integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_pagamento date;

-- There are no invoices in the checked live database; this also keeps old
-- cancelled invoices consistent when the migration is run elsewhere.
UPDATE public.faturas
SET status_pagamento = 'cancelado'
WHERE status = 'cancelado' AND valor_pago = 0 AND status_pagamento = 'pendente';

ALTER TABLE public.faturas
  ADD CONSTRAINT faturas_receipt_amount_check
    CHECK (valor_pago >= 0 AND valor_pago <= valor_total),
  ADD CONSTRAINT faturas_receipt_status_check
    CHECK (
      (status_pagamento = 'pendente' AND valor_pago = 0)
      OR (status_pagamento = 'parcial' AND valor_pago > 0 AND valor_pago < valor_total)
      OR (status_pagamento = 'pago' AND valor_total > 0 AND valor_pago = valor_total)
      OR (status_pagamento = 'cancelado' AND valor_pago = 0)
    ),
  ADD CONSTRAINT faturas_receipt_version_check CHECK (versao_financeira >= 0),
  ADD CONSTRAINT faturas_receipt_source_check
    CHECK (asaas_charge_id IS NULL OR valor_pago = 0),
  ADD CONSTRAINT faturas_receipt_date_check
    CHECK ((valor_pago = 0 AND data_pagamento IS NULL)
      OR (valor_pago > 0 AND data_pagamento IS NOT NULL));

CREATE TABLE public.fatura_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  fatura_id uuid NOT NULL,
  caixa_id uuid NOT NULL,
  caixa_movimentacao_id uuid NOT NULL UNIQUE,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento date NOT NULL,
  forma_pagamento text NOT NULL CHECK (forma_pagamento IN
    ('PIX','TRANSFERENCIA','BOLETO','CARTAO_CREDITO','CARTAO_DEBITO','DINHEIRO','OUTRO')),
  referencia text,
  observacoes text,
  criado_por uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  resultado jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fatura_pagamentos_fatura_tenant_fkey FOREIGN KEY (fatura_id,tenant_id)
    REFERENCES public.faturas(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fatura_pagamentos_caixa_tenant_fkey FOREIGN KEY (caixa_id,tenant_id)
    REFERENCES public.caixas(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fatura_pagamentos_movimento_tenant_fkey FOREIGN KEY (caixa_movimentacao_id,tenant_id)
    REFERENCES public.caixa_movimentacoes(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fatura_pagamentos_idempotency_unique UNIQUE (tenant_id,idempotency_key)
);

CREATE INDEX fatura_pagamentos_fatura_data_idx
  ON public.fatura_pagamentos (tenant_id,fatura_id,data_pagamento DESC,created_at DESC);

ALTER TABLE public.fatura_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fatura_pagamentos_read ON public.fatura_pagamentos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT private.current_tenant_id())
    AND (SELECT private.has_any_module_access(
      ARRAY['faturamento','contas_receber','caixa','relatorios']::text[]))
    AND EXISTS (
      SELECT 1 FROM public.faturas f
      WHERE f.id = fatura_id AND f.tenant_id = fatura_pagamentos.tenant_id
        AND private.can_access_client(f.cliente_id)
        AND private.can_access_area(f.operation_type::text)
    )
  );
REVOKE ALL ON public.fatura_pagamentos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.fatura_pagamentos TO authenticated;

CREATE TRIGGER audit_mutation
  AFTER INSERT OR UPDATE OR DELETE ON public.fatura_pagamentos
  FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

-- Direct table writes can still edit the billing workflow. Receipt totals,
-- versions and dates are writable only by the definer receipt command.
CREATE OR REPLACE FUNCTION private.guard_fatura_receipt_fields()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'cancelado' AND NEW.valor_pago = 0 THEN
      NEW.status_pagamento := 'cancelado';
    END IF;
    IF current_user = 'authenticated' AND
       (NEW.valor_pago <> 0 OR NEW.status_pagamento NOT IN ('pendente','cancelado')
        OR NEW.versao_financeira <> 0 OR NEW.data_pagamento IS NOT NULL) THEN
      RAISE EXCEPTION 'Recebimentos de fatura devem ser registrados pelo comando financeiro';
    END IF;
  ELSE
    IF OLD.valor_pago > 0 AND (
      NEW.valor_total IS DISTINCT FROM OLD.valor_total
      OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.operation_type IS DISTINCT FROM OLD.operation_type
      OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
      OR NEW.status = 'cancelado') THEN
      RAISE EXCEPTION 'Fatura recebida não pode alterar origem, total ou ser cancelada';
    END IF;
    IF NEW.status = 'cancelado' AND OLD.status <> 'cancelado' THEN
      NEW.status_pagamento := 'cancelado';
    END IF;
    IF current_user = 'authenticated' AND (
      NEW.valor_pago IS DISTINCT FROM OLD.valor_pago
      OR NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento
      OR NEW.versao_financeira IS DISTINCT FROM OLD.versao_financeira
      OR NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento) THEN
      RAISE EXCEPTION 'Recebimentos de fatura devem ser registrados pelo comando financeiro';
    END IF;
  END IF;
  IF NEW.valor_pago > 0 AND NEW.asaas_charge_id IS NOT NULL THEN
    RAISE EXCEPTION 'Fatura com recebimento manual não aceita cobrança Asaas';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_fatura_receipt_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_fatura_receipt_fields
  BEFORE INSERT OR UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION private.guard_fatura_receipt_fields();

-- The old trigger mirrored invoice workflow status onto orders. An invoice
-- receipt is accounted at invoice level; workflow transitions must not mint
-- or erase order payments.
DROP TRIGGER IF EXISTS sync_billed_pdv_payment ON public.faturas;

-- Invoice charge creation and manual receipt take the invoice row lock in
-- opposite workflows. Whichever commits first excludes the other source.
CREATE OR REPLACE FUNCTION private.guard_invoice_charge_after_manual_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_invoice_id uuid;
  v_paid numeric;
BEGIN
  IF NEW.external_reference ~ '^fatura:[0-9a-fA-F-]{36}:[A-Za-z0-9_-]+$' THEN
    v_invoice_id := split_part(NEW.external_reference,':',2)::uuid;
    SELECT f.valor_pago INTO v_paid FROM public.faturas f
    WHERE f.id = v_invoice_id AND f.tenant_id = NEW.tenant_id FOR UPDATE;
    IF FOUND AND v_paid > 0 THEN
      RAISE EXCEPTION 'Fatura com recebimento manual não aceita cobrança Asaas';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_invoice_charge_after_manual_receipt()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_invoice_charge_after_manual_receipt
  BEFORE INSERT OR UPDATE OF external_reference,tenant_id ON public.asaas_charges
  FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_charge_after_manual_receipt();

CREATE OR REPLACE FUNCTION public.registrar_pagamento_fatura(
  _fatura_id uuid, _caixa_id uuid, _valor numeric, _data_pagamento date,
  _forma_pagamento text, _referencia text, _observacoes text,
  _versao_esperada integer, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_actor uuid := auth.uid();
  v_fatura public.faturas%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_previous public.fatura_pagamentos%ROWTYPE;
  v_movement_id uuid;
  v_payment_id uuid := gen_random_uuid();
  v_new_paid numeric(12,2);
  v_status text;
  v_ref text := NULLIF(trim(coalesce(_referencia,'')), '');
  v_notes text := NULLIF(trim(coalesce(_observacoes,'')), '');
  v_request jsonb;
  v_fingerprint text;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['faturamento','contas_receber']::text[])
     OR NOT private.pdv_cash_write_allowed() THEN
    RAISE EXCEPTION 'Sem permissão para receber faturas no caixa';
  END IF;
  IF _fatura_id IS NULL OR _caixa_id IS NULL OR _valor IS NULL
     OR _valor::text IN ('NaN','Infinity','-Infinity')
     OR _valor <= 0 OR _valor <> round(_valor,2)
     OR _data_pagamento IS NULL
     OR _data_pagamento > (now() AT TIME ZONE 'America/Sao_Paulo')::date
     OR _forma_pagamento IS NULL OR _forma_pagamento NOT IN
       ('PIX','TRANSFERENCIA','BOLETO','CARTAO_CREDITO','CARTAO_DEBITO','DINHEIRO','OUTRO')
     OR _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$'
     OR length(coalesce(_referencia,'')) > 160
     OR length(coalesce(_observacoes,'')) > 1000 THEN
    RAISE EXCEPTION 'Dados do recebimento inválidos';
  END IF;

  v_request := jsonb_build_object('fatura_id',_fatura_id,'caixa_id',_caixa_id,
    'valor',_valor,'data_pagamento',_data_pagamento,'forma_pagamento',_forma_pagamento,
    'referencia',v_ref,'observacoes',v_notes,'versao_esperada',_versao_esperada);
  v_fingerprint := md5(v_request::text);
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_tenant::text || ':fatura_recebimento:' || _idempotency_key, 0));

  SELECT * INTO v_fatura FROM public.faturas
  WHERE id = _fatura_id AND tenant_id = v_tenant FOR UPDATE;
  IF NOT FOUND OR NOT private.can_access_client(v_fatura.cliente_id)
     OR v_fatura.operation_type IS NULL
     OR NOT private.can_access_area(v_fatura.operation_type::text) THEN
    RAISE EXCEPTION 'Fatura não encontrada nesta empresa e operação';
  END IF;

  SELECT * INTO v_previous FROM public.fatura_pagamentos
  WHERE tenant_id = v_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_previous.criado_por <> v_actor
       OR v_previous.fatura_id <> _fatura_id
       OR v_previous.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada com outros dados';
    END IF;
    RETURN v_previous.resultado || jsonb_build_object('idempotent',true);
  END IF;

  IF v_fatura.status = 'cancelado' OR v_fatura.status_pagamento IN ('cancelado','pago')
     OR v_fatura.valor_total <= 0 THEN
    RAISE EXCEPTION 'Esta fatura não aceita novos recebimentos';
  END IF;
  IF v_fatura.asaas_charge_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.asaas_charges charge
    WHERE charge.tenant_id = v_tenant
      AND charge.external_reference LIKE 'fatura:' || v_fatura.id::text || ':%'
  ) THEN
    RAISE EXCEPTION 'Fatura com cobrança Asaas deve ser conciliada pelo provedor';
  END IF;
  IF _versao_esperada IS NULL OR v_fatura.versao_financeira <> _versao_esperada THEN
    RAISE EXCEPTION 'Esta fatura foi alterada. Atualize e tente novamente';
  END IF;
  IF _valor > v_fatura.valor_total - v_fatura.valor_pago THEN
    RAISE EXCEPTION 'O recebimento excede o saldo da fatura';
  END IF;

  -- Lock the shared register after the invoice. Closure takes the same row
  -- lock, so a receipt cannot slip into a register after reconciliation.
  SELECT * INTO v_caixa FROM public.caixas
  WHERE id = _caixa_id AND tenant_id = v_tenant
    AND status = 'ABERTO' AND modelo = 'compartilhado' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Abra um caixa compartilhado nesta empresa antes de receber';
  END IF;
  IF (v_caixa.operation_type IS NOT NULL
      AND v_caixa.operation_type IS DISTINCT FROM v_fatura.operation_type)
     OR (v_caixa.unidade_id IS NOT NULL
      AND v_caixa.unidade_id IS DISTINCT FROM v_fatura.unidade_id) THEN
    RAISE EXCEPTION 'O caixa aberto pertence a outra operação ou unidade';
  END IF;
  IF _data_pagamento < (v_caixa.data_abertura AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'A data do recebimento deve estar dentro do caixa aberto';
  END IF;

  INSERT INTO public.caixa_movimentacoes (
    caixa_id,tenant_id,tipo,valor,descricao,forma_pagamento,cliente_id,
    categoria_id,centro_custo_id,criado_por,ocorrido_em,referencia,
    operation_type,evento_pagamento
  ) VALUES (
    v_caixa.id,v_tenant,'FATURA_RECEBIMENTO',_valor,
    'Recebimento manual da fatura ' || v_fatura.id::text,_forma_pagamento,
    v_fatura.cliente_id,v_fatura.categoria_id,v_fatura.centro_custo_id,
    v_actor,now(),'fatura:' || v_fatura.id::text,v_fatura.operation_type,'CONFIRMACAO'
  ) RETURNING id INTO v_movement_id;

  v_new_paid := v_fatura.valor_pago + _valor;
  v_status := CASE WHEN v_new_paid = v_fatura.valor_total THEN 'pago' ELSE 'parcial' END;
  UPDATE public.faturas
  SET valor_pago = v_new_paid, status_pagamento = v_status,
      data_pagamento = _data_pagamento, versao_financeira = versao_financeira + 1
  WHERE id = v_fatura.id AND tenant_id = v_tenant RETURNING * INTO v_fatura;

  v_result := jsonb_build_object('id',v_fatura.id,'pagamentoId',v_payment_id,
    'status',v_fatura.status,'statusPagamento',v_status,'valor',v_fatura.valor_total,
    'valorPago',v_new_paid,'saldo',v_fatura.valor_total-v_new_paid,
    'versao',v_fatura.versao_financeira,'idempotent',false);
  INSERT INTO public.fatura_pagamentos (
    id,tenant_id,fatura_id,caixa_id,caixa_movimentacao_id,valor,data_pagamento,
    forma_pagamento,referencia,observacoes,criado_por,idempotency_key,
    request_fingerprint,resultado
  ) VALUES (
    v_payment_id,v_tenant,v_fatura.id,v_caixa.id,v_movement_id,_valor,
    _data_pagamento,_forma_pagamento,v_ref,v_notes,v_actor,_idempotency_key,
    v_fingerprint,v_result
  );
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_pagamento_fatura(
  uuid,uuid,numeric,date,text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_fatura(
  uuid,uuid,numeric,date,text,text,text,integer,text) TO authenticated;

-- Include the distinct receipt type in the five reconciled payment methods.
-- Keep the cash register's sales total PDV-only; invoice receipts are income
-- through the invoice ledger and never a second sale.
DO $migration$
DECLARE
  v_oid regprocedure;
  v_definition text;
BEGIN
  FOREACH v_oid IN ARRAY ARRAY[
    'public.obter_resumo_caixa(uuid)'::regprocedure,
    'public.fechar_caixa_auditado(uuid,numeric,numeric,numeric,numeric,numeric,text,text)'::regprocedure
  ] LOOP
    v_definition := pg_get_functiondef(v_oid);
    IF strpos(v_definition, 'm.tipo = ''VENDA''') = 0 THEN
      RAISE EXCEPTION 'Cash reconciliation changed; review FAT-05 before applying: %',v_oid;
    END IF;
    v_definition := replace(v_definition, 'm.tipo = ''VENDA''',
      'm.tipo IN (''VENDA'', ''FATURA_RECEBIMENTO'')');
    IF strpos(v_definition,
        'm.tipo IN (''VENDA'', ''FATURA_RECEBIMENTO'') THEN CASE') = 0 THEN
      RAISE EXCEPTION 'Cash sales subtotal changed; review FAT-05 before applying: %',v_oid;
    END IF;
    v_definition := replace(v_definition,
      'm.tipo IN (''VENDA'', ''FATURA_RECEBIMENTO'') THEN CASE',
      'm.tipo = ''VENDA'' THEN CASE');
    EXECUTE v_definition;
  END LOOP;
END;
$migration$;

-- The receivables view was installed before the receipt date column existed.
-- Preserve its other source branches and use the actual date of manual receipt.
DO $migration$
DECLARE
  v_definition text;
  v_first_branch text;
  v_next_branch integer;
BEGIN
  PERFORM set_config('search_path','public,pg_temp',true);
  v_definition := pg_get_viewdef('public.v_contas_receber'::regclass,true);
  v_next_branch := strpos(v_definition,E'\nUNION ALL\n');
  v_first_branch := left(v_definition,greatest(v_next_branch-1,0));
  IF v_next_branch = 0 OR v_first_branch NOT LIKE '%FROM faturas f%'
     OR v_first_branch NOT LIKE '%ELSE f.updated_at::date%'
     OR v_first_branch NOT LIKE '%settlement.valor_recebido%' THEN
    RAISE EXCEPTION 'Invoice receivables view changed; review FAT-05 before applying';
  END IF;
  EXECUTE 'CREATE OR REPLACE VIEW public.v_contas_receber '
    || 'WITH (security_invoker = true) AS '
    || replace(v_first_branch,'ELSE f.updated_at::date','ELSE f.data_pagamento')
    || substr(v_definition,v_next_branch);
END;
$migration$;
ALTER VIEW public.v_contas_receber SET (security_invoker = true);
REVOKE ALL ON public.v_contas_receber FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_contas_receber TO authenticated;

-- Extend the active billing directory without changing its ROL based area
-- scope, fiscal fields, pagination or authorization checks.
DO $migration$
DECLARE
  v_definition text := pg_get_functiondef(
    'public.consultar_faturas_faturamento_periodo(text,date,date,integer,integer)'::regprocedure);
BEGIN
  IF strpos(v_definition,
      'select f.id, f.cliente_id, f.periodo_inicio, f.periodo_fim, f.valor_total,') = 0
     OR strpos(v_definition,
      'f.configuracao_fiscal_id, f.nfse_status, f.operation_type,') = 0
     OR strpos(v_definition,
      'join public.clientes c on c.id = f.cliente_id and c.tenant_id = f.tenant_id') = 0 THEN
    RAISE EXCEPTION 'Billing invoice directory changed; review FAT-05 before applying';
  END IF;
  v_definition := replace(v_definition,
    'select f.id, f.cliente_id, f.periodo_inicio, f.periodo_fim, f.valor_total,',
    'select f.id, f.cliente_id, f.periodo_inicio, f.periodo_fim, f.valor_total,'
      || E'\n' || '      f.valor_pago, f.status_pagamento, f.versao_financeira, f.data_pagamento,');
  v_definition := replace(v_definition,
    'f.configuracao_fiscal_id, f.nfse_status, f.operation_type,',
    'f.configuracao_fiscal_id, f.nfse_status, f.operation_type, f.unidade_id,'
      || E'\n' || '      case when charge.id is null then null else jsonb_build_object('
      || E'\n' || '        ''status'', charge.status, ''paid_at'', charge.paid_at) end as asaas_charge,');
  v_definition := replace(v_definition,
    'join public.clientes c on c.id = f.cliente_id and c.tenant_id = f.tenant_id',
    'join public.clientes c on c.id = f.cliente_id and c.tenant_id = f.tenant_id'
      || E'\n' || '    left join public.asaas_charges charge'
      || E'\n' || '      on charge.id = f.asaas_charge_id and charge.tenant_id = f.tenant_id');
  EXECUTE v_definition;
END;
$migration$;

-- The finance dashboard predates the invoice receipt fields and summed full
-- invoices only when the workflow status was "pago". Keep its other CTEs and
-- count manual/provider settlement once, with partial open balances.
DO $migration$
DECLARE
  v_definition text := pg_get_functiondef(
    'public.consultar_dashboard_financeiro(date,date,text)'::regprocedure);
BEGIN
  IF strpos(v_definition, '      fatura.status,') = 0
     OR strpos(v_definition, '      fatura.valor_total,') = 0
     OR strpos(v_definition, '    WHERE fatura.tenant_id = v_tenant_id') = 0
     OR strpos(v_definition, 'coalesce(sum(valor_total) FILTER (WHERE status = ''pago'')') = 0
     OR strpos(v_definition, 'coalesce(sum(valor_total) FILTER (') = 0 THEN
    RAISE EXCEPTION 'Finance dashboard changed; review FAT-05 before applying';
  END IF;

  v_definition := replace(v_definition,
    '      fatura.status,' || E'\n' || '      fatura.valor_total,',
    $fragment$      CASE
        WHEN fatura.status = 'cancelado' OR fatura.status_pagamento = 'cancelado'
          THEN 'cancelado'
        WHEN charge.status = 'RECEIVED'
          OR (fatura.valor_total > 0 AND fatura.valor_pago >= fatura.valor_total)
          THEN 'pago'
        WHEN fatura.valor_pago > 0 THEN 'parcial'
        ELSE 'pendente' END AS status,
      fatura.valor_total,
      CASE WHEN fatura.status = 'cancelado' OR fatura.status_pagamento = 'cancelado'
        THEN 0::numeric
        WHEN charge.status = 'RECEIVED' THEN fatura.valor_total
        ELSE fatura.valor_pago END AS valor_pago,$fragment$);
  v_definition := replace(v_definition,
    '    WHERE fatura.tenant_id = v_tenant_id',
    '    LEFT JOIN public.asaas_charges AS charge' || E'\n'
    || '      ON charge.id = fatura.asaas_charge_id AND charge.tenant_id = fatura.tenant_id'
    || E'\n' || '    WHERE fatura.tenant_id = v_tenant_id');
  v_definition := replace(v_definition,
    'coalesce(sum(valor_total) FILTER (WHERE status = ''pago''), 0)',
    'coalesce(sum(valor_pago) FILTER (WHERE status IN (''pago'',''parcial'')), 0)');
  v_definition := replace(v_definition,
    'count(*) FILTER (WHERE status = ''pago'') AS receitas_faturas_count',
    'count(*) FILTER (WHERE status IN (''pago'',''parcial'')) AS receitas_faturas_count');
  v_definition := replace(v_definition,
    'coalesce(sum(valor_total) FILTER (',
    'coalesce(sum(greatest(valor_total - valor_pago, 0)) FILTER (');
  v_definition := replace(v_definition,
    '      fatura.valor_total AS valor',
    '      greatest(fatura.valor_total - fatura.valor_pago, 0) AS valor');
  EXECUTE v_definition;
END;
$migration$;
