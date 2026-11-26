ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS atendente_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ordens_servico_atendente_id_fkey'
      AND conrelid = 'public.ordens_servico'::regclass
  ) THEN
    ALTER TABLE public.ordens_servico
      ADD CONSTRAINT ordens_servico_atendente_id_fkey
      FOREIGN KEY (atendente_id)
      REFERENCES public.funcionarios(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ordens_servico_tenant_atendente_created_idx
  ON public.ordens_servico (tenant_id, atendente_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.assign_order_attendant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_tenant_id uuid;
  v_funcionario_id uuid;
BEGIN
  IF NEW.atendente_id IS NOT NULL OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_tenant_id := COALESCE(NEW.tenant_id, private.current_tenant_id());
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT f.id
    INTO v_funcionario_id
  FROM public.funcionarios f
  WHERE f.tenant_id = v_tenant_id
    AND f.user_id = auth.uid()
    AND f.ativo = true
  ORDER BY f.created_at
  LIMIT 1;

  NEW.atendente_id := v_funcionario_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assign_order_attendant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS assign_order_attendant ON public.ordens_servico;
CREATE TRIGGER assign_order_attendant
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_order_attendant();

WITH first_order_actor AS (
  SELECT DISTINCT ON (a.tenant_id, a.entity_id)
    a.tenant_id,
    a.entity_id,
    f.id AS funcionario_id
  FROM public.audit_events a
  JOIN public.funcionarios f
    ON f.user_id = a.actor_id
   AND f.tenant_id = a.tenant_id
   AND f.ativo = true
  WHERE a.entity_schema = 'public'
    AND a.entity_table = 'ordens_servico'
    AND a.action = 'INSERT'
  ORDER BY a.tenant_id, a.entity_id, a.occurred_at
)
UPDATE public.ordens_servico o
SET atendente_id = actor.funcionario_id
FROM first_order_actor actor
WHERE o.atendente_id IS NULL
  AND actor.tenant_id = o.tenant_id
  AND actor.entity_id = o.id::text;
