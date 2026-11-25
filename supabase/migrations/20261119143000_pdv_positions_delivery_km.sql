-- Catálogo de posições físicas do PDV e cobrança de delivery por quilômetro.
-- O catálogo é por empresa e operação; o ROL continua guardando o texto da
-- posição para preservar o histórico mesmo que o catálogo seja alterado.

ALTER TABLE public.pdv_regras_comerciais
  ADD COLUMN IF NOT EXISTS delivery_pricing_model text NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS delivery_fee_base numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_per_km numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.pdv_regras_comerciais
SET delivery_fee_base = coalesce(delivery_fee_base, taxa_entrega_padrao, 0)
WHERE delivery_fee_base IS NULL;

-- A coluna nova recebe o DEFAULT 0 para linhas antigas; preserve a taxa fixa
-- já configurada antes desta migração quando ela for maior que zero.
UPDATE public.pdv_regras_comerciais
SET delivery_fee_base = coalesce(taxa_entrega_padrao, 0)
WHERE delivery_fee_base = 0
  AND coalesce(taxa_entrega_padrao, 0) <> 0;

ALTER TABLE public.pdv_regras_comerciais
  DROP CONSTRAINT IF EXISTS pdv_regras_comerciais_delivery_pricing_model_check,
  ADD CONSTRAINT pdv_regras_comerciais_delivery_pricing_model_check
    CHECK (delivery_pricing_model IN ('fixo', 'km')),
  DROP CONSTRAINT IF EXISTS pdv_regras_comerciais_delivery_fee_base_check,
  ADD CONSTRAINT pdv_regras_comerciais_delivery_fee_base_check
    CHECK (delivery_fee_base >= 0 AND delivery_fee_base <= 9999999.99),
  DROP CONSTRAINT IF EXISTS pdv_regras_comerciais_delivery_fee_per_km_check,
  ADD CONSTRAINT pdv_regras_comerciais_delivery_fee_per_km_check
    CHECK (delivery_fee_per_km >= 0 AND delivery_fee_per_km <= 9999999.99);

CREATE TABLE IF NOT EXISTS public.pdv_posicoes_armazenamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('residencial', 'industrial')),
  tipo text NOT NULL CHECK (tipo IN ('cabideiro', 'balcao', 'prateleira')),
  codigo text NOT NULL,
  nome_exibicao text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, area, tipo, codigo)
);

CREATE INDEX IF NOT EXISTS pdv_posicoes_armazenamento_lookup_idx
  ON public.pdv_posicoes_armazenamento (tenant_id, area, ativo, ordem, tipo, codigo);

ALTER TABLE public.pdv_posicoes_armazenamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdv_posicoes_armazenamento FROM anon, authenticated;
GRANT SELECT ON public.pdv_posicoes_armazenamento TO authenticated;

DROP POLICY IF EXISTS pdv_posicoes_select ON public.pdv_posicoes_armazenamento;
CREATE POLICY pdv_posicoes_select ON public.pdv_posicoes_armazenamento
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['caixa', 'ordens', 'producao', 'configuracoes']::text[])
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
    AND p.area = lower(trim(_area))
    AND (NOT coalesce(_somente_ativas, true) OR p.ativo)
    AND private.has_any_module_access(ARRAY['caixa', 'ordens', 'producao', 'configuracoes']::text[])
  ORDER BY p.ordem, p.tipo, p.codigo;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_posicao_pdv(
  _id uuid,
  _area text,
  _tipo text,
  _codigo text,
  _nome_exibicao text,
  _ordem integer DEFAULT 0,
  _ativo boolean DEFAULT true
)
RETURNS public.pdv_posicoes_armazenamento
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_row public.pdv_posicoes_armazenamento;
  v_area text := lower(trim(coalesce(_area, '')));
  v_tipo text := lower(trim(coalesce(_tipo, '')));
  v_codigo text := left(trim(coalesce(_codigo, '')), 80);
  v_nome text := left(trim(coalesce(_nome_exibicao, '')), 160);
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['configuracoes']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para configurar posições do PDV' USING ERRCODE = '42501';
  END IF;
  IF v_area NOT IN ('residencial', 'industrial') OR v_tipo NOT IN ('cabideiro', 'balcao', 'prateleira') OR v_codigo = '' THEN
    RAISE EXCEPTION 'Tipo, operação e código da posição são obrigatórios';
  END IF;
  IF v_nome = '' THEN
    v_nome := initcap(v_tipo) || ' ' || v_codigo;
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.pdv_posicoes_armazenamento (tenant_id, area, tipo, codigo, nome_exibicao, ordem, ativo)
    VALUES (v_tenant, v_area, v_tipo, v_codigo, v_nome, greatest(coalesce(_ordem, 0), 0), coalesce(_ativo, true))
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.pdv_posicoes_armazenamento
    SET area = v_area,
        tipo = v_tipo,
        codigo = v_codigo,
        nome_exibicao = v_nome,
        ordem = greatest(coalesce(_ordem, 0), 0),
        ativo = coalesce(_ativo, true),
        updated_at = now()
    WHERE id = _id AND tenant_id = v_tenant
    RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Posição não encontrada'; END IF;
  END IF;
  RETURN v_row;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe uma posição com este código nesta operação';
END;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_posicao_pdv(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.has_any_module_access(ARRAY['configuracoes']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para excluir posições do PDV' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.pdv_posicoes_armazenamento
  WHERE id = _id AND tenant_id = private.current_tenant_id();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preencher_posicoes_padrao_pdv(_area text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_area text := lower(trim(coalesce(_area, '')));
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR NOT private.has_any_module_access(ARRAY['configuracoes']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para carregar posições padrão' USING ERRCODE = '42501';
  END IF;
  IF v_area NOT IN ('residencial', 'industrial') THEN RAISE EXCEPTION 'Operação inválida'; END IF;

  INSERT INTO public.pdv_posicoes_armazenamento (tenant_id, area, tipo, codigo, nome_exibicao, ordem)
  SELECT v_tenant, v_area, 'cabideiro', lpad(n::text, 3, '0'), 'Cabideiro ' || lpad(n::text, 3, '0'), n
  FROM generate_series(1, 510) n
  ON CONFLICT (tenant_id, area, tipo, codigo) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  INSERT INTO public.pdv_posicoes_armazenamento (tenant_id, area, tipo, codigo, nome_exibicao, ordem)
  SELECT v_tenant, v_area, 'balcao', lpad(n::text, 2, '0'), 'Balcão ' || lpad(n::text, 2, '0'), 1000 + n
  FROM generate_series(1, 21) n
  ON CONFLICT (tenant_id, area, tipo, codigo) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  INSERT INTO public.pdv_posicoes_armazenamento (tenant_id, area, tipo, codigo, nome_exibicao, ordem)
  SELECT v_tenant, v_area, 'prateleira', item.codigo, item.nome, 2000 + item.ordem
  FROM (VALUES
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
  ON CONFLICT (tenant_id, area, tipo, codigo) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;
  RETURN v_count;
END;
$function$;

-- A consulta permanece autenticada e limitada ao tenant; as operações de
-- manutenção são concedidas somente ao perfil de configuração.
REVOKE ALL ON FUNCTION public.consultar_posicoes_pdv(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_posicoes_pdv(text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.salvar_posicao_pdv(uuid, text, text, text, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_posicao_pdv(uuid, text, text, text, text, integer, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.excluir_posicao_pdv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_posicao_pdv(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.preencher_posicoes_padrao_pdv(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preencher_posicoes_padrao_pdv(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.consultar_regras_comerciais_pdv(_area text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_row public.pdv_regras_comerciais%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR lower(trim(_area)) NOT IN ('residencial', 'industrial') THEN
    RAISE EXCEPTION 'Contexto inválido para consultar regras do PDV';
  END IF;
  IF NOT private.has_any_module_access(ARRAY['caixa', 'configuracoes', 'dashboard']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para consultar regras comerciais';
  END IF;
  SELECT * INTO v_row
  FROM public.pdv_regras_comerciais
  WHERE tenant_id = v_tenant AND area = lower(trim(_area));
  RETURN jsonb_build_object(
    'area', lower(trim(_area)),
    'urgencyPercentage', coalesce(v_row.percentual_urgencia, 30),
    'defaultDeliveryFee', coalesce(v_row.taxa_entrega_padrao, 0),
    'deliveryPricingModel', coalesce(v_row.delivery_pricing_model, 'fixo'),
    'deliveryBaseFee', coalesce(v_row.delivery_fee_base, v_row.taxa_entrega_padrao, 0),
    'deliveryFeePerKm', coalesce(v_row.delivery_fee_per_km, 0),
    'updatedAt', v_row.updated_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_regras_comerciais_pdv_v2(
  _area text,
  _percentual_urgencia numeric,
  _modelo_delivery text,
  _taxa_base_delivery numeric,
  _taxa_por_km numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_area text := lower(trim(coalesce(_area, '')));
  v_model text := lower(trim(coalesce(_modelo_delivery, '')));
  v_row public.pdv_regras_comerciais%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR v_area NOT IN ('residencial', 'industrial') THEN
    RAISE EXCEPTION 'Dados da regra comercial inválidos';
  END IF;
  IF NOT private.has_any_module_access(ARRAY['configuracoes', 'alterar_condicoes_comerciais']::text[]) THEN
    RAISE EXCEPTION 'Sem permissão para alterar regras comerciais';
  END IF;
  IF _percentual_urgencia IS NULL OR _percentual_urgencia < 0 OR _percentual_urgencia > 100
     OR v_model NOT IN ('fixo', 'km')
     OR _taxa_base_delivery IS NULL OR _taxa_base_delivery < 0
     OR _taxa_por_km IS NULL OR _taxa_por_km < 0
     OR (v_model = 'km' AND _taxa_por_km = 0) THEN
    RAISE EXCEPTION 'Informe valores válidos para as regras comerciais';
  END IF;
  INSERT INTO public.pdv_regras_comerciais (
    tenant_id, area, percentual_urgencia, taxa_entrega_padrao,
    delivery_pricing_model, delivery_fee_base, delivery_fee_per_km,
    updated_by, updated_at
  )
  VALUES (
    v_tenant, v_area, round(_percentual_urgencia, 2), round(_taxa_base_delivery, 2),
    v_model, round(_taxa_base_delivery, 2), round(_taxa_por_km, 2), auth.uid(), now()
  )
  ON CONFLICT (tenant_id, area) DO UPDATE SET
    percentual_urgencia = excluded.percentual_urgencia,
    taxa_entrega_padrao = excluded.taxa_entrega_padrao,
    delivery_pricing_model = excluded.delivery_pricing_model,
    delivery_fee_base = excluded.delivery_fee_base,
    delivery_fee_per_km = excluded.delivery_fee_per_km,
    updated_by = excluded.updated_by,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object(
    'area', v_row.area,
    'urgencyPercentage', v_row.percentual_urgencia,
    'defaultDeliveryFee', v_row.taxa_entrega_padrao,
    'deliveryPricingModel', v_row.delivery_pricing_model,
    'deliveryBaseFee', v_row.delivery_fee_base,
    'deliveryFeePerKm', v_row.delivery_fee_per_km,
    'updatedAt', v_row.updated_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.salvar_regras_comerciais_pdv_v2(text, numeric, text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_regras_comerciais_pdv_v2(text, numeric, text, numeric, numeric) TO authenticated;
