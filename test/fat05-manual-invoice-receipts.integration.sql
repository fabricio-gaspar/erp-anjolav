-- Run with psql against a local database after both FAT-05 migrations.
-- Fixtures, receipts and the cash close are rolled back unconditionally.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
  clerk_user uuid := gen_random_uuid();
  clerk_employee uuid;
  customer_a uuid;
  customer_b uuid;
  invoice_a uuid;
  invoice_b uuid;
  invoice_provider uuid;
  charge_id uuid;
  cash_id uuid;
  payment_key text := 'fat05-partial-' || gen_random_uuid()::text;
  full_key text := 'fat05-full-' || gen_random_uuid()::text;
  result jsonb;
  replay jsonb;
  partial_payment_id uuid;
  cash_summary jsonb;
  invoice_payload jsonb;
  movement_count integer;
  denied boolean;
BEGIN
  INSERT INTO public.tenants (id,nome,slug) VALUES
    (tenant_a,'FAT05 test A','fat05-a-' || tenant_a),
    (tenant_b,'FAT05 test B','fat05-b-' || tenant_b);
  INSERT INTO auth.users (id) VALUES (admin_user),(clerk_user);
  INSERT INTO public.tenant_memberships (tenant_id,user_id,role,enabled,is_active)
  VALUES (tenant_a,admin_user,'admin',true,true),
         (tenant_a,clerk_user,'member',true,true);
  INSERT INTO public.funcionarios (tenant_id,user_id,nome,cargo,login,ativo)
  VALUES (tenant_a,clerk_user,'FAT05 clerk','caixa','fat05-' || clerk_user,true)
  RETURNING id INTO clerk_employee;
  INSERT INTO public.clientes (tenant_id,razao_social,classificacao)
  VALUES (tenant_a,'FAT05 customer A','industrial') RETURNING id INTO customer_a;
  INSERT INTO public.clientes (tenant_id,razao_social,classificacao)
  VALUES (tenant_b,'FAT05 customer B','industrial') RETURNING id INTO customer_b;
  INSERT INTO public.faturas
    (tenant_id,cliente_id,periodo_inicio,periodo_fim,valor_total,data_vencimento,operation_type)
  VALUES (tenant_a,customer_a,current_date,current_date,100,current_date,'industrial')
  RETURNING id INTO invoice_a;
  UPDATE public.faturas SET status='nota_emitida' WHERE id=invoice_a;
  INSERT INTO public.faturas
    (tenant_id,cliente_id,periodo_inicio,periodo_fim,valor_total,data_vencimento,operation_type)
  VALUES (tenant_b,customer_b,current_date,current_date,50,current_date,'industrial')
  RETURNING id INTO invoice_b;
  INSERT INTO public.faturas
    (tenant_id,cliente_id,periodo_inicio,periodo_fim,valor_total,data_vencimento,operation_type)
  VALUES (tenant_a,customer_a,current_date,current_date,25,current_date,'industrial')
  RETURNING id INTO invoice_provider;
  INSERT INTO public.caixas (tenant_id,operador,data_abertura,status)
  VALUES (tenant_a,'FAT05 shared',now(),'ABERTO') RETURNING id INTO cash_id;

  INSERT INTO public.asaas_charges
    (tenant_id,customer_name,description,value,due_date,billing_type,status,external_reference)
  VALUES (tenant_a,'FAT05 customer A','Invoice charge',25,current_date,'PIX','RECEIVED',
    'fatura:' || invoice_provider::text || ':pix') RETURNING id INTO charge_id;
  UPDATE public.faturas SET asaas_charge_id = charge_id WHERE id = invoice_provider;

  PERFORM set_config('request.jwt.claim.sub',admin_user::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF NOT EXISTS (SELECT 1 FROM public.v_contas_receber
      WHERE id=invoice_a AND origem='fatura' AND status='pendente' AND valor_recebido=0) THEN
    RAISE EXCEPTION 'Invoice issue was incorrectly treated as payment';
  END IF;
  IF has_table_privilege('authenticated','public.fatura_pagamentos','INSERT')
     OR has_table_privilege('authenticated','public.fatura_pagamentos','UPDATE')
     OR has_function_privilege('anon',
       'public.registrar_pagamento_fatura(uuid,uuid,numeric,date,text,text,text,integer,text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'Receipt ledger write privilege leaked';
  END IF;

  result := public.registrar_pagamento_fatura(invoice_a,cash_id,40,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,'PIX','receipt 1',NULL,0,payment_key);
  IF result->>'statusPagamento' <> 'parcial'
     OR (result->>'valorPago')::numeric <> 40
     OR (result->>'saldo')::numeric <> 60
     OR (result->>'versao')::integer <> 1 THEN
    RAISE EXCEPTION 'Partial receipt invalid: %',result;
  END IF;
  partial_payment_id := (result->>'pagamentoId')::uuid;
  IF NOT EXISTS (SELECT 1 FROM public.v_contas_receber
      WHERE id=invoice_a AND origem='fatura' AND status='parcial' AND valor_recebido=40
        AND data_recebimento=(now() AT TIME ZONE 'America/Sao_Paulo')::date)
     OR NOT EXISTS (SELECT 1 FROM public.v_contas_receber
      WHERE id=invoice_provider AND origem='fatura' AND status='recebido' AND valor_recebido=25) THEN
    RAISE EXCEPTION 'Receivables view lost manual or provider settlement';
  END IF;
  SELECT count(*) INTO movement_count FROM public.caixa_movimentacoes
  WHERE caixa_id=cash_id AND tipo='FATURA_RECEBIMENTO';
  IF movement_count <> 1 THEN RAISE EXCEPTION 'Partial receipt cash movement missing'; END IF;
  result := public.consultar_dashboard_financeiro(current_date,current_date,'todos');
  IF (result->>'receitas_totais')::numeric <> 65
     OR (result->>'a_receber_hoje')::numeric <> 60 THEN
    RAISE EXCEPTION 'Finance dashboard double-counted or omitted partial/provider receipts: %',result;
  END IF;
  result := public.consultar_faturas_faturamento_periodo('central',current_date,current_date,1,25);
  SELECT elem.value INTO invoice_payload
  FROM jsonb_array_elements(result->'items') AS elem(value)
  WHERE elem.value->>'id'=invoice_a::text;
  IF (invoice_payload->>'valor_pago')::numeric <> 40
     OR invoice_payload->>'status_pagamento' <> 'parcial'
     OR (invoice_payload->>'versao_financeira')::integer <> 1 THEN
    RAISE EXCEPTION 'Active billing directory omitted receipt fields: %',invoice_payload;
  END IF;

  denied := false;
  BEGIN
    UPDATE public.faturas SET valor_pago=99 WHERE id=invoice_a;
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Recebimentos de fatura devem ser registrados%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Direct invoice receipt mutation accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.registrar_pagamento_fatura(invoice_a,cash_id,41,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,'PIX','receipt 1',NULL,0,payment_key);
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Chave de idempotência já utilizada%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Conflicting idempotency key accepted'; END IF;

  denied := false;
  BEGIN
    PERFORM public.registrar_pagamento_fatura(invoice_provider,cash_id,1,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,'PIX',NULL,NULL,0,
      'fat05-charge-' || gen_random_uuid()::text);
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Fatura com cobrança Asaas%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Provider charge was counted manually'; END IF;

  EXECUTE 'RESET ROLE';
  denied := false;
  BEGIN
    INSERT INTO public.asaas_charges
      (tenant_id,customer_name,description,value,due_date,billing_type,status,external_reference)
    VALUES (tenant_a,'FAT05 customer A','Late invoice charge',100,current_date,
      'PIX','PENDING','fatura:' || invoice_a::text || ':pix');
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Fatura com recebimento manual não aceita cobrança Asaas%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Asaas charge raced a manual receipt'; END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';

  denied := false;
  BEGIN
    PERFORM public.registrar_pagamento_fatura(invoice_b,cash_id,1,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,'PIX',NULL,NULL,0,
      'fat05-tenant-' || gen_random_uuid()::text);
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Fatura não encontrada%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-tenant invoice receipt accepted'; END IF;

  PERFORM set_config('request.jwt.claim.sub',clerk_user::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',clerk_user,'role','authenticated')::text,true);
  denied := false;
  BEGIN
    PERFORM public.registrar_pagamento_fatura(invoice_a,cash_id,60,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,'DINHEIRO',NULL,NULL,1,full_key);
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Sem permissão para receber faturas%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Clerk without modules received an invoice'; END IF;

  EXECUTE 'RESET ROLE';
  INSERT INTO public.modulo_permissoes
    (tenant_id,funcionario_id,modulo_key,tem_acesso)
  VALUES (tenant_a,clerk_employee,'faturamento',true),
         (tenant_a,clerk_employee,'caixa',true);
  INSERT INTO public.area_permissoes (tenant_id,user_id,area)
  VALUES (tenant_a,clerk_user,'residencial');
  PERFORM set_config('request.jwt.claim.sub',clerk_user::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',clerk_user,'role','authenticated')::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  denied := false;
  BEGIN
    PERFORM public.registrar_pagamento_fatura(invoice_a,cash_id,60,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,'DINHEIRO',NULL,NULL,1,full_key);
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Fatura não encontrada%' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Wrong-area receipt accepted'; END IF;

  EXECUTE 'RESET ROLE';
  INSERT INTO public.area_permissoes (tenant_id,user_id,area)
  VALUES (tenant_a,clerk_user,'industrial');
  EXECUTE 'SET LOCAL ROLE authenticated';
  result := public.registrar_pagamento_fatura(invoice_a,cash_id,60,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,'DINHEIRO',NULL,NULL,1,full_key);
  IF result->>'statusPagamento' <> 'pago' OR (result->>'saldo')::numeric <> 0 THEN
    RAISE EXCEPTION 'Shared cashier full receipt invalid: %',result;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.v_contas_receber
      WHERE id=invoice_a AND origem='fatura' AND status='recebido' AND valor_recebido=100)
     OR (SELECT count(*) FROM public.fatura_pagamentos WHERE fatura_id=invoice_a) <> 2 THEN
    RAISE EXCEPTION 'Full receipt did not reconcile exactly twice';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',admin_user::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
  replay := public.registrar_pagamento_fatura(invoice_a,cash_id,40,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,'PIX','receipt 1',NULL,0,payment_key);
  IF NOT (replay->>'idempotent')::boolean
     OR (replay->>'pagamentoId')::uuid <> partial_payment_id THEN
    RAISE EXCEPTION 'Idempotent replay failed: %',replay;
  END IF;
  IF (SELECT count(*) FROM public.fatura_pagamentos WHERE fatura_id=invoice_a) <> 2
     OR (SELECT count(*) FROM public.caixa_movimentacoes
         WHERE caixa_id=cash_id AND tipo='FATURA_RECEBIMENTO') <> 2 THEN
    RAISE EXCEPTION 'Replay double-counted receipt';
  END IF;
  result := public.consultar_dashboard_financeiro(current_date,current_date,'todos');
  IF (result->>'receitas_totais')::numeric <> 125
     OR (result->>'a_receber_hoje')::numeric <> 0 THEN
    RAISE EXCEPTION 'Finance dashboard double-counted full/provider receipts: %',result;
  END IF;

  cash_summary := public.obter_resumo_caixa(cash_id);
  IF (cash_summary->>'pix')::numeric <> 40
     OR (cash_summary->>'dinheiroVendas')::numeric <> 60
     OR (cash_summary->>'vendasLiquidas')::numeric <> 0 THEN
    RAISE EXCEPTION 'Shared cash summary omitted invoice receipts: %',cash_summary;
  END IF;
  result := public.fechar_caixa_auditado(cash_id,60,40,0,0,0,NULL,
    'fat05-close-' || gen_random_uuid()::text);
  IF (result->>'valor_esperado')::numeric <> 100
     OR (result->>'valor_vendas')::numeric <> 0 THEN
    RAISE EXCEPTION 'Cash closure omitted invoice receipts: %',result;
  END IF;
  result := public.obter_demonstrativo_industrial(customer_a,current_date,current_date,invoice_a);
  IF result->>'escopo' <> 'fatura'
     OR (result->'totais'->>'valorFaturado')::numeric <> 100
     OR (result->'totais'->>'valorPago')::numeric <> 100
     OR (result->'totais'->>'saldoFaturado')::numeric <> 0
     OR result->'fatura'->>'statusPagamento' <> 'pago' THEN
    RAISE EXCEPTION 'Industrial statement did not reconcile full invoice: %',result;
  END IF;
  EXECUTE 'RESET ROLE';
END;
$test$;
ROLLBACK;
SELECT 'FAT-05 manual invoice receipts passed' AS result;
