BEGIN;

ALTER TABLE public.fidelidade_configuracoes
  ADD COLUMN IF NOT EXISTS ativo_domestico boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ativo_industrial boolean NOT NULL DEFAULT false;

-- Keep the behavior already working in production: previously active tenants
-- earned/redeemed through the domestic flow. Industrial can now be enabled
-- explicitly in the settings screen.
UPDATE public.fidelidade_configuracoes
   SET ativo_domestico = ativo,
       ativo_industrial = false;

CREATE OR REPLACE FUNCTION private.creditar_pontos_fidelidade_ordem(_ordem_servico_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_config public.fidelidade_configuracoes%ROWTYPE;
  v_pago numeric(12,2);
  v_monetario numeric(12,2);
  v_pontos integer;
BEGIN
  SELECT * INTO v_os
    FROM public.ordens_servico
   WHERE id = _ordem_servico_id
   FOR UPDATE;
  IF NOT FOUND OR v_os.status = 'cancelada' OR v_os.operation_type IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_config
    FROM public.fidelidade_configuracoes
   WHERE tenant_id = v_os.tenant_id;
  IF NOT FOUND OR NOT v_config.ativo THEN
    RETURN;
  END IF;
  IF (v_os.operation_type = 'domestico' AND NOT v_config.ativo_domestico)
     OR (v_os.operation_type = 'industrial' AND NOT v_config.ativo_industrial) THEN
    RETURN;
  END IF;

  SELECT round(coalesce(sum(valor), 0), 2),
         round(coalesce(sum(valor) FILTER (WHERE metodo <> 'FIDELIDADE'), 0), 2)
    INTO v_pago, v_monetario
    FROM public.pdv_pagamentos
   WHERE ordem_servico_id = v_os.id
     AND status IN ('CONFIRMADO', 'EM_REVISAO');

  IF v_pago + 0.009 < v_os.valor_total
     OR v_monetario + 0.009 < v_config.valor_minimo_acumulo THEN
    RETURN;
  END IF;

  v_pontos := floor(v_monetario / v_config.reais_por_ponto)::integer;
  IF v_pontos <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.fidelidade_lancamentos (
    tenant_id, cliente_id, ordem_servico_id, tipo, pontos,
    valor_referencia, descricao, idempotency_key
  ) VALUES (
    v_os.tenant_id, v_os.cliente_id, v_os.id, 'CREDITO', v_pontos,
    v_monetario, 'Pontos da OS ' || v_os.numero,
    'loyalty:credit:' || v_os.id::text
  )
  ON CONFLICT (tenant_id, ordem_servico_id) WHERE tipo = 'CREDITO'
  DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION private.resumo_fidelidade(
  _tenant_id uuid,
  _cliente_id uuid,
  _ordem_servico_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
DECLARE
  v_config public.fidelidade_configuracoes%ROWTYPE;
  v_operation_type public.operation_type;
  v_operation_enabled boolean := false;
  v_saldo integer := 0;
  v_ganhos integer := 0;
BEGIN
  SELECT * INTO v_config
    FROM public.fidelidade_configuracoes
   WHERE tenant_id = _tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'programaAtivo', false,
      'saldoPontos', 0,
      'valorSaldo', 0,
      'pontosGanhosNestaOrdem', 0,
      'pontosMinimosResgate', 0
    );
  END IF;

  IF _ordem_servico_id IS NULL THEN
    v_operation_enabled := v_config.ativo;
  ELSE
    SELECT operation_type INTO v_operation_type
      FROM public.ordens_servico
     WHERE id = _ordem_servico_id
       AND tenant_id = _tenant_id
       AND cliente_id = _cliente_id;
    v_operation_enabled := CASE v_operation_type
      WHEN 'domestico' THEN v_config.ativo_domestico
      WHEN 'industrial' THEN v_config.ativo_industrial
      ELSE false
    END;
  END IF;

  SELECT coalesce(sum(pontos), 0) INTO v_saldo
    FROM public.fidelidade_lancamentos
   WHERE tenant_id = _tenant_id
     AND cliente_id = _cliente_id;

  IF _ordem_servico_id IS NOT NULL THEN
    SELECT coalesce(sum(pontos), 0) INTO v_ganhos
      FROM public.fidelidade_lancamentos
     WHERE tenant_id = _tenant_id
       AND cliente_id = _cliente_id
       AND ordem_servico_id = _ordem_servico_id
       AND tipo = 'CREDITO';
  END IF;

  RETURN jsonb_build_object(
    'programaAtivo', v_config.ativo AND v_operation_enabled,
    'saldoPontos', greatest(v_saldo, 0),
    'valorSaldo', round(greatest(v_saldo, 0) * v_config.valor_por_ponto, 2),
    'pontosGanhosNestaOrdem', v_ganhos,
    'pontosMinimosResgate', v_config.pontos_minimos_resgate,
    'valorPorPonto', v_config.valor_por_ponto
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resgatar_pontos_fidelidade_pdv(
  _ordem_servico_id uuid,
  _caixa_id uuid,
  _pontos integer,
  _momento text,
  _idempotency_key text,
  _criado_por uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_caixa public.caixas%ROWTYPE;
  v_config public.fidelidade_configuracoes%ROWTYPE;
  v_existente public.pdv_pagamentos%ROWTYPE;
  v_area text;
  v_saldo integer;
  v_pendente numeric(12,2);
  v_valor numeric(12,2);
  v_resumo jsonb;
BEGIN
  SELECT * INTO v_os
    FROM public.ordens_servico
   WHERE id = _ordem_servico_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  v_area := CASE v_os.operation_type
    WHEN 'domestico' THEN 'residencial'
    WHEN 'industrial' THEN 'industrial'
    ELSE NULL
  END;
  IF v_os.condicao_pagamento = 'faturado'
     OR NOT private.pdv_actor_allowed(_criado_por, v_os.tenant_id, v_area, ARRAY['caixa']) THEN
    RAISE EXCEPTION 'Atendimento sem permissão para resgate direto';
  END IF;
  IF _pontos IS NULL OR _pontos < 1 OR _pontos > 1000000 THEN
    RAISE EXCEPTION 'Quantidade de pontos inválida';
  END IF;
  IF _momento NOT IN ('ENTRADA', 'RETIRADA') THEN
    RAISE EXCEPTION 'Momento do resgate inválido';
  END IF;

  SELECT * INTO v_existente
    FROM public.pdv_pagamentos
   WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF v_existente.ordem_servico_id <> _ordem_servico_id
       OR v_existente.metodo <> 'FIDELIDADE' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outro pagamento';
    END IF;
    v_resumo := private.recalcular_pagamento_os(_ordem_servico_id);
    RETURN jsonb_build_object(
      'paymentId', v_existente.id,
      'paymentStatus', v_existente.status,
      'redeemedValue', v_existente.valor
    ) || v_resumo;
  END IF;

  SELECT * INTO v_os
    FROM public.ordens_servico
   WHERE id = _ordem_servico_id
   FOR UPDATE;
  IF NOT FOUND OR v_os.status = 'cancelada' OR v_os.operation_type IS NULL THEN
    RAISE EXCEPTION 'OS inválida para resgate';
  END IF;

  SELECT * INTO v_caixa
    FROM public.caixas
   WHERE id = _caixa_id
   FOR UPDATE;
  IF NOT FOUND OR v_caixa.status <> 'ABERTO' OR v_caixa.tenant_id <> v_os.tenant_id THEN
    RAISE EXCEPTION 'O caixa informado não está aberto';
  END IF;

  SELECT * INTO v_config
    FROM public.fidelidade_configuracoes
   WHERE tenant_id = v_os.tenant_id;
  IF NOT FOUND OR NOT v_config.ativo
     OR (v_os.operation_type = 'domestico' AND NOT v_config.ativo_domestico)
     OR (v_os.operation_type = 'industrial' AND NOT v_config.ativo_industrial) THEN
    RAISE EXCEPTION 'O programa de fidelidade não está ativo para esta operação';
  END IF;
  IF _pontos < v_config.pontos_minimos_resgate THEN
    RAISE EXCEPTION 'O resgate mínimo é de % pontos', v_config.pontos_minimos_resgate;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.pdv_pagamentos
     WHERE ordem_servico_id = v_os.id
       AND metodo = 'PIX'
       AND status IN ('PENDENTE', 'PROCESSANDO')
  ) THEN
    RAISE EXCEPTION 'Cancele o PIX pendente antes de usar pontos';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_os.tenant_id::text || ':' || v_os.cliente_id::text, 0));
  SELECT coalesce(sum(pontos), 0) INTO v_saldo
    FROM public.fidelidade_lancamentos
   WHERE tenant_id = v_os.tenant_id
     AND cliente_id = v_os.cliente_id;
  IF v_saldo < _pontos THEN
    RAISE EXCEPTION 'Saldo de pontos insuficiente';
  END IF;

  SELECT round(coalesce(sum(valor), 0), 2) INTO v_pendente
    FROM public.pdv_pagamentos
   WHERE ordem_servico_id = v_os.id
     AND status IN ('CONFIRMADO', 'EM_REVISAO');
  v_pendente := round(v_os.valor_total - v_pendente, 2);
  v_valor := round(_pontos * v_config.valor_por_ponto, 2);
  IF v_valor <= 0 OR v_valor > v_pendente + 0.009 THEN
    RAISE EXCEPTION 'Os pontos informados excedem o saldo pendente da OS';
  END IF;

  INSERT INTO public.pdv_pagamentos (
    ordem_servico_id, caixa_id, cliente_id, metodo, momento, status, valor, parcelas,
    provedor, idempotency_key, metadata, confirmado_em, criado_por
  ) VALUES (
    v_os.id, v_caixa.id, v_os.cliente_id, 'FIDELIDADE', _momento, 'CONFIRMADO', v_valor, 1,
    'FIDELIDADE', _idempotency_key,
    jsonb_build_object('pontos', _pontos, 'valorPorPonto', v_config.valor_por_ponto),
    now(), _criado_por
  ) RETURNING * INTO v_existente;

  INSERT INTO public.fidelidade_lancamentos (
    tenant_id, cliente_id, ordem_servico_id, tipo, pontos,
    valor_referencia, descricao, idempotency_key, criado_por
  ) VALUES (
    v_os.tenant_id, v_os.cliente_id, v_os.id, 'RESGATE', -_pontos, v_valor,
    'Resgate na OS ' || v_os.numero, 'loyalty:redeem:' || _idempotency_key, _criado_por
  );

  v_resumo := private.recalcular_pagamento_os(v_os.id);
  RETURN jsonb_build_object(
    'paymentId', v_existente.id,
    'paymentStatus', v_existente.status,
    'redeemedValue', v_valor,
    'redeemedPoints', _pontos
  ) || v_resumo;
END;
$function$;

COMMIT;
