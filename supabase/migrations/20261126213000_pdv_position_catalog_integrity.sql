-- Keep physical storage names unique within a tenant and operation, while
-- preserving the position text already stored on historical ROL items.
CREATE OR REPLACE FUNCTION private.pdv_position_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT translate(
    lower(regexp_replace(btrim(coalesce(value, '')), '[[:space:]]+', ' ', 'g')),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  );
$function$;

REVOKE ALL ON FUNCTION private.pdv_position_key(text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS pdv_posicoes_select ON public.pdv_posicoes_armazenamento;
CREATE POLICY pdv_posicoes_select ON public.pdv_posicoes_armazenamento
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND (
      private.pdv_actor_allowed(
        auth.uid(), tenant_id, area, ARRAY['caixa', 'ordens', 'producao']::text[]
      )
      OR private.has_any_module_access(ARRAY['configuracoes']::text[])
    )
  );

CREATE OR REPLACE FUNCTION public.consultar_posicoes_pdv(_area text, _somente_ativas boolean DEFAULT true)
RETURNS SETOF public.pdv_posicoes_armazenamento
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.*
  FROM public.pdv_posicoes_armazenamento p
  WHERE auth.uid() IS NOT NULL
    AND p.tenant_id = private.current_tenant_id()
    AND p.area = lower(btrim(_area))
    AND (NOT coalesce(_somente_ativas, true) OR p.ativo)
    AND (
      private.pdv_actor_allowed(
        auth.uid(), p.tenant_id, p.area, ARRAY['caixa', 'ordens', 'producao']::text[]
      )
      OR private.has_any_module_access(ARRAY['configuracoes']::text[])
    )
  ORDER BY p.ordem, p.tipo, p.codigo;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS pdv_posicoes_unique_normalized_code
  ON public.pdv_posicoes_armazenamento
  (tenant_id, area, tipo, private.pdv_position_key(codigo));

CREATE UNIQUE INDEX IF NOT EXISTS pdv_posicoes_unique_normalized_name
  ON public.pdv_posicoes_armazenamento
  (tenant_id, area, private.pdv_position_key(nome_exibicao));

-- The requested catalog is idempotent and belongs to each tenant and area.
-- Existing custom positions are left untouched.
INSERT INTO public.pdv_posicoes_armazenamento
  (tenant_id, area, tipo, codigo, nome_exibicao, ordem)
SELECT t.id, a.area, 'cabideiro', lpad(n::text, 3, '0'),
  'Cabideiro ' || lpad(n::text, 3, '0'), n
FROM public.tenants t
CROSS JOIN (VALUES ('residencial'), ('industrial')) AS a(area)
CROSS JOIN generate_series(1, 510) AS n
ON CONFLICT DO NOTHING;

INSERT INTO public.pdv_posicoes_armazenamento
  (tenant_id, area, tipo, codigo, nome_exibicao, ordem)
SELECT t.id, a.area, 'balcao', lpad(n::text, 2, '0'),
  'Balcão ' || lpad(n::text, 2, '0'), 1000 + n
FROM public.tenants t
CROSS JOIN (VALUES ('residencial'), ('industrial')) AS a(area)
CROSS JOIN generate_series(1, 21) AS n
ON CONFLICT DO NOTHING;

INSERT INTO public.pdv_posicoes_armazenamento
  (tenant_id, area, tipo, codigo, nome_exibicao, ordem)
SELECT t.id, a.area, 'prateleira', item.codigo, item.nome, 2000 + item.ordem
FROM public.tenants t
CROSS JOIN (VALUES ('residencial'), ('industrial')) AS a(area)
CROSS JOIN (VALUES
  (1, 'Vidro B5', 'Prateleira Vidro B5'),
  (2, 'Vidro B6', 'Prateleira Vidro B6'),
  (3, 'Vidro B7', 'Prateleira Vidro B7'),
  (4, 'Vidro B8', 'Prateleira Vidro B8'),
  (5, 'Vidro B9', 'Prateleira Vidro B9'),
  (6, 'Parede B6', 'Prateleira Parede B6'),
  (7, 'Parede B7', 'Prateleira Parede B7'),
  (8, 'Parede B8', 'Prateleira Parede B8'),
  (9, 'C9', 'Prateleira C9'),
  (10, 'C10', 'Prateleira C10'),
  (11, 'C11', 'Prateleira C11'),
  (12, 'C12', 'Prateleira C12'),
  (13, 'D1', 'Prateleira D1'),
  (14, 'D2', 'Prateleira D2'),
  (15, 'D3', 'Prateleira D3'),
  (16, 'D4', 'Prateleira D4'),
  (17, 'A1', 'Prateleira A1'),
  (18, 'A2', 'Prateleira A2'),
  (19, 'A3', 'Prateleira A3'),
  (20, 'A4', 'Prateleira A4'),
  (21, 'Bx Arara', 'Bx Arara'),
  (22, 'Cab lado', 'Cab lado'),
  (23, 'Cima mesa', 'Cima mesa')
) AS item(ordem, codigo, nome)
ON CONFLICT DO NOTHING;

-- Count active ROL items at each catalog position. A location can hold more
-- than one piece; occupation is informative and never blocks an attendant.
CREATE OR REPLACE FUNCTION public.consultar_ocupacao_posicoes_pdv(_area text)
RETURNS TABLE(posicao_id uuid, itens_ocupando bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_area text := lower(btrim(coalesce(_area, '')));
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR v_area NOT IN ('residencial', 'industrial')
    OR NOT private.pdv_actor_allowed(
      auth.uid(), v_tenant, v_area, ARRAY['caixa', 'ordens', 'producao']::text[]
    ) THEN
    RAISE EXCEPTION 'Sem permissão para consultar posições deste setor' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH occupied AS (
    SELECT private.pdv_position_key(i.posicao_prateleira) AS position_key,
      count(*)::bigint AS item_count
    FROM public.itens_ordem_servico i
    JOIN public.ordens_servico o
      ON o.id = i.ordem_servico_id AND o.tenant_id = v_tenant
    JOIN public.clientes c
      ON c.id = o.cliente_id AND c.tenant_id = v_tenant
    WHERE i.tenant_id = v_tenant
      AND nullif(btrim(i.posicao_prateleira), '') IS NOT NULL
      AND o.status NOT IN ('entregue', 'cancelada', 'cancelado')
      AND c.classificacao = CASE WHEN v_area = 'residencial' THEN 'domestico' ELSE 'industrial' END
    GROUP BY private.pdv_position_key(i.posicao_prateleira)
  )
  SELECT p.id, coalesce(occupied.item_count, 0)::bigint
  FROM public.pdv_posicoes_armazenamento p
  LEFT JOIN occupied ON occupied.position_key = private.pdv_position_key(p.nome_exibicao)
  WHERE p.tenant_id = v_tenant AND p.area = v_area AND p.ativo;
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_ocupacao_posicoes_pdv(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_ocupacao_posicoes_pdv(text) TO authenticated;
