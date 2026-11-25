-- Capacity is configured once per tenant and operating sector.
-- The selected ROL date remains the lookup key for reserved production load;
-- it is no longer required to create a separate capacity record per day.

CREATE TABLE IF NOT EXISTS public.pdv_capacidade_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('industrial', 'residencial')),
  limite_carga numeric(12,3) NOT NULL CHECK (limite_carga > 0 AND limite_carga <= 999999999.999),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pdv_capacidade_configuracoes_tenant_area_key UNIQUE (tenant_id, area)
);

CREATE INDEX IF NOT EXISTS idx_pdv_capacidade_configuracoes_lookup
  ON public.pdv_capacidade_configuracoes (tenant_id, area)
  WHERE ativo;

ALTER TABLE public.pdv_capacidade_configuracoes ENABLE ROW LEVEL SECURITY;

-- The application reads and writes this internal table only through the
-- protected RPCs below. Do not expose its rows directly through Data API or
-- GraphQL; the RPCs re-check the active tenant administrator.
REVOKE ALL ON TABLE public.pdv_capacidade_configuracoes FROM anon, authenticated;

DROP POLICY IF EXISTS pdv_capacity_config_tenant_admin_read ON public.pdv_capacidade_configuracoes;
CREATE POLICY pdv_capacity_config_tenant_admin_read
  ON public.pdv_capacidade_configuracoes
  FOR SELECT
  TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS pdv_capacity_config_tenant_admin_insert ON public.pdv_capacidade_configuracoes;
CREATE POLICY pdv_capacity_config_tenant_admin_insert
  ON public.pdv_capacidade_configuracoes
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS pdv_capacity_config_tenant_admin_update ON public.pdv_capacidade_configuracoes;
CREATE POLICY pdv_capacity_config_tenant_admin_update
  ON public.pdv_capacidade_configuracoes
  FOR UPDATE
  TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

-- Preserve the current operational configuration by using the most recent
-- active daily value as the initial sector default. Legacy daily rows remain
-- intact for historical reference and are no longer used as the live limit.
INSERT INTO public.pdv_capacidade_configuracoes (tenant_id, area, limite_carga, ativo)
SELECT DISTINCT ON (tenant_id, area)
  tenant_id,
  area,
  limite_carga,
  ativo
FROM public.pdv_capacidades_diarias
WHERE ativo
ORDER BY tenant_id, area, data DESC
ON CONFLICT (tenant_id, area) DO NOTHING;

DROP FUNCTION IF EXISTS public.configurar_capacidade_pdv(text, date, numeric, boolean);

CREATE OR REPLACE FUNCTION public.configurar_capacidade_pdv(
  _area text,
  _limite_carga numeric,
  _ativo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_capacity public.pdv_capacidade_configuracoes%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL OR NOT private.is_tenant_admin(v_tenant_id) THEN
    RAISE EXCEPTION 'Somente administradores podem configurar a capacidade operacional';
  END IF;
  IF _area NOT IN ('industrial', 'residencial') THEN
    RAISE EXCEPTION 'Setor de capacidade inválido';
  END IF;
  IF _limite_carga IS NULL OR _limite_carga <= 0 OR _limite_carga > 999999999.999 THEN
    RAISE EXCEPTION 'Limite de capacidade inválido';
  END IF;
  IF _ativo IS NULL THEN
    RAISE EXCEPTION 'Status de capacidade inválido';
  END IF;

  INSERT INTO public.pdv_capacidade_configuracoes (tenant_id, area, limite_carga, ativo)
  VALUES (v_tenant_id, _area, round(_limite_carga, 3), _ativo)
  ON CONFLICT (tenant_id, area) DO UPDATE
  SET limite_carga = EXCLUDED.limite_carga,
      ativo = EXCLUDED.ativo,
      updated_at = now()
  RETURNING * INTO v_capacity;

  RETURN jsonb_build_object(
    'id', v_capacity.id,
    'area', v_capacity.area,
    'limit', v_capacity.limite_carga,
    'active', v_capacity.ativo,
    'createdAt', v_capacity.created_at,
    'updatedAt', v_capacity.updated_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.configurar_capacidade_pdv(text, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.configurar_capacidade_pdv(text, numeric, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_capacidades_pdv()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
BEGIN
  IF v_tenant_id IS NULL OR NOT private.is_tenant_admin(v_tenant_id) THEN
    RAISE EXCEPTION 'Somente administradores podem consultar a capacidade operacional';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', capacity.id,
        'area', capacity.area,
        'limit', capacity.limite_carga,
        'active', capacity.ativo,
        'createdAt', capacity.created_at,
        'updatedAt', capacity.updated_at
      )
      ORDER BY capacity.area ASC
    )
    FROM public.pdv_capacidade_configuracoes AS capacity
    WHERE capacity.tenant_id = v_tenant_id
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_capacidades_pdv() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_capacidades_pdv() TO authenticated;

CREATE OR REPLACE FUNCTION public.consultar_capacidade_pdv(
  _tenant_id uuid,
  _area text,
  _data date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_limite numeric(12,3);
  v_reservada numeric(12,3) := 0;
BEGIN
  IF _tenant_id IS NULL OR _area NOT IN ('residencial', 'industrial') OR _data IS NULL THEN
    RAISE EXCEPTION 'Consulta de capacidade inválida';
  END IF;

  SELECT limite_carga INTO v_limite
  FROM public.pdv_capacidade_configuracoes
  WHERE tenant_id = _tenant_id
    AND area = _area
    AND ativo;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'configured', false,
      'limit', NULL,
      'reserved', 0,
      'available', NULL,
      'date', _data,
      'area', _area
    );
  END IF;

  SELECT coalesce(sum(item.quantidade), 0)::numeric(12,3) INTO v_reservada
  FROM public.ordens_servico AS service_order
  JOIN public.clientes AS customer
    ON customer.id = service_order.cliente_id
   AND customer.tenant_id = service_order.tenant_id
  JOIN public.itens_ordem_servico AS item
    ON item.ordem_servico_id = service_order.id
   AND item.tenant_id = service_order.tenant_id
  WHERE service_order.tenant_id = _tenant_id
    AND customer.classificacao = _area
    AND service_order.data_previsao_entrega = _data
    AND service_order.status <> 'cancelada';

  RETURN jsonb_build_object(
    'configured', true,
    'limit', v_limite,
    'reserved', v_reservada,
    'available', greatest(v_limite - v_reservada, 0),
    'date', _data,
    'area', _area
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_capacidade_pdv(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_capacidade_pdv(uuid, text, date) TO authenticated;
