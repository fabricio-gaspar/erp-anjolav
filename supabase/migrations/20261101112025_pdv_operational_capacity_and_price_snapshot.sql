-- The price table and the exact item prices must remain explainable even when
-- the customer profile or product catalog changes later.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS tabela_preco_tipo_snapshot text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS capacidade_reservada numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_limite_snapshot numeric(12,3),
  ADD COLUMN IF NOT EXISTS capacidade_excecao boolean NOT NULL DEFAULT false;

ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_tabela_preco_tipo_snapshot_check,
  ADD CONSTRAINT ordens_servico_tabela_preco_tipo_snapshot_check
    CHECK (tabela_preco_tipo_snapshot IN ('padrao', 'personalizada', 'cesto')),
  DROP CONSTRAINT IF EXISTS ordens_servico_capacidade_reservada_check,
  ADD CONSTRAINT ordens_servico_capacidade_reservada_check
    CHECK (capacidade_reservada >= 0),
  DROP CONSTRAINT IF EXISTS ordens_servico_capacidade_limite_snapshot_check,
  ADD CONSTRAINT ordens_servico_capacidade_limite_snapshot_check
    CHECK (capacidade_limite_snapshot IS NULL OR capacidade_limite_snapshot > 0);

-- Older confirmed PDV orders already hold the chosen table in the commercial
-- snapshot. Materialize it explicitly without changing their financial data.
UPDATE public.ordens_servico
SET tabela_preco_tipo_snapshot = CASE
  WHEN condicoes_comerciais->>'tabela_preco_tipo' IN ('padrao', 'personalizada', 'cesto')
    THEN condicoes_comerciais->>'tabela_preco_tipo'
  ELSE tabela_preco_tipo_snapshot
END
WHERE condicoes_comerciais ? 'tabela_preco_tipo';

COMMENT ON COLUMN public.ordens_servico.tabela_preco_tipo_snapshot IS
  'Immutable price table selected when the PDV order was confirmed.';
COMMENT ON COLUMN public.ordens_servico.capacidade_reservada IS
  'Operational load reserved for the promised delivery date at order confirmation.';
COMMENT ON COLUMN public.ordens_servico.capacidade_limite_snapshot IS
  'Configured daily load limit seen when the order was confirmed.';
COMMENT ON COLUMN public.ordens_servico.capacidade_excecao IS
  'Whether an authorized user intentionally exceeded the daily capacity limit.';

-- Price-table snapshotting happens before the core commercial function writes
-- the order. This avoids a post-insert window in which an historical order
-- could have no table identified.
CREATE OR REPLACE FUNCTION private.snapshot_pdv_price_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tabela text;
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    SELECT tabela_preco_tipo INTO v_tabela
    FROM public.clientes
    WHERE id = NEW.cliente_id
      AND tenant_id = NEW.tenant_id;
    IF v_tabela IN ('padrao', 'personalizada', 'cesto') THEN
      NEW.tabela_preco_tipo_snapshot := v_tabela;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.snapshot_pdv_price_table() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS snapshot_pdv_price_table ON public.ordens_servico;
CREATE TRIGGER snapshot_pdv_price_table
BEFORE INSERT ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION private.snapshot_pdv_price_table();

-- The ordinary PDV update path never changes this field. Protect it separately
-- from generic order edits so the item-price snapshot and table stay aligned.
CREATE OR REPLACE FUNCTION private.guard_pdv_price_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF OLD.pdv_request_hash IS NOT NULL
     AND NEW.tabela_preco_tipo_snapshot IS DISTINCT FROM OLD.tabela_preco_tipo_snapshot THEN
    RAISE EXCEPTION 'A tabela de preço original do atendimento deve ser preservada';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_pdv_price_snapshot() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_pdv_price_snapshot ON public.ordens_servico;
CREATE TRIGGER guard_pdv_price_snapshot
BEFORE UPDATE OF tabela_preco_tipo_snapshot ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION private.guard_pdv_price_snapshot();

-- Capacity is configurable per tenant, operation and delivery date. There is
-- intentionally no silent default limit: an unconfigured date is explicit in
-- the UI and can never be mistaken for a full date.
CREATE TABLE IF NOT EXISTS public.pdv_capacidades_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  area text NOT NULL CHECK (area IN ('residencial', 'industrial')),
  data date NOT NULL,
  limite_carga numeric(12,3) NOT NULL CHECK (limite_carga > 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, area, data)
);

CREATE INDEX IF NOT EXISTS idx_pdv_capacidades_diarias_lookup
  ON public.pdv_capacidades_diarias (tenant_id, area, data)
  WHERE ativo;

ALTER TABLE public.pdv_capacidades_diarias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pdv_capacidades_diarias FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pdv_capacidades_diarias TO authenticated;
GRANT ALL ON TABLE public.pdv_capacidades_diarias TO service_role;

CREATE POLICY pdv_capacity_tenant_admin_read
  ON public.pdv_capacidades_diarias
  FOR SELECT TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));
CREATE POLICY pdv_capacity_tenant_admin_insert
  ON public.pdv_capacidades_diarias
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));
CREATE POLICY pdv_capacity_tenant_admin_update
  ON public.pdv_capacidades_diarias
  FOR UPDATE TO authenticated
  USING (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id))
  WITH CHECK (tenant_id = private.current_tenant_id() AND private.is_tenant_admin(tenant_id));

DROP TRIGGER IF EXISTS audit_mutation ON public.pdv_capacidades_diarias;
CREATE TRIGGER audit_mutation
AFTER INSERT OR UPDATE OR DELETE ON public.pdv_capacidades_diarias
FOR EACH ROW EXECUTE FUNCTION private.write_audit_event();

-- This protected read model is called only by the PDV Edge Function. The UI
-- gets a scoped snapshot; the browser never derives booked capacity itself.
CREATE OR REPLACE FUNCTION public.consultar_capacidade_pdv(
  _tenant_id uuid,
  _area text,
  _data date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_limite numeric(12,3);
  v_reservada numeric(12,3) := 0;
BEGIN
  IF _tenant_id IS NULL OR _area NOT IN ('residencial', 'industrial') OR _data IS NULL THEN
    RAISE EXCEPTION 'Consulta de capacidade inválida';
  END IF;

  SELECT limite_carga INTO v_limite
  FROM public.pdv_capacidades_diarias
  WHERE tenant_id = _tenant_id
    AND area = _area
    AND data = _data
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
$$;
REVOKE ALL ON FUNCTION public.consultar_capacidade_pdv(uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_capacidade_pdv(uuid, text, date) TO service_role;

-- Replace the intake wrapper so the capacity decision happens in the same
-- transaction as the order and payment creation. The capacity row is locked
-- per date; simultaneous confirmations cannot both consume the final slot.
DROP FUNCTION IF EXISTS public.criar_pedido_atendimento(
  uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid,
  text, date, text, text, text, jsonb
);

CREATE FUNCTION public.criar_pedido_atendimento(
  _cliente_id uuid,
  _caixa_id uuid,
  _data_previsao_entrega date,
  _urgente boolean,
  _percentual_urgencia numeric,
  _valor_desconto numeric,
  _motorista_id uuid,
  _veiculo_id uuid,
  _itens jsonb,
  _pagamento jsonb,
  _criado_por uuid,
  _idempotency_key text,
  _data_retirada date,
  _observacoes text,
  _recebimento_modalidade text,
  _entrega_modalidade text,
  _endereco_snapshot jsonb,
  _permitir_excecao_capacidade boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_resultado jsonb;
  v_ordem public.ordens_servico%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_ordem_id uuid;
  v_data_retirada date := coalesce(_data_retirada, current_date);
  v_observacoes text := nullif(left(trim(coalesce(_observacoes, '')), 2000), '');
  v_recebimento text := coalesce(nullif(trim(_recebimento_modalidade), ''), 'balcao');
  v_entrega text := coalesce(nullif(trim(_entrega_modalidade), ''), 'balcao');
  v_endereco jsonb := '{}'::jsonb;
  v_idempotente boolean;
  v_preexistente boolean := false;
  v_capacidade_configurada boolean := false;
  v_limite_carga numeric(12,3);
  v_carga_reservada numeric(12,3) := 0;
  v_carga_solicitada numeric(12,3) := 0;
  v_item jsonb;
  v_quantidade numeric;
  v_excecao boolean := coalesce(_permitir_excecao_capacidade, false);
BEGIN
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_idempotency_key, 0));

  SELECT * INTO v_ordem
  FROM public.ordens_servico
  WHERE pdv_idempotency_key = _idempotency_key;
  v_preexistente := FOUND;
  IF v_preexistente AND _data_retirada IS NULL THEN
    v_data_retirada := v_ordem.data_retirada;
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = _cliente_id
  FOR SHARE;
  IF NOT FOUND OR NOT coalesce(v_cliente.ativo, false) OR v_cliente.classificacao NOT IN ('industrial', 'residencial') THEN
    RAISE EXCEPTION 'Cliente inválido ou inativo';
  END IF;

  IF NOT v_preexistente AND v_data_retirada < current_date THEN
    RAISE EXCEPTION 'A data de recebimento não pode estar no passado';
  END IF;
  IF _data_previsao_entrega IS NULL OR _data_previsao_entrega < v_data_retirada THEN
    RAISE EXCEPTION 'A previsão de entrega deve ser igual ou posterior ao recebimento';
  END IF;
  IF length(coalesce(_observacoes, '')) > 2000 THEN
    RAISE EXCEPTION 'As observações devem ter no máximo 2000 caracteres';
  END IF;
  IF v_recebimento NOT IN ('balcao', 'coleta') THEN
    RAISE EXCEPTION 'Modalidade de recebimento inválida';
  END IF;
  IF v_entrega NOT IN ('balcao', 'entrega') THEN
    RAISE EXCEPTION 'Modalidade de entrega inválida';
  END IF;
  IF _endereco_snapshot IS NOT NULL AND jsonb_typeof(_endereco_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Endereço do atendimento inválido';
  END IF;
  IF pg_column_size(coalesce(_endereco_snapshot, '{}'::jsonb)) > 16384 THEN
    RAISE EXCEPTION 'Endereço do atendimento excede o limite permitido';
  END IF;

  IF v_recebimento = 'coleta' OR v_entrega = 'entrega' THEN
    IF nullif(trim(coalesce(_endereco_snapshot->>'logradouro', '')), '') IS NULL
       OR nullif(trim(coalesce(_endereco_snapshot->>'cidade', '')), '') IS NULL
       OR nullif(trim(coalesce(_endereco_snapshot->>'uf', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Informe um endereço completo para coleta ou entrega';
    END IF;
    v_endereco := jsonb_strip_nulls(jsonb_build_object(
      'cep', nullif(left(trim(coalesce(_endereco_snapshot->>'cep', '')), 20), ''),
      'logradouro', nullif(left(trim(coalesce(_endereco_snapshot->>'logradouro', '')), 200), ''),
      'numero', nullif(left(trim(coalesce(_endereco_snapshot->>'numero', '')), 30), ''),
      'complemento', nullif(left(trim(coalesce(_endereco_snapshot->>'complemento', '')), 120), ''),
      'bairro', nullif(left(trim(coalesce(_endereco_snapshot->>'bairro', '')), 120), ''),
      'cidade', nullif(left(trim(coalesce(_endereco_snapshot->>'cidade', '')), 120), ''),
      'uf', upper(nullif(left(trim(coalesce(_endereco_snapshot->>'uf', '')), 2), '')),
      'pais', nullif(left(trim(coalesce(_endereco_snapshot->>'pais', 'Brasil')), 80), '')
    ));
  END IF;

  IF v_excecao AND NOT private.pdv_actor_allowed(
    _criado_por, v_cliente.tenant_id, v_cliente.classificacao, ARRAY['alterar_condicoes_comerciais']
  ) THEN
    RAISE EXCEPTION 'Sem permissão para autorizar exceção de capacidade';
  END IF;

  IF NOT v_preexistente THEN
    IF jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
      RAISE EXCEPTION 'A venda deve possuir itens para reservar capacidade';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(_itens)
    LOOP
      BEGIN
        v_quantidade := (v_item->>'quantidade')::numeric;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Quantidade inválida para reservar capacidade';
      END;
      IF v_quantidade IS NULL OR v_quantidade::text IN ('NaN', 'Infinity', '-Infinity') OR v_quantidade <= 0 OR v_quantidade > 999 THEN
        RAISE EXCEPTION 'Quantidade inválida para reservar capacidade';
      END IF;
      v_carga_solicitada := v_carga_solicitada + v_quantidade;
    END LOOP;

    SELECT limite_carga INTO v_limite_carga
    FROM public.pdv_capacidades_diarias
    WHERE tenant_id = v_cliente.tenant_id
      AND area = v_cliente.classificacao
      AND data = _data_previsao_entrega
      AND ativo
    FOR UPDATE;
    v_capacidade_configurada := FOUND;

    IF v_capacidade_configurada THEN
      SELECT coalesce(sum(item.quantidade), 0)::numeric(12,3) INTO v_carga_reservada
      FROM public.ordens_servico AS service_order
      JOIN public.clientes AS customer
        ON customer.id = service_order.cliente_id
       AND customer.tenant_id = service_order.tenant_id
      JOIN public.itens_ordem_servico AS item
        ON item.ordem_servico_id = service_order.id
       AND item.tenant_id = service_order.tenant_id
      WHERE service_order.tenant_id = v_cliente.tenant_id
        AND customer.classificacao = v_cliente.classificacao
        AND service_order.data_previsao_entrega = _data_previsao_entrega
        AND service_order.status <> 'cancelada';

      IF v_carga_reservada + v_carga_solicitada > v_limite_carga AND NOT v_excecao THEN
        RAISE EXCEPTION 'A data escolhida não possui capacidade disponível para este pedido';
      END IF;
    END IF;
  END IF;

  v_resultado := public.criar_venda_pdv(
    _cliente_id,
    _caixa_id,
    _data_previsao_entrega,
    _urgente,
    _percentual_urgencia,
    _valor_desconto,
    _motorista_id,
    _veiculo_id,
    _itens,
    _pagamento,
    _criado_por,
    _idempotency_key
  );

  v_ordem_id := (v_resultado->'order'->>'id')::uuid;
  v_idempotente := coalesce((v_resultado->>'idempotent')::boolean, false);
  SELECT * INTO v_ordem
  FROM public.ordens_servico
  WHERE id = v_ordem_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O pedido confirmado não foi encontrado';
  END IF;

  IF v_idempotente THEN
    IF v_ordem.data_retirada IS DISTINCT FROM v_data_retirada
       OR v_ordem.observacoes IS DISTINCT FROM v_observacoes
       OR v_ordem.recebimento_modalidade IS DISTINCT FROM v_recebimento
       OR v_ordem.entrega_modalidade IS DISTINCT FROM v_entrega
       OR v_ordem.endereco_atendimento_snapshot IS DISTINCT FROM v_endereco
       OR v_ordem.capacidade_excecao IS DISTINCT FROM v_excecao THEN
      RAISE EXCEPTION 'Chave de idempotência usada com dados diferentes no pedido';
    END IF;
  ELSE
    UPDATE public.ordens_servico
    SET data_retirada = v_data_retirada,
        observacoes = v_observacoes,
        recebimento_modalidade = v_recebimento,
        entrega_modalidade = v_entrega,
        endereco_atendimento_snapshot = v_endereco,
        capacidade_reservada = v_carga_solicitada,
        capacidade_limite_snapshot = CASE WHEN v_capacidade_configurada THEN v_limite_carga ELSE NULL END,
        capacidade_excecao = v_excecao,
        status_logistica = CASE
          WHEN v_recebimento = 'coleta' THEN 'aguardando_coleta'
          ELSE status_logistica
        END
    WHERE id = v_ordem_id;
  END IF;

  RETURN v_resultado || jsonb_build_object(
    'intake', jsonb_build_object(
      'date', v_data_retirada,
      'receiptMode', v_recebimento,
      'deliveryMode', v_entrega,
      'addressSnapshot', v_endereco,
      'priceTable', v_ordem.tabela_preco_tipo_snapshot
    ),
    'capacity', jsonb_build_object(
      'configured', v_capacidade_configurada,
      'limit', CASE WHEN v_capacidade_configurada THEN v_limite_carga ELSE NULL END,
      'reserved', v_carga_reservada,
      'requested', v_carga_solicitada,
      'override', v_excecao
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_atendimento(
  uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid,
  text, date, text, text, text, jsonb, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atendimento(
  uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid,
  text, date, text, text, text, jsonb, boolean
) TO service_role;
