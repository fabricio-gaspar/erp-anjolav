-- Administrative capacity commands stay outside the PDV. They run with the
-- caller JWT so the existing audit trigger records the real administrator,
-- while the database remains the authorization boundary.
CREATE OR REPLACE FUNCTION public.listar_capacidades_pdv()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
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
        'date', capacity.data,
        'limit', capacity.limite_carga,
        'active', capacity.ativo,
        'createdAt', capacity.created_at,
        'updatedAt', capacity.updated_at
      )
      ORDER BY capacity.data ASC, capacity.area ASC
    )
    FROM public.pdv_capacidades_diarias AS capacity
    WHERE capacity.tenant_id = v_tenant_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.configurar_capacidade_pdv(
  _area text,
  _data date,
  _limite_carga numeric,
  _ativo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tenant_id uuid := private.current_tenant_id();
  v_capacity public.pdv_capacidades_diarias%ROWTYPE;
BEGIN
  IF v_tenant_id IS NULL OR NOT private.is_tenant_admin(v_tenant_id) THEN
    RAISE EXCEPTION 'Somente administradores podem configurar a capacidade operacional';
  END IF;
  IF _area NOT IN ('industrial', 'residencial') THEN
    RAISE EXCEPTION 'Setor de capacidade inválido';
  END IF;
  IF _data IS NULL OR _data < current_date THEN
    RAISE EXCEPTION 'A capacidade só pode ser configurada para hoje ou para uma data futura';
  END IF;
  IF _limite_carga IS NULL OR _limite_carga <= 0 OR _limite_carga > 999999999.999 THEN
    RAISE EXCEPTION 'Limite de capacidade inválido';
  END IF;
  IF _ativo IS NULL THEN
    RAISE EXCEPTION 'Status de capacidade inválido';
  END IF;

  INSERT INTO public.pdv_capacidades_diarias (
    tenant_id, area, data, limite_carga, ativo
  ) VALUES (
    v_tenant_id, _area, _data, round(_limite_carga, 3), _ativo
  )
  ON CONFLICT (tenant_id, area, data) DO UPDATE
  SET limite_carga = EXCLUDED.limite_carga,
      ativo = EXCLUDED.ativo,
      updated_at = now()
  RETURNING * INTO v_capacity;

  RETURN jsonb_build_object(
    'id', v_capacity.id,
    'area', v_capacity.area,
    'date', v_capacity.data,
    'limit', v_capacity.limite_carga,
    'active', v_capacity.ativo,
    'createdAt', v_capacity.created_at,
    'updatedAt', v_capacity.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.listar_capacidades_pdv() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.configurar_capacidade_pdv(text, date, numeric, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_capacidades_pdv() TO authenticated;
GRANT EXECUTE ON FUNCTION public.configurar_capacidade_pdv(text, date, numeric, boolean) TO authenticated;
