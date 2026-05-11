CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role public.app_role;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  target_role := CASE
    WHEN upper(coalesce(NEW.cargo, '')) = 'ADMINISTRADOR' THEN 'admin'::public.app_role
    WHEN upper(coalesce(NEW.cargo, '')) IN ('PRODUCAO', 'PRODUÇÃO') THEN 'producao'::public.app_role
    ELSE 'operador'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_funcionario_user_link ON public.funcionarios;
DROP TRIGGER IF EXISTS trg_handle_new_user_role ON public.funcionarios;

CREATE TRIGGER trg_handle_new_user_role
AFTER INSERT OR UPDATE OF user_id, cargo ON public.funcionarios
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();

INSERT INTO public.user_roles (user_id, role)
SELECT
  f.user_id,
  CASE
    WHEN upper(coalesce(f.cargo, '')) = 'ADMINISTRADOR' THEN 'admin'::public.app_role
    WHEN upper(coalesce(f.cargo, '')) IN ('PRODUCAO', 'PRODUÇÃO') THEN 'producao'::public.app_role
    ELSE 'operador'::public.app_role
  END
FROM public.funcionarios f
WHERE f.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;