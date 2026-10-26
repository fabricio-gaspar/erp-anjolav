-- Match the existing catalog's "Mt" unit as well as "m"/"metro".
DO $migration$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.criar_venda_pdv(uuid,uuid,date,boolean,numeric,numeric,uuid,uuid,jsonb,jsonb,uuid,text)'::regprocedure);
 IF position('''kg'',''m'',''metro''' in definition)=0 THEN RAISE EXCEPTION 'Unexpected PDV unit validation definition'; END IF;
 EXECUTE replace(definition,'''kg'',''m'',''metro''','''kg'',''m'',''mt'',''metro''');
END; $migration$;
CREATE OR REPLACE FUNCTION public.resgatar_pontos_fidelidade_pdv(_ordem_servico_id uuid, _caixa_id uuid, _pontos integer, _momento text, _idempotency_key text, _criado_por uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_config public.fidelidade_configuracoes%ROWTYPE;
  v_existente public.pdv_pagamentos%ROWTYPE;
  v_saldo integer;
  v_pendente numeric(12,2);
  v_valor numeric(12,2);
  v_resumo jsonb;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id=_ordem_servico_id FOR UPDATE;
  IF NOT FOUND OR v_os.condicao_pagamento='faturado'
    OR NOT private.pdv_actor_allowed(_criado_por,v_os.tenant_id,
      CASE WHEN v_os.origem='loja' THEN 'residencial' ELSE v_os.origem END,ARRAY['caixa']) THEN
    RAISE EXCEPTION 'Atendimento sem permissão para resgate direto';
  END IF;
  IF _pontos IS NULL OR _pontos < 1 OR _pontos > 1000000 THEN RAISE EXCEPTION 'Quantidade de pontos inválida'; END IF;
  IF _momento NOT IN ('ENTRADA', 'RETIRADA') THEN RAISE EXCEPTION 'Momento do resgate inválido'; END IF;

  SELECT * INTO v_existente FROM public.pdv_pagamentos WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existente.ordem_servico_id <> _ordem_servico_id OR v_existente.metodo <> 'FIDELIDADE' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outro pagamento';
    END IF;
    v_resumo := private.recalcular_pagamento_os(_ordem_servico_id);
    RETURN jsonb_build_object('paymentId', v_existente.id, 'paymentStatus', v_existente.status, 'redeemedValue', v_existente.valor) || v_resumo;
  END IF;

  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _ordem_servico_id FOR UPDATE;
  IF NOT FOUND OR v_os.status = 'cancelada' OR v_os.origem NOT IN ('residencial', 'loja') THEN RAISE EXCEPTION 'OS residencial inválida para resgate'; END IF;
  SELECT * INTO v_caixa FROM public.caixas WHERE id = _caixa_id FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' OR v_caixa.tenant_id <> v_os.tenant_id THEN RAISE EXCEPTION 'O caixa informado não está aberto'; END IF;
  SELECT * INTO v_config FROM public.fidelidade_configuracoes WHERE tenant_id = v_os.tenant_id;
  IF NOT FOUND OR NOT v_config.ativo THEN RAISE EXCEPTION 'O programa de fidelidade não está ativo'; END IF;
  IF _pontos < v_config.pontos_minimos_resgate THEN RAISE EXCEPTION 'O resgate mínimo é de % pontos', v_config.pontos_minimos_resgate; END IF;
  IF EXISTS (SELECT 1 FROM public.pdv_pagamentos WHERE ordem_servico_id = v_os.id AND metodo = 'PIX' AND status IN ('PENDENTE', 'PROCESSANDO')) THEN
    RAISE EXCEPTION 'Cancele o PIX pendente antes de usar pontos';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_os.tenant_id::text || ':' || v_os.cliente_id::text, 0));
  SELECT coalesce(sum(pontos), 0) INTO v_saldo FROM public.fidelidade_lancamentos WHERE tenant_id = v_os.tenant_id AND cliente_id = v_os.cliente_id;
  IF v_saldo < _pontos THEN RAISE EXCEPTION 'Saldo de pontos insuficiente'; END IF;
  SELECT round(coalesce(sum(valor), 0), 2) INTO v_pendente FROM public.pdv_pagamentos WHERE ordem_servico_id = v_os.id AND status IN ('CONFIRMADO', 'EM_REVISAO');
  v_pendente := round(v_os.valor_total - v_pendente, 2);
  v_valor := round(_pontos * v_config.valor_por_ponto, 2);
  IF v_valor <= 0 OR v_valor > v_pendente + 0.009 THEN RAISE EXCEPTION 'Os pontos informados excedem o saldo pendente da OS'; END IF;

  INSERT INTO public.pdv_pagamentos (
    ordem_servico_id, caixa_id, cliente_id, metodo, momento, status, valor, parcelas,
    provedor, idempotency_key, metadata, confirmado_em, criado_por
  ) VALUES (
    v_os.id, v_caixa.id, v_os.cliente_id, 'FIDELIDADE', _momento, 'CONFIRMADO', v_valor, 1,
    'FIDELIDADE', _idempotency_key, jsonb_build_object('pontos', _pontos, 'valorPorPonto', v_config.valor_por_ponto), now(), _criado_por
  ) RETURNING * INTO v_existente;

  INSERT INTO public.fidelidade_lancamentos (
    tenant_id, cliente_id, ordem_servico_id, tipo, pontos, valor_referencia, descricao, idempotency_key, criado_por
  ) VALUES (
    v_os.tenant_id, v_os.cliente_id, v_os.id, 'RESGATE', -_pontos, v_valor,
    'Resgate na OS ' || v_os.numero, 'loyalty:redeem:' || _idempotency_key, _criado_por
  );

  v_resumo := private.recalcular_pagamento_os(v_os.id);
  RETURN jsonb_build_object('paymentId', v_existente.id, 'paymentStatus', v_existente.status, 'redeemedValue', v_valor, 'redeemedPoints', _pontos) || v_resumo;
END;
$function$;
REVOKE ALL ON FUNCTION public.resgatar_pontos_fidelidade_pdv(uuid,uuid,integer,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resgatar_pontos_fidelidade_pdv(uuid,uuid,integer,text,text,uuid) TO service_role;


