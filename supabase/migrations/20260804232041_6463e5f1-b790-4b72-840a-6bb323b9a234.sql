CREATE OR REPLACE FUNCTION public.get_employee_email_by_login(p_login text)
RETURNS TABLE(email text, ativo boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT f.email, f.ativo
  FROM funcionarios f
  WHERE (lower(f.login) = lower(trim(p_login)) OR lower(coalesce(f.email,'')) = lower(trim(p_login)))
    AND f.ativo = true
    AND f.email IS NOT NULL
  ORDER BY (lower(f.login) = lower(trim(p_login))) DESC
  LIMIT 1;
$function$;