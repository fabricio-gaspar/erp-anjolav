-- Preserve the existing sale transaction and idempotency checks while storing
-- the operator's order notes in the same transaction as the new ROL.
DO $migration$
DECLARE
  definition text;
  expected text := 'capacidade_reservada=v_requested,';
  replacement text := $patch$observacoes=nullif(left(trim(coalesce(_observacoes,'')),500),''), capacidade_reservada=v_requested,$patch$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO STRICT definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'criar_pedido_atendimento_v2'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%_observacoes text%';
  IF position(expected IN definition) = 0 OR position('observacoes=nullif(left(trim(coalesce(_observacoes' IN definition) > 0 THEN
    RAISE EXCEPTION 'A definição da criação de ROL mudou; revise a migração antes de aplicá-la.';
  END IF;
  EXECUTE replace(definition, expected, replacement);
END
$migration$;
