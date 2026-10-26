-- Apply the selected client price mode in server-authoritative commercial flows.
-- Standard clients always use products.preco; personalized clients may use
-- their tenant-scoped precos_especiais override.

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
      ON pe.cliente_id = _cliente_id
     AND pe.produto_id = v_produto.id
     AND v_cliente.tabela_preco_tipo = 'personalizada'
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
    produto_id uuid, quantidade numeric, preco_unitario numeric, subtotal numeric,
    cor_item text, marca_item text, avarias text, posicao_prateleira text, observacoes text
  );

  IF _pagamento IS NOT NULL AND _pagamento <> 'null'::jsonb THEN
    IF upper(coalesce(_pagamento->>'metodo', '')) = 'PIX' THEN
      RAISE EXCEPTION 'PIX deve ser criado pelo provedor após a criação da OS';
    END IF;
    v_pagamento_resultado := public.registrar_pagamento_pdv(
      v_os.id, _caixa_id, upper(_pagamento->>'metodo'), v_total,
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
$$;

CREATE OR REPLACE FUNCTION public.avancar_etapa_producao(
  _ordem_servico_id uuid,
  _etapa_esperada text,
  _proxima_etapa text,
  _funcionario_id uuid,
  _observacoes text,
  _dados_formulario jsonb,
  _itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  order_row public.ordens_servico%ROWTYPE;
  item jsonb;
  product_row public.produtos%ROWTYPE;
  quantity numeric;
  unit_price numeric;
  allowed_next text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_any_module_access(ARRAY['ordens', 'producao']) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO order_row FROM public.ordens_servico
  WHERE id = _ordem_servico_id AND tenant_id = private.current_tenant_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada nesta empresa'; END IF;
  IF NOT private.can_access_order(order_row.id) THEN RAISE EXCEPTION 'Acesso negado para esta área'; END IF;
  IF order_row.status IS DISTINCT FROM _etapa_esperada THEN
    RAISE EXCEPTION 'A OS foi alterada por outro usuário; atualize a tela';
  END IF;

  allowed_next := CASE _etapa_esperada
    WHEN 'retirada' THEN 'separacao'
    WHEN 'separacao' THEN 'lavagem'
    WHEN 'lavagem' THEN 'secagem'
    WHEN 'secagem' THEN 'passadoria'
    WHEN 'passadoria' THEN 'embalagem'
    WHEN 'embalagem' THEN 'expedicao'
    WHEN 'expedicao' THEN 'entregue'
    ELSE NULL
  END;
  IF allowed_next IS NULL OR allowed_next <> _proxima_etapa THEN RAISE EXCEPTION 'Transição de produção inválida'; END IF;
  IF _funcionario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios WHERE id = _funcionario_id AND tenant_id = order_row.tenant_id AND ativo
  ) THEN RAISE EXCEPTION 'Funcionário inválido para esta empresa'; END IF;
  IF jsonb_typeof(coalesce(_dados_formulario, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Dados da etapa inválidos'; END IF;
  IF octet_length(coalesce(_dados_formulario, '{}'::jsonb)::text) > 65536 THEN RAISE EXCEPTION 'Dados da etapa excedem o limite permitido'; END IF;
  IF jsonb_typeof(coalesce(_itens, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(_itens, '[]'::jsonb)) > 200 THEN RAISE EXCEPTION 'Itens da etapa inválidos'; END IF;
  IF _etapa_esperada <> 'separacao' AND jsonb_array_length(coalesce(_itens, '[]'::jsonb)) > 0 THEN RAISE EXCEPTION 'Itens só podem ser incluídos durante a separação'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(_itens, '[]'::jsonb)) LOOP
    BEGIN quantity := (item->>'quantidade')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'Quantidade inválida'; END;
    IF quantity <= 0 OR quantity > 999 OR coalesce(item->>'produto_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Item de separação inválido';
    END IF;

    SELECT * INTO product_row FROM public.produtos
    WHERE id = (item->>'produto_id')::uuid AND tenant_id = order_row.tenant_id AND status = 'ativo'
      AND CASE
        WHEN lower(coalesce(order_row.origem, 'industrial')) IN ('residencial', 'loja')
          THEN coalesce(unidade_negocio, 'ambos') IN ('ID2', 'ambos')
        ELSE coalesce(unidade_negocio, 'ambos') IN ('ID1', 'ambos')
      END;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido ou inativo'; END IF;

    SELECT coalesce(price.preco_especial, product_row.preco) INTO unit_price
    FROM (SELECT 1) source
    LEFT JOIN public.precos_especiais price
      ON price.tenant_id = order_row.tenant_id
     AND price.cliente_id = order_row.cliente_id
     AND price.produto_id = product_row.id
     AND EXISTS (
       SELECT 1 FROM public.clientes client_price
       WHERE client_price.id = order_row.cliente_id
         AND client_price.tenant_id = order_row.tenant_id
         AND client_price.tabela_preco_tipo = 'personalizada'
     )
    LIMIT 1;

    INSERT INTO public.itens_ordem_servico (
      tenant_id, ordem_servico_id, produto_id, quantidade, preco_unitario, subtotal
    ) VALUES (
      order_row.tenant_id, order_row.id, product_row.id, quantity,
      round(unit_price::numeric, 2), round(unit_price::numeric * quantity, 2)
    );
  END LOOP;

  UPDATE public.ordens_servico
  SET status = _proxima_etapa,
      data_entrega = CASE WHEN _proxima_etapa = 'entregue' THEN current_date ELSE data_entrega END
  WHERE id = order_row.id;

  UPDATE public.historico_producao
  SET funcionario_id = _funcionario_id,
      observacoes = nullif(left(trim(coalesce(_observacoes, '')), 1000), ''),
      dados_formulario = coalesce(_dados_formulario, '{}'::jsonb)
  WHERE id = (
    SELECT id FROM public.historico_producao
    WHERE ordem_servico_id = order_row.id AND etapa_anterior = _etapa_esperada AND etapa_nova = _proxima_etapa
    ORDER BY created_at DESC LIMIT 1
  );

  RETURN jsonb_build_object('id', order_row.id, 'status', _proxima_etapa);
END;
$$;

REVOKE ALL ON FUNCTION public.criar_venda_pdv(uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_venda_pdv(uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.avancar_etapa_producao(uuid, text, text, uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avancar_etapa_producao(uuid, text, text, uuid, text, jsonb, jsonb) TO authenticated;
