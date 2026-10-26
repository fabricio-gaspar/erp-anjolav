-- Integration test: all fixtures and financial movements roll back.
BEGIN;
DO $test$
DECLARE
 t uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid();
 actor uuid:=gen_random_uuid(); limited uuid:=gen_random_uuid(); employee uuid;
 client uuid; residential uuid; foreign_client uuid; product uuid; foreign_product uuid; cash uuid;
 result jsonb; retry jsonb; order_id uuid; launch uuid; invoice uuid; paid_order uuid;
 key text:='test-unified-'||gen_random_uuid()::text;
 items jsonb; count_rows integer;
BEGIN
 INSERT INTO public.tenants(id,nome,slug) VALUES(t,'PDV rollback test','pdv-test-'||t),(t2,'PDV tenant isolation','pdv-test-'||t2);
 INSERT INTO auth.users(id) VALUES(actor),(limited);
 INSERT INTO public.tenant_memberships(tenant_id,user_id,role,enabled,is_active)
 VALUES(t,actor,'admin',true,true),(t,limited,'member',true,true);
 INSERT INTO public.funcionarios(tenant_id,user_id,nome,cargo,login) VALUES(t,actor,'Test admin','administrador','pdv-test-'||actor);
 INSERT INTO public.funcionarios(tenant_id,user_id,nome,cargo,login) VALUES(t,limited,'Test limited','atendente','pdv-test-'||limited) RETURNING id INTO employee;
 INSERT INTO public.area_permissoes(tenant_id,user_id,area) VALUES(t,limited,'residencial');
 INSERT INTO public.modulo_permissoes(tenant_id,funcionario_id,modulo_key,tem_acesso)
 VALUES(t,employee,'caixa',true),(t,employee,'clientes',true);
 INSERT INTO public.clientes(tenant_id,razao_social,classificacao) VALUES(t,'Test industrial','industrial') RETURNING id INTO client;
 INSERT INTO public.clientes(tenant_id,razao_social,classificacao) VALUES(t,'Test residential','residencial') RETURNING id INTO residential;
 INSERT INTO public.clientes(tenant_id,razao_social,classificacao) VALUES(t2,'Test other tenant','industrial') RETURNING id INTO foreign_client;
 INSERT INTO public.produtos(tenant_id,nome,preco,unidade,unidade_negocio) VALUES(t,'Test kg',20,'kg','ambos') RETURNING id INTO product;
 INSERT INTO public.produtos(tenant_id,nome,preco,unidade,unidade_negocio) VALUES(t2,'Test other product',1,'kg','ambos') RETURNING id INTO foreign_product;
 INSERT INTO public.caixas(tenant_id,operador,operador_id) VALUES(t,'Test',(SELECT id FROM public.funcionarios WHERE user_id=actor AND tenant_id=t)) RETURNING id INTO cash;
 items:=jsonb_build_array(jsonb_build_object('produto_id',product,'quantidade',1.5));

 -- Unpaid industrial service without an open cash requirement, priced by server.
 result:=public.criar_venda_pdv(client,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key);
 order_id:=(result->'order'->>'id')::uuid;
 IF (result->'order'->>'total')::numeric<>30 THEN RAISE EXCEPTION 'TEST incorrect standard price'; END IF;
 IF (SELECT origem FROM public.ordens_servico WHERE id=order_id)<>'industrial' THEN RAISE EXCEPTION 'TEST wrong sector'; END IF;
 retry:=public.criar_venda_pdv(client,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key);
 IF retry->>'idempotent'<>'true' OR retry->'order'->>'id'<>order_id::text THEN RAISE EXCEPTION 'TEST duplicate sale'; END IF;
 BEGIN
  PERFORM public.criar_venda_pdv(residential,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key);
  RAISE EXCEPTION 'TEST expected idempotency rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Chave de idempotência%' THEN RAISE; END IF; END;

 -- Sector and tenant boundaries are enforced inside the privileged RPC.
 BEGIN
  PERFORM public.criar_venda_pdv(client,NULL,current_date,false,0,0,NULL,NULL,items,NULL,limited,key||'denied');
  RAISE EXCEPTION 'TEST expected area rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Sem permissão para atender este cliente' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.criar_venda_pdv(foreign_client,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key||'tenant');
  RAISE EXCEPTION 'TEST expected tenant rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Sem permissão para atender este cliente' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.criar_venda_pdv(client,NULL,current_date,false,0,0,NULL,NULL,
    jsonb_build_array(jsonb_build_object('produto_id',foreign_product,'quantidade',1)),NULL,actor,key||'product');
  RAISE EXCEPTION 'TEST expected product rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Produto incompatível%' THEN RAISE; END IF; END;

 -- Custom price is required (no silent fallback), then used.
 UPDATE public.clientes SET tabela_preco_tipo='personalizada' WHERE id=client;
 BEGIN
  PERFORM public.criar_venda_pdv(client,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key||'missingprice');
  RAISE EXCEPTION 'TEST expected missing price rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Produto sem preço%' THEN RAISE; END IF; END;
 INSERT INTO public.precos_especiais(tenant_id,cliente_id,produto_id,preco_especial,tipo) VALUES(t,client,product,12,'desconto');

 -- Billed order has one linked launch, no payment or cash movement.
 INSERT INTO public.configuracoes_pagamento_cliente(tenant_id,cliente_id,condicao_pagamento,tipo_faturamento,forma_pagamento)
 VALUES(t,client,'faturado','mensal','boleto');
 result:=public.criar_venda_pdv(client,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key||'billed');
 order_id:=(result->'order'->>'id')::uuid;
 IF (result->'order'->>'total')::numeric<>18 THEN RAISE EXCEPTION 'TEST incorrect custom price'; END IF;
 SELECT id INTO launch FROM public.lancamentos WHERE ordem_servico_id=order_id;
 IF launch IS NULL OR (SELECT sum(subtotal) FROM public.itens_lancamento WHERE lancamento_id=launch)<>18
   OR EXISTS(SELECT 1 FROM public.pdv_pagamentos WHERE ordem_servico_id=order_id) THEN RAISE EXCEPTION 'TEST incorrect billed launch'; END IF;
 BEGIN
  PERFORM public.registrar_pagamento_pdv(order_id,cash,'DINHEIRO',18,20,1,NULL,NULL,NULL,'ENTRADA',key||'badpay',actor);
  RAISE EXCEPTION 'TEST expected billed payment rejection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'OS inválida%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE public.lancamentos SET valor_total=1 WHERE id=launch;
  RAISE EXCEPTION 'TEST expected snapshot protection';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'O valor e vínculo%' THEN RAISE; END IF; END;
 INSERT INTO public.faturas(tenant_id,cliente_id,periodo_inicio,periodo_fim,valor_total)
 VALUES(t,client,current_date,current_date,18) RETURNING id INTO invoice;
 UPDATE public.lancamentos SET fatura_id=invoice,status='faturado' WHERE id=launch;
 UPDATE public.faturas SET status='pago' WHERE id=invoice;
 IF (SELECT status_pagamento FROM public.ordens_servico WHERE id=order_id)<>'pago' THEN RAISE EXCEPTION 'TEST invoice not reconciled'; END IF;
 UPDATE public.faturas SET status='cancelado' WHERE id=invoice;
 UPDATE public.ordens_servico SET status='cancelada' WHERE id=order_id;
 IF (SELECT status FROM public.lancamentos WHERE id=launch)<>'cancelado' THEN RAISE EXCEPTION 'TEST launch not cancelled'; END IF;

 -- Entrance requires a payment; PIX remains pending until provider confirmation.
 INSERT INTO public.configuracoes_pagamento_cliente(tenant_id,cliente_id,condicao_pagamento,tipo_faturamento,forma_pagamento)
 VALUES(t,residential,'entrada','avulso','pix');
 BEGIN
  PERFORM public.criar_venda_pdv(residential,NULL,current_date,false,0,0,NULL,NULL,items,NULL,actor,key||'nopay');
  RAISE EXCEPTION 'TEST expected required payment';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Este cliente exige pagamento na entrada' THEN RAISE; END IF; END;
 result:=public.criar_venda_pdv(residential,cash,current_date,false,0,0,NULL,NULL,items,'{"metodo":"PIX"}',actor,key||'pix');
 IF result->'order'->>'paymentStatus'<>'pendente' THEN RAISE EXCEPTION 'TEST simulated PIX confirmation'; END IF;
 result:=public.criar_venda_pdv(residential,cash,current_date,false,0,0,NULL,NULL,items,
  '{"metodo":"DINHEIRO","valor_recebido":40,"parcelas":1}',actor,key||'cash');
 paid_order:=(result->'order'->>'id')::uuid;
 IF (SELECT valor_pago FROM public.ordens_servico WHERE id=paid_order)<>30 THEN RAISE EXCEPTION 'TEST cash receipt mismatch'; END IF;


 -- Measured units support decimal meters, but piece counts stay integral.
 UPDATE public.produtos SET unidade='metro' WHERE id=product;
 result:=public.criar_venda_pdv(residential,cash,current_date,false,0,0,NULL,NULL,items,'{"metodo":"PIX"}',actor,key||'meters');
 IF (result->'order'->>'total')::numeric<>30 THEN RAISE EXCEPTION 'TEST decimal meters'; END IF;
 UPDATE public.produtos SET unidade='peca' WHERE id=product;
 BEGIN
  PERFORM public.criar_venda_pdv(residential,cash,current_date,false,0,0,NULL,NULL,items,'{"metodo":"PIX"}',actor,key||'pieces');
  RAISE EXCEPTION 'TEST fractional pieces accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Este produto exige quantidade inteira' THEN RAISE; END IF; END;
 UPDATE public.produtos SET unidade='kg' WHERE id=product;
 BEGIN
  PERFORM public.criar_venda_pdv(residential,cash,current_date,false,0,1,NULL,NULL,items,'{"metodo":"PIX"}',limited,key||'discount');
  RAISE EXCEPTION 'TEST discount permission bypass';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Sem permissão para conceder desconto' THEN RAISE; END IF; END;
 IF has_function_privilege('authenticated','public.resgatar_pontos_fidelidade_pdv(uuid,uuid,integer,text,text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'TEST loyalty must require authenticated Edge authorization';
 END IF;

 -- Financial aggregation follows the actual sector and sees the cash receipt once.
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 result:=public.consultar_dashboard_financeiro(current_date,current_date,'loja');
 IF (result->>'receitas_totais')::numeric<>30 THEN RAISE EXCEPTION 'TEST residential financial totals'; END IF;
 result:=public.consultar_dashboard_financeiro(current_date,current_date,'industrial');
 IF (result->>'receitas_totais')::numeric<>0 THEN RAISE EXCEPTION 'TEST industrial financial totals'; END IF;
 IF (SELECT sum(valor_recebido) FROM public.v_contas_receber WHERE origem='pdv_loja')<>30 THEN RAISE EXCEPTION 'TEST receivable view'; END IF;
 EXECUTE 'RESET ROLE';

 -- Actual authenticated RLS: limited cashier can read prices, cannot alter terms.
 PERFORM set_config('request.jwt.claim.sub',limited::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',limited,'role','authenticated')::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO count_rows FROM public.clientes WHERE id=foreign_client;
 IF count_rows<>0 THEN RAISE EXCEPTION 'TEST tenant leak'; END IF;
 SELECT count(*) INTO count_rows FROM public.clientes WHERE id=client;
 IF count_rows<>0 THEN RAISE EXCEPTION 'TEST area leak'; END IF;
 BEGIN
  INSERT INTO public.configuracoes_pagamento_cliente(tenant_id,cliente_id,condicao_pagamento)
  VALUES(t,residential,'faturado');
  RAISE EXCEPTION 'TEST terms RLS bypass';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.clientes SET tabela_preco_tipo='personalizada' WHERE id=residential;
  RAISE EXCEPTION 'TEST price mode bypass';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Sem permissão para alterar a tabela de preços' THEN RAISE; END IF; END;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
END;
$test$;
ROLLBACK;
SELECT 'Unified PDV: atomic creation, idempotency, prices, billed reconciliation, payment timing and RLS passed; fixtures rolled back' AS result;

