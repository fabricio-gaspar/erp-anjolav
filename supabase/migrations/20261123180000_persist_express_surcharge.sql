ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS valor_acrescimo_express numeric(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.calcular_acrescimo_express_rol(
  _ordem_id uuid,
  _tenant_id uuid,
  _urgente boolean,
  _percentual numeric,
  _desconto numeric
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  SELECT CASE WHEN coalesce(_urgente, false) THEN
    round(
      greatest(0, coalesce((
        SELECT sum(i.subtotal)
        FROM public.itens_ordem_servico i
        WHERE i.ordem_servico_id = _ordem_id
          AND i.tenant_id = _tenant_id
      ), 0) - coalesce(_desconto, 0)) * coalesce(_percentual, 0) / 100,
      2
    )
  ELSE 0 END;
$function$;

CREATE OR REPLACE FUNCTION private.definir_acrescimo_express_rol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  NEW.valor_acrescimo_express := private.calcular_acrescimo_express_rol(
    NEW.id,
    NEW.tenant_id,
    NEW.urgente,
    NEW.percentual_urgencia,
    NEW.valor_desconto
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sincronizar_acrescimo_express_por_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.ordem_servico_id;
  ELSE
    v_order_id := NEW.ordem_servico_id;
  END IF;

  UPDATE public.ordens_servico o
  SET valor_acrescimo_express = private.calcular_acrescimo_express_rol(
    o.id,
    o.tenant_id,
    o.urgente,
    o.percentual_urgencia,
    o.valor_desconto
  )
  WHERE o.id = v_order_id;

  IF TG_OP = 'UPDATE' AND OLD.ordem_servico_id IS DISTINCT FROM NEW.ordem_servico_id THEN
    UPDATE public.ordens_servico o
    SET valor_acrescimo_express = private.calcular_acrescimo_express_rol(
      o.id,
      o.tenant_id,
      o.urgente,
      o.percentual_urgencia,
      o.valor_desconto
    )
    WHERE o.id = OLD.ordem_servico_id;
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_definir_acrescimo_express_rol ON public.ordens_servico;
CREATE TRIGGER trg_definir_acrescimo_express_rol
BEFORE INSERT OR UPDATE OF urgente, percentual_urgencia, valor_desconto, valor_acrescimo_express
ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION private.definir_acrescimo_express_rol();

DROP TRIGGER IF EXISTS trg_sincronizar_acrescimo_express_por_item ON public.itens_ordem_servico;
CREATE TRIGGER trg_sincronizar_acrescimo_express_por_item
AFTER INSERT OR UPDATE OR DELETE
ON public.itens_ordem_servico
FOR EACH ROW
EXECUTE FUNCTION private.sincronizar_acrescimo_express_por_item();

UPDATE public.ordens_servico
SET valor_acrescimo_express = 0;

REVOKE ALL ON FUNCTION private.calcular_acrescimo_express_rol(uuid, uuid, boolean, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.definir_acrescimo_express_rol() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sincronizar_acrescimo_express_por_item() FROM PUBLIC, anon, authenticated;
