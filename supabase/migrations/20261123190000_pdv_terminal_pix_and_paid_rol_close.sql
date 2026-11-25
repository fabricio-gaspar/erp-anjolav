-- Registra PIX de maquininha como pagamento manual confirmado e só permite
-- concluir um ROL depois de o saldo integral estar recebido.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.registrar_pagamento_pdv(uuid,uuid,text,numeric,numeric,integer,text,text,text,text,text,uuid)'::regprocedure
  ) INTO v_definition;

  IF position('upper(_metodo) NOT IN (''DINHEIRO'', ''CARTAO_CREDITO'', ''CARTAO_DEBITO'')' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A validação de métodos do registrar_pagamento_pdv mudou; revise a migração antes de aplicar';
  END IF;

  v_definition := replace(
    v_definition,
    'upper(_metodo) NOT IN (''DINHEIRO'', ''CARTAO_CREDITO'', ''CARTAO_DEBITO'')',
    'upper(_metodo) NOT IN (''DINHEIRO'', ''PIX'', ''CARTAO_CREDITO'', ''CARTAO_DEBITO'')'
  );
  EXECUTE v_definition;

  SELECT pg_get_functiondef(
    'public.criar_venda_pdv_com_taxa(uuid,uuid,date,boolean,numeric,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)'::regprocedure
  ) INTO v_definition;

  IF position(' <> ''PIX'' THEN' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A regra de pagamento do criar_venda_pdv_com_taxa mudou; revise a migração antes de aplicar';
  END IF;

  v_definition := replace(
    v_definition,
    'IF _pagamento IS NOT NULL AND _pagamento <> ''null''::jsonb AND upper(coalesce(_pagamento->>''metodo'','''')) <> ''PIX'' THEN',
    'IF _pagamento IS NOT NULL AND _pagamento <> ''null''::jsonb THEN'
  );
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.dar_baixa_rol_pdv(uuid)'::regprocedure)
    INTO v_definition;

  IF position('v_order.condicao_pagamento <> ''faturado'' AND v_paid + 0.009 < coalesce(v_order.valor_total, 0)' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'A validação do saldo em dar_baixa_rol_pdv mudou; revise a migração antes de aplicar';
  END IF;

  v_definition := replace(
    v_definition,
    'v_order.condicao_pagamento <> ''faturado'' AND v_paid + 0.009 < coalesce(v_order.valor_total, 0)',
    'v_paid + 0.009 < coalesce(v_order.valor_total, 0)'
  );
  EXECUTE v_definition;
END;
$migration$;
