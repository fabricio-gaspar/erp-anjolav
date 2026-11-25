-- Permite receber apenas parte do ROL na criação sem perder a validação no servidor.
-- O valor omitido mantém compatibilidade e representa quitação integral.
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
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
  v_valor_pagamento numeric(12,2);
  v_pagamento_resultado jsonb := NULL;
  v_existente public.ordens_servico%ROWTYPE;
  v_condicao text;
  v_config jsonb;
  v_lancamento uuid;
  v_fingerprint text;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = _cliente_id FOR SHARE;
  IF NOT FOUND OR NOT coalesce(v_cliente.ativo, false) OR v_cliente.classificacao NOT IN ('industrial','residencial') THEN
    RAISE EXCEPTION 'Cliente inválido ou inativo';
  END IF;
  IF NOT private.pdv_actor_allowed(_criado_por, v_cliente.tenant_id, v_cliente.classificacao, ARRAY['caixa','faturamento']) THEN
    RAISE EXCEPTION 'Sem permissão para atender este cliente';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key, 0));
  v_fingerprint := md5(jsonb_build_array(_cliente_id,_caixa_id,_data_previsao_entrega,_urgente,
    _percentual_urgencia,_valor_desconto,_motorista_id,_veiculo_id,_itens,_pagamento,_criado_por)::text);
  SELECT * INTO v_existente FROM public.ordens_servico WHERE pdv_idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existente.tenant_id <> v_cliente.tenant_id OR v_existente.cliente_id <> _cliente_id
       OR v_existente.pdv_request_hash IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'Chave de idempotência usada em outro atendimento';
    END IF;
    RETURN jsonb_build_object('order',jsonb_build_object(
      'id',v_existente.id,'number',v_existente.numero,'total',v_existente.valor_total,
      'paymentStatus',v_existente.status_pagamento,'deliveryDate',v_existente.data_previsao_entrega),
      'idempotent',true);
  END IF;
  SELECT to_jsonb(config) - 'id' - 'tenant_id' - 'cliente_id' - 'created_at' - 'updated_at'
    INTO v_config FROM public.configuracoes_pagamento_cliente config
    WHERE cliente_id = _cliente_id AND tenant_id = v_cliente.tenant_id FOR SHARE;
  v_condicao := coalesce(v_config->>'condicao_pagamento','retirada');
  IF v_condicao NOT IN ('entrada','retirada','faturado') THEN
    RAISE EXCEPTION 'Revise a condição de pagamento no cadastro do cliente';
  END IF;
  IF v_condicao = 'entrada' AND (_pagamento IS NULL OR _pagamento = 'null'::jsonb) THEN
    RAISE EXCEPTION 'Este cliente exige pagamento na entrada';
  END IF;
  IF v_condicao = 'faturado' AND (_pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb) THEN
    RAISE EXCEPTION 'Cliente faturado: receba pelo fechamento da fatura';
  END IF;
  IF v_condicao = 'faturado' AND (coalesce(_valor_desconto,0) <> 0 OR coalesce(_percentual_urgencia,0) <> 0) THEN
    RAISE EXCEPTION 'No atendimento faturado utilize os preços da tabela do cliente';
  END IF;
  IF coalesce(_valor_desconto,0) > 0 AND NOT private.pdv_actor_allowed(
    _criado_por,v_cliente.tenant_id,v_cliente.classificacao,ARRAY['alterar_condicoes_comerciais']) THEN
    RAISE EXCEPTION 'Sem permissão para conceder desconto';
  END IF;
  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    IF NOT private.pdv_actor_allowed(_criado_por,v_cliente.tenant_id,v_cliente.classificacao,ARRAY['caixa']) THEN
      RAISE EXCEPTION 'Sem permissão para receber pagamentos';
    END IF;
    SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id AND tenant_id = v_cliente.tenant_id FOR UPDATE;
    IF NOT FOUND OR v_caixa.status <> 'ABERTO' THEN RAISE EXCEPTION 'Abra um caixa para receber o pagamento'; END IF;
  END IF;
  IF _data_previsao_entrega IS NULL OR _data_previsao_entrega < current_date THEN
    RAISE EXCEPTION 'Previsão de entrega inválida';
  END IF;
  IF _percentual_urgencia IS NULL OR _percentual_urgencia::text IN ('NaN','Infinity','-Infinity') OR _percentual_urgencia < 0 OR _percentual_urgencia > 100 OR
     (NOT coalesce(_urgente, false) AND _percentual_urgencia <> 0) THEN
    RAISE EXCEPTION 'Percentual de urgência inválido';
  END IF;
  IF _valor_desconto IS NULL OR _valor_desconto::text IN ('NaN','Infinity','-Infinity') OR _valor_desconto < 0 THEN RAISE EXCEPTION 'Desconto inválido'; END IF;
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 OR jsonb_array_length(_itens) > 200 THEN
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
    IF v_quantidade IS NULL OR v_quantidade::text IN ('NaN','Infinity','-Infinity') OR v_quantidade <= 0 OR v_quantidade > 999 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

    SELECT p.* INTO v_produto FROM public.produtos p
    WHERE p.id = (v_item->>'produto_id')::uuid
      AND p.tenant_id = v_cliente.tenant_id AND p.status = 'ativo'
      AND (p.unidade_negocio IN (CASE WHEN v_cliente.classificacao = 'industrial' THEN 'ID1' ELSE 'ID2' END, 'ambos') OR p.unidade_negocio IS NULL)
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto incompatível com a área do cliente ou inativo'; END IF;

    IF lower(coalesce(v_produto.unidade,'un')) NOT IN ('kg','m','mt','metro','metros','m²','m2','litro','l') AND trunc(v_quantidade) <> v_quantidade THEN
      RAISE EXCEPTION 'Este produto exige quantidade inteira';
    END IF;
    SELECT round((CASE WHEN v_cliente.tabela_preco_tipo = 'personalizada' THEN pe.preco_especial ELSE v_produto.preco END)::numeric, 2)
    INTO v_preco
    FROM (SELECT 1) source
    LEFT JOIN public.precos_especiais pe
      ON pe.cliente_id = _cliente_id AND pe.tenant_id = v_cliente.tenant_id
     AND pe.produto_id = v_produto.id
     AND v_cliente.tabela_preco_tipo = 'personalizada'
    LIMIT 1;
    IF v_preco IS NULL OR v_preco::text IN ('NaN','Infinity','-Infinity') OR v_preco < 0 THEN RAISE EXCEPTION 'Produto sem preço válido na tabela do cliente'; END IF;
    v_subtotal := round(v_preco * v_quantidade, 2);
    v_total_itens := v_total_itens + v_subtotal;
    v_itens_calculados := v_itens_calculados || jsonb_build_array(jsonb_build_object(
      'produto_nome', v_produto.nome, 'unidade', v_produto.unidade,
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

  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    BEGIN
      v_valor_pagamento := round(coalesce(nullif(_pagamento->>'valor', '')::numeric, v_total), 2);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Valor do pagamento inválido';
    END;
    IF v_valor_pagamento IS NULL OR v_valor_pagamento::text IN ('NaN','Infinity','-Infinity')
       OR v_valor_pagamento <= 0 OR v_valor_pagamento > v_total THEN
      RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero e não pode ultrapassar o total do ROL';
    END IF;
  END IF;

  INSERT INTO public.ordens_servico (
    numero, cliente_id, motorista_id, veiculo_id, data_retirada, data_previsao_entrega,
    data_entrega, status, prioridade, observacoes, valor_total, valor_desconto,
    forma_pagamento, status_pagamento, pago_na_entrada, valor_pago,
    urgente, percentual_urgencia, origem, pdv_idempotency_key,
    tenant_id, condicao_pagamento, condicoes_comerciais, pdv_request_hash
  ) VALUES (
    '', _cliente_id, _motorista_id, _veiculo_id, current_date, _data_previsao_entrega,
    NULL, 'retirada', CASE WHEN _urgente THEN 'urgente' ELSE 'normal' END,
    NULL, v_total, round(_valor_desconto, 2),
    NULL, 'pendente', false, 0, _urgente, _percentual_urgencia, v_cliente.classificacao,
    _idempotency_key, v_cliente.tenant_id, v_condicao, coalesce(v_config,'{}'::jsonb) || jsonb_build_object('tabela_preco_tipo',v_cliente.tabela_preco_tipo), v_fingerprint
  ) RETURNING * INTO v_os;

  INSERT INTO public.itens_ordem_servico (
    tenant_id, ordem_servico_id, produto_id, quantidade, preco_unitario, subtotal,
    cor_item, marca_item, avarias, posicao_prateleira, observacoes
  )
  SELECT
    v_cliente.tenant_id, v_os.id, produto_id, quantidade, preco_unitario, subtotal,
    cor_item, marca_item, avarias, posicao_prateleira, observacoes
  FROM jsonb_to_recordset(v_itens_calculados) AS item(
    produto_id uuid, quantidade numeric, preco_unitario numeric, subtotal numeric,
    cor_item text, marca_item text, avarias text, posicao_prateleira text, observacoes text
  );

  IF v_condicao = 'faturado' THEN
    INSERT INTO public.lancamentos(tenant_id,cliente_id,ordem_servico_id,data_lancamento,data_entrega,
      valor_total,status,etapa,observacao)
    VALUES(v_cliente.tenant_id,_cliente_id,v_os.id,current_date,_data_previsao_entrega,
      v_total,'pendente','em_processo','Atendimento ' || v_os.numero)
    RETURNING id INTO v_lancamento;
    INSERT INTO public.itens_lancamento(tenant_id,lancamento_id,produto_nome,quantidade,unidade,preco_unitario,subtotal)
    SELECT v_cliente.tenant_id,v_lancamento,produto_nome,quantidade,coalesce(unidade,'un'),preco_unitario,subtotal
    FROM jsonb_to_recordset(v_itens_calculados) AS item(
      produto_nome text,quantidade numeric,unidade text,preco_unitario numeric,subtotal numeric);
  END IF;
  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb AND upper(coalesce(_pagamento->>'metodo','')) <> 'PIX' THEN
    v_pagamento_resultado := public.registrar_pagamento_pdv(
      v_os.id, _caixa_id, upper(_pagamento->>'metodo'), v_valor_pagamento,
      CASE WHEN _pagamento ? 'valor_recebido' THEN (_pagamento->>'valor_recebido')::numeric ELSE NULL END,
      coalesce((_pagamento->>'parcelas')::integer, 1), _pagamento->>'bandeira',
      _pagamento->>'nsu', _pagamento->>'codigo_autorizacao', 'ENTRADA',
      _idempotency_key || ':payment', _criado_por
    );
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_os.id, 'number', v_os.numero, 'total', v_total,
      'paymentStatus', CASE WHEN v_pagamento_resultado IS NULL THEN 'pendente' ELSE v_pagamento_resultado->>'orderStatus' END,
      'deliveryDate', v_os.data_previsao_entrega
    ),
    'payment', v_pagamento_resultado,
    'idempotent', false
  );
END;
$function$;
