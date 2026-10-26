-- Unified service counter. Existing orders keep their current payment state.
ALTER TABLE public.ordens_servico
  ADD COLUMN condicao_pagamento text CHECK(condicao_pagamento IN ('entrada','retirada','faturado')),
  ADD COLUMN condicoes_comerciais jsonb,
  ADD COLUMN pdv_request_hash text;
ALTER TABLE public.lancamentos ADD COLUMN ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX lancamentos_one_per_order ON public.lancamentos(ordem_servico_id) WHERE ordem_servico_id IS NOT NULL;

-- The Edge verifies the JWT; service-only RPCs also verify persisted actor grants.
CREATE OR REPLACE FUNCTION private.pdv_actor_allowed(_actor uuid,_tenant uuid,_area text,_modules text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.tenant_memberships m
  JOIN public.tenants t ON t.id=m.tenant_id AND t.status='active'
  JOIN public.funcionarios f ON f.user_id=m.user_id AND f.tenant_id=m.tenant_id AND f.ativo
  WHERE m.user_id=_actor AND m.tenant_id=_tenant AND m.enabled AND m.is_active
    AND (m.role IN ('owner','admin') OR EXISTS(
      SELECT 1 FROM public.modulo_permissoes p WHERE p.funcionario_id=f.id AND p.tenant_id=_tenant
      AND p.tem_acesso AND p.modulo_key=ANY(_modules)))
    AND (m.role IN ('owner','admin') OR EXISTS(
      SELECT 1 FROM public.area_permissoes a WHERE a.user_id=_actor AND a.tenant_id=_tenant
      AND a.area IN (_area,'central')))
 );
$$;
REVOKE ALL ON FUNCTION private.pdv_actor_allowed(uuid,uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.pdv_actor_allowed(uuid,uuid,text,text[]) TO service_role;

-- Additional restrictive policies preserve the existing tenant and area policies.
CREATE POLICY commercial_terms_insert ON public.precos_especiais AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])));
CREATE POLICY commercial_terms_update ON public.precos_especiais AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])))
WITH CHECK ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])));
CREATE POLICY commercial_terms_delete ON public.precos_especiais AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])));
CREATE POLICY commercial_terms_insert ON public.configuracoes_pagamento_cliente AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])));
CREATE POLICY commercial_terms_update ON public.configuracoes_pagamento_cliente AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])))
WITH CHECK ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])));
CREATE POLICY commercial_terms_delete ON public.configuracoes_pagamento_cliente AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais'])));

CREATE OR REPLACE FUNCTION private.guard_customer_price_mode()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.has_any_module_access(ARRAY['alterar_condicoes_comerciais']) THEN
  IF (TG_OP='INSERT' AND coalesce(NEW.tabela_preco_tipo,'padrao')<>'padrao')
     OR (TG_OP='UPDATE' AND NEW.tabela_preco_tipo IS DISTINCT FROM OLD.tabela_preco_tipo) THEN
   RAISE EXCEPTION 'Sem permissão para alterar a tabela de preços';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_customer_price_mode() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_customer_price_mode BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION private.guard_customer_price_mode();

CREATE OR REPLACE FUNCTION private.validate_customer_payment_terms()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,private,pg_temp AS $$
BEGIN
 IF NEW.condicao_pagamento IS NOT NULL AND NEW.condicao_pagamento NOT IN ('entrada','retirada','faturado') THEN
  RAISE EXCEPTION 'Condição de pagamento inválida';
 END IF;
 IF NEW.condicao_pagamento IN ('entrada','retirada') AND NEW.forma_pagamento IN ('boleto','transferencia') THEN
  RAISE EXCEPTION 'Boleto e transferência devem ser recebidos pelo fluxo de faturamento';
 END IF;
 IF NEW.condicao_pagamento='faturado' AND (
   NEW.tipo_faturamento IS NULL OR NEW.tipo_faturamento NOT IN ('avulso','mensal','quinzenal')) THEN
  RAISE EXCEPTION 'Periodicidade de faturamento inválida';
 END IF;
 IF NEW.forma_pagamento IS NOT NULL AND NEW.forma_pagamento NOT IN ('dinheiro','pix','cartao_credito','cartao_debito','boleto','transferencia') THEN
  RAISE EXCEPTION 'Forma de pagamento inválida';
 END IF;
 IF (NEW.dia_fechamento IS NOT NULL AND NEW.dia_fechamento NOT BETWEEN 1 AND 31)
 OR (NEW.dia_vencimento IS NOT NULL AND NEW.dia_vencimento NOT BETWEEN 1 AND 31) THEN
  RAISE EXCEPTION 'Dia de fechamento ou vencimento inválido';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.validate_customer_payment_terms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_customer_payment_terms BEFORE INSERT OR UPDATE ON public.configuracoes_pagamento_cliente
FOR EACH ROW EXECUTE FUNCTION private.validate_customer_payment_terms();

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

    IF lower(coalesce(v_produto.unidade,'un')) NOT IN ('kg','m','metro','metros','m²','m2','litro','l') AND trunc(v_quantidade) <> v_quantidade THEN
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

CREATE OR REPLACE FUNCTION public.registrar_intencao_pix_pdv(_ordem_servico_id uuid, _caixa_id uuid, _asaas_charge_id uuid, _provedor_pagamento_id text, _status_provedor text, _idempotency_key text, _momento text, _criado_por uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
  IF NOT FOUND OR v_os.origem NOT IN ('industrial', 'residencial', 'loja') OR v_os.condicao_pagamento = 'faturado' OR v_os.status = 'cancelada' THEN
    RAISE EXCEPTION 'OS inválida para PIX';
  END IF;
  IF NOT private.pdv_actor_allowed(_criado_por,v_os.tenant_id,
    CASE WHEN v_os.origem='loja' THEN 'residencial' ELSE v_os.origem END,ARRAY['caixa']) THEN
    RAISE EXCEPTION 'Sem permissão para receber nesta área';
  END IF;
  SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id AND tenant_id=v_os.tenant_id FOR UPDATE;
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
$function$;

-- A linked ROL is a billing snapshot of the order, not a second editable sale.
CREATE OR REPLACE FUNCTION private.guard_linked_pdv_launch()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,private,pg_temp AS $$
DECLARE service_order public.ordens_servico%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.ordem_servico_id IS NOT NULL THEN RAISE EXCEPTION 'Cancele o atendimento pela OS'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.ordem_servico_id IS NOT NULL AND (
  NEW.ordem_servico_id IS DISTINCT FROM OLD.ordem_servico_id OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id
  OR NEW.valor_total IS DISTINCT FROM OLD.valor_total OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id) THEN
  RAISE EXCEPTION 'O valor e vínculo deste lançamento são controlados pela OS';
 END IF;
 IF NEW.ordem_servico_id IS NOT NULL THEN
  SELECT * INTO service_order FROM public.ordens_servico WHERE id=NEW.ordem_servico_id;
  IF NOT FOUND OR service_order.tenant_id<>NEW.tenant_id OR service_order.cliente_id<>NEW.cliente_id
    OR service_order.condicao_pagamento IS DISTINCT FROM 'faturado'
    OR service_order.valor_total IS DISTINCT FROM NEW.valor_total THEN
   RAISE EXCEPTION 'Lançamento incompatível com a OS faturada';
  END IF;
  IF NEW.status='cancelado' AND service_order.status<>'cancelada' THEN
   RAISE EXCEPTION 'Cancele o atendimento pela OS';
  END IF;
  IF NEW.fatura_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.faturas WHERE id=NEW.fatura_id AND tenant_id=NEW.tenant_id
   AND cliente_id=NEW.cliente_id AND status<>'cancelado') THEN
   RAISE EXCEPTION 'Fatura incompatível com este atendimento';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_linked_pdv_launch() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_linked_pdv_launch BEFORE INSERT OR UPDATE OR DELETE ON public.lancamentos
FOR EACH ROW EXECUTE FUNCTION private.guard_linked_pdv_launch();

CREATE OR REPLACE FUNCTION private.guard_linked_pdv_items()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,private,pg_temp AS $$
DECLARE linked boolean;
BEGIN
 IF TG_TABLE_NAME='itens_lancamento' THEN
  SELECT EXISTS(SELECT 1 FROM public.lancamentos WHERE
   id=CASE WHEN TG_OP='DELETE' THEN OLD.lancamento_id ELSE NEW.lancamento_id END AND ordem_servico_id IS NOT NULL)
   INTO linked;
  IF linked AND (TG_OP<>'INSERT' OR auth.uid() IS NOT NULL) THEN
   RAISE EXCEPTION 'Itens faturados são definidos na OS; não podem ser alterados separadamente';
  END IF;
 ELSE
  SELECT EXISTS(SELECT 1 FROM public.lancamentos WHERE
   ordem_servico_id=CASE WHEN TG_OP='DELETE' THEN OLD.ordem_servico_id ELSE NEW.ordem_servico_id END)
   INTO linked;
  IF linked THEN RAISE EXCEPTION 'Este atendimento já possui lançamento para faturamento; cancele e refaça para alterar os itens'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_linked_pdv_items() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_linked_pdv_items BEFORE INSERT OR UPDATE OR DELETE ON public.itens_lancamento
FOR EACH ROW EXECUTE FUNCTION private.guard_linked_pdv_items();
CREATE TRIGGER guard_linked_pdv_items BEFORE INSERT OR UPDATE OR DELETE ON public.itens_ordem_servico
FOR EACH ROW EXECUTE FUNCTION private.guard_linked_pdv_items();

CREATE OR REPLACE FUNCTION private.guard_pdv_order_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 IF OLD.pdv_request_hash IS NOT NULL AND (
  NEW.condicao_pagamento IS DISTINCT FROM OLD.condicao_pagamento
  OR NEW.condicoes_comerciais IS DISTINCT FROM OLD.condicoes_comerciais
  OR NEW.pdv_request_hash IS DISTINCT FROM OLD.pdv_request_hash
  OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.origem IS DISTINCT FROM OLD.origem) THEN
  RAISE EXCEPTION 'As condições originais do atendimento devem ser preservadas';
 END IF;
 IF OLD.condicao_pagamento='faturado' THEN
  IF NEW.valor_total IS DISTINCT FROM OLD.valor_total OR NEW.valor_desconto IS DISTINCT FROM OLD.valor_desconto THEN
   RAISE EXCEPTION 'Este atendimento já possui lançamento para faturamento';
  END IF;
  IF NEW.status='cancelada' AND OLD.status<>'cancelada' AND EXISTS(
   SELECT 1 FROM public.lancamentos l JOIN public.faturas f ON f.id=l.fatura_id AND f.tenant_id=l.tenant_id
   WHERE l.ordem_servico_id=OLD.id AND f.status<>'cancelado') THEN
   RAISE EXCEPTION 'Resolva ou cancele a fatura vinculada antes de cancelar a OS';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_pdv_order_terms() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pdv_order_terms BEFORE UPDATE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION private.guard_pdv_order_terms();

CREATE OR REPLACE FUNCTION private.sync_pdv_launch_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 IF NEW.condicao_pagamento='faturado' AND NEW.status IS DISTINCT FROM OLD.status THEN
  UPDATE public.lancamentos SET
   etapa=CASE WHEN NEW.status='entregue' THEN 'entregue' WHEN NEW.status='expedicao' THEN 'prateleira' ELSE 'em_processo' END,
   status=CASE WHEN NEW.status='cancelada' THEN 'cancelado' ELSE status END,
   fatura_id=CASE WHEN NEW.status='cancelada' THEN NULL ELSE fatura_id END
  WHERE ordem_servico_id=NEW.id AND tenant_id=NEW.tenant_id;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.sync_pdv_launch_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_pdv_launch_status AFTER UPDATE OF status ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION private.sync_pdv_launch_status();

CREATE OR REPLACE FUNCTION private.sync_billed_pdv_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private,pg_temp AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  UPDATE public.ordens_servico os SET
   status_pagamento=CASE WHEN NEW.status='pago' THEN 'pago' ELSE 'pendente' END,
   valor_pago=CASE WHEN NEW.status='pago' THEN os.valor_total ELSE 0 END
  FROM public.lancamentos l WHERE l.fatura_id=NEW.id AND l.ordem_servico_id=os.id
    AND l.tenant_id=NEW.tenant_id AND os.tenant_id=NEW.tenant_id AND os.condicao_pagamento='faturado';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.sync_billed_pdv_payment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_billed_pdv_payment AFTER UPDATE OF status ON public.faturas
FOR EACH ROW EXECUTE FUNCTION private.sync_billed_pdv_payment();

REVOKE ALL ON FUNCTION public.criar_venda_pdv(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.criar_venda_pdv(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text) TO service_role;
NOTIFY pgrst, 'reload schema';


CREATE OR REPLACE FUNCTION public.registrar_pagamento_pdv(_ordem_servico_id uuid, _caixa_id uuid, _metodo text, _valor numeric, _valor_recebido numeric, _parcelas integer, _bandeira text, _nsu text, _codigo_autorizacao text, _momento text, _idempotency_key text, _criado_por uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
  IF NOT FOUND OR v_os.origem NOT IN ('industrial', 'residencial', 'loja') OR v_os.condicao_pagamento = 'faturado' OR v_os.status = 'cancelada' THEN
    RAISE EXCEPTION 'OS inválida para recebimento';
  END IF;

  IF NOT private.pdv_actor_allowed(_criado_por,v_os.tenant_id,
    CASE WHEN v_os.origem='loja' THEN 'residencial' ELSE v_os.origem END,ARRAY['caixa']) THEN
    RAISE EXCEPTION 'Sem permissão para receber nesta área';
  END IF;
  SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id AND tenant_id=v_os.tenant_id FOR UPDATE;
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
    (SELECT id FROM public.categorias_financeiras WHERE tenant_id=v_os.tenant_id AND nome = CASE WHEN v_os.origem='industrial' THEN 'Venda PDV Industrial' ELSE 'Venda PDV Loja' END AND tipo = 'receita' LIMIT 1),
    (SELECT id FROM public.centros_custo WHERE tenant_id=v_os.tenant_id AND nome = CASE WHEN v_os.origem='industrial' THEN 'Industrial' ELSE 'Loja' END LIMIT 1)
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
$function$;

