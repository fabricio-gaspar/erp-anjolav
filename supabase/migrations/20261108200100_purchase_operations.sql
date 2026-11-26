-- All purchasing mutations are transactional RPCs. Direct table writes stay
-- revoked so stock, payable and order state cannot diverge.
CREATE OR REPLACE FUNCTION private.purchase_begin(
  _tenant uuid, _key text, _operation text, _request jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE v_existing public.pedido_compra_operacoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR _tenant IS NULL OR nullif(trim(_key),'') IS NULL THEN
    RAISE EXCEPTION 'Sessão e chave de operação são obrigatórias';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_tenant::text || ':' || _key, 0));
  SELECT * INTO v_existing FROM public.pedido_compra_operacoes
  WHERE tenant_id = _tenant AND idempotency_key = _key;
  IF FOUND THEN
    IF v_existing.operation <> _operation
      OR v_existing.request_data IS DISTINCT FROM _request THEN
      RAISE EXCEPTION 'Chave já usada com outros dados';
    END IF;
    RETURN v_existing.result;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION private.purchase_begin(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consultar_diretorio_pedidos_compra(
  _busca text DEFAULT NULL, _situacao text DEFAULT 'open',
  _pagina integer DEFAULT 1, _tamanho integer DEFAULT 25
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_page integer := GREATEST(COALESCE(_pagina,1),1);
  v_size integer := LEAST(GREATEST(COALESCE(_tamanho,25),1),100);
  v_result jsonb;
BEGIN
  IF COALESCE(_situacao,'open') NOT IN
    ('open','all','rascunho','aprovado','parcial','recebido','cancelado') THEN
    RAISE EXCEPTION 'Situação inválida';
  END IF;
  WITH base AS (
    SELECT p.id, p.numero, p.fornecedor_id, f.nome AS fornecedor_nome,
      p.status, p.data_pedido, p.previsao_entrega,
      p.prazo_pagamento_dias, p.valor_total, p.versao, p.created_at,
      COALESCE((SELECT sum(GREATEST(i.quantidade_solicitada-i.quantidade_recebida,0))
        FROM public.pedido_compra_itens i WHERE i.pedido_compra_id=p.id),0)
        AS quantidade_pendente,
      COALESCE((SELECT sum(GREATEST(i.quantidade_solicitada-i.quantidade_recebida,0)
        * i.custo_unitario) FROM public.pedido_compra_itens i
        WHERE i.pedido_compra_id=p.id),0) AS valor_pendente
    FROM public.pedidos_compra p
    JOIN public.fornecedores f ON f.id=p.fornecedor_id AND f.tenant_id=p.tenant_id
    WHERE p.tenant_id=v_tenant
  ), filtered AS (
    SELECT * FROM base
    WHERE (COALESCE(_situacao,'open')='all'
      OR (COALESCE(_situacao,'open')='open' AND status IN
        ('rascunho','aprovado','parcial')) OR status=_situacao)
      AND (nullif(trim(_busca),'') IS NULL
        OR fornecedor_nome ILIKE '%' || trim(_busca) || '%'
        OR numero::text LIKE '%' || trim(_busca) || '%')
  ), paged AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id DESC
    OFFSET (v_page-1)*v_size LIMIT v_size
  )
  SELECT jsonb_build_object(
    'items',COALESCE((SELECT jsonb_agg(to_jsonb(paged)
      ORDER BY created_at DESC,id DESC) FROM paged),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),
    'page',v_page,'pageSize',v_size,
    'summary',jsonb_build_object(
      'draftCount',(SELECT count(*) FROM base WHERE status='rascunho'),
      'receivingCount',(SELECT count(*) FROM base WHERE status IN ('aprovado','parcial')),
      'pendingValue',(SELECT COALESCE(sum(valor_pendente),0) FROM base
        WHERE status IN ('rascunho','aprovado','parcial')),
      'availableCreditValue',(SELECT COALESCE(sum(valor_disponivel),0)
        FROM public.creditos_fornecedor WHERE tenant_id=v_tenant AND status='disponivel')
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consultar_pedido_compra_detalhes(_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_order public.pedidos_compra%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_order FROM public.pedidos_compra
  WHERE id=_pedido_id AND tenant_id=v_tenant;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  SELECT to_jsonb(v_order) || jsonb_build_object(
    'fornecedor_nome',(SELECT nome FROM public.fornecedores
      WHERE id=v_order.fornecedor_id AND tenant_id=v_tenant),
    'itens',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.descricao)
      FROM public.pedido_compra_itens i
      WHERE i.pedido_compra_id=_pedido_id AND i.tenant_id=v_tenant),'[]'::jsonb),
    'recebimentos',COALESCE((SELECT jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'itens',COALESCE((SELECT jsonb_agg(to_jsonb(ri) ORDER BY ri.id)
        FROM public.recebimento_compra_itens ri
        WHERE ri.recebimento_id=r.id AND ri.tenant_id=v_tenant),'[]'::jsonb),
      'conta',(SELECT jsonb_build_object('id',c.id,'status',c.status,
        'valor',c.valor,'valor_pago',c.valor_pago,'vencimento',c.vencimento)
        FROM public.contas_pagar c WHERE c.id=r.conta_pagar_id AND c.tenant_id=v_tenant)
      ) ORDER BY r.created_at,r.id)
      FROM public.recebimentos_compra r
      WHERE r.pedido_compra_id=_pedido_id AND r.tenant_id=v_tenant),'[]'::jsonb),
    'devolucoes',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at,d.id)
      FROM public.devolucoes_compra d
      WHERE d.pedido_compra_id=_pedido_id AND d.tenant_id=v_tenant),'[]'::jsonb),
    'creditos',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at,c.id)
      FROM public.creditos_fornecedor c
      WHERE c.pedido_compra_id=_pedido_id AND c.tenant_id=v_tenant),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_pedido_compra(
  _pedido_id uuid, _fornecedor_id uuid, _previsao_entrega date,
  _prazo_pagamento_dias integer, _observacoes text, _itens jsonb,
  _versao_esperada integer, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_order public.pedidos_compra%ROWTYPE;
  v_item jsonb;
  v_product public.estoque_produtos%ROWTYPE;
  v_product_id uuid;
  v_qty numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_result jsonb;
  v_request jsonb := jsonb_build_object('pedido_id',_pedido_id,
    'fornecedor_id',_fornecedor_id,'previsao_entrega',_previsao_entrega,
    'prazo_pagamento_dias',_prazo_pagamento_dias,'observacoes',_observacoes,
    'itens',_itens,'versao_esperada',_versao_esperada);
BEGIN
  v_result := private.purchase_begin(v_tenant,_idempotency_key,'save',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  IF _fornecedor_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.fornecedores
    WHERE id=_fornecedor_id AND tenant_id=v_tenant AND ativo) THEN
    RAISE EXCEPTION 'Fornecedor inválido';
  END IF;
  IF _prazo_pagamento_dias IS NULL OR _prazo_pagamento_dias NOT BETWEEN 0 AND 3650
    OR _itens IS NULL OR jsonb_typeof(_itens)<>'array'
    OR jsonb_array_length(_itens)=0 THEN
    RAISE EXCEPTION 'Informe prazo e itens válidos';
  END IF;
  IF _pedido_id IS NULL THEN
    INSERT INTO public.pedidos_compra
      (tenant_id,fornecedor_id,previsao_entrega,prazo_pagamento_dias,observacoes,criado_por)
    VALUES (v_tenant,_fornecedor_id,_previsao_entrega,_prazo_pagamento_dias,
      nullif(trim(_observacoes),''),auth.uid()) RETURNING * INTO v_order;
  ELSE
    SELECT * INTO v_order FROM public.pedidos_compra
    WHERE id=_pedido_id AND tenant_id=v_tenant FOR UPDATE;
    IF NOT FOUND OR v_order.status<>'rascunho' THEN
      RAISE EXCEPTION 'Somente rascunhos podem ser editados';
    END IF;
    IF v_order.versao IS DISTINCT FROM _versao_esperada THEN
      RAISE EXCEPTION 'Pedido alterado por outro usuário';
    END IF;
    DELETE FROM public.pedido_compra_itens
    WHERE tenant_id=v_tenant AND pedido_compra_id=_pedido_id;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    v_product_id := (v_item->>'produtoId')::uuid;
    v_qty := (v_item->>'quantidade')::numeric;
    v_cost := (v_item->>'custoUnitario')::numeric;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty<=0
      OR v_cost IS NULL OR v_cost<=0 THEN
      RAISE EXCEPTION 'Item de compra inválido';
    END IF;
    SELECT * INTO v_product FROM public.estoque_produtos
    WHERE id=v_product_id AND tenant_id=v_tenant AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insumo não encontrado ou arquivado'; END IF;
    INSERT INTO public.pedido_compra_itens
      (tenant_id,pedido_compra_id,estoque_produto_id,descricao,unidade,
        quantidade_solicitada,custo_unitario)
    VALUES (v_tenant,v_order.id,v_product_id,v_product.nome,
      COALESCE(v_product.unidade,'unidade'),v_qty,v_cost);
    v_total := v_total + v_qty*v_cost;
  END LOOP;
  UPDATE public.pedidos_compra SET fornecedor_id=_fornecedor_id,
    previsao_entrega=_previsao_entrega,prazo_pagamento_dias=_prazo_pagamento_dias,
    observacoes=nullif(trim(_observacoes),''),valor_total=v_total,
    versao=CASE WHEN _pedido_id IS NULL THEN versao ELSE versao+1 END,
    updated_at=now()
  WHERE id=v_order.id AND tenant_id=v_tenant RETURNING * INTO v_order;
  v_result := jsonb_build_object('id',v_order.id,'numero',v_order.numero,
    'status',v_order.status,'versao',v_order.versao);
  INSERT INTO public.pedido_compra_operacoes
    (tenant_id,operation,idempotency_key,request_data,result)
  VALUES (v_tenant,'save',_idempotency_key,v_request,v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aprovar_pedido_compra(
  _pedido_id uuid, _versao_esperada integer, _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_purchase_admin();
  v_order public.pedidos_compra%ROWTYPE;
  v_result jsonb;
  v_request jsonb := jsonb_build_object('pedido_id',_pedido_id,
    'versao_esperada',_versao_esperada);
BEGIN
  v_result := private.purchase_begin(v_tenant,_idempotency_key,'approve',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_order FROM public.pedidos_compra
  WHERE id=_pedido_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR v_order.status<>'rascunho' THEN
    RAISE EXCEPTION 'Rascunho não encontrado';
  END IF;
  IF v_order.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Pedido alterado por outro usuário';
  END IF;
  UPDATE public.pedidos_compra SET status='aprovado', aprovado_em=now(),
    versao=versao+1,updated_at=now() WHERE id=_pedido_id RETURNING * INTO v_order;
  v_result := jsonb_build_object('id',v_order.id,'status',v_order.status,
    'versao',v_order.versao);
  INSERT INTO public.pedido_compra_operacoes
    (tenant_id,operation,idempotency_key,request_data,result)
  VALUES (v_tenant,'approve',_idempotency_key,v_request,v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.receber_pedido_compra(
  _pedido_id uuid, _estoque_local_id uuid, _data_recebimento date,
  _documento_fornecedor text, _itens jsonb, _versao_esperada integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_stock_access();
  v_order public.pedidos_compra%ROWTYPE;
  v_item public.pedido_compra_itens%ROWTYPE;
  v_receipt public.recebimentos_compra%ROWTYPE;
  v_account uuid;
  v_entry jsonb;
  v_qty numeric;
  v_total numeric := 0;
  v_pending numeric;
  v_result jsonb;
  v_request jsonb := jsonb_build_object('pedido_id',_pedido_id,
    'estoque_local_id',_estoque_local_id,'data_recebimento',_data_recebimento,
    'documento_fornecedor',_documento_fornecedor,'itens',_itens,
    'versao_esperada',_versao_esperada);
BEGIN
  v_result := private.purchase_begin(v_tenant,_idempotency_key,'receive',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_order FROM public.pedidos_compra
  WHERE id=_pedido_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('aprovado','parcial') THEN
    RAISE EXCEPTION 'Pedido não aprovado ou sem saldo pendente';
  END IF;
  IF v_order.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Pedido alterado por outro usuário';
  END IF;
  IF _data_recebimento IS NULL OR _itens IS NULL
    OR jsonb_typeof(_itens)<>'array' OR jsonb_array_length(_itens)=0 THEN
    RAISE EXCEPTION 'Data e itens são obrigatórios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.estoque_locais
    WHERE id=_estoque_local_id AND tenant_id=v_tenant AND ativo) THEN
    RAISE EXCEPTION 'Local de estoque inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_itens) x
    GROUP BY x->>'itemId' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Item repetido no recebimento';
  END IF;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    SELECT * INTO v_item FROM public.pedido_compra_itens
    WHERE id=(v_entry->>'itemId')::uuid AND pedido_compra_id=_pedido_id
      AND tenant_id=v_tenant FOR UPDATE;
    v_qty := (v_entry->>'quantidade')::numeric;
    IF NOT FOUND OR v_qty IS NULL OR v_qty<=0
      OR v_qty>v_item.quantidade_solicitada-v_item.quantidade_recebida THEN
      RAISE EXCEPTION 'Quantidade fora do saldo do pedido';
    END IF;
    v_total := v_total+v_qty*v_item.custo_unitario;
  END LOOP;
  INSERT INTO public.contas_pagar
    (tenant_id,descricao,fornecedor,fornecedor_id,valor,vencimento,
      status,categoria,observacoes)
  VALUES (v_tenant,'Recebimento do pedido #'||v_order.numero,
    (SELECT nome FROM public.fornecedores WHERE id=v_order.fornecedor_id
      AND tenant_id=v_tenant),v_order.fornecedor_id,v_total,
    _data_recebimento+v_order.prazo_pagamento_dias,'pendente',
    'Compras','Documento: '||COALESCE(_documento_fornecedor,'—'))
  RETURNING id INTO v_account;
  INSERT INTO public.recebimentos_compra
    (tenant_id,pedido_compra_id,estoque_local_id,conta_pagar_id,
      data_recebimento,documento_fornecedor,valor_total,criado_por)
  VALUES (v_tenant,_pedido_id,_estoque_local_id,v_account,_data_recebimento,
    nullif(trim(_documento_fornecedor),''),v_total,auth.uid())
  RETURNING * INTO v_receipt;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    SELECT * INTO v_item FROM public.pedido_compra_itens
    WHERE id=(v_entry->>'itemId')::uuid AND pedido_compra_id=_pedido_id
      AND tenant_id=v_tenant FOR UPDATE;
    v_qty := (v_entry->>'quantidade')::numeric;
    INSERT INTO public.recebimento_compra_itens
      (tenant_id,recebimento_id,pedido_item_id,estoque_produto_id,
        quantidade,custo_unitario)
    VALUES (v_tenant,v_receipt.id,v_item.id,v_item.estoque_produto_id,
      v_qty,v_item.custo_unitario);
    UPDATE public.pedido_compra_itens
    SET quantidade_recebida=quantidade_recebida+v_qty WHERE id=v_item.id;
    PERFORM public.registrar_movimentacao_estoque_local(
      v_item.estoque_produto_id,'entrada',v_qty,
      'Recebimento pedido #'||v_order.numero,v_order.fornecedor_id,
      v_item.custo_unitario,_estoque_local_id,
      _idempotency_key||':entrada:'||v_item.id::text);
  END LOOP;
  SELECT COALESCE(sum(quantidade_solicitada-quantidade_recebida),0)
  INTO v_pending FROM public.pedido_compra_itens
  WHERE pedido_compra_id=_pedido_id AND tenant_id=v_tenant;
  UPDATE public.pedidos_compra
  SET status=CASE WHEN v_pending=0 THEN 'recebido' ELSE 'parcial' END,
    versao=versao+1,updated_at=now()
  WHERE id=_pedido_id RETURNING * INTO v_order;
  v_result := jsonb_build_object('id',v_receipt.id,'pedido_compra_id',_pedido_id,
    'conta_pagar_id',v_account,'valor_total',v_total,
    'status',v_order.status,'versao',v_order.versao);
  INSERT INTO public.pedido_compra_operacoes
    (tenant_id,operation,idempotency_key,request_data,result)
  VALUES (v_tenant,'receive',_idempotency_key,v_request,v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.devolver_recebimento_compra(
  _recebimento_id uuid, _estoque_local_id uuid, _data_devolucao date,
  _motivo text, _itens jsonb, _versao_esperada integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_purchase_admin();
  v_receipt public.recebimentos_compra%ROWTYPE;
  v_order public.pedidos_compra%ROWTYPE;
  v_account public.contas_pagar%ROWTYPE;
  v_item public.recebimento_compra_itens%ROWTYPE;
  v_return public.devolucoes_compra%ROWTYPE;
  v_entry jsonb;
  v_qty numeric;
  v_total numeric := 0;
  v_reduction numeric;
  v_credit numeric;
  v_result jsonb;
  v_request jsonb := jsonb_build_object('recebimento_id',_recebimento_id,
    'estoque_local_id',_estoque_local_id,'data_devolucao',_data_devolucao,
    'motivo',_motivo,'itens',_itens,'versao_esperada',_versao_esperada);
BEGIN
  v_result := private.purchase_begin(v_tenant,_idempotency_key,'return',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_receipt FROM public.recebimentos_compra
  WHERE id=_recebimento_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recebimento não encontrado'; END IF;
  SELECT * INTO v_order FROM public.pedidos_compra
  WHERE id=v_receipt.pedido_compra_id AND tenant_id=v_tenant FOR UPDATE;
  IF v_order.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Pedido alterado por outro usuário';
  END IF;
  SELECT * INTO v_account FROM public.contas_pagar
  WHERE id=v_receipt.conta_pagar_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta a pagar do recebimento não encontrada'; END IF;
  IF _data_devolucao IS NULL OR length(trim(COALESCE(_motivo,'')))<5
    OR _itens IS NULL OR jsonb_typeof(_itens)<>'array'
    OR jsonb_array_length(_itens)=0 THEN
    RAISE EXCEPTION 'Data, motivo e itens são obrigatórios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.estoque_locais
    WHERE id=_estoque_local_id AND tenant_id=v_tenant AND ativo) THEN
    RAISE EXCEPTION 'Local de estoque inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_itens) x
    GROUP BY x->>'recebimentoItemId' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Item repetido na devolução';
  END IF;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    SELECT * INTO v_item FROM public.recebimento_compra_itens
    WHERE id=(v_entry->>'recebimentoItemId')::uuid
      AND recebimento_id=_recebimento_id AND tenant_id=v_tenant FOR UPDATE;
    v_qty := (v_entry->>'quantidade')::numeric;
    IF NOT FOUND OR v_qty IS NULL OR v_qty<=0
      OR v_qty>v_item.quantidade-v_item.quantidade_devolvida THEN
      RAISE EXCEPTION 'Quantidade de devolução inválida';
    END IF;
    v_total := v_total+v_qty*v_item.custo_unitario;
  END LOOP;
  v_reduction := LEAST(v_total,GREATEST(v_account.valor-v_account.valor_pago,0));
  v_credit := v_total-v_reduction;
  INSERT INTO public.devolucoes_compra
    (tenant_id,pedido_compra_id,recebimento_id,estoque_local_id,
      data_devolucao,motivo,valor_total,reducao_obrigacao,
      credito_fornecedor,criado_por)
  VALUES (v_tenant,v_order.id,_recebimento_id,_estoque_local_id,
    _data_devolucao,trim(_motivo),v_total,v_reduction,v_credit,auth.uid())
  RETURNING * INTO v_return;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    SELECT * INTO v_item FROM public.recebimento_compra_itens
    WHERE id=(v_entry->>'recebimentoItemId')::uuid
      AND recebimento_id=_recebimento_id AND tenant_id=v_tenant FOR UPDATE;
    v_qty := (v_entry->>'quantidade')::numeric;
    INSERT INTO public.devolucao_compra_itens
      (tenant_id,devolucao_id,recebimento_item_id,quantidade,custo_unitario)
    VALUES (v_tenant,v_return.id,v_item.id,v_qty,v_item.custo_unitario);
    UPDATE public.recebimento_compra_itens
    SET quantidade_devolvida=quantidade_devolvida+v_qty WHERE id=v_item.id;
    UPDATE public.pedido_compra_itens
    SET quantidade_devolvida=quantidade_devolvida+v_qty
    WHERE id=v_item.pedido_item_id AND tenant_id=v_tenant;
    PERFORM public.registrar_movimentacao_estoque_local(
      v_item.estoque_produto_id,'saida',v_qty,
      'Devolução pedido #'||v_order.numero,NULL,NULL,_estoque_local_id,
      _idempotency_key||':saida:'||v_item.id::text);
  END LOOP;
  UPDATE public.contas_pagar SET valor=valor-v_reduction,
    status=CASE WHEN valor-v_reduction<=valor_pago THEN 'pago'
      ELSE status END,updated_at=now()
  WHERE id=v_account.id AND tenant_id=v_tenant;
  IF v_credit>0 THEN
    INSERT INTO public.creditos_fornecedor
      (tenant_id,fornecedor_id,pedido_compra_id,devolucao_id,
        valor_original,valor_disponivel)
    VALUES (v_tenant,v_order.fornecedor_id,v_order.id,v_return.id,
      v_credit,v_credit);
  END IF;
  UPDATE public.pedidos_compra SET versao=versao+1,updated_at=now()
  WHERE id=v_order.id RETURNING * INTO v_order;
  v_result := jsonb_build_object('id',v_return.id,'valor_total',v_total,
    'reducao_obrigacao',v_reduction,'credito_fornecedor',v_credit,
    'versao',v_order.versao);
  INSERT INTO public.pedido_compra_operacoes
    (tenant_id,operation,idempotency_key,request_data,result)
  VALUES (v_tenant,'return',_idempotency_key,v_request,v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_compra(
  _pedido_id uuid, _motivo text, _versao_esperada integer,
  _idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.require_purchase_admin();
  v_order public.pedidos_compra%ROWTYPE;
  v_result jsonb;
  v_request jsonb := jsonb_build_object('pedido_id',_pedido_id,
    'motivo',_motivo,'versao_esperada',_versao_esperada);
BEGIN
  v_result := private.purchase_begin(v_tenant,_idempotency_key,'cancel',v_request);
  IF v_result IS NOT NULL THEN RETURN v_result; END IF;
  SELECT * INTO v_order FROM public.pedidos_compra
  WHERE id=_pedido_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND OR v_order.status IN ('recebido','cancelado') THEN
    RAISE EXCEPTION 'Pedido não pode ser cancelado';
  END IF;
  IF v_order.versao IS DISTINCT FROM _versao_esperada THEN
    RAISE EXCEPTION 'Pedido alterado por outro usuário';
  END IF;
  IF length(trim(COALESCE(_motivo,'')))<5 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento';
  END IF;
  UPDATE public.pedidos_compra SET status='cancelado',
    cancelamento_motivo=trim(_motivo),cancelado_em=now(),
    versao=versao+1,updated_at=now()
  WHERE id=_pedido_id RETURNING * INTO v_order;
  v_result := jsonb_build_object('id',v_order.id,'status',v_order.status,
    'versao',v_order.versao);
  INSERT INTO public.pedido_compra_operacoes
    (tenant_id,operation,idempotency_key,request_data,result)
  VALUES (v_tenant,'cancel',_idempotency_key,v_request,v_result);
  RETURN v_result;
END;
$function$;

DO $$
DECLARE v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'consultar_diretorio_insumos','consultar_diretorio_locais_estoque',
    'consultar_saldos_local_estoque','consultar_diretorio_movimentacoes_estoque',
    'salvar_estoque_local','registrar_movimentacao_estoque_local',
    'transferir_estoque','ajustar_estoque_contagem',
    'consultar_diretorio_pedidos_compra','consultar_pedido_compra_detalhes',
    'salvar_pedido_compra','aprovar_pedido_compra','receber_pedido_compra',
    'devolver_recebimento_compra','cancelar_pedido_compra'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM PUBLIC, anon',v_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated',v_name);
  END LOOP;
END;
$$;
