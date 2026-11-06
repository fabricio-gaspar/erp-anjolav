-- Client address book with one canonical primary address, operational address
-- types and archival instead of destructive deletion.

ALTER TABLE public.enderecos_clientes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'principal',
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS principal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS instrucoes text;

ALTER TABLE public.enderecos_clientes
  DROP CONSTRAINT IF EXISTS enderecos_clientes_tipo_check,
  DROP CONSTRAINT IF EXISTS enderecos_clientes_cep_check,
  DROP CONSTRAINT IF EXISTS enderecos_clientes_uf_check,
  DROP CONSTRAINT IF EXISTS enderecos_clientes_coordinates_check;

ALTER TABLE public.enderecos_clientes
  ADD CONSTRAINT enderecos_clientes_tipo_check CHECK (
    tipo IN ('principal', 'coleta', 'entrega', 'faturamento', 'outro')
  ),
  ADD CONSTRAINT enderecos_clientes_cep_check CHECK (
    cep IS NULL OR cep ~ '^[0-9]{8}$'
  ),
  ADD CONSTRAINT enderecos_clientes_uf_check CHECK (
    uf IS NULL OR uf ~ '^[A-Z]{2}$'
  ),
  ADD CONSTRAINT enderecos_clientes_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  );

WITH ranked AS (
  SELECT address.id,
         row_number() OVER (
           PARTITION BY address.tenant_id, address.cliente_id
           ORDER BY address.updated_at DESC, address.created_at DESC, address.id
         ) AS position
  FROM public.enderecos_clientes address
  WHERE address.ativo
)
UPDATE public.enderecos_clientes address
SET principal = ranked.position = 1,
    tipo = CASE WHEN ranked.position = 1 THEN 'principal' ELSE address.tipo END
FROM ranked
WHERE address.id = ranked.id;

UPDATE public.enderecos_clientes
SET principal = false
WHERE NOT ativo;

CREATE UNIQUE INDEX IF NOT EXISTS enderecos_clientes_one_active_primary
  ON public.enderecos_clientes(tenant_id, cliente_id)
  WHERE ativo AND principal;

CREATE INDEX IF NOT EXISTS enderecos_clientes_active_lookup
  ON public.enderecos_clientes(tenant_id, cliente_id, ativo, principal DESC, tipo, updated_at DESC);

CREATE OR REPLACE FUNCTION private.normalize_client_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
DECLARE
  client_tenant uuid;
BEGIN
  SELECT client.tenant_id INTO client_tenant
  FROM public.clientes client
  WHERE client.id = NEW.cliente_id;

  IF client_tenant IS NULL OR NEW.tenant_id IS DISTINCT FROM client_tenant THEN
    RAISE EXCEPTION 'Cliente e endereço devem pertencer à mesma empresa';
  END IF;

  NEW.tipo := lower(trim(coalesce(NEW.tipo, 'principal')));
  NEW.nome := nullif(left(regexp_replace(trim(coalesce(NEW.nome, '')), '\s+', ' ', 'g'), 80), '');
  NEW.cep := nullif(regexp_replace(coalesce(NEW.cep, ''), '[^0-9]', '', 'g'), '');
  NEW.logradouro := nullif(left(regexp_replace(trim(coalesce(NEW.logradouro, '')), '\s+', ' ', 'g'), 200), '');
  NEW.numero := nullif(left(regexp_replace(trim(coalesce(NEW.numero, '')), '\s+', ' ', 'g'), 30), '');
  NEW.complemento := nullif(left(regexp_replace(trim(coalesce(NEW.complemento, '')), '\s+', ' ', 'g'), 120), '');
  NEW.bairro := nullif(left(regexp_replace(trim(coalesce(NEW.bairro, '')), '\s+', ' ', 'g'), 120), '');
  NEW.cidade := nullif(left(regexp_replace(trim(coalesce(NEW.cidade, '')), '\s+', ' ', 'g'), 120), '');
  NEW.uf := nullif(upper(regexp_replace(coalesce(NEW.uf, ''), '[^A-Za-z]', '', 'g')), '');
  NEW.pais := coalesce(nullif(left(regexp_replace(trim(coalesce(NEW.pais, '')), '\s+', ' ', 'g'), 80), ''), 'Brasil');
  NEW.instrucoes := nullif(left(regexp_replace(trim(coalesce(NEW.instrucoes, '')), '\s+', ' ', 'g'), 500), '');

  IF NEW.ativo AND (NEW.logradouro IS NULL OR NEW.cidade IS NULL OR NEW.uf IS NULL) THEN
    RAISE EXCEPTION 'Endereço ativo exige logradouro, cidade e UF';
  END IF;
  IF NEW.cep IS NOT NULL AND char_length(NEW.cep) <> 8 THEN
    RAISE EXCEPTION 'CEP deve conter 8 dígitos';
  END IF;
  IF NEW.uf IS NOT NULL AND char_length(NEW.uf) <> 2 THEN
    RAISE EXCEPTION 'UF deve conter 2 letras';
  END IF;
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN
    RAISE EXCEPTION 'Latitude e longitude devem ser informadas juntas';
  END IF;

  IF pg_trigger_depth() = 1 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      NEW.tenant_id::text || ':client-address:' || NEW.cliente_id::text,
      0
    ));

    IF NOT NEW.ativo THEN
      NEW.principal := false;
    ELSIF NEW.principal THEN
      UPDATE public.enderecos_clientes other
      SET principal = false
      WHERE other.tenant_id = NEW.tenant_id
        AND other.cliente_id = NEW.cliente_id
        AND other.id IS DISTINCT FROM NEW.id
        AND other.principal;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.enderecos_clientes other
      WHERE other.tenant_id = NEW.tenant_id
        AND other.cliente_id = NEW.cliente_id
        AND other.id IS DISTINCT FROM NEW.id
        AND other.ativo
        AND other.principal
    ) THEN
      NEW.principal := true;
    END IF;
  ELSIF NOT NEW.ativo THEN
    NEW.principal := false;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.normalize_client_address() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS normalize_client_address ON public.enderecos_clientes;
CREATE TRIGGER normalize_client_address
BEFORE INSERT OR UPDATE ON public.enderecos_clientes
FOR EACH ROW EXECUTE FUNCTION private.normalize_client_address();

CREATE OR REPLACE FUNCTION private.repair_client_primary_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private, pg_temp
AS $$
DECLARE
  replacement_id uuid;
BEGIN
  -- Demoting the previous primary from the BEFORE trigger is part of the same
  -- primary switch; the outer row will become primary before the statement
  -- finishes. Only a top-level archive/unset needs a replacement here.
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;
  IF OLD.principal AND (NOT NEW.ativo OR NOT NEW.principal) THEN
    SELECT address.id INTO replacement_id
    FROM public.enderecos_clientes address
    WHERE address.tenant_id = NEW.tenant_id
      AND address.cliente_id = NEW.cliente_id
      AND address.ativo
      AND address.id <> NEW.id
    ORDER BY
      CASE address.tipo WHEN 'principal' THEN 0 WHEN 'coleta' THEN 1 WHEN 'entrega' THEN 2 ELSE 3 END,
      address.updated_at DESC,
      address.id
    LIMIT 1;

    IF replacement_id IS NOT NULL THEN
      UPDATE public.enderecos_clientes
      SET principal = true
      WHERE id = replacement_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.repair_client_primary_address() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS repair_client_primary_address ON public.enderecos_clientes;
CREATE TRIGGER repair_client_primary_address
AFTER UPDATE OF ativo, principal ON public.enderecos_clientes
FOR EACH ROW EXECUTE FUNCTION private.repair_client_primary_address();

CREATE OR REPLACE FUNCTION public.salvar_endereco_cliente(
  _endereco_id uuid,
  _cliente_id uuid,
  _tipo text,
  _nome text,
  _cep text,
  _logradouro text,
  _numero text,
  _complemento text,
  _bairro text,
  _cidade text,
  _uf text,
  _pais text,
  _latitude numeric,
  _longitude numeric,
  _principal boolean,
  _instrucoes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  saved_address public.enderecos_clientes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['clientes', 'ordens', 'agenda'])
     OR NOT private.can_access_client(_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao endereço do cliente';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':client-address:' || _cliente_id::text,
    0
  ));

  IF _endereco_id IS NULL THEN
    INSERT INTO public.enderecos_clientes (
      tenant_id, cliente_id, tipo, nome, cep, logradouro, numero,
      complemento, bairro, cidade, uf, pais, latitude, longitude,
      principal, ativo, instrucoes
    ) VALUES (
      current_tenant, _cliente_id, _tipo, _nome, _cep, _logradouro, _numero,
      _complemento, _bairro, _cidade, _uf, _pais, _latitude, _longitude,
      coalesce(_principal, false), true, _instrucoes
    ) RETURNING * INTO saved_address;
  ELSE
    UPDATE public.enderecos_clientes address
    SET tipo = _tipo,
        nome = _nome,
        cep = _cep,
        logradouro = _logradouro,
        numero = _numero,
        complemento = _complemento,
        bairro = _bairro,
        cidade = _cidade,
        uf = _uf,
        pais = _pais,
        latitude = _latitude,
        longitude = _longitude,
        principal = coalesce(_principal, address.principal),
        instrucoes = _instrucoes,
        ativo = true
    WHERE address.id = _endereco_id
      AND address.cliente_id = _cliente_id
      AND address.tenant_id = current_tenant
    RETURNING * INTO saved_address;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Endereço não encontrado neste cliente';
    END IF;
  END IF;

  RETURN to_jsonb(saved_address);
END;
$$;

CREATE OR REPLACE FUNCTION public.arquivar_endereco_cliente(
  _endereco_id uuid,
  _cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  archived_address public.enderecos_clientes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['clientes', 'ordens', 'agenda'])
     OR NOT private.can_access_client(_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao endereço do cliente';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':client-address:' || _cliente_id::text,
    0
  ));

  UPDATE public.enderecos_clientes address
  SET ativo = false,
      principal = false
  WHERE address.id = _endereco_id
    AND address.cliente_id = _cliente_id
    AND address.tenant_id = current_tenant
    AND address.ativo
  RETURNING * INTO archived_address;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Endereço ativo não encontrado neste cliente';
  END IF;

  RETURN to_jsonb(archived_address);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_endereco_cliente(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, boolean, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_endereco_cliente(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, boolean, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.arquivar_endereco_cliente(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.arquivar_endereco_cliente(uuid, uuid)
  TO authenticated;

REVOKE DELETE, TRUNCATE ON TABLE public.enderecos_clientes FROM authenticated;
