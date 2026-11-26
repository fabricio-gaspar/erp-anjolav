BEGIN;

CREATE OR REPLACE FUNCTION private.client_name_key(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT regexp_replace(
    translate(lower(btrim(coalesce(value, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[[:space:]]+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION private.client_phone_key(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN length(digits) IN (12, 13) AND left(digits, 2) = '55' THEN substring(digits FROM 3)
    ELSE digits
  END
  FROM (SELECT regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') AS digits) normalized;
$$;

CREATE OR REPLACE FUNCTION private.prevent_client_identity_duplicate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public', 'private', 'pg_temp' AS $$
DECLARE
  name_key text := private.client_name_key(NEW.razao_social);
  primary_phone text := private.client_phone_key(NEW.telefone);
  secondary_phone text := private.client_phone_key(NEW.telefone2);
  existing_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM private.current_tenant_id() THEN
    RAISE EXCEPTION 'Cliente fora da empresa ativa' USING errcode = '42501';
  END IF;
  IF NOT NEW.ativo THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.ativo = NEW.ativo
     AND private.client_name_key(OLD.razao_social) = name_key
     AND private.client_phone_key(OLD.telefone) = primary_phone
     AND private.client_phone_key(OLD.telefone2) = secondary_phone THEN
    RETURN NEW;
  END IF;

  IF (primary_phone <> '' AND length(primary_phone) NOT IN (10, 11))
     OR (secondary_phone <> '' AND length(secondary_phone) NOT IN (10, 11)) THEN
    RAISE EXCEPTION 'Telefone deve conter DDD e 10 ou 11 dígitos; prefixo +55 é opcional' USING errcode = '22023';
  END IF;

  IF name_key = '' OR (primary_phone = '' AND secondary_phone = '') THEN RETURN NEW; END IF;
  -- Serialize identical identities so parallel inserts cannot both pass the review.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || ':' || name_key, 0));
  SELECT c.id INTO existing_id
  FROM public.clientes c
  WHERE c.tenant_id = NEW.tenant_id AND c.id <> NEW.id AND c.ativo
    AND private.client_name_key(c.razao_social) = name_key
    AND (
      (primary_phone <> '' AND primary_phone IN (private.client_phone_key(c.telefone), private.client_phone_key(c.telefone2)))
      OR (secondary_phone <> '' AND secondary_phone IN (private.client_phone_key(c.telefone), private.client_phone_key(c.telefone2)))
    )
  LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nome e telefone já cadastrados nesta empresa. Abra o cadastro existente.' USING errcode = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clientes_prevent_identity_duplicate ON public.clientes;
CREATE TRIGGER clientes_prevent_identity_duplicate
BEFORE INSERT OR UPDATE OF razao_social, telefone, telefone2, ativo ON public.clientes
FOR EACH ROW EXECUTE FUNCTION private.prevent_client_identity_duplicate();

CREATE OR REPLACE FUNCTION public.consultar_clientes_similares(
  _cliente_id uuid, _classificacao text, _cpf_cnpj text, _email text,
  _telefone text, _telefone2 text, _razao_social text
)
RETURNS jsonb LANGUAGE sql STABLE
SET search_path TO 'public', 'private', 'pg_temp' AS $$
  WITH requested AS (
    SELECT CASE
      WHEN lower(btrim(coalesce(_classificacao, ''))) IN ('domestico', 'residencial') THEN 'domestico'
      WHEN lower(btrim(coalesce(_classificacao, ''))) = 'industrial' THEN 'industrial'
    END AS classification
  )
  SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.name), '[]'::jsonb)
  FROM (
    SELECT c.id, c.razao_social AS name, c.classificacao AS classification, c.ativo AS active,
      (nullif(regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
        AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g')) AS "documentConflict",
      array_remove(ARRAY[
        CASE WHEN length(regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g')) IN (11, 14)
          AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g') THEN 'document' END,
        CASE WHEN nullif(btrim(_email), '') IS NOT NULL AND lower(btrim(c.email)) = lower(btrim(_email)) THEN 'email' END,
        CASE WHEN private.client_phone_key(_telefone) <> ''
          AND private.client_phone_key(_telefone) IN (private.client_phone_key(c.telefone), private.client_phone_key(c.telefone2)) THEN 'phone' END,
        CASE WHEN private.client_phone_key(_telefone2) <> ''
          AND private.client_phone_key(_telefone2) IN (private.client_phone_key(c.telefone), private.client_phone_key(c.telefone2)) THEN 'phone' END,
        CASE WHEN length(private.client_name_key(_razao_social)) >= 4
          AND private.client_name_key(c.razao_social) = private.client_name_key(_razao_social) THEN 'name' END
      ], NULL)::text[] AS matches,
      CASE WHEN c.cpf_cnpj IS NOT NULL THEN '***' || right(regexp_replace(c.cpf_cnpj, '[^0-9]', '', 'g'), 4) END AS "maskedDocument",
      CASE WHEN c.telefone IS NOT NULL THEN '***' || right(regexp_replace(c.telefone, '[^0-9]', '', 'g'), 4) END AS "maskedPhone",
      CASE WHEN c.email IS NOT NULL THEN left(c.email, 1) || '***' || substring(c.email FROM position('@' IN c.email)) END AS "maskedEmail"
    FROM public.clientes c CROSS JOIN requested r
    WHERE auth.uid() IS NOT NULL
      AND c.tenant_id = private.current_tenant_id()
      AND private.has_any_module_access(ARRAY['clientes','ordens','agenda','faturamento','caixa','dashboard','relatorios'])
      AND r.classification IS NOT NULL AND private.can_access_area(r.classification)
      AND private.can_access_area(c.classificacao)
      AND (_cliente_id IS NULL OR c.id <> _cliente_id)
      AND (
        (length(regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g')) IN (11, 14)
          AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g'))
        OR (nullif(btrim(_email), '') IS NOT NULL AND lower(btrim(c.email)) = lower(btrim(_email)))
        OR (private.client_phone_key(_telefone) <> '' AND private.client_phone_key(_telefone) IN (private.client_phone_key(c.telefone), private.client_phone_key(c.telefone2)))
        OR (private.client_phone_key(_telefone2) <> '' AND private.client_phone_key(_telefone2) IN (private.client_phone_key(c.telefone), private.client_phone_key(c.telefone2)))
        OR (length(private.client_name_key(_razao_social)) >= 4 AND private.client_name_key(c.razao_social) = private.client_name_key(_razao_social))
      )
    ORDER BY c.razao_social LIMIT 20
  ) z;
$$;

COMMIT;
