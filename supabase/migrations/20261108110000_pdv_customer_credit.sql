-- Customer wallet credit: every balance change is an immutable, tenant-scoped ledger entry.
CREATE TABLE public.pdv_credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_credit_accounts_tenant_client_unique UNIQUE (tenant_id, client_id),
  CONSTRAINT pdv_credit_accounts_client_tenant_fk FOREIGN KEY (client_id, tenant_id)
    REFERENCES public.clientes (id, tenant_id) ON DELETE RESTRICT
);

CREATE TABLE public.pdv_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('CREDITO', 'USO', 'ESTORNO')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  balance_after numeric(12,2) NOT NULL CHECK (balance_after >= 0),
  payment_method text,
  card_brand text,
  amount_received numeric(12,2),
  change_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  cash_register_id uuid NOT NULL,
  order_id uuid,
  payment_id uuid,
  reason text NOT NULL,
  nsu text,
  authorization_code text,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_credit_ledger_tenant_key_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT pdv_credit_ledger_client_tenant_fk FOREIGN KEY (client_id, tenant_id)
    REFERENCES public.clientes (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT pdv_credit_ledger_cash_tenant_fk FOREIGN KEY (cash_register_id, tenant_id)
    REFERENCES public.caixas (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT pdv_credit_ledger_order_tenant_fk FOREIGN KEY (order_id, tenant_id)
    REFERENCES public.ordens_servico (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT pdv_credit_ledger_payment_tenant_fk FOREIGN KEY (payment_id, tenant_id)
    REFERENCES public.pdv_pagamentos (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT pdv_credit_ledger_text_lengths_check CHECK (
    length(reason) <= 1200 AND length(coalesce(card_brand, '')) <= 50
    AND length(coalesce(nsu, '')) <= 100 AND length(coalesce(authorization_code, '')) <= 100
  )
);

CREATE INDEX pdv_credit_ledger_client_created_idx
  ON public.pdv_credit_ledger (tenant_id, client_id, created_at DESC);

ALTER TABLE public.pdv_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdv_credit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pdv_credit_accounts, public.pdv_credit_ledger FROM anon, authenticated;
GRANT ALL ON TABLE public.pdv_credit_accounts, public.pdv_credit_ledger TO service_role;

ALTER TABLE public.pdv_pagamentos DROP CONSTRAINT IF EXISTS pdv_pagamentos_metodo_check;
ALTER TABLE public.pdv_pagamentos
  ADD CONSTRAINT pdv_pagamentos_metodo_check
  CHECK (metodo = ANY (ARRAY['DINHEIRO','PIX','CARTAO_CREDITO','CARTAO_DEBITO','FIDELIDADE','CREDITO_CLIENTE','OUTRO']::text[]));

ALTER TABLE public.pdv_pagamentos DROP CONSTRAINT IF EXISTS pdv_pagamentos_provedor_check;
ALTER TABLE public.pdv_pagamentos
  ADD CONSTRAINT pdv_pagamentos_provedor_check
  CHECK (provedor = ANY (ARRAY['MANUAL','TERMINAL_EXTERNO','ASAAS','FIDELIDADE','CREDITO_CLIENTE','LEGACY']::text[]));

ALTER TABLE public.pdv_pagamentos DROP CONSTRAINT IF EXISTS pdv_pagamentos_credito_cliente_check;
ALTER TABLE public.pdv_pagamentos
  ADD CONSTRAINT pdv_pagamentos_credito_cliente_check
  CHECK (
    metodo <> 'CREDITO_CLIENTE' OR
    (provedor = 'CREDITO_CLIENTE' AND valor_recebido IS NULL AND troco = 0 AND parcelas = 1)
  );

CREATE OR REPLACE FUNCTION public.consultar_credito_cliente_pdv(
  _tenant_id uuid,
  _cliente_id uuid,
  _ator uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_saldo numeric(12,2);
  v_lancamentos jsonb;
BEGIN
  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = _cliente_id AND tenant_id = _tenant_id;
  IF NOT FOUND OR NOT private.pdv_actor_allowed(_ator, _tenant_id, v_cliente.classificacao, ARRAY['caixa']) THEN
    RAISE EXCEPTION 'Cliente não encontrado ou sem permissão para consultar o crédito';
  END IF;

  SELECT balance INTO v_saldo
  FROM public.pdv_credit_accounts
  WHERE tenant_id = _tenant_id AND client_id = _cliente_id;
  v_saldo := coalesce(v_saldo, 0);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'tipo', l.entry_type,
    'valor', l.amount,
    'saldoApos', l.balance_after,
    'formaPagamento', l.payment_method,
    'descricao', l.reason,
    'rolId', l.order_id,
    'criadoEm', l.created_at
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_lancamentos
  FROM (
    SELECT * FROM public.pdv_credit_ledger
    WHERE tenant_id = _tenant_id AND client_id = _cliente_id
    ORDER BY created_at DESC
    LIMIT 20
  ) l;

  RETURN jsonb_build_object('saldo', v_saldo, 'lancamentos', v_lancamentos);
END;
$function$;

CREATE OR REPLACE FUNCTION public.adicionar_credito_cliente_pdv(
  _tenant_id uuid,
  _cliente_id uuid,
  _caixa_id uuid,
  _valor numeric,
  _valor_recebido numeric,
  _metodo text,
  _bandeira text,
  _nsu text,
  _codigo_autorizacao text,
  _idempotency_key text,
  _ator uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_lancamento public.pdv_credit_ledger%ROWTYPE;
  v_saldo numeric(12,2);
  v_metodo text := upper(trim(coalesce(_metodo, '')));
  v_bandeira text := nullif(left(upper(trim(coalesce(_bandeira, ''))), 50), '');
  v_nsu text := nullif(left(trim(coalesce(_nsu, '')), 100), '');
  v_autorizacao text := nullif(left(trim(coalesce(_codigo_autorizacao, '')), 100), '');
  v_recebido numeric(12,2);
  v_troco numeric(12,2);
BEGIN
  IF _tenant_id IS NULL OR _cliente_id IS NULL OR _caixa_id IS NULL OR _ator IS NULL THEN
    RAISE EXCEPTION 'Dados do crédito incompletos';
  END IF;
  IF _valor IS NULL OR _valor <= 0 OR _valor > 9999999.99 THEN
    RAISE EXCEPTION 'Informe um valor de crédito válido';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de operação inválida';
  END IF;
  IF v_metodo NOT IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN
    RAISE EXCEPTION 'Forma de recebimento inválida para adicionar crédito';
  END IF;
  IF v_metodo LIKE 'CARTAO_%' AND v_nsu IS NULL AND v_autorizacao IS NULL THEN
    RAISE EXCEPTION 'Informe o NSU ou o código de autorização da maquininha';
  END IF;
  IF v_metodo LIKE 'CARTAO_%' AND (v_bandeira IS NULL OR v_bandeira NOT IN ('VISA','MASTERCARD','ELO','AMEX','HIPERCARD','OUTRA')) THEN
    RAISE EXCEPTION 'Selecione uma bandeira válida para o cartão';
  END IF;
  v_recebido := CASE WHEN v_metodo = 'DINHEIRO' THEN round(coalesce(_valor_recebido, _valor), 2) ELSE NULL END;
  IF v_metodo = 'DINHEIRO' AND v_recebido < round(_valor, 2) THEN
    RAISE EXCEPTION 'O valor recebido é insuficiente';
  END IF;
  v_troco := CASE WHEN v_metodo = 'DINHEIRO' THEN v_recebido - round(_valor, 2) ELSE 0 END;

  SELECT * INTO v_cliente FROM public.clientes
  WHERE id = _cliente_id AND tenant_id = _tenant_id FOR SHARE;
  IF NOT FOUND OR NOT private.pdv_actor_allowed(_ator, _tenant_id, v_cliente.classificacao, ARRAY['caixa']) THEN
    RAISE EXCEPTION 'Cliente não encontrado ou sem permissão para adicionar crédito';
  END IF;

  SELECT * INTO v_lancamento FROM public.pdv_credit_ledger
  WHERE tenant_id = _tenant_id AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_lancamento.entry_type <> 'CREDITO' OR v_lancamento.client_id <> _cliente_id
       OR v_lancamento.amount <> round(_valor, 2) OR v_lancamento.cash_register_id <> _caixa_id
       OR v_lancamento.payment_method <> v_metodo THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada em outra operação';
    END IF;
    SELECT balance INTO v_saldo FROM public.pdv_credit_accounts
    WHERE tenant_id = _tenant_id AND client_id = _cliente_id;
    RETURN jsonb_build_object('lancamentoId', v_lancamento.id, 'saldo', coalesce(v_saldo, 0), 'idempotente', true);
  END IF;

  SELECT * INTO v_caixa FROM public.caixas
  WHERE id = _caixa_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN
    RAISE EXCEPTION 'O caixa informado não está aberto';
  END IF;

  INSERT INTO public.pdv_credit_accounts (tenant_id, client_id)
  VALUES (_tenant_id, _cliente_id)
  ON CONFLICT (tenant_id, client_id) DO NOTHING;
  SELECT balance INTO v_saldo FROM public.pdv_credit_accounts
  WHERE tenant_id = _tenant_id AND client_id = _cliente_id FOR UPDATE;
  v_saldo := round(v_saldo + _valor, 2);
  UPDATE public.pdv_credit_accounts SET balance = v_saldo, updated_at = now()
  WHERE tenant_id = _tenant_id AND client_id = _cliente_id;

  INSERT INTO public.pdv_credit_ledger (
    tenant_id, client_id, entry_type, amount, balance_after, payment_method,
    card_brand, amount_received, change_amount, cash_register_id, reason, nsu,
    authorization_code, idempotency_key, created_by
  ) VALUES (
    _tenant_id, _cliente_id, 'CREDITO', round(_valor, 2), v_saldo, v_metodo,
    v_bandeira, v_recebido, v_troco, _caixa_id, 'Crédito pré-pago do cliente', v_nsu, v_autorizacao,
    _idempotency_key, _ator
  ) RETURNING * INTO v_lancamento;

  INSERT INTO public.caixa_movimentacoes (
    caixa_id, tipo, valor, descricao, forma_pagamento, cliente_id, tenant_id, criado_por
  ) VALUES (
    _caixa_id, 'VENDA', round(_valor, 2),
    left('Crédito pré-pago · ' || coalesce(v_cliente.nome_fantasia, v_cliente.razao_social), 1200),
    v_metodo, _cliente_id, _tenant_id, _ator
  );

  UPDATE public.caixas
  SET valor_vendas = coalesce(valor_vendas, 0) + round(_valor, 2),
      valor_esperado = coalesce(valor_esperado, 0) + round(_valor, 2)
  WHERE id = _caixa_id AND tenant_id = _tenant_id;

  RETURN jsonb_build_object('lancamentoId', v_lancamento.id, 'saldo', v_saldo, 'idempotente', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_credito_cliente_pdv(
  _tenant_id uuid,
  _ordem_servico_id uuid,
  _caixa_id uuid,
  _valor numeric,
  _momento text,
  _idempotency_key text,
  _ator uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_conta public.pdv_credit_accounts%ROWTYPE;
  v_existente public.pdv_credit_ledger%ROWTYPE;
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_pago numeric(12,2);
  v_pendente numeric(12,2);
  v_saldo numeric(12,2);
  v_resumo jsonb;
BEGIN
  IF _tenant_id IS NULL OR _ordem_servico_id IS NULL OR _caixa_id IS NULL OR _ator IS NULL
     OR _valor IS NULL OR _valor <= 0 OR _valor > 9999999.99 THEN
    RAISE EXCEPTION 'Dados de aplicação do crédito inválidos';
  END IF;
  IF _momento NOT IN ('ENTRADA', 'RETIRADA') THEN
    RAISE EXCEPTION 'Momento do pagamento inválido';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de operação inválida';
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico
  WHERE id = _ordem_servico_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND OR v_os.status = 'cancelada' OR v_os.condicao_pagamento = 'faturado'
     OR v_os.origem NOT IN ('industrial', 'residencial', 'loja') THEN
    RAISE EXCEPTION 'ROL não permite aplicação de crédito';
  END IF;
  IF NOT private.pdv_actor_allowed(
    _ator, _tenant_id, CASE WHEN v_os.origem = 'loja' THEN 'residencial' ELSE v_os.origem END, ARRAY['caixa']
  ) THEN
    RAISE EXCEPTION 'Sem permissão para receber nesta área';
  END IF;

  SELECT * INTO v_existente FROM public.pdv_credit_ledger
  WHERE tenant_id = _tenant_id AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existente.entry_type <> 'USO' OR v_existente.order_id <> _ordem_servico_id
       OR v_existente.amount <> round(_valor, 2) THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada em outra operação';
    END IF;
    SELECT * INTO v_pagamento FROM public.pdv_pagamentos WHERE id = v_existente.payment_id;
    IF NOT FOUND OR v_pagamento.caixa_id <> _caixa_id OR v_pagamento.momento <> _momento THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada em outro recebimento';
    END IF;
    SELECT balance INTO v_saldo FROM public.pdv_credit_accounts
    WHERE tenant_id = _tenant_id AND client_id = v_os.cliente_id;
    v_resumo := private.recalcular_pagamento_os(_ordem_servico_id);
    RETURN jsonb_build_object('paymentId', v_pagamento.id, 'paymentStatus', v_pagamento.status, 'saldoCredito', coalesce(v_saldo, 0), 'idempotente', true) || v_resumo;
  END IF;

  SELECT * INTO v_caixa FROM public.caixas
  WHERE id = _caixa_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN
    RAISE EXCEPTION 'O caixa informado não está aberto';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pdv_pagamentos
    WHERE ordem_servico_id = _ordem_servico_id AND metodo = 'PIX'
      AND status IN ('PENDENTE', 'PROCESSANDO')
  ) THEN
    RAISE EXCEPTION 'Cancele o PIX pendente antes de aplicar o crédito';
  END IF;

  INSERT INTO public.pdv_credit_accounts (tenant_id, client_id)
  VALUES (_tenant_id, v_os.cliente_id)
  ON CONFLICT (tenant_id, client_id) DO NOTHING;
  SELECT * INTO v_conta FROM public.pdv_credit_accounts
  WHERE tenant_id = _tenant_id AND client_id = v_os.cliente_id FOR UPDATE;

  SELECT round(coalesce(sum(valor), 0)::numeric, 2) INTO v_pago
  FROM public.pdv_pagamentos
  WHERE ordem_servico_id = _ordem_servico_id AND status IN ('CONFIRMADO', 'EM_REVISAO');
  v_pendente := round(coalesce(v_os.valor_total, 0) - coalesce(v_pago, 0), 2);
  IF round(_valor, 2) > v_pendente + 0.009 THEN
    RAISE EXCEPTION 'O valor do crédito supera o saldo pendente do ROL';
  END IF;
  IF v_conta.balance < round(_valor, 2) THEN
    RAISE EXCEPTION 'Saldo de crédito insuficiente';
  END IF;

  UPDATE public.pdv_credit_accounts
  SET balance = round(balance - _valor, 2), updated_at = now()
  WHERE id = v_conta.id;
  INSERT INTO public.pdv_pagamentos (
    ordem_servico_id, caixa_id, cliente_id, metodo, momento, status, valor,
    valor_recebido, troco, parcelas, provedor, idempotency_key, confirmado_em,
    criado_por, tenant_id
  ) VALUES (
    v_os.id, _caixa_id, v_os.cliente_id, 'CREDITO_CLIENTE', _momento, 'CONFIRMADO',
    round(_valor, 2), NULL, 0, 1, 'CREDITO_CLIENTE', _idempotency_key, now(),
    _ator, _tenant_id
  ) RETURNING * INTO v_pagamento;

  INSERT INTO public.pdv_credit_ledger (
    tenant_id, client_id, entry_type, amount, balance_after, payment_method,
    cash_register_id, order_id, payment_id, reason, idempotency_key, created_by
  ) VALUES (
    _tenant_id, v_os.cliente_id, 'USO', round(_valor, 2),
    round(v_conta.balance - _valor, 2), 'CREDITO_CLIENTE', _caixa_id,
    v_os.id, v_pagamento.id, 'Crédito aplicado ao ROL ' || v_os.numero,
    _idempotency_key, _ator
  );

  v_resumo := private.recalcular_pagamento_os(v_os.id);
  RETURN jsonb_build_object(
    'paymentId', v_pagamento.id,
    'paymentStatus', v_pagamento.status,
    'saldoCredito', round(v_conta.balance - _valor, 2),
    'idempotente', false
  ) || v_resumo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.estornar_credito_cliente_pdv(
  _tenant_id uuid,
  _pagamento_id uuid,
  _motivo text,
  _estornado_por uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_os public.ordens_servico%ROWTYPE;
  v_conta public.pdv_credit_accounts%ROWTYPE;
  v_motivo text := left(trim(coalesce(_motivo, '')), 1000);
  v_resumo jsonb;
BEGIN
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'Informe um motivo de estorno com ao menos 5 caracteres';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    JOIN public.tenants t ON t.id = m.tenant_id AND t.status = 'active'
    WHERE m.tenant_id = _tenant_id AND m.user_id = _estornado_por
      AND m.enabled AND m.is_active AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado para estornar pagamentos';
  END IF;

  SELECT * INTO v_pagamento FROM public.pdv_pagamentos
  WHERE id = _pagamento_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND OR v_pagamento.metodo <> 'CREDITO_CLIENTE' OR v_pagamento.provedor <> 'CREDITO_CLIENTE' THEN
    RAISE EXCEPTION 'Pagamento de crédito não encontrado';
  END IF;
  SELECT * INTO v_os FROM public.ordens_servico
  WHERE id = v_pagamento.ordem_servico_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROL do pagamento não encontrado'; END IF;

  IF v_pagamento.status = 'ESTORNADO' THEN
    v_resumo := private.recalcular_pagamento_os(v_os.id);
    RETURN jsonb_build_object('paymentId', v_pagamento.id, 'paymentStatus', 'ESTORNADO', 'idempotente', true) || v_resumo;
  END IF;
  IF v_pagamento.status NOT IN ('CONFIRMADO', 'EM_REVISAO') THEN
    RAISE EXCEPTION 'Somente pagamentos confirmados podem ser estornados';
  END IF;

  INSERT INTO public.pdv_credit_accounts (tenant_id, client_id)
  VALUES (_tenant_id, v_pagamento.cliente_id)
  ON CONFLICT (tenant_id, client_id) DO NOTHING;
  SELECT * INTO v_conta FROM public.pdv_credit_accounts
  WHERE tenant_id = _tenant_id AND client_id = v_pagamento.cliente_id FOR UPDATE;
  UPDATE public.pdv_credit_accounts
  SET balance = round(balance + v_pagamento.valor, 2), updated_at = now()
  WHERE id = v_conta.id
  RETURNING * INTO v_conta;

  UPDATE public.pdv_pagamentos
  SET status = 'ESTORNADO', cancelado_em = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'estorno', jsonb_build_object('motivo', v_motivo, 'estornadoPor', _estornado_por::text, 'estornadoEm', now())
      )
  WHERE id = v_pagamento.id;

  INSERT INTO public.pdv_credit_ledger (
    tenant_id, client_id, entry_type, amount, balance_after, payment_method,
    cash_register_id, order_id, payment_id, reason, idempotency_key, created_by
  ) VALUES (
    _tenant_id, v_pagamento.cliente_id, 'ESTORNO', v_pagamento.valor,
    v_conta.balance, 'CREDITO_CLIENTE', v_pagamento.caixa_id,
    v_pagamento.ordem_servico_id, v_pagamento.id,
    left('Estorno do ROL ' || v_os.numero || ' · ' || v_motivo, 1200),
    'credit:reversal:' || v_pagamento.id::text, _estornado_por
  ) ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

  v_resumo := private.recalcular_pagamento_os(v_os.id);
  RETURN jsonb_build_object(
    'paymentId', v_pagamento.id,
    'paymentStatus', 'ESTORNADO',
    'reversedValue', v_pagamento.valor,
    'reason', v_motivo,
    'saldoCredito', v_conta.balance
  ) || v_resumo;
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_credito_cliente_pdv(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adicionar_credito_cliente_pdv(uuid,uuid,uuid,numeric,numeric,text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplicar_credito_cliente_pdv(uuid,uuid,uuid,numeric,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estornar_credito_cliente_pdv(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_credito_cliente_pdv(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adicionar_credito_cliente_pdv(uuid,uuid,uuid,numeric,numeric,text,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.aplicar_credito_cliente_pdv(uuid,uuid,uuid,numeric,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.estornar_credito_cliente_pdv(uuid,uuid,text,uuid) TO service_role;
