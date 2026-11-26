-- A single cash register has no operation_type; include orders from both
-- authorized operations when showing pending pickup balances.
DO $migration$
DECLARE
  definition text;
  old_filter text := 'o.operation_type IS NOT DISTINCT FROM v_caixa.operation_type';
BEGIN
  definition := pg_get_functiondef('public.obter_resumo_caixa(uuid)'::regprocedure);
  IF position(old_filter IN definition) = 0 THEN
    RAISE EXCEPTION 'Cash summary scope changed; review this migration';
  END IF;
  EXECUTE replace(definition, old_filter,
    '(v_caixa.operation_type IS NULL OR o.operation_type IS NOT DISTINCT FROM v_caixa.operation_type)');
END;
$migration$;

-- Reject values that round to zero before storing. Retain the existing
-- authorization, idempotency and concurrency rules of the RPC.
DO $migration$
DECLARE
  definition text;
  old_check text := 'OR _valor<=0 OR _valor>999999999999.99';
BEGIN
  definition := pg_get_functiondef('public.salvar_conta_pagar(uuid,text,text,uuid,numeric,date,text,uuid,uuid,text,integer,text)'::regprocedure);
  IF position(old_check IN definition) = 0 THEN
    RAISE EXCEPTION 'Payables validation changed; review this migration';
  END IF;
  EXECUTE replace(definition, old_check,
    'OR _valor<=0 OR round(_valor,2)<=0 OR _valor>999999999999.99');
END;
$migration$;

ALTER TABLE public.contas_pagar
  DROP CONSTRAINT IF EXISTS chk_contas_pagar_valor_positivo;
ALTER TABLE public.contas_pagar
  ADD CONSTRAINT chk_contas_pagar_valor_positivo CHECK (valor > 0);
