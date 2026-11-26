-- PDV permissions and capacity settings still identify the domestic sector as
-- residencial, while current clients are classified as domestico. Count both
-- classifications under the same domestic capacity without mixing tenants.
CREATE OR REPLACE FUNCTION public.consultar_capacidade_pdv(
  _tenant_id uuid, _area text, _data date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
DECLARE
  v_limit numeric(12,3);
  v_reserved numeric(12,3) := 0;
BEGIN
  IF _tenant_id IS NULL OR _area NOT IN ('residencial', 'industrial') OR _data IS NULL THEN
    RAISE EXCEPTION 'Consulta de capacidade inválida';
  END IF;
  IF auth.uid() IS NOT NULL AND _tenant_id IS DISTINCT FROM private.current_tenant_id() THEN
    RAISE EXCEPTION 'A capacidade solicitada não pertence à empresa ativa';
  END IF;

  SELECT limite_carga INTO v_limit
  FROM public.pdv_capacidades_diarias
  WHERE tenant_id = _tenant_id AND area = _area AND data = _data AND ativo;
  IF NOT FOUND THEN
    SELECT limite_carga INTO v_limit
    FROM public.pdv_capacidade_configuracoes
    WHERE tenant_id = _tenant_id AND area = _area AND ativo;
  END IF;
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('configured', false, 'limit', NULL, 'reserved', 0,
      'available', NULL, 'date', _data, 'area', _area);
  END IF;

  SELECT coalesce(sum(i.quantidade), 0)::numeric(12,3) INTO v_reserved
  FROM public.ordens_servico o
  JOIN public.clientes c ON c.id = o.cliente_id AND c.tenant_id = o.tenant_id
  JOIN public.itens_ordem_servico i ON i.ordem_servico_id = o.id AND i.tenant_id = o.tenant_id
  WHERE o.tenant_id = _tenant_id
    AND c.classificacao IN (_area, CASE WHEN _area = 'residencial' THEN 'domestico' ELSE _area END)
    AND o.data_previsao_entrega = _data
    AND o.status NOT IN ('cancelada', 'cancelado');

  RETURN jsonb_build_object('configured', true, 'limit', v_limit,
    'reserved', v_reserved, 'available', greatest(v_limit - v_reserved, 0),
    'date', _data, 'area', _area);
END;
$function$;

REVOKE ALL ON FUNCTION public.consultar_capacidade_pdv(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_capacidade_pdv(uuid, text, date) TO authenticated, service_role;
