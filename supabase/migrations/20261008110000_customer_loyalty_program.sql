-- Programa de fidelidade por empresa: pontos são um crédito interno e nunca
-- movimentam dinheiro no caixa. Crédito e resgate passam por rotinas atômicas.

CREATE TABLE IF NOT EXISTS public.fidelidade_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  valor_minimo_acumulo numeric(12,2) NOT NULL DEFAULT 50.00 CHECK (valor_minimo_acumulo >= 0),
  reais_por_ponto numeric(12,2) NOT NULL DEFAULT 1.00 CHECK (reais_por_ponto > 0),
  valor_por_ponto numeric(12,2) NOT NULL DEFAULT 0.10 CHECK (valor_por_ponto > 0),
  pontos_minimos_resgate integer NOT NULL DEFAULT 100 CHECK (pontos_minimos_resgate > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fidelidade_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('CREDITO', 'RESGATE', 'ESTORNO', 'EXPIRACAO')),
  pontos integer NOT NULL CHECK (pontos <> 0),
  valor_referencia numeric(12,2),
  descricao text NOT NULL CHECK (length(trim(descricao)) BETWEEN 3 AND 250),
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tipo = 'CREDITO' AND pontos > 0) OR (tipo IN ('RESGATE', 'EXPIRACAO') AND pontos < 0) OR tipo = 'ESTORNO')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fidelidade_credito_por_os
  ON public.fidelidade_lancamentos(tenant_id, ordem_servico_id)
  WHERE tipo = 'CREDITO';
CREATE UNIQUE INDEX IF NOT EXISTS uq_fidelidade_lancamentos_idempotency
  ON public.fidelidade_lancamentos(tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_fidelidade_lancamentos_cliente
  ON public.fidelidade_lancamentos(tenant_id, cliente_id, created_at DESC);

ALTER TABLE public.fidelidade_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fidelidade_lancamentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fidelidade_configuracoes, public.fidelidade_lancamentos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.fidelidade_configuracoes TO authenticated;
GRANT SELECT ON public.fidelidade_lancamentos TO authenticated;
GRANT ALL ON TABLE public.fidelidade_configuracoes, public.fidelidade_lancamentos TO service_role;

CREATE POLICY fidelidade_configuracoes_admin ON public.fidelidade_configuracoes
  FOR ALL TO authenticated
  USING (private.is_tenant_admin(tenant_id))
  WITH CHECK (private.is_tenant_admin(tenant_id));

CREATE POLICY fidelidade_lancamentos_leitura_empresa ON public.fidelidade_lancamentos
  FOR SELECT TO authenticated
  USING (
    tenant_id = private.current_tenant_id()
    AND private.has_any_module_access(ARRAY['caixa', 'clientes'])
  );

CREATE TRIGGER update_fidelidade_configuracoes_updated_at
  BEFORE UPDATE ON public.fidelidade_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rol_configuracoes
  ADD COLUMN IF NOT EXISTS exibir_fidelidade boolean NOT NULL DEFAULT true;

ALTER TABLE public.pdv_pagamentos
  DROP CONSTRAINT IF EXISTS pdv_pagamentos_metodo_check,
  DROP CONSTRAINT IF EXISTS pdv_pagamentos_provedor_check;
ALTER TABLE public.pdv_pagamentos
  ADD CONSTRAINT pdv_pagamentos_metodo_check
    CHECK (metodo IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'FIDELIDADE', 'OUTRO')),
  ADD CONSTRAINT pdv_pagamentos_provedor_check
    CHECK (provedor IN ('MANUAL', 'TERMINAL_EXTERNO', 'ASAAS', 'FIDELIDADE', 'LEGACY')),
  ADD CONSTRAINT pdv_pagamentos_fidelidade_check
    CHECK (metodo <> 'FIDELIDADE' OR (provedor = 'FIDELIDADE' AND valor_recebido IS NULL AND troco = 0 AND parcelas = 1));

CREATE OR REPLACE FUNCTION private.resumo_fidelidade(
  _tenant_id uuid,
  _cliente_id uuid,
  _ordem_servico_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_config public.fidelidade_configuracoes%ROWTYPE;
  v_saldo integer := 0;
  v_ganhos integer := 0;
BEGIN
  SELECT * INTO v_config
  FROM public.fidelidade_configuracoes
  WHERE tenant_id = _tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('programaAtivo', false, 'saldoPontos', 0, 'valorSaldo', 0, 'pontosGanhosNestaOrdem', 0, 'pontosMinimosResgate', 0);
  END IF;

  SELECT coalesce(sum(pontos), 0) INTO v_saldo
  FROM public.fidelidade_lancamentos
  WHERE tenant_id = _tenant_id AND cliente_id = _cliente_id;

  IF _ordem_servico_id IS NOT NULL THEN
    SELECT coalesce(sum(pontos), 0) INTO v_ganhos
    FROM public.fidelidade_lancamentos
    WHERE tenant_id = _tenant_id
      AND cliente_id = _cliente_id
      AND ordem_servico_id = _ordem_servico_id
      AND tipo = 'CREDITO';
  END IF;

  RETURN jsonb_build_object(
    'programaAtivo', v_config.ativo,
    'saldoPontos', greatest(v_saldo, 0),
    'valorSaldo', round(greatest(v_saldo, 0) * v_config.valor_por_ponto, 2),
    'pontosGanhosNestaOrdem', v_ganhos,
    'pontosMinimosResgate', v_config.pontos_minimos_resgate,
    'valorPorPonto', v_config.valor_por_ponto
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.creditar_pontos_fidelidade_ordem(_ordem_servico_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_config public.fidelidade_configuracoes%ROWTYPE;
  v_pago numeric(12,2);
  v_monetario numeric(12,2);
  v_pontos integer;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _ordem_servico_id FOR UPDATE;
  IF NOT FOUND OR v_os.status = 'cancelada' OR v_os.origem NOT IN ('residencial', 'loja') THEN RETURN; END IF;

  SELECT * INTO v_config FROM public.fidelidade_configuracoes WHERE tenant_id = v_os.tenant_id;
  IF NOT FOUND OR NOT v_config.ativo THEN RETURN; END IF;

  SELECT round(coalesce(sum(valor), 0), 2),
         round(coalesce(sum(valor) FILTER (WHERE metodo <> 'FIDELIDADE'), 0), 2)
    INTO v_pago, v_monetario
  FROM public.pdv_pagamentos
  WHERE ordem_servico_id = v_os.id AND status IN ('CONFIRMADO', 'EM_REVISAO');

  IF v_pago + 0.009 < v_os.valor_total OR v_monetario + 0.009 < v_config.valor_minimo_acumulo THEN RETURN; END IF;
  v_pontos := floor(v_monetario / v_config.reais_por_ponto)::integer;
  IF v_pontos <= 0 THEN RETURN; END IF;

  INSERT INTO public.fidelidade_lancamentos (
    tenant_id, cliente_id, ordem_servico_id, tipo, pontos, valor_referencia, descricao, idempotency_key
  ) VALUES (
    v_os.tenant_id, v_os.cliente_id, v_os.id, 'CREDITO', v_pontos, v_monetario,
    'Pontos da OS ' || v_os.numero, 'loyalty:credit:' || v_os.id::text
  ) ON CONFLICT (tenant_id, ordem_servico_id) WHERE tipo = 'CREDITO' DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION private.processar_credito_fidelidade_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('CONFIRMADO', 'EM_REVISAO') THEN
    PERFORM private.creditar_pontos_fidelidade_ordem(NEW.ordem_servico_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creditar_pontos_fidelidade ON public.pdv_pagamentos;
CREATE TRIGGER trg_creditar_pontos_fidelidade
  AFTER INSERT OR UPDATE OF status ON public.pdv_pagamentos
  FOR EACH ROW EXECUTE FUNCTION private.processar_credito_fidelidade_pagamento();

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
SET search_path = public, private, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.consultar_fidelidade_rol(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  v_os public.ordens_servico%ROWTYPE;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.can_access_order(_ordem_servico_id) THEN RAISE EXCEPTION 'Sem permissão para consultar a fidelidade desta OS'; END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _ordem_servico_id AND tenant_id = private.current_tenant_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  v_resultado := private.resumo_fidelidade(v_os.tenant_id, v_os.cliente_id, v_os.id);
  RETURN v_resultado || jsonb_build_object('exibirRol', coalesce((SELECT exibir_fidelidade FROM public.rol_configuracoes WHERE tenant_id = v_os.tenant_id LIMIT 1), true));
END;
$$;

CREATE OR REPLACE FUNCTION public.consultar_fidelidade_pdv(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE v_os public.ordens_servico%ROWTYPE;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = _ordem_servico_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;
  RETURN private.resumo_fidelidade(v_os.tenant_id, v_os.cliente_id, v_os.id);
END;
$$;

REVOKE ALL ON FUNCTION private.resumo_fidelidade(uuid, uuid, uuid), private.creditar_pontos_fidelidade_ordem(uuid), private.processar_credito_fidelidade_pagamento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resgatar_pontos_fidelidade_pdv(uuid, uuid, integer, text, text, uuid), public.consultar_fidelidade_rol(uuid), public.consultar_fidelidade_pdv(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resgatar_pontos_fidelidade_pdv(uuid, uuid, integer, text, text, uuid), public.consultar_fidelidade_pdv(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_fidelidade_rol(uuid) TO authenticated;
