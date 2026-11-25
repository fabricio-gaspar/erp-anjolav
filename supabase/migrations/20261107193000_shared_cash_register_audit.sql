-- Shared PDV cash register workflow.
-- The register is tenant-scoped, opened once per identifier, and reused by all
-- authenticated operators until an authorized user closes it.

ALTER TABLE public.caixas
  ADD COLUMN IF NOT EXISTS identificador_caixa text NOT NULL DEFAULT 'principal',
  ADD COLUMN IF NOT EXISTS aberto_por uuid,
  ADD COLUMN IF NOT EXISTS fechado_por uuid,
  ADD COLUMN IF NOT EXISTS fechamento_resumo jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS criado_por uuid;

CREATE TABLE IF NOT EXISTS public.pdv_cash_operation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT private.current_tenant_id(),
  operation text NOT NULL,
  idempotency_key text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_cash_operation_requests_key_unique UNIQUE (tenant_id, operation, idempotency_key)
);

ALTER TABLE public.pdv_cash_operation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pdv_cash_operation_requests FROM anon, authenticated;
DROP POLICY IF EXISTS pdv_cash_operation_requests_block_direct_access ON public.pdv_cash_operation_requests;
CREATE POLICY pdv_cash_operation_requests_block_direct_access
  ON public.pdv_cash_operation_requests
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE UNIQUE INDEX IF NOT EXISTS caixas_one_open_per_tenant_identifier_idx
  ON public.caixas (tenant_id, identificador_caixa)
  WHERE status = 'ABERTO';

CREATE INDEX IF NOT EXISTS caixa_movimentacoes_tenant_created_at_idx
  ON public.caixa_movimentacoes (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.set_cash_movement_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  NEW.criado_por := COALESCE(NEW.criado_por, auth.uid());
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_cash_movement_actor ON public.caixa_movimentacoes;
CREATE TRIGGER set_cash_movement_actor
BEFORE INSERT OR UPDATE ON public.caixa_movimentacoes
FOR EACH ROW EXECUTE FUNCTION private.set_cash_movement_actor();

DO $audit$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['caixas', 'caixa_movimentacoes', 'itens_ordem_servico'] LOOP
    IF to_regclass(format('public.%s', table_name)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_mutation ON public.%I', table_name);
      EXECUTE format(
        'CREATE TRIGGER audit_mutation AFTER INSERT OR DELETE OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.write_audit_event()',
        table_name
      );
    END IF;
  END LOOP;
END
$audit$;

CREATE OR REPLACE FUNCTION private.pdv_cash_access_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND private.has_any_module_access(ARRAY['caixa', 'faturamento', 'relatorios']::text[]);
$function$;

CREATE OR REPLACE FUNCTION public.abrir_caixa(
  _valor_abertura numeric,
  _identificador_caixa text DEFAULT 'principal',
  _idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_user_id uuid := auth.uid();
  v_funcionario_id uuid;
  v_operador text;
  v_identificador text := NULLIF(trim(COALESCE(_identificador_caixa, '')), '');
  v_key text := NULLIF(trim(COALESCE(_idempotency_key, '')), '');
  v_caixa public.caixas%ROWTYPE;
  v_result jsonb;
BEGIN
  IF NOT private.pdv_cash_access_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para operar o caixa';
  END IF;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Empresa ativa não encontrada';
  END IF;
  IF _valor_abertura IS NULL OR _valor_abertura < 0 THEN
    RAISE EXCEPTION 'O valor de abertura não pode ser negativo';
  END IF;
  IF v_identificador IS NULL THEN
    v_identificador := 'principal';
  END IF;

  -- Serialize first-open races so two computers cannot create competing openings.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_identificador, 0));

  IF v_key IS NOT NULL THEN
    SELECT r.result
      INTO v_result
      FROM public.pdv_cash_operation_requests r
     WHERE r.tenant_id = v_tenant_id
       AND r.operation = 'ABRIR'
       AND r.idempotency_key = v_key
     FOR UPDATE;
    IF v_result IS NOT NULL THEN
      RETURN v_result;
    END IF;
  END IF;

  SELECT c.*
    INTO v_caixa
    FROM public.caixas c
   WHERE c.tenant_id = v_tenant_id
     AND c.identificador_caixa = v_identificador
     AND c.status = 'ABERTO'
   ORDER BY c.data_abertura DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    SELECT f.id, f.nome
      INTO v_funcionario_id, v_operador
      FROM public.funcionarios f
     WHERE f.tenant_id = v_tenant_id
       AND f.user_id = v_user_id
       AND f.ativo = true
     ORDER BY f.created_at
     LIMIT 1;

    v_operador := COALESCE(
      v_operador,
      NULLIF(split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1), ''),
      'Usuário autenticado'
    );

    INSERT INTO public.caixas (
      identificador_caixa,
      operador,
      operador_id,
      aberto_por,
      valor_abertura,
      status,
      tenant_id
    ) VALUES (
      v_identificador,
      v_operador,
      v_funcionario_id,
      v_user_id,
      _valor_abertura,
      'ABERTO',
      v_tenant_id
    )
    RETURNING * INTO v_caixa;
  END IF;

  v_result := to_jsonb(v_caixa);

  IF v_key IS NOT NULL THEN
    INSERT INTO public.pdv_cash_operation_requests (tenant_id, operation, idempotency_key, result)
    VALUES (v_tenant_id, 'ABRIR', v_key, v_result)
    ON CONFLICT (tenant_id, operation, idempotency_key)
    DO UPDATE SET result = EXCLUDED.result;
  END IF;

  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION public.obter_resumo_caixa(_caixa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_caixa public.caixas%ROWTYPE;
  v_dinheiro numeric := 0;
  v_pix numeric := 0;
  v_credito numeric := 0;
  v_debito numeric := 0;
  v_outros numeric := 0;
  v_vendas numeric := 0;
  v_sangrias numeric := 0;
  v_suprimentos numeric := 0;
BEGIN
  IF NOT private.pdv_cash_access_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o caixa';
  END IF;

  SELECT c.* INTO v_caixa
    FROM public.caixas c
   WHERE c.id = _caixa_id
     AND c.tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, 'DINHEIRO')) = 'DINHEIRO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'PIX' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'PIX' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_CREDITO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_CREDITO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_DEBITO' THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) = 'CARTAO_DEBITO' THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' AND COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'CONFIRMACAO' AND upper(COALESCE(m.forma_pagamento, '')) NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN m.valor WHEN m.tipo = 'VENDA' AND m.evento_pagamento = 'ESTORNO' AND upper(COALESCE(m.forma_pagamento, '')) NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO') THEN -m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'VENDA' THEN CASE WHEN COALESCE(m.evento_pagamento, 'CONFIRMACAO') = 'ESTORNO' THEN -m.valor ELSE m.valor END ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'SANGRIA' THEN m.valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN m.tipo = 'REFORCO' THEN m.valor ELSE 0 END), 0)
  INTO v_dinheiro, v_pix, v_credito, v_debito, v_outros, v_vendas, v_sangrias, v_suprimentos
  FROM public.caixa_movimentacoes m
  WHERE m.caixa_id = _caixa_id
    AND m.tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'caixaId', v_caixa.id,
    'status', v_caixa.status,
    'identificador', v_caixa.identificador_caixa,
    'operador', v_caixa.operador,
    'abertoEm', v_caixa.data_abertura,
    'dinheiro', v_dinheiro + COALESCE(v_caixa.valor_abertura, 0) - v_sangrias + v_suprimentos,
    'pix', v_pix,
    'cartaoCredito', v_credito,
    'cartaoDebito', v_debito,
    'outros', v_outros,
    'vendasLiquidas', v_vendas,
    'sangrias', v_sangrias,
    'suprimentos', v_suprimentos
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_caixa(
  _caixa_id uuid,
  _tipo text,
  _valor numeric,
  _descricao text,
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
  v_caixa public.caixas%ROWTYPE;
  v_mov public.caixa_movimentacoes%ROWTYPE;
  v_result jsonb;
  v_dinheiro numeric := 0;
  v_sangrias numeric := 0;
  v_suprimentos numeric := 0;
  v_vendas numeric := 0;
BEGIN
  IF NOT private.pdv_cash_access_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para movimentar o caixa';
  END IF;
  IF _valor IS NULL OR _valor <= 0 THEN
    RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero';
  END IF;
  IF v_tipo NOT IN ('SANGRIA', 'REFORCO') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido';
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

  SELECT c.* INTO v_caixa
    FROM public.caixas c
   WHERE c.id = _caixa_id
     AND c.tenant_id = v_tenant_id
     AND c.status = 'ABERTO'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O caixa não está aberto ou não pertence à empresa ativa';
  END IF;

  INSERT INTO public.caixa_movimentacoes (
    caixa_id, tipo, valor, descricao, forma_pagamento, criado_por, tenant_id
  ) VALUES (
    v_caixa.id, v_tipo, _valor, NULLIF(trim(_descricao), ''), 'DINHEIRO', v_user_id, v_tenant_id
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
   WHERE id = v_caixa.id;

  v_result := to_jsonb(v_mov);
  IF v_key IS NOT NULL THEN
    INSERT INTO public.pdv_cash_operation_requests (tenant_id, operation, idempotency_key, result)
    VALUES (v_tenant_id, v_tipo, v_key, v_result)
    ON CONFLICT (tenant_id, operation, idempotency_key)
    DO UPDATE SET result = EXCLUDED.result;
  END IF;
  RETURN v_result;
END
$function$;

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_user_id uuid := auth.uid();
  v_key text := NULLIF(trim(COALESCE(_idempotency_key, '')), '');
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
  v_esperado numeric := 0;
  v_contado numeric := 0;
  v_diferenca numeric := 0;
BEGIN
  IF NOT private.pdv_cash_access_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para fechar o caixa';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT r.result INTO v_result
      FROM public.pdv_cash_operation_requests r
     WHERE r.tenant_id = v_tenant_id
       AND r.operation = 'FECHAR'
       AND r.idempotency_key = v_key
     FOR UPDATE;
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  END IF;

  SELECT c.* INTO v_caixa
    FROM public.caixas c
   WHERE c.id = _caixa_id
     AND c.tenant_id = v_tenant_id
     AND c.status = 'ABERTO'
   FOR UPDATE;
  IF NOT FOUND THEN
    SELECT c.* INTO v_caixa FROM public.caixas c WHERE c.id = _caixa_id AND c.tenant_id = v_tenant_id;
    IF FOUND AND v_caixa.status = 'FECHADO' THEN RETURN to_jsonb(v_caixa); END IF;
    RAISE EXCEPTION 'O caixa não está aberto ou não pertence à empresa ativa';
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

  v_esperado := v_caixa.valor_abertura + v_dinheiro - v_sangrias + v_suprimentos + v_pix + v_credito + v_debito + v_outros;
  v_contado := COALESCE(_valor_contado_dinheiro, 0) + COALESCE(_valor_conferido_pix, 0) + COALESCE(_valor_conferido_cartao_credito, 0) + COALESCE(_valor_conferido_cartao_debito, 0);
  v_diferenca := v_contado - v_esperado;

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
         observacoes = NULLIF(trim(COALESCE(_observacoes, '')), ''),
         fechamento_resumo = jsonb_build_object(
           'dinheiro_esperado', v_caixa.valor_abertura + v_dinheiro - v_sangrias + v_suprimentos,
           'pix_esperado', v_pix,
           'cartao_credito_esperado', v_credito,
           'cartao_debito_esperado', v_debito,
           'outros_esperado', v_outros,
           'dinheiro_contado', COALESCE(_valor_contado_dinheiro, 0),
           'pix_conferido', COALESCE(_valor_conferido_pix, 0),
           'cartao_credito_conferido', COALESCE(_valor_conferido_cartao_credito, 0),
           'cartao_debito_conferido', COALESCE(_valor_conferido_cartao_debito, 0)
         ),
         updated_at = now()
   WHERE id = v_caixa.id;

  SELECT c.* INTO v_caixa FROM public.caixas c WHERE c.id = _caixa_id;
  v_result := to_jsonb(v_caixa);
  IF v_key IS NOT NULL THEN
    INSERT INTO public.pdv_cash_operation_requests (tenant_id, operation, idempotency_key, result)
    VALUES (v_tenant_id, 'FECHAR', v_key, v_result)
    ON CONFLICT (tenant_id, operation, idempotency_key)
    DO UPDATE SET result = EXCLUDED.result;
  END IF;
  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_caixas_fechados(
  _inicio timestamptz,
  _fim_exclusivo timestamptz,
  _pagina integer DEFAULT 1,
  _tamanho_pagina integer DEFAULT 12,
  _busca text DEFAULT NULL,
  _diferenca text DEFAULT 'todos'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_page integer := GREATEST(COALESCE(_pagina, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(_tamanho_pagina, 12), 1), 100);
  v_offset integer := (v_page - 1) * v_page_size;
  v_total integer := 0;
  v_pages integer := 1;
  v_items jsonb := '[]'::jsonb;
  v_summary jsonb;
BEGIN
  IF NOT private.pdv_cash_access_allowed() THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o histórico de caixas';
  END IF;

  WITH filtered AS (
    SELECT c.*
      FROM public.caixas c
     WHERE c.tenant_id = v_tenant_id
       AND c.status = 'FECHADO'
       AND c.data_fechamento >= _inicio
       AND c.data_fechamento < _fim_exclusivo
       AND (
         NULLIF(trim(COALESCE(_busca, '')), '') IS NULL
         OR c.operador ILIKE '%' || trim(_busca) || '%'
         OR c.identificador_caixa ILIKE '%' || trim(_busca) || '%'
       )
       AND (
         COALESCE(_diferenca, 'todos') = 'todos'
         OR (COALESCE(_diferenca, 'todos') = 'com' AND abs(COALESCE(c.diferenca, 0)) > 0.009)
         OR (COALESCE(_diferenca, 'todos') = 'sem' AND abs(COALESCE(c.diferenca, 0)) <= 0.009)
         OR (COALESCE(_diferenca, 'todos') = 'sobra' AND COALESCE(c.diferenca, 0) > 0.009)
         OR (COALESCE(_diferenca, 'todos') = 'falta' AND COALESCE(c.diferenca, 0) < -0.009)
       )
  )
  SELECT count(*) INTO v_total FROM filtered;
  v_pages := GREATEST(CEIL(v_total::numeric / v_page_size)::integer, 1);

  WITH page_rows AS (
    SELECT c.*
      FROM public.caixas c
     WHERE c.tenant_id = v_tenant_id
       AND c.status = 'FECHADO'
       AND c.data_fechamento >= _inicio
       AND c.data_fechamento < _fim_exclusivo
       AND (
         NULLIF(trim(COALESCE(_busca, '')), '') IS NULL
         OR c.operador ILIKE '%' || trim(_busca) || '%'
         OR c.identificador_caixa ILIKE '%' || trim(_busca) || '%'
       )
       AND (
         COALESCE(_diferenca, 'todos') = 'todos'
         OR (COALESCE(_diferenca, 'todos') = 'com' AND abs(COALESCE(c.diferenca, 0)) > 0.009)
         OR (COALESCE(_diferenca, 'todos') = 'sem' AND abs(COALESCE(c.diferenca, 0)) <= 0.009)
         OR (COALESCE(_diferenca, 'todos') = 'sobra' AND COALESCE(c.diferenca, 0) > 0.009)
         OR (COALESCE(_diferenca, 'todos') = 'falta' AND COALESCE(c.diferenca, 0) < -0.009)
       )
     ORDER BY c.data_fechamento DESC, c.id DESC
     OFFSET v_offset
     LIMIT v_page_size
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(page_rows) ORDER BY page_rows.data_fechamento DESC, page_rows.id DESC), '[]'::jsonb)
    INTO v_items
    FROM page_rows;

  SELECT jsonb_build_object(
    'quantidade', count(*),
    'quantidade_com_diferenca', count(*) FILTER (WHERE abs(COALESCE(c.diferenca, 0)) > 0.009),
    'total_vendas', COALESCE(sum(c.valor_vendas), 0),
    'media_por_caixa', COALESCE(avg(c.valor_vendas), 0),
    'total_sangrias', COALESCE(sum(c.valor_sangrias), 0),
    'total_reforcos', COALESCE(sum(c.valor_reforcos), 0),
    'total_diferencas', COALESCE(sum(c.diferenca), 0),
    'dinheiro', 0,
    'pix', 0,
    'cartao_credito', 0,
    'cartao_debito', 0,
    'outros', 0
  ) INTO v_summary
  FROM public.caixas c
  WHERE c.tenant_id = v_tenant_id
    AND c.status = 'FECHADO'
    AND c.data_fechamento >= _inicio
    AND c.data_fechamento < _fim_exclusivo;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'pagina', v_page,
    'tamanho_pagina', v_page_size,
    'paginas', v_pages,
    'summary', v_summary
  );
END
$function$;

REVOKE ALL ON FUNCTION public.abrir_caixa(numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obter_resumo_caixa(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_movimentacao_caixa(uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fechar_caixa(uuid, numeric, numeric, numeric, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consultar_diretorio_caixas_fechados(timestamptz, timestamptz, integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abrir_caixa(numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.obter_resumo_caixa(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.registrar_movimentacao_caixa(uuid, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fechar_caixa(uuid, numeric, numeric, numeric, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.consultar_diretorio_caixas_fechados(timestamptz, timestamptz, integer, integer, text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.abrir_caixa(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obter_resumo_caixa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_caixa(uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_caixa(uuid, numeric, numeric, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_diretorio_caixas_fechados(timestamptz, timestamptz, integer, integer, text, text) TO authenticated;
