-- Cash changes must pass through the validated, idempotent RPCs. The SELECT
-- policies remain available to operational reports.
REVOKE INSERT, UPDATE, DELETE ON public.caixas FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.caixa_movimentacoes FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('caixas', 'caixa_movimentacoes')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_policy.tablename);
  END LOOP;
END;
$$;

-- A report viewer can read the cash register, but cannot operate it.
CREATE OR REPLACE FUNCTION private.pdv_cash_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND private.has_any_module_access(ARRAY['caixa']::text[]);
$function$;

REVOKE ALL ON FUNCTION private.pdv_cash_write_allowed() FROM PUBLIC, anon, authenticated;

-- Keep the existing RPC bodies and their grants intact. Replace only the
-- authorization predicate of the three write operations.
DO $$
DECLARE
  v_name text;
  v_function oid;
  v_definition text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'abrir_caixa',
    'registrar_movimentacao_caixa',
    'fechar_caixa'
  ] LOOP
    SELECT p.oid INTO v_function
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name AND p.prokind = 'f';
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'Cash RPC % is missing', v_name;
    END IF;
    v_definition := pg_get_functiondef(v_function);
    IF position('private.pdv_cash_access_allowed()' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Cash RPC % no longer has the expected permission check', v_name;
    END IF;
    EXECUTE replace(
      v_definition,
      'private.pdv_cash_access_allowed()',
      'private.pdv_cash_write_allowed()'
    );
  END LOOP;
END;
$$;

-- Existing movements can be attributed to their linked payment. Do not infer
-- an operator from the customer, order or register opener.
UPDATE public.caixa_movimentacoes AS m
SET criado_por = p.criado_por
FROM public.pdv_pagamentos AS p
WHERE m.criado_por IS NULL
  AND p.id = m.pdv_pagamento_id
  AND p.tenant_id = m.tenant_id
  AND p.criado_por IS NOT NULL;

CREATE OR REPLACE FUNCTION private.set_cash_movement_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
BEGIN
  IF NEW.criado_por IS NULL AND NEW.pdv_pagamento_id IS NOT NULL THEN
    SELECT p.criado_por INTO NEW.criado_por
    FROM public.pdv_pagamentos AS p
    WHERE p.id = NEW.pdv_pagamento_id
      AND p.tenant_id = NEW.tenant_id;
  END IF;
  NEW.criado_por := COALESCE(NEW.criado_por, auth.uid());
  IF NEW.criado_por IS NULL THEN
    RAISE EXCEPTION 'Movimentação sem operador identificado';
  END IF;
  RETURN NEW;
END;
$function$;

-- Both triggers called registrar_historico_status() for each status change.
DROP TRIGGER IF EXISTS trg_registrar_historico_status ON public.ordens_servico;
