-- Um pagamento combinado é uma única operação: todas as formas são gravadas
-- ou a transação inteira falha. Apenas a Edge Function autenticada pode chamar.
CREATE OR REPLACE FUNCTION public.registrar_pagamentos_pdv_lote(
  _ordem_servico_id uuid, _caixa_id uuid, _momento text,
  _pagamentos jsonb, _idempotency_key text, _criado_por uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_order public.ordens_servico%ROWTYPE;
  v_payment jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_fingerprint text;
  v_existing record;
  v_index integer := 0;
  v_first_id uuid;
BEGIN
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,180}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF _pagamentos IS NULL OR jsonb_typeof(_pagamentos) <> 'array'
     OR jsonb_array_length(_pagamentos) NOT BETWEEN 2 AND 4 THEN
    RAISE EXCEPTION 'Informe entre duas e quatro formas de pagamento';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key, 0));
  SELECT * INTO v_order FROM public.ordens_servico
  WHERE id = _ordem_servico_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROL não encontrado'; END IF;
  v_fingerprint := md5(jsonb_build_array(
    _ordem_servico_id, _caixa_id, _momento, _pagamentos, _criado_por
  )::text);
  SELECT p.metadata->>'batch_hash' AS batch_hash, p.caixa_id, p.criado_por
    INTO v_existing
  FROM public.pdv_pagamentos p
  WHERE p.tenant_id = v_order.tenant_id
    AND p.idempotency_key = _idempotency_key || ':part:0';
  IF FOUND AND (v_existing.batch_hash IS DISTINCT FROM v_fingerprint
      OR v_existing.caixa_id IS DISTINCT FROM _caixa_id
      OR v_existing.criado_por IS DISTINCT FROM _criado_por) THEN
    RAISE EXCEPTION 'Esta chave já pertence a outro recebimento';
  END IF;

  FOR v_payment IN SELECT value FROM jsonb_array_elements(_pagamentos) LOOP
    IF jsonb_typeof(v_payment) <> 'object' THEN
      RAISE EXCEPTION 'Forma de pagamento inválida';
    END IF;
    v_result := public.registrar_pagamento_pdv(
      _ordem_servico_id, _caixa_id, upper(v_payment->>'metodo'),
      (v_payment->>'valor')::numeric,
      nullif(v_payment->>'valor_recebido','')::numeric,
      coalesce((v_payment->>'parcelas')::integer, 1),
      v_payment->>'bandeira', v_payment->>'nsu',
      v_payment->>'codigo_autorizacao', _momento,
      _idempotency_key || ':part:' || v_index, _criado_por
    );
    v_results := v_results || jsonb_build_array(v_result);
    IF v_index = 0 THEN v_first_id := (v_result->>'paymentId')::uuid; END IF;
    v_index := v_index + 1;
  END LOOP;
  UPDATE public.pdv_pagamentos
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'batch_hash', v_fingerprint, 'batch_count', v_index
  )
  WHERE id = v_first_id AND tenant_id = v_order.tenant_id;
  RETURN jsonb_build_object('payments', v_results, 'summary', v_result);
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pagamentos_pdv_lote(uuid,uuid,text,jsonb,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pagamentos_pdv_lote(uuid,uuid,text,jsonb,text,uuid)
  TO service_role;

-- O fechamento do ROL recebe pagamento único ou um array de formas.
-- A função existente contém cálculo de preço, desconto, delivery e idempotência;
-- substituir apenas os blocos de pagamento preserva essas regras.
DO $migration$
DECLARE
  definition text;
  old_fragment text;
  new_fragment text;
BEGIN
  definition := pg_get_functiondef('public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)'::regprocedure);
  old_fragment := 'v_valor_pagamento numeric(12,2); v_pagamento_resultado jsonb := NULL;';
  new_fragment := 'v_valor_pagamento numeric(12,2); v_pagamentos jsonb; v_pagamento_item jsonb; v_total_pagamentos numeric(12,2) := 0; v_indice integer := 0; v_pagamento_resultado jsonb := NULL;';
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'As variáveis de pagamento do fechamento mudaram';
  END IF;
  definition := replace(definition, old_fragment, new_fragment);

  old_fragment := $old$BEGIN
  IF v_fee < 0$old$;
  new_fragment := $new$BEGIN
  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    IF jsonb_typeof(_pagamento) = 'object' THEN
      v_pagamentos := jsonb_build_array(_pagamento);
    ELSIF jsonb_typeof(_pagamento) = 'array' THEN
      v_pagamentos := _pagamento;
    ELSE
      RAISE EXCEPTION 'Pagamento inválido';
    END IF;
    IF jsonb_array_length(v_pagamentos) NOT BETWEEN 1 AND 4 THEN
      RAISE EXCEPTION 'Informe entre uma e quatro formas de pagamento';
    END IF;
  END IF;
  IF v_fee < 0$new$;
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'O início do fechamento mudou';
  END IF;
  definition := replace(definition, old_fragment, new_fragment);

  old_fragment := $old$IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    BEGIN v_valor_pagamento := round(coalesce(nullif(_pagamento->>'valor','')::numeric,v_total),2); EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Valor do pagamento inválido'; END;
    IF v_valor_pagamento IS NULL OR v_valor_pagamento <= 0 OR v_valor_pagamento > v_total THEN RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero e não pode ultrapassar o total do ROL'; END IF;
  END IF;$old$;
  new_fragment := $new$IF v_pagamentos IS NOT NULL THEN
    FOR v_pagamento_item IN SELECT value FROM jsonb_array_elements(v_pagamentos) LOOP
      IF jsonb_typeof(v_pagamento_item) <> 'object' THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
      BEGIN
        v_valor_pagamento := round(coalesce(nullif(v_pagamento_item->>'valor','')::numeric,
          CASE WHEN jsonb_array_length(v_pagamentos) = 1 THEN v_total ELSE NULL END), 2);
      EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Valor do pagamento inválido'; END;
      IF v_valor_pagamento IS NULL OR v_valor_pagamento::text IN ('NaN','Infinity','-Infinity')
         OR v_valor_pagamento <= 0 THEN RAISE EXCEPTION 'Valor do pagamento inválido'; END IF;
      v_total_pagamentos := v_total_pagamentos + v_valor_pagamento;
    END LOOP;
    IF v_total_pagamentos > v_total THEN
      RAISE EXCEPTION 'A soma dos pagamentos não pode ultrapassar o total do ROL';
    END IF;
  END IF;$new$;
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A validação de pagamento do fechamento mudou';
  END IF;
  definition := replace(definition, old_fragment, new_fragment);

  old_fragment := $old$IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    v_pagamento_resultado := public.registrar_pagamento_pdv(v_os.id,_caixa_id,upper(_pagamento->>'metodo'),v_valor_pagamento,CASE WHEN _pagamento ? 'valor_recebido' THEN (_pagamento->>'valor_recebido')::numeric ELSE NULL END,coalesce((_pagamento->>'parcelas')::integer,1),_pagamento->>'bandeira',_pagamento->>'nsu',_pagamento->>'codigo_autorizacao','ENTRADA',_idempotency_key || ':payment',_criado_por);
  END IF;$old$;
  new_fragment := $new$IF v_pagamentos IS NOT NULL THEN
    FOR v_pagamento_item IN SELECT value FROM jsonb_array_elements(v_pagamentos) LOOP
      v_valor_pagamento := round(coalesce(nullif(v_pagamento_item->>'valor','')::numeric, v_total), 2);
      v_pagamento_resultado := public.registrar_pagamento_pdv(
        v_os.id, _caixa_id, upper(v_pagamento_item->>'metodo'), v_valor_pagamento,
        nullif(v_pagamento_item->>'valor_recebido','')::numeric,
        coalesce((v_pagamento_item->>'parcelas')::integer, 1),
        v_pagamento_item->>'bandeira', v_pagamento_item->>'nsu',
        v_pagamento_item->>'codigo_autorizacao', 'ENTRADA',
        _idempotency_key || ':payment' || CASE WHEN jsonb_array_length(v_pagamentos) > 1 THEN ':' || v_indice ELSE '' END,
        _criado_por
      );
      v_indice := v_indice + 1;
    END LOOP;
  END IF;$new$;
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'O registro de pagamento do fechamento mudou';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);
END;
$migration$;

-- CREATE OR REPLACE preserva a ACL, mas declare a fronteira explicitamente.
REVOKE ALL ON FUNCTION public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)
  TO service_role;
