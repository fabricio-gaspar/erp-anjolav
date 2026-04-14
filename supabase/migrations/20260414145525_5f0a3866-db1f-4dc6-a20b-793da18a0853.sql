
-- Add numero_rol column
ALTER TABLE public.lancamentos ADD COLUMN numero_rol TEXT;

-- Create function to generate ROL number
CREATE OR REPLACE FUNCTION public.generate_rol_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_number INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_rol FROM 10) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.lancamentos
  WHERE numero_rol LIKE 'ROL-' || year_prefix || '-%';
  NEW.numero_rol := 'ROL-' || year_prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_generate_rol_number
BEFORE INSERT ON public.lancamentos
FOR EACH ROW
WHEN (NEW.numero_rol IS NULL)
EXECUTE FUNCTION public.generate_rol_number();

-- Backfill existing lancamentos
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM public.lancamentos
  WHERE numero_rol IS NULL
)
UPDATE public.lancamentos l
SET numero_rol = 'ROL-' || TO_CHAR(l.created_at, 'YYYY') || '-' || LPAD(n.rn::TEXT, 6, '0')
FROM numbered n
WHERE l.id = n.id;
