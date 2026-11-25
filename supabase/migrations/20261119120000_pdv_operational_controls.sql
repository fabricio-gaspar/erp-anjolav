-- Controles operacionais do PDV: regras comerciais, baixa do ROL,
-- identificação do atendente, operação explícita e matriz de acesso.

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS atendente_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_type public.operation_type,
  ADD COLUMN IF NOT EXISTS taxa_entrega numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_taxa_entrega_check,
  ADD CONSTRAINT ordens_servico_taxa_entrega_check CHECK (taxa_entrega >= 0 AND taxa_entrega <= 9999999.99);

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS operation_type public.operation_type;

ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS operation_type public.operation_type;

ALTER TABLE public.pdv_pagamentos
  ADD COLUMN IF NOT EXISTS operation_type public.operation_type;

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS operation_type public.operation_type;

UPDATE public.ordens_servico
SET operation_type = CASE
  WHEN lower(coalesce(origem, '')) = 'industrial' THEN 'industrial'::public.operation_type
  ELSE 'domestico'::public.operation_type
END
WHERE operation_type IS NULL;

UPDATE public.lancamentos AS l
SET operation_type = CASE
  WHEN lower(coalesce(o.origem, '')) = 'industrial' THEN 'industrial'::public.operation_type
  ELSE 'domestico'::public.operation_type
END
FROM public.ordens_servico AS o
WHERE o.id = l.ordem_servico_id AND l.operation_type IS NULL;

UPDATE public.caixa_movimentacoes AS m
SET operation_type = CASE
  WHEN lower(coalesce(o.origem, '')) = 'industrial' THEN 'industrial'::public.operation_type
  ELSE 'domestico'::public.operation_type
END
FROM public.ordens_servico AS o
WHERE o.id = m.ordem_servico_id AND m.operation_type IS NULL;

UPDATE public.pdv_pagamentos AS p
SET operation_type = CASE
  WHEN lower(coalesce(o.origem, '')) = 'industrial' THEN 'industrial'::public.operation_type
  ELSE 'domestico'::public.operation_type
END
FROM public.ordens_servico AS o
WHERE o.id = p.ordem_servico_id AND p.operation_type IS NULL;

-- Faturas podem ser criadas pelo fechamento por período, sem passar pelo
-- mesmo caminho do ROL. Sempre derive a operação do ROL ou do cliente antes
-- de permitir que o registro financeiro seja gravado.
UPDATE public.faturas AS f
SET operation_type = CASE
  WHEN lower(coalesce(c.classificacao, '')) = 'industrial' THEN 'industrial'::public.operation_type
  ELSE 'domestico'::public.operation_type
END
FROM public.clientes AS c
WHERE c.id = f.cliente_id
  AND f.operation_type IS NULL;

UPDATE public.lancamentos AS l
SET operation_type = CASE
  WHEN lower(coalesce(c.classificacao, '')) = 'industrial' THEN 'industrial'::public.operation_type
  ELSE 'domestico'::public.operation_type
END
FROM public.clientes AS c
WHERE c.id = l.cliente_id
  AND l.operation_type IS NULL;

CREATE INDEX IF NOT EXISTS ordens_servico_atendente_tenant_idx
  ON public.ordens_servico (tenant_id, atendente_id);
CREATE INDEX IF NOT EXISTS ordens_servico_operation_type_date_idx
  ON public.ordens_servico (tenant_id, operation_type, data_retirada);
CREATE INDEX IF NOT EXISTS caixa_movimentacoes_operation_type_idx
  ON public.caixa_movimentacoes (tenant_id, operation_type, ocorrido_em);
CREATE INDEX IF NOT EXISTS pdv_pagamentos_operation_type_idx
  ON public.pdv_pagamentos (tenant_id, operation_type, created_at);

CREATE OR REPLACE FUNCTION private.pdv_set_order_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_employee_id uuid;
  v_area text;
BEGIN
  IF NEW.atendente_id IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT f.id INTO v_employee_id
    FROM public.funcionarios f
    WHERE f.tenant_id = NEW.tenant_id AND f.user_id = auth.uid() AND f.ativo
    ORDER BY f.created_at
    LIMIT 1;
    NEW.atendente_id := v_employee_id;
  END IF;

  v_area := lower(coalesce(NEW.origem, ''));
  IF NEW.operation_type IS NULL THEN
    NEW.operation_type := CASE WHEN v_area = 'industrial' THEN 'industrial'::public.operation_type ELSE 'domestico'::public.operation_type END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pdv_set_order_context ON public.ordens_servico;
CREATE TRIGGER trg_pdv_set_order_context
BEFORE INSERT ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION private.pdv_set_order_context();

CREATE OR REPLACE FUNCTION private.pdv_set_movement_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
BEGIN
  IF NEW.operation_type IS NULL AND NEW.ordem_servico_id IS NOT NULL THEN
    SELECT o.operation_type INTO NEW.operation_type
    FROM public.ordens_servico o
    WHERE o.id = NEW.ordem_servico_id AND o.tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pdv_set_movement_operation ON public.caixa_movimentacoes;
CREATE TRIGGER trg_pdv_set_movement_operation
BEFORE INSERT ON public.caixa_movimentacoes
FOR EACH ROW EXECUTE FUNCTION private.pdv_set_movement_operation();

DROP TRIGGER IF EXISTS trg_pdv_set_payment_operation ON public.pdv_pagamentos;
CREATE TRIGGER trg_pdv_set_payment_operation
BEFORE INSERT ON public.pdv_pagamentos
FOR EACH ROW EXECUTE FUNCTION private.pdv_set_movement_operation();

CREATE OR REPLACE FUNCTION private.pdv_set_financial_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_payload jsonb := to_jsonb(NEW);
  v_order_id uuid := nullif(v_payload ->> 'ordem_servico_id', '')::uuid;
  v_client_id uuid := nullif(v_payload ->> 'cliente_id', '')::uuid;
  v_operation public.operation_type;
BEGIN
  IF NEW.operation_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_order_id IS NOT NULL THEN
    SELECT o.operation_type INTO v_operation
    FROM public.ordens_servico o
    WHERE o.id = v_order_id AND o.tenant_id = NEW.tenant_id;
  END IF;

  IF v_operation IS NULL AND v_client_id IS NOT NULL THEN
    SELECT CASE
      WHEN lower(coalesce(c.classificacao, '')) = 'industrial' THEN 'industrial'::public.operation_type
      ELSE 'domestico'::public.operation_type
    END INTO v_operation
    FROM public.clientes c
    WHERE c.id = v_client_id AND c.tenant_id = NEW.tenant_id;
  END IF;

  NEW.operation_type := coalesce(v_operation, 'domestico'::public.operation_type);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pdv_set_lancamento_operation ON public.lancamentos;
CREATE TRIGGER trg_pdv_set_lancamento_operation
BEFORE INSERT ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION private.pdv_set_financial_operation();

DROP TRIGGER IF EXISTS trg_pdv_set_fatura_operation ON public.faturas;
CREATE TRIGGER trg_pdv_set_fatura_operation
BEFORE INSERT ON public.faturas
FOR EACH ROW EXECUTE FUNCTION private.pdv_set_financial_operation();

ALTER TABLE public.lancamentos
  DROP CONSTRAINT IF EXISTS lancamentos_operation_type_required,
  ADD CONSTRAINT lancamentos_operation_type_required CHECK (operation_type IS NOT NULL) NOT VALID;

ALTER TABLE public.faturas
  DROP CONSTRAINT IF EXISTS faturas_operation_type_required,
  ADD CONSTRAINT faturas_operation_type_required CHECK (operation_type IS NOT NULL) NOT VALID;

CREATE TABLE IF NOT EXISTS public.pdv_regras_comerciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('residencial', 'industrial')),
  percentual_urgencia numeric(5,2) NOT NULL DEFAULT 30 CHECK (percentual_urgencia >= 0 AND percentual_urgencia <= 100),
  taxa_entrega_padrao numeric(12,2) NOT NULL DEFAULT 0 CHECK (taxa_entrega_padrao >= 0 AND taxa_entrega_padrao <= 9999999.99),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, area)
);

ALTER TABLE public.pdv_regras_comerciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdv_regras_comerciais FROM anon, authenticated;
GRANT ALL ON public.pdv_regras_comerciais TO service_role;

CREATE OR REPLACE FUNCTION public.consultar_regras_comerciais_pdv(_area text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_row public.pdv_regras_comerciais%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR _area NOT IN ('residencial', 'industrial') THEN
    RAISE EXCEPTION 'Contexto inválido para consultar regras do PDV';
  END IF;
  IF NOT private.has_any_module_access(ARRAY['caixa','configuracoes','dashboard']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para consultar regras comerciais';
  END IF;
  SELECT * INTO v_row FROM public.pdv_regras_comerciais WHERE tenant_id = v_tenant AND area = _area;
  RETURN jsonb_build_object(
    'area', _area,
    'urgencyPercentage', coalesce(v_row.percentual_urgencia, 30),
    'defaultDeliveryFee', coalesce(v_row.taxa_entrega_padrao, 0),
    'updatedAt', v_row.updated_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_regras_comerciais_pdv(
  _area text,
  _percentual_urgencia numeric,
  _taxa_entrega_padrao numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_row public.pdv_regras_comerciais%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR _area NOT IN ('residencial', 'industrial') THEN
    RAISE EXCEPTION 'Dados da regra comercial inválidos';
  END IF;
  IF _percentual_urgencia IS NULL OR _percentual_urgencia < 0 OR _percentual_urgencia > 100
     OR _taxa_entrega_padrao IS NULL OR _taxa_entrega_padrao < 0 THEN
    RAISE EXCEPTION 'Informe valores válidos para as regras comerciais';
  END IF;
  IF NOT private.has_any_module_access(ARRAY['configuracoes','alterar_condicoes_comerciais']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para alterar regras comerciais';
  END IF;
  INSERT INTO public.pdv_regras_comerciais (tenant_id, area, percentual_urgencia, taxa_entrega_padrao, updated_by, updated_at)
  VALUES (v_tenant, _area, round(_percentual_urgencia, 2), round(_taxa_entrega_padrao, 2), auth.uid(), now())
  ON CONFLICT (tenant_id, area) DO UPDATE SET
    percentual_urgencia = excluded.percentual_urgencia,
    taxa_entrega_padrao = excluded.taxa_entrega_padrao,
    updated_by = excluded.updated_by,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('area', v_row.area, 'urgencyPercentage', v_row.percentual_urgencia, 'defaultDeliveryFee', v_row.taxa_entrega_padrao, 'updatedAt', v_row.updated_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_regras_comerciais_pdv(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_regras_comerciais_pdv(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.salvar_regras_comerciais_pdv(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_regras_comerciais_pdv(text, numeric, numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.aplicar_reajuste_produtos_pdv(
  _area text,
  _percentual numeric,
  _produto_id uuid DEFAULT NULL,
  _apenas_ativos boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR _area NOT IN ('residencial','industrial') OR _percentual IS NULL OR _percentual < -90 OR _percentual > 500 THEN
    RAISE EXCEPTION 'Dados do reajuste inválidos';
  END IF;
  IF NOT private.has_any_module_access(ARRAY['configuracoes','produtos']::text[]) THEN RAISE EXCEPTION 'Sem permissão para alterar preços'; END IF;
  UPDATE public.produtos p
  SET preco = round(p.preco * (1 + (_percentual / 100)), 2), updated_at = now()
  WHERE p.tenant_id = v_tenant
    AND (_produto_id IS NULL OR p.id = _produto_id)
    AND (NOT _apenas_ativos OR p.status = 'ativo')
    AND (p.unidade_negocio IN (CASE WHEN _area = 'industrial' THEN 'ID1' ELSE 'ID2' END, 'ambos') OR p.unidade_negocio IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF _produto_id IS NOT NULL AND v_count = 0 THEN RAISE EXCEPTION 'Produto não encontrado ou fora da operação selecionada'; END IF;
  RETURN jsonb_build_object('area',_area,'percentual',_percentual,'alterados',v_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.aplicar_reajuste_produtos_pdv(text, numeric, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_reajuste_produtos_pdv(text, numeric, uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dar_baixa_rol_pdv(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_order public.ordens_servico%ROWTYPE;
  v_paid numeric(12,2);
BEGIN
  SELECT * INTO v_order FROM public.ordens_servico WHERE id = _ordem_servico_id AND tenant_id = private.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROL não encontrado'; END IF;
  IF NOT private.has_any_module_access(ARRAY['caixa','ordens','producao']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para dar baixa no ROL';
  END IF;
  IF v_order.status IN ('entregue', 'cancelada', 'cancelado') THEN
    RAISE EXCEPTION 'Este ROL já está encerrado';
  END IF;
  SELECT coalesce(sum(valor), 0) INTO v_paid
  FROM public.pdv_pagamentos
  WHERE ordem_servico_id = v_order.id AND status IN ('CONFIRMADO', 'EM_REVISAO');
  IF v_order.condicao_pagamento <> 'faturado' AND v_paid + 0.009 < coalesce(v_order.valor_total, 0) THEN
    RAISE EXCEPTION 'Receba o saldo pendente antes de dar baixa neste ROL';
  END IF;
  UPDATE public.ordens_servico
  SET status = 'entregue', data_entrega = coalesce(data_entrega, current_date), status_logistica = 'entregue', updated_at = now()
  WHERE id = v_order.id;
  RETURN jsonb_build_object('id', v_order.id, 'status', 'entregue', 'dataEntrega', current_date);
END;
$function$;

REVOKE ALL ON FUNCTION public.dar_baixa_rol_pdv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dar_baixa_rol_pdv(uuid) TO authenticated, service_role;

-- Abater crédito é uma saída controlada, com motivo obrigatório e reflexo no caixa.
ALTER TABLE public.pdv_credit_ledger DROP CONSTRAINT IF EXISTS pdv_credit_ledger_entry_type_check;
ALTER TABLE public.pdv_credit_ledger ADD CONSTRAINT pdv_credit_ledger_entry_type_check CHECK (entry_type IN ('CREDITO', 'USO', 'ESTORNO', 'AJUSTE_SAIDA'));

CREATE OR REPLACE FUNCTION public.abater_credito_cliente_pdv(
  _tenant_id uuid,
  _cliente_id uuid,
  _caixa_id uuid,
  _valor numeric,
  _motivo text,
  _idempotency_key text,
  _ator uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_client public.clientes%ROWTYPE;
  v_account public.pdv_credit_accounts%ROWTYPE;
  v_cash public.caixas%ROWTYPE;
  v_existing public.pdv_credit_ledger%ROWTYPE;
  v_value numeric(12,2) := round(_valor, 2);
  v_reason text := left(trim(coalesce(_motivo, '')), 1200);
BEGIN
  IF v_value IS NULL OR v_value <= 0 OR length(v_reason) < 5 THEN RAISE EXCEPTION 'Informe valor e motivo válidos para abater crédito'; END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN RAISE EXCEPTION 'Chave de operação inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant_id::text || ':' || _idempotency_key, 0));

  SELECT * INTO v_existing
  FROM public.pdv_credit_ledger
  WHERE tenant_id = _tenant_id AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existing.client_id <> _cliente_id
       OR v_existing.cash_register_id <> _caixa_id
       OR v_existing.entry_type <> 'AJUSTE_SAIDA'
       OR abs(v_existing.amount - v_value) > 0.009 THEN
      RAISE EXCEPTION 'A chave de operação já foi usada com dados diferentes';
    END IF;
    RETURN jsonb_build_object(
      'saldo', v_existing.balance_after,
      'valor', v_existing.amount,
      'idempotente', true
    );
  END IF;

  SELECT * INTO v_client FROM public.clientes WHERE id = _cliente_id AND tenant_id = _tenant_id;
  IF NOT FOUND OR NOT private.pdv_actor_allowed(_ator, _tenant_id, v_client.classificacao, ARRAY['caixa']) THEN RAISE EXCEPTION 'Cliente não encontrado ou sem permissão'; END IF;
  SELECT * INTO v_cash FROM public.caixas WHERE id = _caixa_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND OR v_cash.status <> 'ABERTO' THEN RAISE EXCEPTION 'O caixa informado não está aberto'; END IF;
  INSERT INTO public.pdv_credit_accounts (tenant_id, client_id) VALUES (_tenant_id, _cliente_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_account FROM public.pdv_credit_accounts WHERE tenant_id = _tenant_id AND client_id = _cliente_id FOR UPDATE;
  IF v_account.balance < v_value THEN RAISE EXCEPTION 'O valor supera o crédito disponível'; END IF;
  UPDATE public.pdv_credit_accounts SET balance = round(balance - v_value, 2), updated_at = now() WHERE id = v_account.id RETURNING * INTO v_account;
  INSERT INTO public.pdv_credit_ledger (tenant_id, client_id, entry_type, amount, balance_after, payment_method, cash_register_id, reason, idempotency_key, created_by)
  VALUES (_tenant_id, _cliente_id, 'AJUSTE_SAIDA', v_value, v_account.balance, 'AJUSTE_CREDITO', _caixa_id, v_reason, _idempotency_key, _ator)
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  INSERT INTO public.caixa_movimentacoes (caixa_id, tipo, valor, descricao, forma_pagamento, cliente_id, tenant_id, criado_por, operation_type)
  VALUES (_caixa_id, 'SANGRIA', v_value, left('Abatimento de crédito · ' || v_client.razao_social || ' · ' || v_reason, 1200), 'AJUSTE_CREDITO', _cliente_id, _tenant_id, _ator,
    CASE WHEN lower(coalesce(v_client.classificacao, '')) = 'industrial' THEN 'industrial'::public.operation_type ELSE 'domestico'::public.operation_type END);
  UPDATE public.caixas SET valor_sangrias = coalesce(valor_sangrias, 0) + v_value, valor_esperado = coalesce(valor_esperado, 0) - v_value WHERE id = _caixa_id;
  RETURN jsonb_build_object('saldo', v_account.balance, 'valor', v_value, 'idempotente', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.abater_credito_cliente_pdv(uuid, uuid, uuid, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abater_credito_cliente_pdv(uuid, uuid, uuid, numeric, text, text, uuid) TO service_role;

-- Versão do fechamento do PDV que calcula a taxa de delivery dentro da mesma
-- operação do ROL (inclusive para pagamentos parciais ou PIX).
CREATE OR REPLACE FUNCTION public.criar_venda_pdv_com_taxa(
  _cliente_id uuid, _caixa_id uuid, _data_previsao_entrega date, _urgente boolean,
  _percentual_urgencia numeric, _valor_desconto numeric, _taxa_entrega numeric,
  _motorista_id uuid, _veiculo_id uuid, _itens jsonb, _pagamento jsonb,
  _criado_por uuid, _idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_cliente public.clientes%ROWTYPE; v_caixa public.caixas%ROWTYPE; v_os public.ordens_servico%ROWTYPE;
  v_atendente uuid;
  v_item jsonb; v_produto public.produtos%ROWTYPE; v_quantidade numeric; v_preco numeric(12,2); v_subtotal numeric(12,2);
  v_itens_calculados jsonb := '[]'::jsonb; v_total_itens numeric(12,2) := 0; v_total numeric(12,2);
  v_valor_pagamento numeric(12,2); v_pagamento_resultado jsonb := NULL; v_existente public.ordens_servico%ROWTYPE;
  v_condicao text; v_config jsonb; v_lancamento uuid; v_fingerprint text; v_fee numeric(12,2) := round(coalesce(_taxa_entrega, 0), 2);
BEGIN
  IF v_fee < 0 OR v_fee > 9999999.99 THEN RAISE EXCEPTION 'Taxa de entrega inválida'; END IF;
  SELECT * INTO v_cliente FROM public.clientes WHERE id = _cliente_id FOR SHARE;
  IF NOT FOUND OR NOT coalesce(v_cliente.ativo, false) OR v_cliente.classificacao NOT IN ('industrial','residencial') THEN RAISE EXCEPTION 'Cliente inválido ou inativo'; END IF;
  SELECT f.id INTO v_atendente
  FROM public.funcionarios f
  WHERE f.tenant_id = v_cliente.tenant_id
    AND f.user_id = _criado_por
    AND f.ativo
  ORDER BY f.created_at
  LIMIT 1;
  IF NOT private.pdv_actor_allowed(_criado_por, v_cliente.tenant_id, v_cliente.classificacao, ARRAY['caixa','faturamento']) THEN RAISE EXCEPTION 'Sem permissão para atender este cliente'; END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN RAISE EXCEPTION 'Chave de idempotência inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key, 0));
  v_fingerprint := md5(jsonb_build_array(_cliente_id,_caixa_id,_data_previsao_entrega,_urgente,_percentual_urgencia,_valor_desconto,v_fee,_motorista_id,_veiculo_id,_itens,_pagamento,_criado_por)::text);
  SELECT * INTO v_existente FROM public.ordens_servico WHERE pdv_idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existente.tenant_id <> v_cliente.tenant_id OR v_existente.cliente_id <> _cliente_id OR v_existente.pdv_request_hash IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'Chave de idempotência usada em outro atendimento'; END IF;
    RETURN jsonb_build_object('order',jsonb_build_object('id',v_existente.id,'number',v_existente.numero,'total',v_existente.valor_total,'paymentStatus',v_existente.status_pagamento,'deliveryDate',v_existente.data_previsao_entrega),'idempotent',true);
  END IF;
  SELECT to_jsonb(config) - 'id' - 'tenant_id' - 'cliente_id' - 'created_at' - 'updated_at' INTO v_config
  FROM public.configuracoes_pagamento_cliente config WHERE cliente_id = _cliente_id AND tenant_id = v_cliente.tenant_id FOR SHARE;
  v_condicao := coalesce(v_config->>'condicao_pagamento','retirada');
  IF v_condicao NOT IN ('entrada','retirada','faturado') THEN RAISE EXCEPTION 'Revise a condição de pagamento no cadastro do cliente'; END IF;
  IF v_condicao = 'entrada' AND (_pagamento IS NULL OR _pagamento = 'null'::jsonb) THEN RAISE EXCEPTION 'Este cliente exige pagamento na entrada'; END IF;
  IF v_condicao = 'faturado' AND (_pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb) THEN RAISE EXCEPTION 'Cliente faturado: receba pelo fechamento da fatura'; END IF;
  IF v_condicao = 'faturado' AND (coalesce(_valor_desconto,0) <> 0 OR coalesce(_percentual_urgencia,0) <> 0 OR v_fee <> 0) THEN RAISE EXCEPTION 'No atendimento faturado utilize os preços da tabela do cliente'; END IF;
  IF coalesce(_valor_desconto,0) > 0 AND NOT private.pdv_actor_allowed(_criado_por,v_cliente.tenant_id,v_cliente.classificacao,ARRAY['alterar_condicoes_comerciais']) THEN RAISE EXCEPTION 'Sem permissão para conceder desconto'; END IF;
  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    IF NOT private.pdv_actor_allowed(_criado_por,v_cliente.tenant_id,v_cliente.classificacao,ARRAY['caixa']) THEN RAISE EXCEPTION 'Sem permissão para receber pagamentos'; END IF;
    SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id AND tenant_id = v_cliente.tenant_id FOR UPDATE;
    IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN RAISE EXCEPTION 'Abra um caixa para receber o pagamento'; END IF;
  END IF;
  IF _data_previsao_entrega IS NULL OR _data_previsao_entrega < current_date THEN RAISE EXCEPTION 'Previsão de entrega inválida'; END IF;
  IF _percentual_urgencia IS NULL OR _percentual_urgencia < 0 OR _percentual_urgencia > 100 OR (NOT coalesce(_urgente,false) AND _percentual_urgencia <> 0) THEN RAISE EXCEPTION 'Percentual de urgência inválido'; END IF;
  IF _valor_desconto IS NULL OR _valor_desconto < 0 THEN RAISE EXCEPTION 'Desconto inválido'; END IF;
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 OR jsonb_array_length(_itens) > 200 THEN RAISE EXCEPTION 'A venda deve possuir entre 1 e 200 itens'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    IF jsonb_typeof(v_item) <> 'object' OR coalesce(v_item->>'produto_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'Item da venda inválido'; END IF;
    BEGIN v_quantidade := (v_item->>'quantidade')::numeric; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Quantidade inválida'; END;
    IF v_quantidade IS NULL OR v_quantidade <= 0 OR v_quantidade > 999 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT p.* INTO v_produto FROM public.produtos p WHERE p.id = (v_item->>'produto_id')::uuid AND p.tenant_id = v_cliente.tenant_id AND p.status = 'ativo' AND (p.unidade_negocio IN (CASE WHEN v_cliente.classificacao = 'industrial' THEN 'ID1' ELSE 'ID2' END, 'ambos') OR p.unidade_negocio IS NULL) FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto incompatível com a área do cliente ou inativo'; END IF;
    IF lower(coalesce(v_produto.unidade,'un')) NOT IN ('kg','m','mt','metro','metros','m²','m2','litro','l') AND trunc(v_quantidade) <> v_quantidade THEN RAISE EXCEPTION 'Este produto exige quantidade inteira'; END IF;
    SELECT round((CASE WHEN v_cliente.tabela_preco_tipo = 'personalizada' THEN pe.preco_especial ELSE v_produto.preco END)::numeric,2) INTO v_preco FROM (SELECT 1) source LEFT JOIN public.precos_especiais pe ON pe.cliente_id = _cliente_id AND pe.tenant_id = v_cliente.tenant_id AND pe.produto_id = v_produto.id AND v_cliente.tabela_preco_tipo = 'personalizada' LIMIT 1;
    IF v_preco IS NULL OR v_preco < 0 THEN RAISE EXCEPTION 'Produto sem preço válido na tabela do cliente'; END IF;
    v_subtotal := round(v_preco * v_quantidade,2); v_total_itens := v_total_itens + v_subtotal;
    v_itens_calculados := v_itens_calculados || jsonb_build_array(jsonb_build_object('produto_nome',v_produto.nome,'unidade',v_produto.unidade,'produto_id',v_produto.id,'quantidade',v_quantidade,'preco_unitario',v_preco,'subtotal',v_subtotal,'cor_item',nullif(left(trim(coalesce(v_item->>'cor_item','')),100),''),'marca_item',nullif(left(trim(coalesce(v_item->>'marca_item','')),100),''),'avarias',nullif(left(trim(coalesce(v_item->>'avarias','')),1000),''),'posicao_prateleira',nullif(left(trim(coalesce(v_item->>'posicao_prateleira','')),100),''),'observacoes',nullif(left(trim(coalesce(v_item->>'observacoes','')),1000),'')));
  END LOOP;
  v_total_itens := round(v_total_itens,2);
  IF round(_valor_desconto,2) > v_total_itens THEN RAISE EXCEPTION 'O desconto supera o total da venda'; END IF;
  v_total := round((v_total_itens - round(_valor_desconto,2)) * (1 + CASE WHEN _urgente THEN _percentual_urgencia / 100 ELSE 0 END) + v_fee, 2);
  IF v_total <= 0 THEN RAISE EXCEPTION 'O total da venda deve ser positivo'; END IF;
  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    BEGIN v_valor_pagamento := round(coalesce(nullif(_pagamento->>'valor','')::numeric,v_total),2); EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Valor do pagamento inválido'; END;
    IF v_valor_pagamento IS NULL OR v_valor_pagamento <= 0 OR v_valor_pagamento > v_total THEN RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero e não pode ultrapassar o total do ROL'; END IF;
  END IF;
  INSERT INTO public.ordens_servico (numero,cliente_id,atendente_id,motorista_id,veiculo_id,data_retirada,data_previsao_entrega,data_entrega,status,prioridade,observacoes,valor_total,valor_desconto,forma_pagamento,status_pagamento,pago_na_entrada,valor_pago,urgente,percentual_urgencia,origem,pdv_idempotency_key,tenant_id,condicao_pagamento,condicoes_comerciais,pdv_request_hash,taxa_entrega)
  VALUES ('',_cliente_id,v_atendente,_motorista_id,_veiculo_id,current_date,_data_previsao_entrega,NULL,'retirada',CASE WHEN _urgente THEN 'urgente' ELSE 'normal' END,NULL,v_total,round(_valor_desconto,2),NULL,'pendente',false,0,_urgente,_percentual_urgencia,v_cliente.classificacao,_idempotency_key,v_cliente.tenant_id,v_condicao,coalesce(v_config,'{}'::jsonb) || jsonb_build_object('tabela_preco_tipo',v_cliente.tabela_preco_tipo),v_fingerprint,v_fee) RETURNING * INTO v_os;
  INSERT INTO public.itens_ordem_servico (tenant_id,ordem_servico_id,produto_id,quantidade,preco_unitario,subtotal,cor_item,marca_item,avarias,posicao_prateleira,observacoes)
  SELECT v_cliente.tenant_id,v_os.id,produto_id,quantidade,preco_unitario,subtotal,cor_item,marca_item,avarias,posicao_prateleira,observacoes FROM jsonb_to_recordset(v_itens_calculados) AS item(produto_id uuid,quantidade numeric,preco_unitario numeric,subtotal numeric,cor_item text,marca_item text,avarias text,posicao_prateleira text,observacoes text);
  IF v_condicao = 'faturado' THEN
    INSERT INTO public.lancamentos(tenant_id,cliente_id,ordem_servico_id,data_lancamento,data_entrega,valor_total,status,etapa,observacao,operation_type) VALUES(v_cliente.tenant_id,_cliente_id,v_os.id,current_date,_data_previsao_entrega,v_total,'pendente','em_processo','Atendimento ' || v_os.numero,CASE WHEN v_cliente.classificacao='industrial' THEN 'industrial'::public.operation_type ELSE 'domestico'::public.operation_type END) RETURNING id INTO v_lancamento;
    INSERT INTO public.itens_lancamento(tenant_id,lancamento_id,produto_nome,quantidade,unidade,preco_unitario,subtotal) SELECT v_cliente.tenant_id,v_lancamento,produto_nome,quantidade,coalesce(unidade,'un'),preco_unitario,subtotal FROM jsonb_to_recordset(v_itens_calculados) AS item(produto_nome text,quantidade numeric,unidade text,preco_unitario numeric,subtotal numeric);
  END IF;
  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb AND upper(coalesce(_pagamento->>'metodo','')) <> 'PIX' THEN
    v_pagamento_resultado := public.registrar_pagamento_pdv(v_os.id,_caixa_id,upper(_pagamento->>'metodo'),v_valor_pagamento,CASE WHEN _pagamento ? 'valor_recebido' THEN (_pagamento->>'valor_recebido')::numeric ELSE NULL END,coalesce((_pagamento->>'parcelas')::integer,1),_pagamento->>'bandeira',_pagamento->>'nsu',_pagamento->>'codigo_autorizacao','ENTRADA',_idempotency_key || ':payment',_criado_por);
  END IF;
  RETURN jsonb_build_object('order',jsonb_build_object('id',v_os.id,'number',v_os.numero,'total',v_total,'paymentStatus',CASE WHEN v_pagamento_resultado IS NULL THEN 'pendente' ELSE v_pagamento_resultado->>'orderStatus' END,'deliveryDate',v_os.data_previsao_entrega),'payment',v_pagamento_resultado,'idempotent',false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_pedido_atendimento_v2(
  _cliente_id uuid, _caixa_id uuid, _data_previsao_entrega date, _urgente boolean,
  _percentual_urgencia numeric, _valor_desconto numeric, _motorista_id uuid, _veiculo_id uuid,
  _itens jsonb, _pagamento jsonb, _criado_por uuid, _idempotency_key text, _data_retirada date,
  _observacoes text, _recebimento_modalidade text, _entrega_modalidade text, _endereco_snapshot jsonb,
  _taxa_entrega numeric, _permitir_excecao_capacidade boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_client public.clientes%ROWTYPE; v_order public.ordens_servico%ROWTYPE; v_result jsonb;
  v_intake date := coalesce(_data_retirada,current_date); v_receipt text := coalesce(nullif(trim(_recebimento_modalidade),''),'balcao');
  v_delivery text := coalesce(nullif(trim(_entrega_modalidade),''),'balcao'); v_address jsonb := '{}'::jsonb;
  v_limit numeric; v_reserved numeric := 0; v_requested numeric := 0; v_item jsonb; v_qty numeric;
  v_delivery_fee numeric(12,2) := round(coalesce(_taxa_entrega, 0), 2);
  v_delivery_rules public.pdv_regras_comerciais%ROWTYPE;
  v_company public.configuracoes_gerais%ROWTYPE;
  v_distance_km numeric;
BEGIN
  SELECT * INTO v_client FROM public.clientes WHERE id = _cliente_id FOR SHARE;
  IF NOT FOUND OR NOT coalesce(v_client.ativo,false) OR v_client.classificacao NOT IN ('industrial','residencial') THEN RAISE EXCEPTION 'Cliente inválido ou inativo'; END IF;
  IF v_intake < current_date THEN RAISE EXCEPTION 'A data de recebimento não pode estar no passado'; END IF;
  IF _data_previsao_entrega IS NULL OR _data_previsao_entrega < v_intake THEN RAISE EXCEPTION 'A previsão de entrega deve ser igual ou posterior ao recebimento'; END IF;
  IF v_receipt NOT IN ('balcao','coleta') OR v_delivery NOT IN ('balcao','entrega') THEN RAISE EXCEPTION 'Modalidade do atendimento inválida'; END IF;
  IF _taxa_entrega IS NULL OR _taxa_entrega < 0 OR (v_delivery <> 'entrega' AND _taxa_entrega <> 0) THEN RAISE EXCEPTION 'Taxa de entrega inválida para a modalidade escolhida'; END IF;
  IF v_receipt = 'coleta' OR v_delivery = 'entrega' THEN
    IF nullif(trim(coalesce(_endereco_snapshot->>'logradouro','')),'') IS NULL OR nullif(trim(coalesce(_endereco_snapshot->>'cidade','')),'') IS NULL OR nullif(trim(coalesce(_endereco_snapshot->>'uf','')),'') IS NULL THEN RAISE EXCEPTION 'Informe um endereço completo para coleta ou entrega'; END IF;
    v_address := jsonb_strip_nulls(jsonb_build_object('cep',nullif(left(trim(coalesce(_endereco_snapshot->>'cep','')),20),''),'logradouro',nullif(left(trim(coalesce(_endereco_snapshot->>'logradouro','')),200),''),'numero',nullif(left(trim(coalesce(_endereco_snapshot->>'numero','')),30),''),'complemento',nullif(left(trim(coalesce(_endereco_snapshot->>'complemento','')),120),''),'bairro',nullif(left(trim(coalesce(_endereco_snapshot->>'bairro','')),120),''),'cidade',nullif(left(trim(coalesce(_endereco_snapshot->>'cidade','')),120),''),'uf',upper(nullif(left(trim(coalesce(_endereco_snapshot->>'uf','')),2),'')),'pais',nullif(left(trim(coalesce(_endereco_snapshot->>'pais','Brasil')),80),''),'latitude',nullif(_endereco_snapshot->>'latitude','')::numeric,'longitude',nullif(_endereco_snapshot->>'longitude','')::numeric));
  END IF;
  IF v_delivery = 'entrega' THEN
    SELECT * INTO v_delivery_rules
    FROM public.pdv_regras_comerciais
    WHERE tenant_id = v_client.tenant_id AND area = v_client.classificacao;
    IF coalesce(v_delivery_rules.delivery_pricing_model, 'fixo') = 'km' THEN
      SELECT * INTO v_company
      FROM public.configuracoes_gerais
      LIMIT 1;
      IF v_company.endereco_latitude IS NULL OR v_company.endereco_longitude IS NULL
         OR (_endereco_snapshot->>'latitude') IS NULL OR (_endereco_snapshot->>'longitude') IS NULL THEN
        RAISE EXCEPTION 'Não foi possível calcular o delivery por KM: faltam coordenadas da empresa ou do cliente';
      END IF;
      v_distance_km := 6371 * 2 * asin(sqrt(
        power(sin(radians(((_endereco_snapshot->>'latitude')::numeric - v_company.endereco_latitude) / 2)), 2)
        + cos(radians(v_company.endereco_latitude)) * cos(radians((_endereco_snapshot->>'latitude')::numeric))
        * power(sin(radians(((_endereco_snapshot->>'longitude')::numeric - v_company.endereco_longitude) / 2)), 2)
      ));
      v_delivery_fee := round(coalesce(v_delivery_rules.delivery_fee_base, 0) + v_distance_km * coalesce(v_delivery_rules.delivery_fee_per_km, 0), 2);
    ELSIF v_delivery_fee = 0 THEN
      v_delivery_fee := round(coalesce(v_delivery_rules.delivery_fee_base, v_delivery_rules.taxa_entrega_padrao, 0), 2);
    END IF;
  ELSE
    v_delivery_fee := 0;
  END IF;
  IF _permitir_excecao_capacidade AND NOT private.pdv_actor_allowed(_criado_por,v_client.tenant_id,v_client.classificacao,ARRAY['alterar_condicoes_comerciais']) THEN RAISE EXCEPTION 'Sem permissão para autorizar exceção de capacidade'; END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'A venda deve possuir itens'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 999 THEN RAISE EXCEPTION 'Quantidade inválida para reservar capacidade'; END IF;
    v_requested := v_requested + v_qty;
  END LOOP;
  SELECT limite_carga INTO v_limit FROM public.pdv_capacidades_diarias WHERE tenant_id=v_client.tenant_id AND area=v_client.classificacao AND data=_data_previsao_entrega AND ativo FOR UPDATE;
  IF FOUND THEN
    SELECT coalesce(sum(i.quantidade),0) INTO v_reserved FROM public.ordens_servico o JOIN public.clientes c ON c.id=o.cliente_id AND c.tenant_id=o.tenant_id JOIN public.itens_ordem_servico i ON i.ordem_servico_id=o.id AND i.tenant_id=o.tenant_id WHERE o.tenant_id=v_client.tenant_id AND c.classificacao=v_client.classificacao AND o.data_previsao_entrega=_data_previsao_entrega AND o.status NOT IN ('cancelada','cancelado');
    IF v_reserved + v_requested > v_limit AND NOT _permitir_excecao_capacidade THEN RAISE EXCEPTION 'A data escolhida não possui capacidade disponível para este pedido'; END IF;
  END IF;
  v_result := public.criar_venda_pdv_com_taxa(_cliente_id,_caixa_id,_data_previsao_entrega,_urgente,_percentual_urgencia,_valor_desconto,v_delivery_fee,_motorista_id,_veiculo_id,_itens,_pagamento,_criado_por,_idempotency_key);
  SELECT * INTO v_order FROM public.ordens_servico WHERE id=(v_result->'order'->>'id')::uuid FOR UPDATE;
  IF coalesce((v_result->>'idempotent')::boolean, false) = false THEN UPDATE public.ordens_servico SET data_retirada=v_intake, recebimento_modalidade=v_receipt, entrega_modalidade=v_delivery, endereco_atendimento_snapshot=v_address, capacidade_reservada=v_requested, capacidade_limite_snapshot=CASE WHEN v_limit IS NOT NULL THEN v_limit ELSE NULL END, capacidade_excecao=coalesce(_permitir_excecao_capacidade,false), status_logistica=CASE WHEN v_receipt='coleta' THEN 'aguardando_coleta' ELSE status_logistica END, updated_at=now() WHERE id=v_order.id; END IF;
  RETURN v_result || jsonb_build_object('intake',jsonb_build_object('date',v_intake,'receiptMode',v_receipt,'deliveryMode',v_delivery,'addressSnapshot',v_address,'deliveryFee',v_delivery_fee,'distanceKm',v_distance_km),'capacity',jsonb_build_object('configured',v_limit IS NOT NULL,'limit',v_limit,'reserved',v_reserved,'requested',v_requested,'override',_permitir_excecao_capacidade));
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean) TO service_role;

-- O caixa continua compartilhado por tenant/identificador; a operação fica no movimento, não em um caixa separado.
ALTER TABLE public.caixas ADD COLUMN IF NOT EXISTS modelo text NOT NULL DEFAULT 'compartilhado';
ALTER TABLE public.caixas DROP CONSTRAINT IF EXISTS caixas_modelo_check;
ALTER TABLE public.caixas ADD CONSTRAINT caixas_modelo_check CHECK (modelo = 'compartilhado');

-- Remove a autorização ampla que permitia que dashboards/relatórios escrevessem nos módulos transacionais.
DROP POLICY IF EXISTS tenant_insert ON public.ordens_servico;
DROP POLICY IF EXISTS tenant_update ON public.ordens_servico;
DROP POLICY IF EXISTS tenant_insert ON public.faturas;
DROP POLICY IF EXISTS tenant_update ON public.faturas;
DROP POLICY IF EXISTS tenant_insert ON public.contas_pagar;
DROP POLICY IF EXISTS tenant_update ON public.contas_pagar;
DROP POLICY IF EXISTS tenant_delete ON public.contas_pagar;

CREATE POLICY tenant_insert_operational ON public.ordens_servico FOR INSERT TO authenticated
WITH CHECK (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['ordens','caixa','faturamento']::text[]));
CREATE POLICY tenant_update_operational ON public.ordens_servico FOR UPDATE TO authenticated
USING (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['ordens','caixa','producao']::text[]))
WITH CHECK (tenant_id = private.current_tenant_id());
CREATE POLICY tenant_insert_billing ON public.faturas FOR INSERT TO authenticated
WITH CHECK (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['faturamento']::text[]));
CREATE POLICY tenant_update_billing ON public.faturas FOR UPDATE TO authenticated
USING (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['faturamento','contas_receber']::text[]))
WITH CHECK (tenant_id = private.current_tenant_id());
CREATE POLICY tenant_insert_payables ON public.contas_pagar FOR INSERT TO authenticated
WITH CHECK (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['contas_pagar']::text[]));
CREATE POLICY tenant_update_payables ON public.contas_pagar FOR UPDATE TO authenticated
USING (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['contas_pagar']::text[]))
WITH CHECK (tenant_id = private.current_tenant_id());
CREATE POLICY tenant_delete_payables ON public.contas_pagar FOR DELETE TO authenticated
USING (tenant_id = private.current_tenant_id() AND private.has_any_module_access(ARRAY['contas_pagar']::text[]));

-- Movimentações manuais do caixa compartilhado não possuem ROL para derivar
-- a operação. O PDV informa explicitamente a área e a RPC valida o tenant.
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_caixa_auditada_v2(
  _caixa_id uuid,
  _tipo text,
  _valor numeric,
  _descricao text,
  _ocorrido_em timestamptz,
  _responsavel_nome text,
  _categoria text,
  _referencia text,
  _idempotency_key text,
  _operation_type public.operation_type
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $function$
DECLARE
  v_result jsonb;
  v_tenant uuid := private.current_tenant_id();
  v_movement public.caixa_movimentacoes%ROWTYPE;
BEGIN
  IF v_tenant IS NULL OR _operation_type IS NULL THEN
    RAISE EXCEPTION 'Empresa e operação são obrigatórias para movimentar o caixa';
  END IF;

  v_result := public.registrar_movimentacao_caixa_auditada(
    _caixa_id, _tipo, _valor, _descricao, _ocorrido_em,
    _responsavel_nome, _categoria, _referencia, _idempotency_key
  );

  UPDATE public.caixa_movimentacoes
  SET operation_type = _operation_type
  WHERE id = (v_result ->> 'id')::uuid
    AND tenant_id = v_tenant
  RETURNING * INTO v_movement;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada após o registro';
  END IF;
  RETURN to_jsonb(v_movement);
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_movimentacao_caixa_auditada_v2(uuid, text, numeric, text, timestamptz, text, text, text, text, public.operation_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_caixa_auditada_v2(uuid, text, numeric, text, timestamptz, text, text, text, text, public.operation_type) TO authenticated;
