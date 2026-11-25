-- Keep the event time separate from the time the database recorded it. The
-- original created_at remains the immutable system/audit timestamp.
ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS ocorrido_em timestamptz,
  ADD COLUMN IF NOT EXISTS responsavel_nome text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS referencia text;

UPDATE public.caixa_movimentacoes
   SET ocorrido_em = created_at
 WHERE ocorrido_em IS NULL;

ALTER TABLE public.caixa_movimentacoes
  ALTER COLUMN ocorrido_em SET DEFAULT now(),
  ALTER COLUMN ocorrido_em SET NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.caixa_movimentacoes'::regclass
      AND conname = 'caixa_movimentacoes_sangria_audit_required'
  ) THEN
    ALTER TABLE public.caixa_movimentacoes
      ADD CONSTRAINT caixa_movimentacoes_sangria_audit_required
      CHECK (
        tipo <> 'SANGRIA'
        OR (
          char_length(trim(COALESCE(responsavel_nome, ''))) BETWEEN 2 AND 120
          AND categoria IN (
            'DEPOSITO_BANCARIO', 'PAGAMENTO_FORNECEDOR', 'DESPESA_OPERACIONAL',
            'ENVIO_AO_COFRE', 'RETIRADA_PROPRIETARIO', 'OUTROS'
          )
          AND char_length(trim(COALESCE(descricao, ''))) BETWEEN 5 AND 1000
          AND (referencia IS NULL OR char_length(trim(referencia)) <= 120)
        )
      ) NOT VALID;
  END IF;
END
$constraints$;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_caixa_auditada(
  _caixa_id uuid,
  _tipo text,
  _valor numeric,
  _descricao text,
  _ocorrido_em timestamptz,
  _responsavel_nome text,
  _categoria text,
  _referencia text,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_user_id uuid := auth.uid();
  v_key text := NULLIF(trim(COALESCE(_idempotency_key, '')), '');
  v_tipo text := upper(trim(COALESCE(_tipo, '')));
  v_descricao text := NULLIF(trim(COALESCE(_descricao, '')), '');
  v_responsavel text := NULLIF(trim(COALESCE(_responsavel_nome, '')), '');
  v_categoria text := NULLIF(upper(trim(COALESCE(_categoria, ''))), '');
  v_referencia text := NULLIF(trim(COALESCE(_referencia, '')), '');
  v_ocorrido_em timestamptz := COALESCE(_ocorrido_em, now());
  v_caixa public.caixas%ROWTYPE;
  v_mov public.caixa_movimentacoes%ROWTYPE;
  v_result jsonb;
  v_dinheiro numeric := 0;
  v_sangrias numeric := 0;
  v_suprimentos numeric := 0;
  v_vendas numeric := 0;
BEGIN
  IF NOT private.pdv_cash_write_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para movimentar o caixa';
  END IF;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e empresa ativa são obrigatórias';
  END IF;
  IF _valor IS NULL OR _valor <= 0 OR _valor::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero';
  END IF;
  IF v_tipo NOT IN ('SANGRIA', 'REFORCO') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido';
  END IF;
  IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF v_referencia IS NOT NULL AND char_length(v_referencia) > 120 THEN
    RAISE EXCEPTION 'A referência deve ter no máximo 120 caracteres';
  END IF;

  IF v_tipo = 'SANGRIA' THEN
    IF _ocorrido_em IS NULL THEN
      RAISE EXCEPTION 'Informe a data e o horário da sangria';
    END IF;
    IF v_responsavel IS NULL OR char_length(v_responsavel) < 2 OR char_length(v_responsavel) > 120 THEN
      RAISE EXCEPTION 'Informe o nome de quem recebeu a sangria (2 a 120 caracteres)';
    END IF;
    IF v_categoria IS NULL OR v_categoria NOT IN (
      'DEPOSITO_BANCARIO', 'PAGAMENTO_FORNECEDOR', 'DESPESA_OPERACIONAL',
      'ENVIO_AO_COFRE', 'RETIRADA_PROPRIETARIO', 'OUTROS'
    ) THEN
      RAISE EXCEPTION 'Selecione uma finalidade válida para a sangria';
    END IF;
    IF v_descricao IS NULL OR char_length(v_descricao) < 5 OR char_length(v_descricao) > 1000 THEN
      RAISE EXCEPTION 'Descreva o motivo da sangria (5 a 1000 caracteres)';
    END IF;
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT r.result INTO v_result
      FROM public.pdv_cash_operation_requests r
     WHERE r.tenant_id = v_tenant_id
       AND r.operation = v_tipo
       AND r.idempotency_key = v_key
     FOR UPDATE;
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  END IF;

  -- The same row lock is used by close_caixa_auditado, so a movement cannot
  -- be recorded after the close has captured its final ledger totals.
  SELECT c.* INTO v_caixa
    FROM public.caixas c
   WHERE c.id = _caixa_id
     AND c.tenant_id = v_tenant_id
     AND c.status = 'ABERTO'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O caixa não está aberto ou não pertence à empresa ativa';
  END IF;
  IF v_ocorrido_em < v_caixa.data_abertura OR v_ocorrido_em > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'A data da movimentação deve estar entre a abertura do caixa e o horário atual';
  END IF;

  INSERT INTO public.caixa_movimentacoes (
    caixa_id, tipo, valor, descricao, forma_pagamento, criado_por,
    tenant_id, ocorrido_em, responsavel_nome, categoria, referencia
  ) VALUES (
    v_caixa.id, v_tipo, round(_valor, 2), v_descricao, 'DINHEIRO', v_user_id,
    v_tenant_id, v_ocorrido_em, v_responsavel, v_categoria, v_referencia
  )
  RETURNING * INTO v_mov;

  SELECT
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' THEN m.valor WHEN m.tipo = 'VENDA' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' AND m.evento_pagamento = 'ESTORNO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'SANGRIA' THEN m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'REFORCO' THEN m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' THEN CASE WHEN m.evento_pagamento = 'ESTORNO' THEN -m.valor ELSE m.valor END ELSE 0 END), 0)
  INTO v_dinheiro, v_sangrias, v_suprimentos, v_vendas
  FROM public.caixa_movimentacoes m
  WHERE m.caixa_id = v_caixa.id
    AND m.tenant_id = v_tenant_id;

  UPDATE public.caixas
     SET valor_vendas = v_vendas,
         valor_sangrias = v_sangrias,
         valor_reforcos = v_suprimentos,
         valor_esperado = COALESCE(valor_abertura, 0) + v_dinheiro - v_sangrias + v_suprimentos,
         updated_at = now()
   WHERE id = v_caixa.id
     AND tenant_id = v_tenant_id;

  v_result := to_jsonb(v_mov);
  INSERT INTO public.pdv_cash_operation_requests (tenant_id, operation, idempotency_key, result)
  VALUES (v_tenant_id, v_tipo, v_key, v_result)
  ON CONFLICT (tenant_id, operation, idempotency_key)
  DO UPDATE SET result = EXCLUDED.result;
  RETURN v_result;
END
$function$;

-- Keep the old RPC for existing clients, but prevent it from bypassing the
-- mandatory sangria audit fields. Reforços remain backward compatible.
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_caixa(
  _caixa_id uuid,
  _tipo text,
  _valor numeric,
  _descricao text,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF upper(trim(COALESCE(_tipo, ''))) = 'SANGRIA' THEN
    RAISE EXCEPTION 'Sangrias devem ser registradas pelo formulário auditado';
  END IF;
  RETURN public.registrar_movimentacao_caixa_auditada(
    _caixa_id, _tipo, _valor, _descricao, now(), NULL,
    CASE WHEN upper(trim(COALESCE(_tipo, ''))) = 'REFORCO' THEN 'OUTROS' ELSE NULL END,
    NULL, _idempotency_key
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.fechar_caixa_auditado(
  _caixa_id uuid,
  _valor_contado_dinheiro numeric,
  _valor_conferido_pix numeric,
  _valor_conferido_cartao_credito numeric,
  _valor_conferido_cartao_debito numeric,
  _valor_conferido_outros numeric,
  _observacoes text,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_user_id uuid := auth.uid();
  v_key text := NULLIF(trim(COALESCE(_idempotency_key, '')), '');
  v_observacoes text := NULLIF(trim(COALESCE(_observacoes, '')), '');
  v_caixa public.caixas%ROWTYPE;
  v_result jsonb;
  v_dinheiro numeric := 0;
  v_pix numeric := 0;
  v_credito numeric := 0;
  v_debito numeric := 0;
  v_outros numeric := 0;
  v_vendas numeric := 0;
  v_sangrias numeric := 0;
  v_suprimentos numeric := 0;
  v_dinheiro_esperado numeric := 0;
  v_esperado numeric := 0;
  v_contado numeric := 0;
  v_dif_dinheiro numeric := 0;
  v_dif_pix numeric := 0;
  v_dif_credito numeric := 0;
  v_dif_debito numeric := 0;
  v_dif_outros numeric := 0;
  v_diferenca numeric := 0;
BEGIN
  IF NOT private.pdv_cash_write_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para fechar o caixa';
  END IF;
  IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada e empresa ativa são obrigatórias';
  END IF;
  IF _valor_contado_dinheiro IS NULL OR _valor_conferido_pix IS NULL
     OR _valor_conferido_cartao_credito IS NULL OR _valor_conferido_cartao_debito IS NULL
     OR _valor_conferido_outros IS NULL
     OR _valor_contado_dinheiro < 0 OR _valor_conferido_pix < 0
     OR _valor_conferido_cartao_credito < 0 OR _valor_conferido_cartao_debito < 0
     OR _valor_conferido_outros < 0
     OR _valor_contado_dinheiro::text IN ('NaN', 'Infinity', '-Infinity')
     OR _valor_conferido_pix::text IN ('NaN', 'Infinity', '-Infinity')
     OR _valor_conferido_cartao_credito::text IN ('NaN', 'Infinity', '-Infinity')
     OR _valor_conferido_cartao_debito::text IN ('NaN', 'Infinity', '-Infinity')
     OR _valor_conferido_outros::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Todos os valores conferidos devem ser informados e não podem ser negativos';
  END IF;
  IF v_key IS NULL OR v_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF _observacoes IS NOT NULL AND char_length(_observacoes) > 1000 THEN
    RAISE EXCEPTION 'As observações devem ter no máximo 1000 caracteres';
  END IF;

  SELECT r.result INTO v_result
    FROM public.pdv_cash_operation_requests r
   WHERE r.tenant_id = v_tenant_id
     AND r.operation = 'FECHAR'
     AND r.idempotency_key = v_key
   FOR UPDATE;
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;

  SELECT c.* INTO v_caixa
    FROM public.caixas c
   WHERE c.id = _caixa_id
     AND c.tenant_id = v_tenant_id
     AND c.status = 'ABERTO'
   FOR UPDATE;
  IF NOT FOUND THEN
    SELECT c.* INTO v_caixa
      FROM public.caixas c
     WHERE c.id = _caixa_id AND c.tenant_id = v_tenant_id;
    IF FOUND AND v_caixa.status = 'FECHADO' THEN RETURN to_jsonb(v_caixa); END IF;
    RAISE EXCEPTION 'O caixa não está aberto ou não pertence à empresa ativa';
  END IF;

  -- Do not close while a provider payment can still become a ledger movement.
  -- PIX creation takes the same cash-row lock, so this check is race-safe.
  IF EXISTS (
    SELECT 1
      FROM public.pdv_pagamentos p
     WHERE p.caixa_id = v_caixa.id
       AND p.tenant_id = v_tenant_id
       AND p.status IN ('PENDENTE', 'PROCESSANDO')
  ) THEN
    RAISE EXCEPTION 'Há pagamento aguardando confirmação. Aguarde a conciliação ou cancele o pagamento antes de fechar o caixa';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'PIX' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'PIX' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_CREDITO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_CREDITO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_DEBITO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_DEBITO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' THEN CASE WHEN m.evento_pagamento = 'ESTORNO' THEN -m.valor ELSE m.valor END ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'SANGRIA' THEN m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'REFORCO' THEN m.valor ELSE 0 END), 0)
  INTO v_dinheiro, v_pix, v_credito, v_debito, v_outros, v_vendas, v_sangrias, v_suprimentos
  FROM public.caixa_movimentacoes m
  WHERE m.caixa_id = v_caixa.id
    AND m.tenant_id = v_tenant_id;

  v_dinheiro_esperado := round(v_caixa.valor_abertura + v_dinheiro - v_sangrias + v_suprimentos, 2);
  v_esperado := round(v_dinheiro_esperado + v_pix + v_credito + v_debito + v_outros, 2);
  v_contado := round(_valor_contado_dinheiro + _valor_conferido_pix + _valor_conferido_cartao_credito + _valor_conferido_cartao_debito + _valor_conferido_outros, 2);
  v_dif_dinheiro := round(_valor_contado_dinheiro - v_dinheiro_esperado, 2);
  v_dif_pix := round(_valor_conferido_pix - v_pix, 2);
  v_dif_credito := round(_valor_conferido_cartao_credito - v_credito, 2);
  v_dif_debito := round(_valor_conferido_cartao_debito - v_debito, 2);
  v_dif_outros := round(_valor_conferido_outros - v_outros, 2);
  v_diferenca := round(v_contado - v_esperado, 2);

  IF (abs(v_dif_dinheiro) > 0.009 OR abs(v_dif_pix) > 0.009
      OR abs(v_dif_credito) > 0.009 OR abs(v_dif_debito) > 0.009
      OR abs(v_dif_outros) > 0.009)
     AND char_length(COALESCE(v_observacoes, '')) < 5 THEN
    RAISE EXCEPTION 'Justifique as divergências por forma de pagamento (mínimo 5 caracteres)';
  END IF;

  UPDATE public.caixas
     SET status = 'FECHADO',
         data_fechamento = now(),
         fechado_por = v_user_id,
         valor_vendas = v_vendas,
         valor_sangrias = v_sangrias,
         valor_reforcos = v_suprimentos,
         valor_esperado = v_esperado,
         valor_contado = v_contado,
         diferenca = v_diferenca,
         observacoes = v_observacoes,
         fechamento_resumo = jsonb_build_object(
           'dinheiro_esperado', v_dinheiro_esperado,
           'pix_esperado', v_pix,
           'cartao_credito_esperado', v_credito,
           'cartao_debito_esperado', v_debito,
           'outros_esperado', v_outros,
           'dinheiro_contado', round(_valor_contado_dinheiro, 2),
           'pix_conferido', round(_valor_conferido_pix, 2),
           'cartao_credito_conferido', round(_valor_conferido_cartao_credito, 2),
           'cartao_debito_conferido', round(_valor_conferido_cartao_debito, 2),
           'outros_conferido', round(_valor_conferido_outros, 2),
           'diferenca_dinheiro', v_dif_dinheiro,
           'diferenca_pix', v_dif_pix,
           'diferenca_cartao_credito', v_dif_credito,
           'diferenca_cartao_debito', v_dif_debito,
           'diferenca_outros', v_dif_outros
         ),
         updated_at = now()
   WHERE id = v_caixa.id
     AND tenant_id = v_tenant_id;

  SELECT c.* INTO v_caixa FROM public.caixas c WHERE c.id = _caixa_id AND c.tenant_id = v_tenant_id;
  v_result := to_jsonb(v_caixa);
  INSERT INTO public.pdv_cash_operation_requests (tenant_id, operation, idempotency_key, result)
  VALUES (v_tenant_id, 'FECHAR', v_key, v_result)
  ON CONFLICT (tenant_id, operation, idempotency_key)
  DO UPDATE SET result = EXCLUDED.result;
  RETURN v_result;
END
$function$;

-- Backward-compatible bridge. The authenticated path still receives the
-- server-side validations, while current clients send all five counted totals.
CREATE OR REPLACE FUNCTION public.fechar_caixa(
  _caixa_id uuid,
  _valor_contado_dinheiro numeric,
  _valor_conferido_pix numeric,
  _valor_conferido_cartao_credito numeric,
  _valor_conferido_cartao_debito numeric,
  _observacoes text,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT public.fechar_caixa_auditado(
    _caixa_id,
    _valor_contado_dinheiro,
    _valor_conferido_pix,
    _valor_conferido_cartao_credito,
    _valor_conferido_cartao_debito,
    0,
    _observacoes,
    _idempotency_key
  );
$function$;

REVOKE ALL ON FUNCTION public.registrar_movimentacao_caixa_auditada(uuid, text, numeric, text, timestamptz, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_caixa_auditada(uuid, text, numeric, text, timestamptz, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fechar_caixa_auditado(uuid, numeric, numeric, numeric, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_caixa_auditado(uuid, numeric, numeric, numeric, numeric, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.registrar_movimentacao_caixa(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_caixa(uuid, text, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fechar_caixa(uuid, numeric, numeric, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fechar_caixa(uuid, numeric, numeric, numeric, numeric, text, text) TO authenticated;
