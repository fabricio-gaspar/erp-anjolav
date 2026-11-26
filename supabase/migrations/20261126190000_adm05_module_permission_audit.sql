-- ADM-05: record effective module permission changes in the existing audit ledger.
-- Explicit false and a missing row have the same access result, so neither
-- inserting nor deleting a false row creates an audit event.
CREATE OR REPLACE FUNCTION private.audit_modulo_permissao_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_entity_id text;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.tem_acesso THEN
      RETURN NEW;
    END IF;
    v_tenant_id := NEW.tenant_id;
    v_entity_id := NEW.id::text;
    v_new_data := jsonb_build_object(
      'funcionario_id', NEW.funcionario_id,
      'modulo_key', NEW.modulo_key,
      'tem_acesso', NEW.tem_acesso
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NOT OLD.tem_acesso AND NOT NEW.tem_acesso)
       OR (ROW(OLD.funcionario_id, OLD.modulo_key, OLD.tem_acesso)
           IS NOT DISTINCT FROM ROW(NEW.funcionario_id, NEW.modulo_key, NEW.tem_acesso)) THEN
      RETURN NEW;
    END IF;
    v_tenant_id := NEW.tenant_id;
    v_entity_id := NEW.id::text;
    v_old_data := jsonb_build_object(
      'funcionario_id', OLD.funcionario_id,
      'modulo_key', OLD.modulo_key,
      'tem_acesso', OLD.tem_acesso
    );
    v_new_data := jsonb_build_object(
      'funcionario_id', NEW.funcionario_id,
      'modulo_key', NEW.modulo_key,
      'tem_acesso', NEW.tem_acesso
    );
  ELSE -- DELETE, including employee deletion cascading to this table.
    IF NOT OLD.tem_acesso THEN
      RETURN OLD;
    END IF;
    v_tenant_id := OLD.tenant_id;
    v_entity_id := OLD.id::text;
    v_old_data := jsonb_build_object(
      'funcionario_id', OLD.funcionario_id,
      'modulo_key', OLD.modulo_key,
      'tem_acesso', OLD.tem_acesso
    );
  END IF;

  INSERT INTO public.audit_events (
    tenant_id, actor_id, action, entity_schema, entity_table,
    entity_id, old_data, new_data
  ) VALUES (
    v_tenant_id, auth.uid(), TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME,
    v_entity_id, v_old_data, v_new_data
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

REVOKE ALL ON FUNCTION private.audit_modulo_permissao_change() FROM PUBLIC, anon, authenticated;

-- Reuse the conventional name so this table has one mutation audit trigger.
DROP TRIGGER IF EXISTS audit_mutation ON public.modulo_permissoes;
CREATE TRIGGER audit_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.modulo_permissoes
FOR EACH ROW EXECUTE FUNCTION private.audit_modulo_permissao_change();
