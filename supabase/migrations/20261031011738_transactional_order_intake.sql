-- A confirmed order keeps the logistics choices and the customer address as a
-- historical snapshot. The customer record may change after the order is made.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS recebimento_modalidade text NOT NULL DEFAULT 'balcao',
  ADD COLUMN IF NOT EXISTS entrega_modalidade text NOT NULL DEFAULT 'balcao',
  ADD COLUMN IF NOT EXISTS endereco_atendimento_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_recebimento_modalidade_check,
  ADD CONSTRAINT ordens_servico_recebimento_modalidade_check
    CHECK (recebimento_modalidade IN ('balcao', 'coleta')),
  DROP CONSTRAINT IF EXISTS ordens_servico_entrega_modalidade_check,
  ADD CONSTRAINT ordens_servico_entrega_modalidade_check
    CHECK (entrega_modalidade IN ('balcao', 'entrega')),
  DROP CONSTRAINT IF EXISTS ordens_servico_endereco_atendimento_snapshot_check,
  ADD CONSTRAINT ordens_servico_endereco_atendimento_snapshot_check
    CHECK (jsonb_typeof(endereco_atendimento_snapshot) = 'object');

COMMENT ON COLUMN public.ordens_servico.recebimento_modalidade IS
  'How customer goods reach the laundry: counter drop-off (balcao) or pickup (coleta).';
COMMENT ON COLUMN public.ordens_servico.entrega_modalidade IS
  'How finished goods leave the laundry: counter pickup (balcao) or delivery (entrega).';
COMMENT ON COLUMN public.ordens_servico.endereco_atendimento_snapshot IS
  'Immutable customer-address snapshot used for pickup/delivery planning.';

-- Keep the mature PDV transaction as the single commercial authority. This
-- wrapper adds order-intake data in the same database transaction and checks
-- that retries cannot change those additional fields.
CREATE OR REPLACE FUNCTION public.criar_pedido_atendimento(
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
  _endereco_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_resultado jsonb;
  v_ordem public.ordens_servico%ROWTYPE;
  v_ordem_id uuid;
  v_data_retirada date := coalesce(_data_retirada, current_date);
  v_observacoes text := nullif(left(trim(coalesce(_observacoes, '')), 2000), '');
  v_recebimento text := coalesce(nullif(trim(_recebimento_modalidade), ''), 'balcao');
  v_entrega text := coalesce(nullif(trim(_entrega_modalidade), ''), 'balcao');
  v_endereco jsonb := '{}'::jsonb;
  v_idempotente boolean;
  v_preexistente boolean := false;
BEGIN
  -- A retry may legitimately happen after midnight. When the caller left the
  -- intake date automatic, preserve the date already confirmed by the first
  -- attempt instead of turning the retry into a different request.
  SELECT * INTO v_ordem
  FROM public.ordens_servico
  WHERE pdv_idempotency_key = _idempotency_key;
  v_preexistente := FOUND;
  IF v_preexistente AND _data_retirada IS NULL THEN
    v_data_retirada := v_ordem.data_retirada;
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
       OR v_ordem.endereco_atendimento_snapshot IS DISTINCT FROM v_endereco THEN
      RAISE EXCEPTION 'Chave de idempotência usada com dados diferentes no pedido';
    END IF;
  ELSE
    UPDATE public.ordens_servico
    SET data_retirada = v_data_retirada,
        observacoes = v_observacoes,
        recebimento_modalidade = v_recebimento,
        entrega_modalidade = v_entrega,
        endereco_atendimento_snapshot = v_endereco,
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
      'addressSnapshot', v_endereco
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_atendimento(
  uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid,
  text, date, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pedido_atendimento(
  uuid, uuid, date, boolean, numeric, numeric, uuid, uuid, jsonb, jsonb, uuid,
  text, date, text, text, text, jsonb
) TO service_role;
