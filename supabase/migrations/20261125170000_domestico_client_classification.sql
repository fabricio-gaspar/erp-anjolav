BEGIN;

-- Customer classification is a business value, so store the canonical label
-- "domestico". Legacy operational-area permission keys remain "residencial".
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_classificacao_check;

UPDATE public.clientes
   SET classificacao = 'domestico'
 WHERE lower(btrim(classificacao)) = 'residencial';

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_classificacao_check
  CHECK (classificacao = ANY (ARRAY['domestico'::text, 'industrial'::text]));

CREATE OR REPLACE FUNCTION private.normalize_client_classification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, private, pg_temp
AS $function$
BEGIN
  IF lower(btrim(coalesce(NEW.classificacao, ''))) = 'residencial' THEN
    NEW.classificacao := 'domestico';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS clientes_normalize_classification ON public.clientes;
CREATE TRIGGER clientes_normalize_classification
BEFORE INSERT OR UPDATE OF classificacao ON public.clientes
FOR EACH ROW EXECUTE FUNCTION private.normalize_client_classification();

-- Keep authorization scoped to the same existing residential permission row.
CREATE OR REPLACE FUNCTION private.can_access_area(_area text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND private.is_tenant_member(private.current_tenant_id())
    AND (
      private.is_tenant_admin(private.current_tenant_id())
      OR EXISTS (
        SELECT 1
          FROM public.area_permissoes permission
         WHERE permission.user_id = auth.uid()
           AND permission.tenant_id = private.current_tenant_id()
           AND (
             permission.area = 'central'
             OR permission.area = CASE
               WHEN lower(coalesce(_area, '')) = 'domestico' THEN 'residencial'
               ELSE lower(coalesce(_area, ''))
             END
           )
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.salvar_cliente(
  _cliente_id uuid,
  _tipo_pessoa text,
  _classificacao text,
  _cpf_cnpj text,
  _razao_social text,
  _nome_fantasia text,
  _email text,
  _telefone text,
  _telefone2 text,
  _contato text,
  _inscricao_estadual text,
  _inscricao_municipal text,
  _regime_tributario text,
  _observacoes text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_doc text := regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g');
  v_classificacao text := CASE
    WHEN lower(btrim(coalesce(_classificacao, ''))) IN ('domestico', 'residencial') THEN 'domestico'
    WHEN lower(btrim(coalesce(_classificacao, ''))) = 'industrial' THEN 'industrial'
    ELSE NULL
  END;
  v_client public.clientes%rowtype;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['clientes','ordens','agenda','faturamento','caixa','dashboard','relatorios'])
     OR v_classificacao IS NULL
     OR NOT private.can_access_area(v_classificacao) THEN
    RAISE EXCEPTION 'Sem permissão para salvar cliente nesta empresa e operação' USING errcode='42501';
  END IF;
  IF _tipo_pessoa NOT IN ('cpf','cnpj') THEN
    RAISE EXCEPTION 'Operação ou tipo de pessoa inválido' USING errcode='22023';
  END IF;
  IF nullif(btrim(_razao_social), '') IS NULL THEN
    RAISE EXCEPTION 'Nome ou razão social obrigatório' USING errcode='22023';
  END IF;
  IF (v_doc <> '' AND _tipo_pessoa = 'cpf' AND length(v_doc) <> 11)
     OR (v_doc <> '' AND _tipo_pessoa = 'cnpj' AND length(v_doc) <> 14) THEN
    RAISE EXCEPTION 'CPF/CNPJ deve ter a quantidade correta de dígitos' USING errcode='22023';
  END IF;
  IF v_doc <> '' AND EXISTS (
    SELECT 1 FROM public.clientes c
     WHERE c.tenant_id = v_tenant
       AND (_cliente_id IS NULL OR c.id <> _cliente_id)
       AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = v_doc
  ) THEN
    RAISE EXCEPTION 'CPF/CNPJ já cadastrado nesta empresa' USING errcode='23505';
  END IF;

  IF _cliente_id IS NULL THEN
    INSERT INTO public.clientes(
      tenant_id, tipo_pessoa, classificacao, cpf_cnpj, razao_social, nome_fantasia,
      email, telefone, telefone2, contato, inscricao_estadual, inscricao_municipal,
      regime_tributario, observacoes
    ) VALUES (
      v_tenant, _tipo_pessoa, v_classificacao, nullif(btrim(_cpf_cnpj), ''), btrim(_razao_social),
      nullif(btrim(_nome_fantasia), ''), nullif(btrim(_email), ''), nullif(btrim(_telefone), ''),
      nullif(btrim(_telefone2), ''), nullif(btrim(_contato), ''), nullif(btrim(_inscricao_estadual), ''),
      nullif(btrim(_inscricao_municipal), ''), _regime_tributario, nullif(btrim(_observacoes), '')
    ) RETURNING * INTO v_client;
  ELSE
    UPDATE public.clientes SET
      tipo_pessoa = _tipo_pessoa,
      classificacao = v_classificacao,
      cpf_cnpj = nullif(btrim(_cpf_cnpj), ''),
      razao_social = btrim(_razao_social),
      nome_fantasia = nullif(btrim(_nome_fantasia), ''),
      email = nullif(btrim(_email), ''),
      telefone = nullif(btrim(_telefone), ''),
      telefone2 = nullif(btrim(_telefone2), ''),
      contato = nullif(btrim(_contato), ''),
      inscricao_estadual = nullif(btrim(_inscricao_estadual), ''),
      inscricao_municipal = nullif(btrim(_inscricao_municipal), ''),
      regime_tributario = _regime_tributario,
      observacoes = nullif(btrim(_observacoes), ''),
      updated_at = now()
    WHERE id = _cliente_id
      AND tenant_id = v_tenant
      AND private.can_access_area(classificacao)
    RETURNING * INTO v_client;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente não encontrado ou sem permissão para editar' USING errcode='42501';
    END IF;
  END IF;
  RETURN to_jsonb(v_client);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consultar_clientes_similares(
  _cliente_id uuid,
  _classificacao text,
  _cpf_cnpj text,
  _email text,
  _telefone text,
  _telefone2 text,
  _razao_social text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  WITH requested AS (
    SELECT CASE
      WHEN lower(btrim(coalesce(_classificacao, ''))) IN ('domestico', 'residencial') THEN 'domestico'
      WHEN lower(btrim(coalesce(_classificacao, ''))) = 'industrial' THEN 'industrial'
      ELSE NULL
    END AS classification
  )
  SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.name), '[]'::jsonb)
    FROM (
      SELECT c.id, c.razao_social AS name, c.classificacao AS classification, c.ativo AS active,
        (nullif(regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
          AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g')) AS "documentConflict",
        array_remove(ARRAY[
          CASE WHEN length(regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g')) IN (11,14)
                 AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g') THEN 'document' END,
          CASE WHEN nullif(btrim(_email), '') IS NOT NULL AND lower(btrim(c.email)) = lower(btrim(_email)) THEN 'email' END,
          CASE WHEN nullif(regexp_replace(coalesce(_telefone, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
                 AND regexp_replace(coalesce(c.telefone, ''), '[^0-9]', '', 'g') = regexp_replace(_telefone, '[^0-9]', '', 'g') THEN 'phone' END,
          CASE WHEN length(btrim(_razao_social)) >= 4 AND lower(btrim(c.razao_social)) = lower(btrim(_razao_social)) THEN 'name' END
        ], NULL)::text[] AS matches,
        CASE WHEN c.cpf_cnpj IS NOT NULL THEN '***' || right(regexp_replace(c.cpf_cnpj, '[^0-9]', '', 'g'), 4) END AS "maskedDocument",
        CASE WHEN c.telefone IS NOT NULL THEN '***' || right(regexp_replace(c.telefone, '[^0-9]', '', 'g'), 4) END AS "maskedPhone",
        CASE WHEN c.email IS NOT NULL THEN left(c.email, 1) || '***' || substring(c.email FROM position('@' IN c.email)) END AS "maskedEmail"
      FROM public.clientes c CROSS JOIN requested r
      WHERE auth.uid() IS NOT NULL
        AND c.tenant_id = private.current_tenant_id()
        AND private.has_any_module_access(ARRAY['clientes','ordens','agenda','faturamento','caixa','dashboard','relatorios'])
        AND r.classification IS NOT NULL
        AND private.can_access_area(r.classification)
        AND c.classificacao = r.classification
        AND (_cliente_id IS NULL OR c.id <> _cliente_id)
        AND (
          (length(regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g')) IN (11,14)
            AND regexp_replace(coalesce(c.cpf_cnpj, ''), '[^0-9]', '', 'g') = regexp_replace(coalesce(_cpf_cnpj, ''), '[^0-9]', '', 'g'))
          OR (nullif(btrim(_email), '') IS NOT NULL AND lower(btrim(c.email)) = lower(btrim(_email)))
          OR (length(regexp_replace(coalesce(_telefone, ''), '[^0-9]', '', 'g')) >= 8
            AND regexp_replace(coalesce(c.telefone, ''), '[^0-9]', '', 'g') = regexp_replace(_telefone, '[^0-9]', '', 'g'))
          OR (length(regexp_replace(coalesce(_telefone2, ''), '[^0-9]', '', 'g')) >= 8
            AND regexp_replace(coalesce(c.telefone2, ''), '[^0-9]', '', 'g') = regexp_replace(_telefone2, '[^0-9]', '', 'g'))
          OR (length(btrim(_razao_social)) >= 4 AND lower(btrim(c.razao_social)) = lower(btrim(_razao_social)))
        )
      ORDER BY c.razao_social LIMIT 20
    ) z;
$function$;

COMMIT;
