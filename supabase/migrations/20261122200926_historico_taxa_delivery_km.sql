-- Preserve the authoritative commercial rules used when each new delivery is created.
-- Existing orders remain NULL: past pricing settings cannot be inferred reliably.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS delivery_modelo_snapshot text,
  ADD COLUMN IF NOT EXISTS delivery_distancia_km_snapshot numeric,
  ADD COLUMN IF NOT EXISTS delivery_taxa_base_snapshot numeric,
  ADD COLUMN IF NOT EXISTS delivery_taxa_km_snapshot numeric;

DO $migration$
DECLARE
  v_definition text;
  v_target text := 'endereco_atendimento_snapshot=v_address, capacidade_reservada=v_requested';
  v_replacement text := 'endereco_atendimento_snapshot=v_address, delivery_modelo_snapshot=CASE WHEN v_delivery=''entrega'' THEN coalesce(v_delivery_rules.delivery_pricing_model,''fixo'') ELSE NULL END, delivery_distancia_km_snapshot=CASE WHEN v_delivery=''entrega'' AND coalesce(v_delivery_rules.delivery_pricing_model,''fixo'')=''km'' THEN v_distance_km ELSE NULL END, delivery_taxa_base_snapshot=CASE WHEN v_delivery=''entrega'' AND coalesce(v_delivery_rules.delivery_pricing_model,''fixo'')=''km'' THEN coalesce(v_delivery_rules.delivery_fee_base,0) WHEN v_delivery=''entrega'' THEN v_delivery_fee ELSE NULL END, delivery_taxa_km_snapshot=CASE WHEN v_delivery=''entrega'' AND coalesce(v_delivery_rules.delivery_pricing_model,''fixo'')=''km'' THEN coalesce(v_delivery_rules.delivery_fee_per_km,0) ELSE NULL END, capacidade_reservada=v_requested';
BEGIN
  SELECT pg_get_functiondef('public.criar_pedido_atendimento_v2(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text,date,text,text,text,jsonb,numeric,boolean)'::regprocedure) INTO v_definition;
  IF position(v_target IN v_definition) = 0 OR position(v_target IN replace(v_definition, v_target, '')) <> 0 THEN
    RAISE EXCEPTION 'Fluxo de criação divergente: snapshot de delivery não aplicado';
  END IF;
  EXECUTE replace(v_definition, v_target, v_replacement);
END;
$migration$;
