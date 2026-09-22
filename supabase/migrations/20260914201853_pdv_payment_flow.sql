-- Fluxo financeiro transacional do PDV.
-- Pagamentos são gravados exclusivamente pelo Edge Function pdv-payment usando service_role.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

ALTER TABLE public.asaas_charges
  ADD COLUMN IF NOT EXISTS external_reference text;
ALTER TABLE public.asaas_charges
  ADD CONSTRAINT asaas_charges_external_reference_check
  CHECK (external_reference IS NULL OR external_reference ~ '^[A-Za-z0-9:._-]{8,200}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_asaas_charges_external_reference
  ON public.asaas_charges(external_reference)
  WHERE external_reference IS NOT NULL;

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pdv_idempotency_key text;
ALTER TABLE public.ordens_servico
  ADD CONSTRAINT ordens_servico_pdv_idempotency_key_check
  CHECK (pdv_idempotency_key IS NULL OR pdv_idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$');

CREATE UNIQUE INDEX IF NOT EXISTS uq_ordens_servico_pdv_idempotency_key
  ON public.ordens_servico(pdv_idempotency_key)
  WHERE pdv_idempotency_key IS NOT NULL;

ALTER TABLE public.asaas_webhook_events
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.asaas_webhook_events
  DROP CONSTRAINT IF EXISTS asaas_webhook_events_processing_status_check;
ALTER TABLE public.asaas_webhook_events
  ADD CONSTRAINT asaas_webhook_events_processing_status_check
  CHECK (processing_status IN ('processing', 'processed', 'failed'));
ALTER TABLE public.asaas_webhook_events
  DROP CONSTRAINT IF EXISTS asaas_webhook_events_attempt_count_check;
ALTER TABLE public.asaas_webhook_events
  ADD CONSTRAINT asaas_webhook_events_attempt_count_check CHECK (attempt_count > 0);
ALTER TABLE public.asaas_webhook_events ALTER COLUMN processed_at DROP NOT NULL;
ALTER TABLE public.asaas_webhook_events ALTER COLUMN processed_at DROP DEFAULT;

CREATE TABLE public.pdv_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  caixa_id uuid REFERENCES public.caixas(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  asaas_charge_id uuid REFERENCES public.asaas_charges(id) ON DELETE SET NULL,
  metodo text NOT NULL,
  momento text NOT NULL DEFAULT 'RETIRADA',
  status text NOT NULL DEFAULT 'PENDENTE',
  status_provedor text,
  valor numeric(12,2) NOT NULL,
  valor_recebido numeric(12,2),
  troco numeric(12,2) NOT NULL DEFAULT 0,
  parcelas smallint NOT NULL DEFAULT 1,
  bandeira text,
  nsu text,
  codigo_autorizacao text,
  provedor text NOT NULL,
  provedor_pagamento_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmado_em timestamptz,
  cancelado_em timestamptz,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_pagamentos_metodo_check
    CHECK (metodo IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'OUTRO')),
  CONSTRAINT pdv_pagamentos_momento_check CHECK (momento IN ('ENTRADA', 'RETIRADA')),
  CONSTRAINT pdv_pagamentos_status_check
    CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'CONFIRMADO', 'FALHOU', 'CANCELADO', 'ESTORNADO', 'EM_REVISAO')),
  CONSTRAINT pdv_pagamentos_provedor_check
    CHECK (provedor IN ('MANUAL', 'TERMINAL_EXTERNO', 'ASAAS', 'LEGACY')),
  CONSTRAINT pdv_pagamentos_valor_check CHECK (valor > 0),
  CONSTRAINT pdv_pagamentos_valor_recebido_check
    CHECK (valor_recebido IS NULL OR valor_recebido >= 0),
  CONSTRAINT pdv_pagamentos_troco_check
    CHECK (troco >= 0 AND (valor_recebido IS NULL OR troco <= valor_recebido)),
  CONSTRAINT pdv_pagamentos_parcelas_check CHECK (parcelas BETWEEN 1 AND 24),
  CONSTRAINT pdv_pagamentos_idempotency_key_check
    CHECK (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  CONSTRAINT pdv_pagamentos_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT pdv_pagamentos_provider_id_check CHECK (
    provedor_pagamento_id IS NULL OR provedor_pagamento_id ~ '^[A-Za-z0-9_-]{3,200}$'
  ),
  CONSTRAINT pdv_pagamentos_text_lengths_check CHECK (
    length(coalesce(bandeira, '')) <= 50 AND
    length(coalesce(nsu, '')) <= 100 AND
    length(coalesce(codigo_autorizacao, '')) <= 100 AND
    length(coalesce(status_provedor, '')) <= 80
  ),
  CONSTRAINT pdv_pagamentos_dinheiro_check CHECK (
    metodo <> 'DINHEIRO' OR provedor = 'LEGACY' OR
    (valor_recebido IS NOT NULL AND valor_recebido >= valor AND troco = valor_recebido - valor)
  ),
  CONSTRAINT pdv_pagamentos_pix_check CHECK (
    metodo <> 'PIX' OR provedor = 'LEGACY' OR
    (provedor = 'ASAAS' AND asaas_charge_id IS NOT NULL AND provedor_pagamento_id IS NOT NULL)
  ),
  CONSTRAINT pdv_pagamentos_cartao_check CHECK (
    metodo NOT IN ('CARTAO_CREDITO', 'CARTAO_DEBITO') OR provedor = 'LEGACY' OR
    (provedor = 'TERMINAL_EXTERNO' AND (nsu IS NOT NULL OR codigo_autorizacao IS NOT NULL))
  ),
  CONSTRAINT pdv_pagamentos_confirmado_check CHECK (
    status NOT IN ('CONFIRMADO', 'EM_REVISAO') OR confirmado_em IS NOT NULL
  )
);

CREATE UNIQUE INDEX uq_pdv_pagamentos_idempotency_key
  ON public.pdv_pagamentos(idempotency_key);
CREATE UNIQUE INDEX uq_pdv_pagamentos_asaas_charge
  ON public.pdv_pagamentos(asaas_charge_id)
  WHERE asaas_charge_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pdv_pagamentos_provedor_id
  ON public.pdv_pagamentos(provedor, provedor_pagamento_id)
  WHERE provedor_pagamento_id IS NOT NULL;
CREATE INDEX idx_pdv_pagamentos_ordem ON public.pdv_pagamentos(ordem_servico_id);
CREATE INDEX idx_pdv_pagamentos_caixa ON public.pdv_pagamentos(caixa_id);
CREATE INDEX idx_pdv_pagamentos_cliente ON public.pdv_pagamentos(cliente_id);
CREATE INDEX idx_pdv_pagamentos_status ON public.pdv_pagamentos(status);
CREATE INDEX idx_pdv_pagamentos_created_at ON public.pdv_pagamentos(created_at DESC);

ALTER TABLE public.pdv_pagamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pdv_pagamentos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.pdv_pagamentos TO service_role;

CREATE TRIGGER update_pdv_pagamentos_updated_at
  BEFORE UPDATE ON public.pdv_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS pdv_pagamento_id uuid REFERENCES public.pdv_pagamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evento_pagamento text;

ALTER TABLE public.caixa_movimentacoes
  DROP CONSTRAINT IF EXISTS caixa_movimentacoes_evento_pagamento_check;
ALTER TABLE public.caixa_movimentacoes
  ADD CONSTRAINT caixa_movimentacoes_evento_pagamento_check
  CHECK (evento_pagamento IS NULL OR evento_pagamento IN ('CONFIRMACAO', 'ESTORNO'));

CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_ordem_servico
  ON public.caixa_movimentacoes(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_caixa_movimentacoes_pdv_pagamento
  ON public.caixa_movimentacoes(pdv_pagamento_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_caixa_movimentacoes_pagamento_evento
  ON public.caixa_movimentacoes(pdv_pagamento_id, evento_pagamento)
  WHERE pdv_pagamento_id IS NOT NULL AND evento_pagamento IS NOT NULL;

CREATE OR REPLACE FUNCTION private.bloquear_fechamento_caixa_pix_pendente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NEW.status = 'FECHADO'
     AND OLD.status IS DISTINCT FROM 'FECHADO'
     AND EXISTS (
       SELECT 1
       FROM public.pdv_pagamentos pp
       WHERE pp.caixa_id = NEW.id
         AND pp.metodo = 'PIX'
         AND pp.status IN ('PENDENTE', 'PROCESSANDO')
     ) THEN
    RAISE EXCEPTION 'Cancele ou confirme os PIX pendentes antes de fechar o caixa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_fechamento_caixa_pix_pendente ON public.caixas;
CREATE TRIGGER trg_bloquear_fechamento_caixa_pix_pendente
  BEFORE UPDATE OF status ON public.caixas
  FOR EACH ROW
  EXECUTE FUNCTION private.bloquear_fechamento_caixa_pix_pendente();

-- Preserva o histórico legado que já possuía movimentação de caixa vinculada à OS.
INSERT INTO public.pdv_pagamentos (
  ordem_servico_id,
  caixa_id,
  cliente_id,
  metodo,
  momento,
  status,
  valor,
  valor_recebido,
  troco,
  provedor,
  idempotency_key,
  confirmado_em,
  created_at,
  updated_at,
  metadata
)
SELECT
  cm.ordem_servico_id,
  cm.caixa_id,
  os.cliente_id,
  CASE upper(coalesce(cm.forma_pagamento, ''))
    WHEN 'DINHEIRO' THEN 'DINHEIRO'
    WHEN 'PIX' THEN 'PIX'
    WHEN 'CARTAO_CREDITO' THEN 'CARTAO_CREDITO'
    WHEN 'CARTAO_DEBITO' THEN 'CARTAO_DEBITO'
    ELSE 'OUTRO'
  END,
  CASE WHEN coalesce(os.pago_na_entrada, false) THEN 'ENTRADA' ELSE 'RETIRADA' END,
  'CONFIRMADO',
  cm.valor,
  CASE WHEN upper(coalesce(cm.forma_pagamento, '')) = 'DINHEIRO' THEN cm.valor ELSE NULL END,
  0,
  'LEGACY',
  'legacy-caixa:' || cm.id::text,
  cm.created_at,
  cm.created_at,
  cm.created_at,
  jsonb_build_object('migration', 'pdv_payment_flow')
FROM public.caixa_movimentacoes cm
JOIN public.ordens_servico os ON os.id = cm.ordem_servico_id
WHERE upper(cm.tipo) = 'VENDA'
  AND cm.ordem_servico_id IS NOT NULL
  AND cm.valor > 0
ON CONFLICT (idempotency_key) DO NOTHING;

UPDATE public.caixa_movimentacoes cm
SET pdv_pagamento_id = pp.id,
    evento_pagamento = 'CONFIRMACAO'
FROM public.pdv_pagamentos pp
WHERE pp.idempotency_key = 'legacy-caixa:' || cm.id::text
  AND cm.pdv_pagamento_id IS NULL;

-- Preserva saldos pagos antigos que não possuíam movimentação vinculada.
WITH registrados AS (
  SELECT ordem_servico_id, sum(valor) AS valor
  FROM public.pdv_pagamentos
  WHERE status IN ('CONFIRMADO', 'EM_REVISAO')
  GROUP BY ordem_servico_id
)
INSERT INTO public.pdv_pagamentos (
  ordem_servico_id,
  caixa_id,
  cliente_id,
  metodo,
  momento,
  status,
  valor,
  valor_recebido,
  troco,
  provedor,
  idempotency_key,
  confirmado_em,
  created_at,
  updated_at,
  metadata
)
SELECT
  os.id,
  NULL,
  os.cliente_id,
  CASE upper(coalesce(os.forma_pagamento, ''))
    WHEN 'DINHEIRO' THEN 'DINHEIRO'
    WHEN 'PIX' THEN 'PIX'
    WHEN 'CARTAO_CREDITO' THEN 'CARTAO_CREDITO'
    WHEN 'CARTAO_DEBITO' THEN 'CARTAO_DEBITO'
    ELSE 'OUTRO'
  END,
  CASE WHEN coalesce(os.pago_na_entrada, false) THEN 'ENTRADA' ELSE 'RETIRADA' END,
  'CONFIRMADO',
  round((coalesce(os.valor_pago, 0) - coalesce(r.valor, 0))::numeric, 2),
  CASE WHEN upper(coalesce(os.forma_pagamento, '')) = 'DINHEIRO'
    THEN round((coalesce(os.valor_pago, 0) - coalesce(r.valor, 0))::numeric, 2)
    ELSE NULL
  END,
  0,
  'LEGACY',
  'legacy-os:' || os.id::text,
  os.updated_at,
  os.created_at,
  os.updated_at,
  jsonb_build_object('migration', 'pdv_payment_flow', 'without_cash_movement', true)
FROM public.ordens_servico os
LEFT JOIN registrados r ON r.ordem_servico_id = os.id
WHERE coalesce(os.valor_pago, 0) - coalesce(r.valor, 0) > 0.009
ON CONFLICT (idempotency_key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.recalcular_pagamento_os(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_total numeric(12,2);
  v_pago numeric(12,2);
  v_metodos text[];
  v_status text;
BEGIN
  SELECT round(coalesce(valor_total, 0)::numeric, 2)
  INTO v_total
  FROM public.ordens_servico
  WHERE id = _ordem_servico_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;

  SELECT
    round(coalesce(sum(valor), 0)::numeric, 2),
    array_agg(DISTINCT metodo ORDER BY metodo)
  INTO v_pago, v_metodos
  FROM public.pdv_pagamentos
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('CONFIRMADO', 'EM_REVISAO');

  IF v_pago > v_total + 0.009 THEN
    RAISE EXCEPTION 'O total confirmado excede o valor da OS';
  END IF;

  v_status := CASE
    WHEN v_pago <= 0 THEN 'pendente'
    WHEN v_pago + 0.009 >= v_total THEN 'pago'
    ELSE 'parcial'
  END;

  UPDATE public.ordens_servico
  SET valor_pago = least(v_pago, v_total),
      status_pagamento = v_status,
      forma_pagamento = CASE
        WHEN coalesce(array_length(v_metodos, 1), 0) = 0 THEN NULL
        WHEN array_length(v_metodos, 1) = 1 THEN v_metodos[1]
        ELSE 'MULTIPLO'
      END,
      pago_na_entrada = EXISTS (
        SELECT 1 FROM public.pdv_pagamentos pp
        WHERE pp.ordem_servico_id = _ordem_servico_id
          AND pp.momento = 'ENTRADA'
          AND pp.status IN ('CONFIRMADO', 'EM_REVISAO')
      )
  WHERE id = _ordem_servico_id;

  RETURN jsonb_build_object(
    'orderStatus', v_status,
    'paidValue', least(v_pago, v_total),
    'pendingValue', greatest(v_total - v_pago, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_pdv(
  _ordem_servico_id uuid,
  _caixa_id uuid,
  _metodo text,
  _valor numeric,
  _valor_recebido numeric,
  _parcelas integer,
  _bandeira text,
  _nsu text,
  _codigo_autorizacao text,
  _momento text,
  _idempotency_key text,
  _criado_por uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_existente public.pdv_pagamentos%ROWTYPE;
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_pago numeric(12,2);
  v_pendente numeric(12,2);
  v_recebido numeric(12,2);
  v_troco numeric(12,2);
  v_resumo jsonb;
BEGIN
  SELECT * INTO v_existente
  FROM public.pdv_pagamentos
  WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existente.ordem_servico_id <> _ordem_servico_id OR
       v_existente.metodo <> upper(_metodo) OR
       v_existente.valor <> round(_valor, 2) THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outro pagamento';
    END IF;
    v_resumo := private.recalcular_pagamento_os(_ordem_servico_id);
    RETURN jsonb_build_object('paymentId', v_existente.id, 'paymentStatus', v_existente.status) || v_resumo;
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico
  WHERE id = _ordem_servico_id FOR UPDATE;
  IF NOT FOUND OR v_os.origem NOT IN ('residencial', 'loja') OR v_os.status = 'cancelada' THEN
    RAISE EXCEPTION 'OS residencial inválida para recebimento';
  END IF;

  SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN
    RAISE EXCEPTION 'O caixa informado não está aberto';
  END IF;

  IF upper(_metodo) NOT IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN
    RAISE EXCEPTION 'Método manual de pagamento inválido';
  END IF;
  IF _momento NOT IN ('ENTRADA', 'RETIRADA') THEN
    RAISE EXCEPTION 'Momento do pagamento inválido';
  END IF;
  IF _parcelas IS NULL OR _parcelas < 1 OR _parcelas > 24 OR
     (upper(_metodo) <> 'CARTAO_CREDITO' AND _parcelas <> 1) THEN
    RAISE EXCEPTION 'Parcelamento inválido';
  END IF;
  IF upper(_metodo) IN ('CARTAO_CREDITO', 'CARTAO_DEBITO') AND
     nullif(trim(coalesce(_nsu, '')), '') IS NULL AND
     nullif(trim(coalesce(_codigo_autorizacao, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o NSU ou o código de autorização da maquininha';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pdv_pagamentos
    WHERE ordem_servico_id = _ordem_servico_id
      AND metodo = 'PIX'
      AND status IN ('PENDENTE', 'PROCESSANDO')
  ) THEN
    RAISE EXCEPTION 'Cancele o PIX pendente antes de registrar outro pagamento';
  END IF;

  SELECT round(coalesce(sum(valor), 0)::numeric, 2)
  INTO v_pago
  FROM public.pdv_pagamentos
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('CONFIRMADO', 'EM_REVISAO');
  v_pendente := round(coalesce(v_os.valor_total, 0)::numeric - v_pago, 2);

  IF _valor IS NULL OR round(_valor, 2) <= 0 OR round(_valor, 2) > v_pendente + 0.009 THEN
    RAISE EXCEPTION 'Valor inválido ou superior ao saldo da OS';
  END IF;

  v_recebido := CASE WHEN upper(_metodo) = 'DINHEIRO' THEN round(coalesce(_valor_recebido, 0), 2) ELSE NULL END;
  IF upper(_metodo) = 'DINHEIRO' AND v_recebido < round(_valor, 2) THEN
    RAISE EXCEPTION 'O valor recebido em dinheiro é insuficiente';
  END IF;
  v_troco := CASE WHEN upper(_metodo) = 'DINHEIRO' THEN v_recebido - round(_valor, 2) ELSE 0 END;

  INSERT INTO public.pdv_pagamentos (
    ordem_servico_id, caixa_id, cliente_id, metodo, momento, status,
    valor, valor_recebido, troco, parcelas, bandeira, nsu, codigo_autorizacao,
    provedor, idempotency_key, confirmado_em, criado_por
  ) VALUES (
    v_os.id, v_caixa.id, v_os.cliente_id, upper(_metodo), _momento, 'CONFIRMADO',
    round(_valor, 2), v_recebido, v_troco, _parcelas,
    nullif(left(trim(coalesce(_bandeira, '')), 50), ''),
    nullif(left(trim(coalesce(_nsu, '')), 100), ''),
    nullif(left(trim(coalesce(_codigo_autorizacao, '')), 100), ''),
    CASE WHEN upper(_metodo) = 'DINHEIRO' THEN 'MANUAL' ELSE 'TERMINAL_EXTERNO' END,
    _idempotency_key, now(), _criado_por
  ) RETURNING * INTO v_pagamento;

  INSERT INTO public.caixa_movimentacoes (
    caixa_id, tipo, valor, descricao, forma_pagamento, cliente_id,
    ordem_servico_id, pdv_pagamento_id, evento_pagamento, categoria_id, centro_custo_id
  ) VALUES (
    v_caixa.id, 'VENDA', v_pagamento.valor,
    'Recebimento OS ' || v_os.numero,
    v_pagamento.metodo, v_os.cliente_id, v_os.id, v_pagamento.id, 'CONFIRMACAO',
    (SELECT id FROM public.categorias_financeiras WHERE nome = 'Venda PDV Loja' AND tipo = 'receita' LIMIT 1),
    (SELECT id FROM public.centros_custo WHERE nome = 'Loja' LIMIT 1)
  );

  UPDATE public.caixas
  SET valor_vendas = valor_vendas + v_pagamento.valor,
      valor_esperado = valor_esperado + v_pagamento.valor
  WHERE id = v_caixa.id;

  v_resumo := private.recalcular_pagamento_os(v_os.id);
  RETURN jsonb_build_object(
    'paymentId', v_pagamento.id,
    'paymentStatus', v_pagamento.status,
    'change', v_pagamento.troco
  ) || v_resumo;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_intencao_pix_pdv(
  _ordem_servico_id uuid,
  _caixa_id uuid,
  _asaas_charge_id uuid,
  _provedor_pagamento_id text,
  _status_provedor text,
  _idempotency_key text,
  _momento text,
  _criado_por uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_pago numeric(12,2);
  v_pendente numeric(12,2);
BEGIN
  SELECT * INTO v_pagamento FROM public.pdv_pagamentos
  WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_pagamento.ordem_servico_id <> _ordem_servico_id OR
       v_pagamento.provedor_pagamento_id <> _provedor_pagamento_id THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outro pagamento';
    END IF;
    RETURN jsonb_build_object(
      'paymentId', v_pagamento.id,
      'paymentStatus', v_pagamento.status,
      'pendingValue', v_pagamento.valor
    );
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico
  WHERE id = _ordem_servico_id FOR UPDATE;
  IF NOT FOUND OR v_os.origem NOT IN ('residencial', 'loja') OR v_os.status = 'cancelada' THEN
    RAISE EXCEPTION 'OS residencial inválida para PIX';
  END IF;
  SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN
    RAISE EXCEPTION 'O caixa informado não está aberto';
  END IF;
  IF _momento NOT IN ('ENTRADA', 'RETIRADA') THEN RAISE EXCEPTION 'Momento do pagamento inválido'; END IF;

  SELECT round(coalesce(sum(valor), 0)::numeric, 2)
  INTO v_pago FROM public.pdv_pagamentos
  WHERE ordem_servico_id = v_os.id AND status IN ('CONFIRMADO', 'EM_REVISAO');
  v_pendente := round(coalesce(v_os.valor_total, 0)::numeric - v_pago, 2);
  IF v_pendente <= 0 THEN RAISE EXCEPTION 'A OS não possui saldo pendente'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.pdv_pagamentos
    WHERE ordem_servico_id = v_os.id AND status IN ('PENDENTE', 'PROCESSANDO')
  ) THEN
    RAISE EXCEPTION 'Já existe um pagamento pendente para esta OS';
  END IF;

  INSERT INTO public.pdv_pagamentos (
    ordem_servico_id, caixa_id, cliente_id, asaas_charge_id, metodo, momento,
    status, status_provedor, valor, provedor, provedor_pagamento_id,
    idempotency_key, criado_por
  ) VALUES (
    v_os.id, v_caixa.id, v_os.cliente_id, _asaas_charge_id, 'PIX', _momento,
    'PENDENTE', upper(_status_provedor), v_pendente, 'ASAAS', _provedor_pagamento_id,
    _idempotency_key, _criado_por
  ) RETURNING * INTO v_pagamento;

  UPDATE public.ordens_servico
  SET forma_pagamento = CASE WHEN forma_pagamento IS NULL THEN 'PIX' ELSE forma_pagamento END
  WHERE id = v_os.id;

  RETURN jsonb_build_object(
    'paymentId', v_pagamento.id,
    'paymentStatus', v_pagamento.status,
    'pendingValue', v_pagamento.valor
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconciliar_pagamento_pdv(
  _asaas_charge_id uuid,
  _status_provedor text,
  _confirmado_em timestamptz,
  _evento text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_pagamento public.pdv_pagamentos%ROWTYPE;
  v_os public.ordens_servico%ROWTYPE;
  v_delta numeric(12,2) := 0;
  v_evento text;
  v_resumo jsonb;
  v_status text := upper(coalesce(_status_provedor, ''));
BEGIN
  SELECT * INTO v_pagamento FROM public.pdv_pagamentos
  WHERE asaas_charge_id = _asaas_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;
  SELECT * INTO v_os FROM public.ordens_servico
  WHERE id = v_pagamento.ordem_servico_id FOR UPDATE;

  UPDATE public.pdv_pagamentos
  SET status_provedor = v_status,
      metadata = metadata || jsonb_build_object('lastProviderEvent', coalesce(_evento, ''))
  WHERE id = v_pagamento.id;

  IF v_status = 'RECEIVED' AND v_pagamento.status NOT IN ('CONFIRMADO', 'EM_REVISAO') THEN
    UPDATE public.pdv_pagamentos
    SET status = 'CONFIRMADO', confirmado_em = coalesce(_confirmado_em, now()), cancelado_em = NULL
    WHERE id = v_pagamento.id
    RETURNING * INTO v_pagamento;
    v_delta := v_pagamento.valor;
    v_evento := 'CONFIRMACAO';
  ELSIF v_status IN ('REFUNDED', 'DELETED', 'CHARGEBACK_REQUESTED') OR
        upper(coalesce(_evento, '')) IN (
          'PAYMENT_DELETED',
          'PAYMENT_REFUNDED',
          'PAYMENT_RECEIVED_IN_CASH_UNDONE',
          'PAYMENT_CHARGEBACK_REQUESTED'
        ) THEN
    IF v_pagamento.status IN ('CONFIRMADO', 'EM_REVISAO') THEN
      UPDATE public.pdv_pagamentos
      SET status = 'ESTORNADO', cancelado_em = now()
      WHERE id = v_pagamento.id RETURNING * INTO v_pagamento;
      v_delta := -v_pagamento.valor;
      v_evento := 'ESTORNO';
    ELSIF v_pagamento.status IN ('PENDENTE', 'PROCESSANDO', 'FALHOU') THEN
      UPDATE public.pdv_pagamentos
      SET status = 'CANCELADO', cancelado_em = now()
      WHERE id = v_pagamento.id RETURNING * INTO v_pagamento;
    END IF;
  ELSIF v_status = 'PARTIALLY_REFUNDED' OR upper(coalesce(_evento, '')) = 'PAYMENT_PARTIALLY_REFUNDED' THEN
    IF v_pagamento.status = 'CONFIRMADO' THEN
      UPDATE public.pdv_pagamentos SET status = 'EM_REVISAO'
      WHERE id = v_pagamento.id RETURNING * INTO v_pagamento;
    END IF;
  ELSIF v_status IN ('PENDING', 'CONFIRMED') AND v_pagamento.status = 'PENDENTE' THEN
    UPDATE public.pdv_pagamentos SET status = 'PROCESSANDO'
    WHERE id = v_pagamento.id RETURNING * INTO v_pagamento;
  ELSIF v_status IN ('OVERDUE') AND v_pagamento.status IN ('PENDENTE', 'PROCESSANDO') THEN
    UPDATE public.pdv_pagamentos SET status = 'FALHOU'
    WHERE id = v_pagamento.id RETURNING * INTO v_pagamento;
  END IF;

  IF v_evento IS NOT NULL THEN
    INSERT INTO public.caixa_movimentacoes (
      caixa_id, tipo, valor, descricao, forma_pagamento, cliente_id,
      ordem_servico_id, pdv_pagamento_id, evento_pagamento, categoria_id, centro_custo_id,
      created_at
    ) VALUES (
      v_pagamento.caixa_id,
      CASE WHEN v_delta > 0 THEN 'VENDA' ELSE 'ESTORNO' END,
      abs(v_delta),
      CASE WHEN v_delta > 0 THEN 'PIX recebido OS ' ELSE 'Estorno PIX OS ' END || v_os.numero,
      'PIX', v_pagamento.cliente_id, v_pagamento.ordem_servico_id,
      v_pagamento.id, v_evento,
      (SELECT id FROM public.categorias_financeiras WHERE nome = 'Venda PDV Loja' AND tipo = 'receita' LIMIT 1),
      (SELECT id FROM public.centros_custo WHERE nome = 'Loja' LIMIT 1),
      coalesce(_confirmado_em, now())
    ) ON CONFLICT (pdv_pagamento_id, evento_pagamento) WHERE pdv_pagamento_id IS NOT NULL AND evento_pagamento IS NOT NULL
      DO NOTHING;

    IF FOUND THEN
      UPDATE public.caixas
      SET valor_vendas = valor_vendas + v_delta,
          valor_esperado = valor_esperado + v_delta,
          diferenca = CASE
            WHEN status = 'FECHADO' AND valor_contado IS NOT NULL
              THEN valor_contado - (valor_esperado + v_delta)
            ELSE diferenca
          END
      WHERE id = v_pagamento.caixa_id;
    END IF;
  END IF;

  v_resumo := private.recalcular_pagamento_os(v_pagamento.ordem_servico_id);
  RETURN jsonb_build_object(
    'found', true,
    'paymentId', v_pagamento.id,
    'paymentStatus', v_pagamento.status,
    'providerStatus', v_status
  ) || v_resumo;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_intencao_pagamento_pdv(
  _pagamento_id uuid,
  _status_provedor text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_pagamento public.pdv_pagamentos%ROWTYPE;
BEGIN
  SELECT * INTO v_pagamento FROM public.pdv_pagamentos
  WHERE id = _pagamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento não encontrado'; END IF;
  IF v_pagamento.status IN ('CONFIRMADO', 'EM_REVISAO', 'ESTORNADO') THEN
    RAISE EXCEPTION 'Um pagamento recebido não pode ser apenas cancelado';
  END IF;

  UPDATE public.pdv_pagamentos
  SET status = 'CANCELADO', status_provedor = upper(_status_provedor), cancelado_em = now()
  WHERE id = v_pagamento.id;

  RETURN jsonb_build_object('paymentId', v_pagamento.id, 'paymentStatus', 'CANCELADO');
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_venda_pdv(
  _cliente_id uuid,
  _caixa_id uuid,
  _data_previsao_entrega date,
  _urgente boolean,
  _percentual_urgencia numeric,
  _valor_desconto numeric,
  _motorista_id uuid,
  _veiculo_id uuid,
  _itens jsonb,
  _pagamento jsonb,
  _criado_por uuid,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_cliente public.clientes%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_os public.ordens_servico%ROWTYPE;
  v_item jsonb;
  v_produto public.produtos%ROWTYPE;
  v_quantidade numeric;
  v_preco numeric(12,2);
  v_subtotal numeric(12,2);
  v_itens_calculados jsonb := '[]'::jsonb;
  v_total_itens numeric(12,2) := 0;
  v_total numeric(12,2);
  v_pagamento_resultado jsonb := NULL;
  v_existente public.ordens_servico%ROWTYPE;
BEGIN
  SELECT os.* INTO v_existente
  FROM public.ordens_servico os
  WHERE os.pdv_idempotency_key = _idempotency_key
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'order', jsonb_build_object(
        'id', v_existente.id, 'number', v_existente.numero,
        'total', v_existente.valor_total, 'paymentStatus', v_existente.status_pagamento,
        'deliveryDate', v_existente.data_previsao_entrega
      ),
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = _cliente_id FOR SHARE;
  IF NOT FOUND OR NOT coalesce(v_cliente.ativo, false) OR v_cliente.classificacao <> 'residencial' THEN
    RAISE EXCEPTION 'Cliente residencial inválido ou inativo';
  END IF;
  SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN RAISE EXCEPTION 'O caixa informado não está aberto'; END IF;
  IF _data_previsao_entrega IS NULL OR _data_previsao_entrega < current_date THEN
    RAISE EXCEPTION 'Previsão de entrega inválida';
  END IF;
  IF _percentual_urgencia IS NULL OR _percentual_urgencia < 0 OR _percentual_urgencia > 100 OR
     (NOT coalesce(_urgente, false) AND _percentual_urgencia <> 0) THEN
    RAISE EXCEPTION 'Percentual de urgência inválido';
  END IF;
  IF _valor_desconto IS NULL OR _valor_desconto < 0 THEN RAISE EXCEPTION 'Desconto inválido'; END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 OR jsonb_array_length(_itens) > 200 THEN
    RAISE EXCEPTION 'A venda deve possuir entre 1 e 200 itens';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_itens)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' OR coalesce(v_item->>'produto_id', '') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Item da venda inválido';
    END IF;
    BEGIN
      v_quantidade := (v_item->>'quantidade')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Quantidade inválida';
    END;
    IF v_quantidade <= 0 OR v_quantidade > 999 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

    SELECT p.* INTO v_produto FROM public.produtos p
    WHERE p.id = (v_item->>'produto_id')::uuid
      AND p.status = 'ativo'
      AND (p.unidade_negocio IN ('ID2', 'ambos') OR p.unidade_negocio IS NULL)
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto residencial inválido ou inativo'; END IF;

    SELECT round(coalesce(pe.preco_especial, v_produto.preco)::numeric, 2)
    INTO v_preco
    FROM (SELECT 1) source
    LEFT JOIN public.precos_especiais pe
      ON pe.cliente_id = _cliente_id AND pe.produto_id = v_produto.id
    LIMIT 1;
    IF v_preco < 0 THEN RAISE EXCEPTION 'Preço de produto inválido'; END IF;
    v_subtotal := round(v_preco * v_quantidade, 2);
    v_total_itens := v_total_itens + v_subtotal;
    v_itens_calculados := v_itens_calculados || jsonb_build_array(jsonb_build_object(
      'produto_id', v_produto.id,
      'quantidade', v_quantidade,
      'preco_unitario', v_preco,
      'subtotal', v_subtotal,
      'cor_item', nullif(left(trim(coalesce(v_item->>'cor_item', '')), 100), ''),
      'marca_item', nullif(left(trim(coalesce(v_item->>'marca_item', '')), 100), ''),
      'avarias', nullif(left(trim(coalesce(v_item->>'avarias', '')), 1000), ''),
      'posicao_prateleira', nullif(left(trim(coalesce(v_item->>'posicao_prateleira', '')), 100), ''),
      'observacoes', nullif(left(trim(coalesce(v_item->>'observacoes', '')), 1000), '')
    ));
  END LOOP;

  v_total_itens := round(v_total_itens, 2);
  IF round(_valor_desconto, 2) > v_total_itens THEN RAISE EXCEPTION 'O desconto supera o total da venda'; END IF;
  v_total := round((v_total_itens - round(_valor_desconto, 2)) *
    (1 + CASE WHEN _urgente THEN _percentual_urgencia / 100 ELSE 0 END), 2);
  IF v_total <= 0 THEN RAISE EXCEPTION 'O total da venda deve ser positivo'; END IF;

  INSERT INTO public.ordens_servico (
    numero, cliente_id, motorista_id, veiculo_id, data_retirada, data_previsao_entrega,
    data_entrega, status, prioridade, observacoes, valor_total, valor_desconto,
    forma_pagamento, status_pagamento, pago_na_entrada, valor_pago,
    urgente, percentual_urgencia, origem, pdv_idempotency_key
  ) VALUES (
    '', _cliente_id, _motorista_id, _veiculo_id, current_date, _data_previsao_entrega,
    NULL, 'retirada', CASE WHEN _urgente THEN 'urgente' ELSE 'normal' END,
    NULL, v_total, round(_valor_desconto, 2),
    NULL, 'pendente', false, 0, _urgente, _percentual_urgencia, 'residencial',
    _idempotency_key
  ) RETURNING * INTO v_os;

  INSERT INTO public.itens_ordem_servico (
    ordem_servico_id, produto_id, quantidade, preco_unitario, subtotal,
    cor_item, marca_item, avarias, posicao_prateleira, observacoes
  )
  SELECT
    v_os.id, produto_id, quantidade, preco_unitario, subtotal,
    cor_item, marca_item, avarias, posicao_prateleira, observacoes
  FROM jsonb_to_recordset(v_itens_calculados) AS item(
    produto_id uuid,
    quantidade numeric,
    preco_unitario numeric,
    subtotal numeric,
    cor_item text,
    marca_item text,
    avarias text,
    posicao_prateleira text,
    observacoes text
  );

  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    IF upper(coalesce(_pagamento->>'metodo', '')) = 'PIX' THEN
      RAISE EXCEPTION 'PIX deve ser criado pelo provedor após a criação da OS';
    END IF;
    v_pagamento_resultado := public.registrar_pagamento_pdv(
      v_os.id,
      _caixa_id,
      upper(_pagamento->>'metodo'),
      v_total,
      CASE WHEN _pagamento ? 'valor_recebido' THEN (_pagamento->>'valor_recebido')::numeric ELSE NULL END,
      coalesce((_pagamento->>'parcelas')::integer, 1),
      _pagamento->>'bandeira',
      _pagamento->>'nsu',
      _pagamento->>'codigo_autorizacao',
      'ENTRADA',
      _idempotency_key || ':payment',
      _criado_por
    );
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_os.id,
      'number', v_os.numero,
      'total', v_total,
      'paymentStatus', CASE WHEN v_pagamento_resultado IS NULL THEN 'pendente' ELSE v_pagamento_resultado->>'orderStatus' END,
      'deliveryDate', v_os.data_previsao_entrega
    ),
    'payment', v_pagamento_resultado,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_venda_pdv(uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_pagamento_pdv(uuid, uuid, text, numeric, numeric, integer, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_intencao_pix_pdv(uuid, uuid, uuid, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconciliar_pagamento_pdv(uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancelar_intencao_pagamento_pdv(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.recalcular_pagamento_os(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.bloquear_fechamento_caixa_pix_pendente() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.criar_venda_pdv(uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_pdv(uuid, uuid, text, numeric, numeric, integer, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_intencao_pix_pdv(uuid, uuid, uuid, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconciliar_pagamento_pdv(uuid, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_intencao_pagamento_pdv(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.recalcular_pagamento_os(uuid) TO service_role;
