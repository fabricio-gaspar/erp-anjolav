-- Capacity defaults remain tenant/sector based; a daily active row overrides that default.
ALTER TABLE public.pdv_capacidades_diarias
  DROP CONSTRAINT IF EXISTS pdv_capacidades_diarias_limite_inteiro_check;
ALTER TABLE public.pdv_capacidades_diarias
  ADD CONSTRAINT pdv_capacidades_diarias_limite_inteiro_check
  CHECK (limite_carga = trunc(limite_carga)) NOT VALID;
ALTER TABLE public.pdv_capacidades_diarias
  VALIDATE CONSTRAINT pdv_capacidades_diarias_limite_inteiro_check;

DROP TRIGGER IF EXISTS audit_mutation ON public.pdv_capacidades_diarias;
CREATE TRIGGER audit_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.pdv_capacidades_diarias
FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

CREATE OR REPLACE FUNCTION public.configurar_capacidade_pdv_data(
  _area text, _data date, _limite_carga numeric, _ativo boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_row public.pdv_capacidades_diarias%ROWTYPE;
BEGIN
  IF v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Somente administradores podem configurar a capacidade por data';
  END IF;
  IF _area NOT IN ('residencial','industrial') OR _data IS NULL OR _ativo IS NULL THEN
    RAISE EXCEPTION 'Setor, data e situação da capacidade são obrigatórios';
  END IF;
  IF _limite_carga IS NULL OR _limite_carga <= 0 OR _limite_carga > 999999999
     OR _limite_carga <> trunc(_limite_carga) THEN
    RAISE EXCEPTION 'A capacidade diária deve ser um número inteiro positivo';
  END IF;
  INSERT INTO public.pdv_capacidades_diarias (tenant_id,area,data,limite_carga,ativo)
  VALUES (v_tenant,_area,_data,_limite_carga,_ativo)
  ON CONFLICT (tenant_id,area,data) DO UPDATE
    SET limite_carga=EXCLUDED.limite_carga,ativo=EXCLUDED.ativo,updated_at=now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('id',v_row.id,'area',v_row.area,'date',v_row.data,
    'limit',v_row.limite_carga,'active',v_row.ativo,'createdAt',v_row.created_at,
    'updatedAt',v_row.updated_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.configurar_capacidade_pdv_data(text,date,numeric,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configurar_capacidade_pdv_data(text,date,numeric,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.consultar_configuracao_capacidade_pdv_data(_area text,_data date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public,private,pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_default public.pdv_capacidade_configuracoes%ROWTYPE;
  v_daily public.pdv_capacidades_diarias%ROWTYPE;
  v_limit numeric;
  v_override boolean := false;
BEGIN
  IF v_tenant IS NULL OR NOT private.is_tenant_admin(v_tenant) THEN
    RAISE EXCEPTION 'Somente administradores podem consultar a capacidade por data';
  END IF;
  IF _area NOT IN ('residencial','industrial') OR _data IS NULL THEN
    RAISE EXCEPTION 'Setor e data da capacidade são obrigatórios';
  END IF;
  SELECT * INTO v_default FROM public.pdv_capacidade_configuracoes
  WHERE tenant_id=v_tenant AND area=_area;
  SELECT * INTO v_daily FROM public.pdv_capacidades_diarias
  WHERE tenant_id=v_tenant AND area=_area AND data=_data;
  IF FOUND AND v_daily.ativo THEN
    v_limit := v_daily.limite_carga;
    v_override := true;
  ELSIF v_default.ativo THEN
    v_limit := v_default.limite_carga;
  END IF;
  RETURN jsonb_build_object('area',_area,'date',_data,'limit',v_limit,
    'isOverride',v_override,'active',v_limit IS NOT NULL,
    'defaultLimit',CASE WHEN v_default.ativo THEN v_default.limite_carga ELSE NULL END,
    'dailyLimit',CASE WHEN v_daily.ativo THEN v_daily.limite_carga ELSE NULL END);
END;
$function$;
REVOKE ALL ON FUNCTION public.consultar_configuracao_capacidade_pdv_data(text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_configuracao_capacidade_pdv_data(text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.consultar_capacidade_pdv(_tenant_id uuid,_area text,_data date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public,private,pg_temp
AS $function$
DECLARE
  v_limit numeric(12,3);
  v_reserved numeric(12,3) := 0;
BEGIN
  IF _tenant_id IS NULL OR _area NOT IN ('residencial','industrial') OR _data IS NULL THEN
    RAISE EXCEPTION 'Consulta de capacidade inválida';
  END IF;
  IF auth.uid() IS NOT NULL AND _tenant_id IS DISTINCT FROM private.current_tenant_id() THEN
    RAISE EXCEPTION 'A capacidade solicitada não pertence à empresa ativa';
  END IF;
  SELECT limite_carga INTO v_limit FROM public.pdv_capacidades_diarias
  WHERE tenant_id=_tenant_id AND area=_area AND data=_data AND ativo;
  IF NOT FOUND THEN
    SELECT limite_carga INTO v_limit FROM public.pdv_capacidade_configuracoes
    WHERE tenant_id=_tenant_id AND area=_area AND ativo;
  END IF;
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('configured',false,'limit',NULL,'reserved',0,
      'available',NULL,'date',_data,'area',_area);
  END IF;
  SELECT coalesce(sum(i.quantidade),0)::numeric(12,3) INTO v_reserved
  FROM public.ordens_servico o
  JOIN public.clientes c ON c.id=o.cliente_id AND c.tenant_id=o.tenant_id
  JOIN public.itens_ordem_servico i ON i.ordem_servico_id=o.id AND i.tenant_id=o.tenant_id
  WHERE o.tenant_id=_tenant_id AND c.classificacao=_area
    AND o.data_previsao_entrega=_data AND o.status NOT IN ('cancelada','cancelado');
  RETURN jsonb_build_object('configured',true,'limit',v_limit,'reserved',v_reserved,
    'available',greatest(v_limit-v_reserved,0),'date',_data,'area',_area);
END;
$function$;
REVOKE ALL ON FUNCTION public.consultar_capacidade_pdv(uuid,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_capacidade_pdv(uuid,text,date) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.criar_pedido_atendimento_v2(_cliente_id uuid, _caixa_id uuid, _data_previsao_entrega date, _urgente boolean, _percentual_urgencia numeric, _valor_desconto numeric, _motorista_id uuid, _veiculo_id uuid, _itens jsonb, _pagamento jsonb, _criado_por uuid, _idempotency_key text, _data_retirada date, _observacoes text, _recebimento_modalidade text, _entrega_modalidade text, _endereco_snapshot jsonb, _taxa_entrega numeric, _permitir_excecao_capacidade boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_client public.clientes%ROWTYPE; v_order public.ordens_servico%ROWTYPE; v_result jsonb;
  v_intake date := coalesce(_data_retirada,current_date); v_receipt text := coalesce(nullif(trim(_recebimento_modalidade),''),'balcao');
  v_delivery text := coalesce(nullif(trim(_entrega_modalidade),''),'balcao'); v_address jsonb := '{}'::jsonb;
  v_limit numeric; v_reserved numeric := 0; v_requested numeric := 0; v_item jsonb; v_qty numeric;
  v_delivery_fee numeric(12,2) := round(coalesce(_taxa_entrega, 0), 2);
  v_delivery_rules public.pdv_regras_comerciais%ROWTYPE;
  v_company public.configuracoes_gerais%ROWTYPE;
  v_distance_km numeric;
BEGIN
  SELECT * INTO v_client FROM public.clientes WHERE id = _cliente_id FOR SHARE;
  IF NOT FOUND OR NOT coalesce(v_client.ativo,false) OR v_client.classificacao NOT IN ('industrial','residencial') THEN RAISE EXCEPTION 'Cliente inválido ou inativo'; END IF;
  IF v_intake < current_date THEN RAISE EXCEPTION 'A data de recebimento não pode estar no passado'; END IF;
  IF _data_previsao_entrega IS NULL OR _data_previsao_entrega < v_intake THEN RAISE EXCEPTION 'A previsão de entrega deve ser igual ou posterior ao recebimento'; END IF;
  IF v_receipt NOT IN ('balcao','coleta') OR v_delivery NOT IN ('balcao','entrega') THEN RAISE EXCEPTION 'Modalidade do atendimento inválida'; END IF;
  IF _taxa_entrega IS NULL OR _taxa_entrega < 0 OR (v_delivery <> 'entrega' AND _taxa_entrega <> 0) THEN RAISE EXCEPTION 'Taxa de entrega inválida para a modalidade escolhida'; END IF;
  IF v_receipt = 'coleta' OR v_delivery = 'entrega' THEN
    IF nullif(trim(coalesce(_endereco_snapshot->>'logradouro','')),'') IS NULL OR nullif(trim(coalesce(_endereco_snapshot->>'cidade','')),'') IS NULL OR nullif(trim(coalesce(_endereco_snapshot->>'uf','')),'') IS NULL THEN RAISE EXCEPTION 'Informe um endereço completo para coleta ou entrega'; END IF;
    v_address := jsonb_strip_nulls(jsonb_build_object('cep',nullif(left(trim(coalesce(_endereco_snapshot->>'cep','')),20),''),'logradouro',nullif(left(trim(coalesce(_endereco_snapshot->>'logradouro','')),200),''),'numero',nullif(left(trim(coalesce(_endereco_snapshot->>'numero','')),30),''),'complemento',nullif(left(trim(coalesce(_endereco_snapshot->>'complemento','')),120),''),'bairro',nullif(left(trim(coalesce(_endereco_snapshot->>'bairro','')),120),''),'cidade',nullif(left(trim(coalesce(_endereco_snapshot->>'cidade','')),120),''),'uf',upper(nullif(left(trim(coalesce(_endereco_snapshot->>'uf','')),2),'')),'pais',nullif(left(trim(coalesce(_endereco_snapshot->>'pais','Brasil')),80),''),'latitude',nullif(_endereco_snapshot->>'latitude','')::numeric,'longitude',nullif(_endereco_snapshot->>'longitude','')::numeric));
  END IF;
  IF v_delivery = 'entrega' THEN
    SELECT * INTO v_delivery_rules
    FROM public.pdv_regras_comerciais
    WHERE tenant_id = v_client.tenant_id AND area = v_client.classificacao;
    IF coalesce(v_delivery_rules.delivery_pricing_model, 'fixo') = 'km' THEN
      SELECT * INTO v_company
      FROM public.configuracoes_gerais
      LIMIT 1;
      IF v_company.endereco_latitude IS NULL OR v_company.endereco_longitude IS NULL
         OR (_endereco_snapshot->>'latitude') IS NULL OR (_endereco_snapshot->>'longitude') IS NULL THEN
        RAISE EXCEPTION 'Não foi possível calcular o delivery por KM: faltam coordenadas da empresa ou do cliente';
      END IF;
      v_distance_km := 6371 * 2 * asin(sqrt(
        power(sin(radians(((_endereco_snapshot->>'latitude')::numeric - v_company.endereco_latitude) / 2)), 2)
        + cos(radians(v_company.endereco_latitude)) * cos(radians((_endereco_snapshot->>'latitude')::numeric))
        * power(sin(radians(((_endereco_snapshot->>'longitude')::numeric - v_company.endereco_longitude) / 2)), 2)
      ));
      v_delivery_fee := round(coalesce(v_delivery_rules.delivery_fee_base, 0) + v_distance_km * coalesce(v_delivery_rules.delivery_fee_per_km, 0), 2);
    ELSIF v_delivery_fee = 0 THEN
      v_delivery_fee := round(coalesce(v_delivery_rules.delivery_fee_base, v_delivery_rules.taxa_entrega_padrao, 0), 2);
    END IF;
  ELSE
    v_delivery_fee := 0;
  END IF;
  IF _permitir_excecao_capacidade AND NOT private.pdv_actor_allowed(_criado_por,v_client.tenant_id,v_client.classificacao,ARRAY['alterar_condicoes_comerciais']) THEN RAISE EXCEPTION 'Sem permissão para autorizar exceção de capacidade'; END IF;
  IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN RAISE EXCEPTION 'A venda deve possuir itens'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    v_qty := (v_item->>'quantidade')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 999 THEN RAISE EXCEPTION 'Quantidade inválida para reservar capacidade'; END IF;
    v_requested := v_requested + v_qty;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_client.tenant_id::text || ':' || v_client.classificacao || ':' || _data_previsao_entrega::text, 0));
  SELECT limite_carga INTO v_limit
  FROM public.pdv_capacidades_diarias
  WHERE tenant_id = v_client.tenant_id
    AND area = v_client.classificacao
    AND data = _data_previsao_entrega
    AND ativo
  FOR UPDATE;
  IF NOT FOUND THEN
    SELECT limite_carga INTO v_limit
    FROM public.pdv_capacidade_configuracoes
    WHERE tenant_id = v_client.tenant_id
      AND area = v_client.classificacao
      AND ativo;
  END IF;
  IF v_limit IS NOT NULL THEN
    SELECT coalesce(sum(i.quantidade), 0) INTO v_reserved
    FROM public.ordens_servico o
    JOIN public.clientes c ON c.id = o.cliente_id AND c.tenant_id = o.tenant_id
    JOIN public.itens_ordem_servico i ON i.ordem_servico_id = o.id AND i.tenant_id = o.tenant_id
    WHERE o.tenant_id = v_client.tenant_id
      AND c.classificacao = v_client.classificacao
      AND o.data_previsao_entrega = _data_previsao_entrega
      AND o.status NOT IN ('cancelada', 'cancelado');
    IF v_reserved + v_requested > v_limit AND NOT _permitir_excecao_capacidade THEN
      RAISE EXCEPTION 'A data escolhida não possui capacidade disponível para este pedido';
    END IF;
  END IF;
  v_result := public.criar_venda_pdv_com_taxa(_cliente_id,_caixa_id,_data_previsao_entrega,_urgente,_percentual_urgencia,_valor_desconto,v_delivery_fee,_motorista_id,_veiculo_id,_itens,_pagamento,_criado_por,_idempotency_key);
  SELECT * INTO v_order FROM public.ordens_servico WHERE id=(v_result->'order'->>'id')::uuid FOR UPDATE;
  IF coalesce((v_result->>'idempotent')::boolean, false) = false THEN UPDATE public.ordens_servico SET data_retirada=v_intake, recebimento_modalidade=v_receipt, entrega_modalidade=v_delivery, endereco_atendimento_snapshot=v_address, capacidade_reservada=v_requested, capacidade_limite_snapshot=CASE WHEN v_limit IS NOT NULL THEN v_limit ELSE NULL END, capacidade_excecao=coalesce(_permitir_excecao_capacidade,false), status_logistica=CASE WHEN v_receipt='coleta' THEN 'aguardando_coleta' ELSE status_logistica END, updated_at=now() WHERE id=v_order.id; END IF;
  RETURN v_result || jsonb_build_object('intake',jsonb_build_object('date',v_intake,'receiptMode',v_receipt,'deliveryMode',v_delivery,'addressSnapshot',v_address,'deliveryFee',v_delivery_fee,'distanceKm',v_distance_km),'capacity',jsonb_build_object('configured',v_limit IS NOT NULL,'limit',v_limit,'reserved',v_reserved,'requested',v_requested,'override',_permitir_excecao_capacidade));
END;
$function$;

REVOKE ALL ON FUNCTION public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean) TO service_role;

