-- The public RPC is callable directly by authenticated users as well as by the
-- validated PDV Edge Function. Enforce the same sector boundary at the RPC.
DO $migration$
DECLARE
  definition text;
  old_fragment text;
  new_fragment text;
BEGIN
  definition := pg_get_functiondef('public.consultar_capacidade_pdv(uuid,text,date)'::regprocedure);
  old_fragment := 'IF auth.uid() IS NOT NULL AND _tenant_id IS DISTINCT FROM private.current_tenant_id() THEN';
  new_fragment := $new$IF auth.uid() IS NOT NULL AND NOT private.pdv_actor_allowed(
    auth.uid(), _tenant_id, _area, ARRAY['caixa', 'faturamento', 'ordens', 'agenda']
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar a capacidade deste setor' USING ERRCODE = '42501';
  END IF;
  $new$ || old_fragment;
  IF position(old_fragment IN definition) = 0 THEN
    RAISE EXCEPTION 'A validação da capacidade mudou; revise esta migração';
  END IF;
  EXECUTE replace(definition, old_fragment, new_fragment);
END;
$migration$;
