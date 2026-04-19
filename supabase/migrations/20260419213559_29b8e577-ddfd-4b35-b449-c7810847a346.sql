CREATE OR REPLACE FUNCTION public.get_employee_email_by_login(p_login text)
RETURNS TABLE(email text, ativo boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.email, f.ativo
  FROM funcionarios f
  WHERE lower(f.login) = lower(p_login)
  LIMIT 1;
$$;