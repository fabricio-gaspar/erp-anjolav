-- Restore delivery proof and route lifecycle. Routes belong to exactly one operation;
-- legacy routes without classification remain visible only to central access.
ALTER TABLE public.rotas_entrega ADD COLUMN IF NOT EXISTS operation_type text;
ALTER TABLE public.rotas_entrega DROP CONSTRAINT IF EXISTS rotas_entrega_operation_type_check;
ALTER TABLE public.rotas_entrega ADD CONSTRAINT rotas_entrega_operation_type_check CHECK (operation_type IS NULL OR operation_type IN ('domestico','industrial'));

CREATE TABLE IF NOT EXISTS public.entregas_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'confirmada',
  nome_recebedor text NOT NULL,
  documento_recebedor text,
  observacoes text,
  autorizada_com_saldo boolean NOT NULL DEFAULT false,
  motivo_autorizacao_saldo text,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entregas_pedido_status_check CHECK (status IN ('confirmada', 'cancelada')),
  CONSTRAINT entregas_pedido_recebedor_check CHECK (char_length(trim(nome_recebedor)) BETWEEN 2 AND 160),
  CONSTRAINT entregas_pedido_idempotency_key_format CHECK (
    idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'
  ),
  CONSTRAINT entregas_pedido_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT entregas_pedido_saldo_reason_check CHECK (
    NOT autorizada_com_saldo
    OR char_length(trim(coalesce(motivo_autorizacao_saldo, ''))) BETWEEN 10 AND 500
  )
);

CREATE TABLE IF NOT EXISTS public.entregas_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  entrega_id uuid NOT NULL REFERENCES public.entregas_pedido(id) ON DELETE RESTRICT,
  item_ordem_servico_id uuid NOT NULL REFERENCES public.itens_ordem_servico(id) ON DELETE RESTRICT,
  quantidade numeric(10,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entregas_pedido_itens_quantidade_check CHECK (quantidade > 0),
  CONSTRAINT entregas_pedido_itens_unique_item UNIQUE (entrega_id, item_ordem_servico_id)
);


ALTER TABLE public.entregas_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_pedido_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entregas_pedido_read ON public.entregas_pedido;
CREATE POLICY entregas_pedido_read ON public.entregas_pedido FOR SELECT TO authenticated USING (
 tenant_id=(SELECT private.current_tenant_id()) AND (SELECT private.has_any_module_access(ARRAY['agenda','ordens','producao','relatorios'])) AND private.can_access_order(ordem_servico_id));
DROP POLICY IF EXISTS entregas_pedido_itens_read ON public.entregas_pedido_itens;
CREATE POLICY entregas_pedido_itens_read ON public.entregas_pedido_itens FOR SELECT TO authenticated USING (
 tenant_id=(SELECT private.current_tenant_id()) AND EXISTS (SELECT 1 FROM public.entregas_pedido d WHERE d.id=entrega_id AND d.tenant_id=entregas_pedido_itens.tenant_id));
REVOKE ALL ON public.entregas_pedido, public.entregas_pedido_itens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.entregas_pedido, public.entregas_pedido_itens TO authenticated;
GRANT ALL ON public.entregas_pedido, public.entregas_pedido_itens TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_entrega_parcial_pedido(
  _ordem_servico_id uuid,
  _itens jsonb,
  _nome_recebedor text,
  _documento_recebedor text,
  _observacoes text,
  _autorizar_com_saldo boolean,
  _motivo_autorizacao_saldo text,
  _funcionario_id uuid,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  service_order public.ordens_servico%ROWTYPE;
  delivery public.entregas_pedido%ROWTYPE;
  order_item public.itens_ordem_servico%ROWTYPE;
  delivery_item jsonb;
  delivery_quantity numeric(10,3);
  available_quantity numeric(10,3);
  fingerprint text;
  requested_count integer := 0;
  order_quantity numeric(12,3);
  delivered_total numeric(12,3);
  retained_total numeric(12,3);
  rework_total numeric(12,3);
  classified_total numeric(12,3);
  logistics_status text;
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    private.has_any_module_access(ARRAY['ordens', 'producao']) OR
    (private.has_any_module_access(ARRAY['agenda']) AND EXISTS (
      SELECT 1 FROM public.paradas_rota p
      JOIN public.rotas_entrega r ON r.id=p.rota_id AND r.tenant_id=p.tenant_id
      JOIN public.motoristas d ON d.id=r.motorista_id AND d.tenant_id=r.tenant_id AND d.ativo
      JOIN public.funcionarios f ON f.id=d.funcionario_id AND f.tenant_id=d.tenant_id AND f.ativo
      WHERE p.ordem_servico_id=_ordem_servico_id AND p.tenant_id=private.current_tenant_id()
        AND p.status='em_atendimento' AND r.status='em_rota' AND f.user_id=auth.uid()
    ))
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF jsonb_typeof(coalesce(_itens, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(_itens, '[]'::jsonb)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Itens da entrega inválidos';
  END IF;
  IF char_length(trim(coalesce(_nome_recebedor, ''))) NOT BETWEEN 2 AND 160 THEN
    RAISE EXCEPTION 'Informe quem recebeu a entrega';
  END IF;
  IF char_length(trim(coalesce(_documento_recebedor, ''))) > 40
     OR char_length(trim(coalesce(_observacoes, ''))) > 1000 THEN
    RAISE EXCEPTION 'Dados da entrega excedem o limite permitido';
  END IF;

  SELECT * INTO service_order
  FROM public.ordens_servico
  WHERE id = _ordem_servico_id
    AND tenant_id = private.current_tenant_id()
  FOR UPDATE;
  IF NOT FOUND OR NOT private.can_access_order(service_order.id) THEN
    RAISE EXCEPTION 'Pedido não encontrado nesta empresa ou área';
  END IF;
  IF _funcionario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.funcionarios employee
    WHERE employee.id = _funcionario_id
      AND employee.tenant_id = service_order.tenant_id
      AND employee.ativo
  ) THEN
    RAISE EXCEPTION 'Funcionário inválido para esta empresa';
  END IF;
  IF coalesce(service_order.status_pagamento, 'pendente') <> 'pago'
     AND coalesce(service_order.condicao_pagamento, '') <> 'faturado' THEN
    IF NOT coalesce(_autorizar_com_saldo, false) THEN
      RAISE EXCEPTION 'Pedido com saldo exige autorização explícita para entrega';
    END IF;
    IF NOT private.is_tenant_admin(service_order.tenant_id) THEN
      RAISE EXCEPTION 'Somente administrador pode liberar entrega com saldo';
    END IF;
    IF char_length(trim(coalesce(_motivo_autorizacao_saldo, ''))) NOT BETWEEN 10 AND 500 THEN
      RAISE EXCEPTION 'Informe o motivo da liberação com saldo';
    END IF;
  END IF;

  fingerprint := md5(jsonb_build_array(
    _ordem_servico_id,
    _itens,
    trim(_nome_recebedor),
    nullif(trim(coalesce(_documento_recebedor, '')), ''),
    nullif(trim(coalesce(_observacoes, '')), ''),
    coalesce(_autorizar_com_saldo, false),
    nullif(trim(coalesce(_motivo_autorizacao_saldo, '')), ''),
    _funcionario_id,
    auth.uid()
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    service_order.tenant_id::text || ':delivery:' || _idempotency_key,
    0
  ));

  SELECT * INTO delivery
  FROM public.entregas_pedido
  WHERE tenant_id = service_order.tenant_id
    AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF delivery.request_fingerprint IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outra entrega';
    END IF;
    SELECT
      round(coalesce(sum(item.quantidade), 0), 3),
      round(coalesce(sum(item.quantidade_entregue), 0), 3)
    INTO order_quantity, delivered_total
    FROM public.itens_ordem_servico item
    WHERE item.ordem_servico_id = service_order.id;
    RETURN jsonb_build_object(
      'deliveryId', delivery.id,
      'orderId', service_order.id,
      'logisticsStatus', service_order.status_logistica,
      'deliveredQuantity', delivered_total,
      'remainingResponsibilityQuantity', greatest(order_quantity - delivered_total, 0),
      'idempotent', true
    );
  END IF;

  IF service_order.status IN ('entregue', 'cancelada') THEN
    RAISE EXCEPTION 'Pedido encerrado não aceita nova entrega';
  END IF;

  INSERT INTO public.entregas_pedido (
    tenant_id, ordem_servico_id, nome_recebedor, documento_recebedor,
    observacoes, autorizada_com_saldo, motivo_autorizacao_saldo,
    funcionario_id, criado_por, idempotency_key, request_fingerprint
  ) VALUES (
    service_order.tenant_id, service_order.id, left(trim(_nome_recebedor), 160),
    nullif(left(trim(coalesce(_documento_recebedor, '')), 40), ''),
    nullif(left(trim(coalesce(_observacoes, '')), 1000), ''),
    coalesce(_autorizar_com_saldo, false),
    nullif(left(trim(coalesce(_motivo_autorizacao_saldo, '')), 500), ''),
    _funcionario_id, auth.uid(), _idempotency_key, fingerprint
  ) RETURNING * INTO delivery;

  FOR delivery_item IN SELECT value FROM jsonb_array_elements(_itens) LOOP
    IF coalesce(delivery_item->>'item_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'Item de entrega inválido';
    END IF;
    BEGIN
      delivery_quantity := round((delivery_item->>'quantidade')::numeric, 3);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Quantidade de entrega inválida';
    END;
    IF delivery_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade de entrega inválida'; END IF;

    SELECT * INTO order_item
    FROM public.itens_ordem_servico
    WHERE id = (delivery_item->>'item_id')::uuid
      AND ordem_servico_id = service_order.id
      AND tenant_id = service_order.tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item não pertence ao pedido'; END IF;
    available_quantity := CASE
      WHEN nullif(trim(coalesce(order_item.posicao_prateleira,'')),'') IS NOT NULL
        AND order_item.quantidade_retida=0 AND order_item.quantidade_retrabalho=0
      THEN greatest(order_item.quantidade_aprovada, order_item.quantidade) - order_item.quantidade_entregue
      ELSE order_item.quantidade_aprovada - order_item.quantidade_entregue END;
    IF delivery_quantity > available_quantity + 0.0005 THEN
      RAISE EXCEPTION 'Quantidade de entrega excede os itens aprovados disponíveis';
    END IF;

    INSERT INTO public.entregas_pedido_itens (
      tenant_id, entrega_id, item_ordem_servico_id, quantidade
    ) VALUES (
      service_order.tenant_id, delivery.id, order_item.id, delivery_quantity
    );
    UPDATE public.itens_ordem_servico
    SET quantidade_aprovada = CASE WHEN nullif(trim(coalesce(posicao_prateleira,'')),'') IS NOT NULL
          AND quantidade_retida=0 AND quantidade_retrabalho=0 THEN greatest(quantidade_aprovada, quantidade) ELSE quantidade_aprovada END,
        quantidade_entregue = quantidade_entregue + delivery_quantity
    WHERE id = order_item.id;
    requested_count := requested_count + 1;
  END LOOP;
  IF requested_count = 0 THEN RAISE EXCEPTION 'A entrega não possui itens'; END IF;

  SELECT
    round(coalesce(sum(quantidade), 0), 3),
    round(coalesce(sum(quantidade_entregue), 0), 3),
    round(coalesce(sum(quantidade_retida), 0), 3),
    round(coalesce(sum(quantidade_retrabalho), 0), 3),
    round(coalesce(sum(quantidade_aprovada + quantidade_retida + quantidade_retrabalho), 0), 3)
  INTO order_quantity, delivered_total, retained_total, rework_total, classified_total
  FROM public.itens_ordem_servico
  WHERE ordem_servico_id = service_order.id;

  logistics_status := CASE
    WHEN delivered_total >= order_quantity - 0.0005
      AND retained_total = 0
      AND rework_total = 0
      AND classified_total >= order_quantity - 0.0005
      THEN 'entregue'
    ELSE 'entrega_parcial'
  END;

  UPDATE public.ordens_servico
  SET status_logistica = logistics_status,
      status = CASE WHEN logistics_status = 'entregue' THEN 'entregue' ELSE status END,
      data_entrega = CASE WHEN logistics_status = 'entregue' THEN current_date ELSE data_entrega END
  WHERE id = service_order.id;

  response := jsonb_build_object(
    'deliveryId', delivery.id,
    'orderId', service_order.id,
    'logisticsStatus', logistics_status,
    'deliveredQuantity', delivered_total,
    'remainingResponsibilityQuantity', greatest(order_quantity - delivered_total, 0),
    'retainedQuantity', retained_total,
    'reworkQuantity', rework_total,
    'idempotent', false
  );
  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrega_parcial_pedido(uuid, jsonb, text, text, text, boolean, text, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_parcial_pedido(uuid, jsonb, text, text, text, boolean, text, uuid, text)
  TO authenticated;


-- Transactional route planning and execution.
-- Reuses rotas_entrega/paradas_rota while making attempts, rescheduling,
-- physical confirmation and address corrections explicit and auditable.

ALTER TABLE public.rotas_entrega
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.paradas_rota
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS janela_inicio time,
  ADD COLUMN IF NOT EXISTS janela_fim time,
  ADD COLUMN IF NOT EXISTS reagendada_para timestamptz,
  ADD COLUMN IF NOT EXISTS recebedor_nome text,
  ADD COLUMN IF NOT EXISTS recebedor_documento text,
  ADD COLUMN IF NOT EXISTS entrega_id uuid REFERENCES public.entregas_pedido(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS endereco_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.paradas_rota
SET status = 'tentativa_falha',
    tentativas = greatest(tentativas, 1)
WHERE status = 'nao_entregue';

UPDATE public.paradas_rota stop
SET endereco_snapshot = coalesce((
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'id', address.id,
    'cep', address.cep,
    'logradouro', address.logradouro,
    'numero', address.numero,
    'complemento', address.complemento,
    'bairro', address.bairro,
    'cidade', address.cidade,
    'uf', address.uf,
    'latitude', address.latitude,
    'longitude', address.longitude
  ))
  FROM public.enderecos_clientes address
  WHERE address.cliente_id = stop.cliente_id
    AND address.tenant_id = stop.tenant_id
  ORDER BY address.updated_at DESC, address.id
  LIMIT 1
), '{}'::jsonb)
WHERE stop.endereco_snapshot = '{}'::jsonb;

ALTER TABLE public.rotas_entrega
  DROP CONSTRAINT IF EXISTS rotas_entrega_status_check,
  DROP CONSTRAINT IF EXISTS rotas_entrega_km_check;

ALTER TABLE public.rotas_entrega
  ADD CONSTRAINT rotas_entrega_status_check CHECK (
    status IN ('pendente', 'em_rota', 'concluida', 'cancelada')
  ),
  ADD CONSTRAINT rotas_entrega_km_check CHECK (
    (km_inicial IS NULL OR km_inicial >= 0)
    AND (km_final IS NULL OR km_final >= 0)
    AND (km_inicial IS NULL OR km_final IS NULL OR km_final >= km_inicial)
  );

ALTER TABLE public.paradas_rota
  DROP CONSTRAINT IF EXISTS paradas_rota_status_check,
  DROP CONSTRAINT IF EXISTS paradas_rota_tipo_check,
  DROP CONSTRAINT IF EXISTS paradas_rota_tentativas_check,
  DROP CONSTRAINT IF EXISTS paradas_rota_versao_check,
  DROP CONSTRAINT IF EXISTS paradas_rota_janela_check,
  DROP CONSTRAINT IF EXISTS paradas_rota_recebedor_check;

ALTER TABLE public.paradas_rota
  ADD CONSTRAINT paradas_rota_status_check CHECK (
    status IN (
      'pendente', 'em_atendimento', 'realizada', 'tentativa_falha',
      'reagendada', 'cancelada'
    )
  ),
  ADD CONSTRAINT paradas_rota_tipo_check CHECK (tipo IN ('retirada', 'entrega')),
  ADD CONSTRAINT paradas_rota_tentativas_check CHECK (tentativas >= 0),
  ADD CONSTRAINT paradas_rota_versao_check CHECK (versao >= 0),
  ADD CONSTRAINT paradas_rota_janela_check CHECK (
    janela_inicio IS NULL OR janela_fim IS NULL OR janela_fim > janela_inicio
  ),
  ADD CONSTRAINT paradas_rota_recebedor_check CHECK (
    recebedor_nome IS NULL OR char_length(trim(recebedor_nome)) BETWEEN 2 AND 160
  );

CREATE TABLE IF NOT EXISTS public.rota_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  rota_id uuid REFERENCES public.rotas_entrega(id) ON DELETE RESTRICT,
  parada_id uuid REFERENCES public.paradas_rota(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  endereco_anterior jsonb,
  endereco_novo jsonb,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rota_operacoes_tipo_check CHECK (
    tipo IN (
      'ROTA_CRIADA', 'PARADA_ADICIONADA', 'PARADAS_REORDENADAS',
      'ROTA_INICIADA', 'CHEGADA', 'OCORRENCIA', 'TENTATIVA_FALHA',
      'REAGENDAMENTO', 'CONCLUIDA', 'ENDERECO_CORRIGIDO', 'ROTA_FINALIZADA'
    )
  ),
  CONSTRAINT rota_operacoes_idempotency_key_format CHECK (
    idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'
  ),
  CONSTRAINT rota_operacoes_tenant_idempotency_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_rota_operacoes_rota_created
  ON public.rota_operacoes (tenant_id, rota_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rota_operacoes_parada_created
  ON public.rota_operacoes (tenant_id, parada_id, created_at DESC)
  WHERE parada_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paradas_rota_tenant_reagendada
  ON public.paradas_rota (tenant_id, reagendada_para)
  WHERE status = 'reagendada';
CREATE INDEX IF NOT EXISTS idx_paradas_rota_tenant_route_order
  ON public.paradas_rota (tenant_id, rota_id, ordem);

ALTER TABLE public.rota_operacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rota_operacoes_read ON public.rota_operacoes;
CREATE POLICY rota_operacoes_read ON public.rota_operacoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT private.current_tenant_id())
    AND (SELECT private.has_any_module_access(ARRAY['agenda', 'ordens', 'dashboard', 'relatorios']))
    AND (
      rota_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.rotas_entrega route
        WHERE route.id = rota_operacoes.rota_id
          AND route.tenant_id = rota_operacoes.tenant_id
      )
    )
  );

REVOKE ALL ON TABLE public.rota_operacoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.rota_operacoes TO authenticated;
GRANT ALL ON TABLE public.rota_operacoes TO service_role;

-- Route and stop material state may only be changed by the commands below.
REVOKE ALL ON TABLE public.rotas_entrega FROM authenticated;
REVOKE ALL ON TABLE public.paradas_rota FROM authenticated;
GRANT SELECT ON TABLE public.rotas_entrega TO authenticated;
GRANT SELECT ON TABLE public.paradas_rota TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_rota_planejada(
  _data date,
  _motorista_id uuid,
  _veiculo_id uuid,
  _km_inicial numeric,
  _observacoes text,
  _idempotency_key text,
  _operacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  existing_operation public.rota_operacoes%ROWTYPE;
  route public.rotas_entrega%ROWTYPE;
  fingerprint text;
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['agenda']) THEN
    RAISE EXCEPTION 'Acesso negado ao planejamento de rotas';
  END IF;
  IF _operacao IS NULL OR _operacao NOT IN ('domestico', 'industrial') OR NOT private.can_access_area(CASE WHEN _operacao='domestico' THEN 'residencial' ELSE 'industrial' END) THEN
    RAISE EXCEPTION 'Operação inválida ou sem permissão para esta rota';
  END IF;
  IF _data IS NULL OR _data < current_date THEN
    RAISE EXCEPTION 'A data da rota não pode estar no passado';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF _km_inicial IS NOT NULL AND _km_inicial < 0 THEN
    RAISE EXCEPTION 'Quilometragem inicial inválida';
  END IF;
  IF _motorista_id IS NULL OR _veiculo_id IS NULL THEN
    RAISE EXCEPTION 'Informe motorista e veículo para a rota';
  END IF;
  IF char_length(trim(coalesce(_observacoes, ''))) > 1000 THEN
    RAISE EXCEPTION 'Observação excede o limite permitido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.motoristas driver
    WHERE driver.id = _motorista_id
      AND driver.tenant_id = current_tenant
      AND driver.ativo
  ) THEN
    RAISE EXCEPTION 'Motorista inválido para esta empresa';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.veiculos vehicle
    WHERE vehicle.id = _veiculo_id
      AND vehicle.tenant_id = current_tenant
      AND vehicle.ativo
  ) THEN
    RAISE EXCEPTION 'Veículo inválido para esta empresa';
  END IF;

  fingerprint := md5(jsonb_build_array(
    _data, _motorista_id, _veiculo_id, _km_inicial, _operacao,
    nullif(trim(coalesce(_observacoes, '')), ''), auth.uid()
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route:' || _idempotency_key, 0
  ));

  SELECT * INTO existing_operation
  FROM public.rota_operacoes
  WHERE tenant_id = current_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_operation.request_fingerprint IS DISTINCT FROM fingerprint
       OR existing_operation.tipo <> 'ROTA_CRIADA' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outra operação logística';
    END IF;
    RETURN existing_operation.resultado || jsonb_build_object('idempotent', true);
  END IF;

  INSERT INTO public.rotas_entrega (
    tenant_id, data, motorista_id, veiculo_id, status, km_inicial,
    observacoes, criado_por, operation_type
  ) VALUES (
    current_tenant, _data, _motorista_id, _veiculo_id, 'pendente', _km_inicial,
    nullif(left(trim(coalesce(_observacoes, '')), 1000), ''), auth.uid(), _operacao
  ) RETURNING * INTO route;

  response := jsonb_build_object(
    'routeId', route.id,
    'status', route.status,
    'date', route.data,
    'idempotent', false
  );
  INSERT INTO public.rota_operacoes (
    tenant_id, rota_id, tipo, idempotency_key, request_fingerprint,
    payload, resultado, criado_por
  ) VALUES (
    current_tenant, route.id, 'ROTA_CRIADA', _idempotency_key, fingerprint,
    jsonb_build_object('driverId', _motorista_id, 'vehicleId', _veiculo_id),
    response, auth.uid()
  );
  RETURN response;
END;
$$;

CREATE OR REPLACE FUNCTION public.adicionar_parada_planejada(
  _rota_id uuid,
  _tipo text,
  _cliente_id uuid,
  _ordem_servico_id uuid,
  _agendamento_id uuid,
  _janela_inicio time,
  _janela_fim time,
  _observacoes text,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  existing_operation public.rota_operacoes%ROWTYPE;
  route public.rotas_entrega%ROWTYPE;
  stop public.paradas_rota%ROWTYPE;
  order_row public.ordens_servico%ROWTYPE;
  appointment_row public.agendamentos%ROWTYPE;
  resolved_client_id uuid := _cliente_id;
  address_snapshot jsonb;
  next_order integer;
  fingerprint text;
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['agenda']) THEN
    RAISE EXCEPTION 'Acesso negado ao planejamento de rotas';
  END IF;
  IF lower(coalesce(_tipo, '')) NOT IN ('retirada', 'entrega') THEN
    RAISE EXCEPTION 'Tipo de parada inválido';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF _janela_inicio IS NOT NULL AND _janela_fim IS NOT NULL
     AND _janela_fim <= _janela_inicio THEN
    RAISE EXCEPTION 'Janela de atendimento inválida';
  END IF;
  IF char_length(trim(coalesce(_observacoes, ''))) > 1000 THEN
    RAISE EXCEPTION 'Instrução excede o limite permitido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rotas_entrega r WHERE r.id = _rota_id AND r.tenant_id = current_tenant AND private.can_access_area(CASE r.operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END)) THEN
    RAISE EXCEPTION 'Rota não encontrada nesta empresa ou área';
  END IF;

  fingerprint := md5(jsonb_build_array(
    _rota_id, lower(_tipo), _cliente_id, _ordem_servico_id, _agendamento_id,
    _janela_inicio, _janela_fim, nullif(trim(coalesce(_observacoes, '')), ''),
    auth.uid()
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route:' || _idempotency_key, 0
  ));
  SELECT * INTO existing_operation
  FROM public.rota_operacoes
  WHERE tenant_id = current_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_operation.request_fingerprint IS DISTINCT FROM fingerprint
       OR existing_operation.tipo <> 'PARADA_ADICIONADA' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outra operação logística';
    END IF;
    RETURN existing_operation.resultado || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO route
  FROM public.rotas_entrega
  WHERE id = _rota_id AND tenant_id = current_tenant
  FOR UPDATE;
  IF NOT FOUND OR route.status <> 'pendente' THEN
    RAISE EXCEPTION 'Somente rota pendente aceita novas paradas';
  END IF;

  IF _ordem_servico_id IS NOT NULL THEN
    SELECT * INTO order_row
    FROM public.ordens_servico
    WHERE id = _ordem_servico_id AND tenant_id = current_tenant;
    IF NOT FOUND OR NOT private.can_access_order(order_row.id) THEN
      RAISE EXCEPTION 'Pedido inválido para esta empresa ou área';
    END IF;
    IF resolved_client_id IS NOT NULL AND resolved_client_id <> order_row.cliente_id THEN
      RAISE EXCEPTION 'Cliente não corresponde ao pedido';
    END IF;
    resolved_client_id := order_row.cliente_id;
  END IF;

  IF _agendamento_id IS NOT NULL THEN
    SELECT * INTO appointment_row
    FROM public.agendamentos
    WHERE id = _agendamento_id AND tenant_id = current_tenant;
    IF NOT FOUND OR NOT private.can_access_appointment(appointment_row.id) THEN
      RAISE EXCEPTION 'Agendamento inválido para esta empresa ou área';
    END IF;
    IF lower(appointment_row.tipo) <> lower(_tipo) THEN
      RAISE EXCEPTION 'Tipo da parada não corresponde ao agendamento';
    END IF;
    IF resolved_client_id IS NOT NULL AND resolved_client_id <> appointment_row.cliente_id THEN
      RAISE EXCEPTION 'Cliente não corresponde ao agendamento';
    END IF;
    resolved_client_id := appointment_row.cliente_id;
  END IF;

  IF resolved_client_id IS NULL OR NOT private.can_access_client(resolved_client_id) THEN
    RAISE EXCEPTION 'Cliente inválido para esta empresa ou área';
  END IF;

  IF route.operation_type IS NULL OR route.operation_type IS DISTINCT FROM coalesce(order_row.operation_type::text, appointment_row.operation_type::text, (SELECT CASE WHEN lower(classificacao)='industrial' THEN 'industrial' WHEN lower(classificacao) IN ('residencial','domestico') THEN 'domestico' END FROM public.clientes WHERE id=resolved_client_id AND tenant_id=current_tenant)) THEN
    RAISE EXCEPTION 'A parada pertence a outra operação ou não tem operação identificada';
  END IF;

  SELECT jsonb_strip_nulls(jsonb_build_object(
    'id', address.id,
    'cep', address.cep,
    'logradouro', address.logradouro,
    'numero', address.numero,
    'complemento', address.complemento,
    'bairro', address.bairro,
    'cidade', address.cidade,
    'uf', address.uf,
    'latitude', address.latitude,
    'longitude', address.longitude
  )) INTO address_snapshot
  FROM public.enderecos_clientes address
  WHERE address.cliente_id = resolved_client_id
    AND address.tenant_id = current_tenant
    AND coalesce(address.ativo, true)
  ORDER BY CASE WHEN lower(address.tipo) = CASE WHEN lower(_tipo) = 'retirada' THEN 'coleta' ELSE lower(_tipo) END THEN 0
                WHEN lower(address.tipo) = 'principal' THEN 1 ELSE 2 END,
           address.updated_at DESC, address.id
  LIMIT 1;
  IF _ordem_servico_id IS NOT NULL AND nullif(trim(coalesce(order_row.endereco_atendimento_snapshot->>'logradouro','')), '') IS NOT NULL AND nullif(trim(coalesce(order_row.endereco_atendimento_snapshot->>'cidade','')), '') IS NOT NULL THEN
    address_snapshot := order_row.endereco_atendimento_snapshot;
  END IF;
  IF address_snapshot IS NULL
     OR nullif(trim(coalesce(address_snapshot->>'logradouro', '')), '') IS NULL
     OR nullif(trim(coalesce(address_snapshot->>'cidade', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Cliente sem endereço válido para a rota';
  END IF;

  IF _ordem_servico_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.paradas_rota candidate
    WHERE candidate.rota_id = route.id
      AND candidate.ordem_servico_id = _ordem_servico_id
      AND candidate.status <> 'cancelada'
  ) THEN
    RAISE EXCEPTION 'Pedido já incluído nesta rota';
  END IF;
  IF _agendamento_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.paradas_rota candidate
    WHERE candidate.rota_id = route.id
      AND candidate.agendamento_id = _agendamento_id
      AND candidate.status <> 'cancelada'
  ) THEN
    RAISE EXCEPTION 'Agendamento já incluído nesta rota';
  END IF;

  SELECT coalesce(max(candidate.ordem), 0) + 1 INTO next_order
  FROM public.paradas_rota candidate
  WHERE candidate.rota_id = route.id;

  INSERT INTO public.paradas_rota (
    tenant_id, rota_id, ordem, tipo, cliente_id, ordem_servico_id,
    agendamento_id, status, janela_inicio, janela_fim, observacoes,
    endereco_snapshot, atualizado_por
  ) VALUES (
    current_tenant, route.id, next_order, lower(_tipo), resolved_client_id,
    _ordem_servico_id, _agendamento_id, 'pendente', _janela_inicio, _janela_fim,
    nullif(left(trim(coalesce(_observacoes, '')), 1000), ''),
    address_snapshot, auth.uid()
  ) RETURNING * INTO stop;

  response := jsonb_build_object(
    'routeId', route.id,
    'stopId', stop.id,
    'order', stop.ordem,
    'status', stop.status,
    'idempotent', false
  );
  INSERT INTO public.rota_operacoes (
    tenant_id, rota_id, parada_id, tipo, idempotency_key,
    request_fingerprint, payload, resultado, criado_por
  ) VALUES (
    current_tenant, route.id, stop.id, 'PARADA_ADICIONADA', _idempotency_key,
    fingerprint, jsonb_build_object('address', address_snapshot), response, auth.uid()
  );
  RETURN response;
END;
$$;

CREATE OR REPLACE FUNCTION public.reordenar_paradas_rota(
  _rota_id uuid,
  _parada_ids jsonb,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  existing_operation public.rota_operacoes%ROWTYPE;
  route public.rotas_entrega%ROWTYPE;
  route_stop_count integer;
  supplied_count integer;
  distinct_count integer;
  fingerprint text;
  response jsonb;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['agenda']) THEN
    RAISE EXCEPTION 'Acesso negado ao planejamento de rotas';
  END IF;
  IF jsonb_typeof(coalesce(_parada_ids, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(_parada_ids, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Informe a ordem completa das paradas';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rotas_entrega r WHERE r.id = _rota_id AND r.tenant_id = current_tenant AND private.can_access_area(CASE r.operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END)) THEN
    RAISE EXCEPTION 'Rota não encontrada nesta empresa ou área';
  END IF;

  fingerprint := md5(jsonb_build_array(_rota_id, _parada_ids, auth.uid())::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route:' || _idempotency_key, 0
  ));
  SELECT * INTO existing_operation FROM public.rota_operacoes
  WHERE tenant_id = current_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_operation.request_fingerprint IS DISTINCT FROM fingerprint
       OR existing_operation.tipo <> 'PARADAS_REORDENADAS' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outra operação logística';
    END IF;
    RETURN existing_operation.resultado || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO route FROM public.rotas_entrega
  WHERE id = _rota_id AND tenant_id = current_tenant FOR UPDATE;
  IF NOT FOUND OR route.status <> 'pendente' THEN
    RAISE EXCEPTION 'Somente rota pendente pode ser reordenada';
  END IF;

  SELECT count(*) INTO route_stop_count FROM public.paradas_rota
  WHERE rota_id = route.id AND tenant_id = current_tenant AND status <> 'cancelada';
  SELECT count(*), count(DISTINCT value)
  INTO supplied_count, distinct_count
  FROM jsonb_array_elements_text(_parada_ids);
  IF route_stop_count <> supplied_count OR supplied_count <> distinct_count
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(_parada_ids) supplied(value)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.paradas_rota stop
         WHERE stop.id = supplied.value::uuid
           AND stop.rota_id = route.id
           AND stop.tenant_id = current_tenant
           AND stop.status <> 'cancelada'
       )
     ) THEN
    RAISE EXCEPTION 'A ordenação deve conter cada parada ativa exatamente uma vez';
  END IF;

  UPDATE public.paradas_rota stop
  SET ordem = supplied.ordinality,
      atualizado_por = auth.uid(),
      updated_at = now()
  FROM jsonb_array_elements_text(_parada_ids) WITH ORDINALITY supplied(value, ordinality)
  WHERE stop.id = supplied.value::uuid AND stop.rota_id = route.id;

  response := jsonb_build_object(
    'routeId', route.id, 'stopCount', supplied_count, 'idempotent', false
  );
  INSERT INTO public.rota_operacoes (
    tenant_id, rota_id, tipo, idempotency_key, request_fingerprint,
    payload, resultado, criado_por
  ) VALUES (
    current_tenant, route.id, 'PARADAS_REORDENADAS', _idempotency_key,
    fingerprint, jsonb_build_object('stopIds', _parada_ids), response, auth.uid()
  );
  RETURN response;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'Identificador de parada inválido';
END;
$$;

CREATE OR REPLACE FUNCTION public.iniciar_rota_planejada(
  _rota_id uuid,
  _km_inicial numeric,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  existing_operation public.rota_operacoes%ROWTYPE;
  route public.rotas_entrega%ROWTYPE;
  fingerprint text;
  response jsonb;
  stop_count integer;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['agenda']) THEN
    RAISE EXCEPTION 'Acesso negado à execução de rotas';
  END IF;
  IF _km_inicial IS NULL OR _km_inicial < 0 THEN
    RAISE EXCEPTION 'Informe a quilometragem inicial';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rotas_entrega r WHERE r.id = _rota_id AND r.tenant_id = current_tenant AND private.can_access_area(CASE r.operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END)) THEN
    RAISE EXCEPTION 'Rota não encontrada nesta empresa ou área';
  END IF;

  fingerprint := md5(jsonb_build_array(_rota_id, _km_inicial, auth.uid())::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route:' || _idempotency_key, 0
  ));
  SELECT * INTO existing_operation FROM public.rota_operacoes
  WHERE tenant_id = current_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_operation.request_fingerprint IS DISTINCT FROM fingerprint
       OR existing_operation.tipo <> 'ROTA_INICIADA' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outra operação logística';
    END IF;
    RETURN existing_operation.resultado || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO route FROM public.rotas_entrega
  WHERE id = _rota_id AND tenant_id = current_tenant FOR UPDATE;
  IF NOT FOUND OR route.status <> 'pendente' THEN
    RAISE EXCEPTION 'Rota não está pendente';
  END IF;
  is_admin := private.is_tenant_admin(current_tenant);
  IF NOT is_admin AND NOT EXISTS (
    SELECT 1
    FROM public.motoristas driver
    JOIN public.funcionarios employee
      ON employee.id = driver.funcionario_id
     AND employee.tenant_id = driver.tenant_id
    WHERE driver.id = route.motorista_id
      AND driver.tenant_id = current_tenant
      AND driver.ativo
      AND employee.ativo
      AND employee.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Somente o motorista designado ou administrador pode iniciar a rota';
  END IF;
  IF route.motorista_id IS NULL OR route.veiculo_id IS NULL THEN
    RAISE EXCEPTION 'A rota precisa de motorista e veículo';
  END IF;
  -- Serialize starts per assigned resource. Direct authenticated writes are
  -- revoked below, so this also prevents two RPCs from creating overlapping
  -- active work through a write-skew race.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route-driver:' || route.motorista_id::text, 0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route-vehicle:' || route.veiculo_id::text, 0
  ));
  IF EXISTS (
    SELECT 1
    FROM public.rotas_entrega active_route
    WHERE active_route.tenant_id = current_tenant
      AND active_route.id <> route.id
      AND active_route.status = 'em_rota'
      AND (
        active_route.motorista_id = route.motorista_id
        OR active_route.veiculo_id = route.veiculo_id
      )
  ) THEN
    RAISE EXCEPTION 'Motorista ou veículo já está em outra rota ativa';
  END IF;
  SELECT count(*) INTO stop_count FROM public.paradas_rota
  WHERE rota_id = route.id AND tenant_id = current_tenant AND status = 'pendente';
  IF stop_count = 0 THEN RAISE EXCEPTION 'A rota não possui paradas pendentes'; END IF;

  UPDATE public.rotas_entrega
  SET status = 'em_rota', km_inicial = _km_inicial, hora_saida = now()
  WHERE id = route.id
  RETURNING * INTO route;
  UPDATE public.ordens_servico service_order
  SET status_logistica = 'em_rota'
  FROM public.paradas_rota stop
  WHERE stop.rota_id = route.id
    AND stop.ordem_servico_id = service_order.id
    AND service_order.tenant_id = current_tenant
    AND service_order.status_logistica NOT IN ('entregue', 'cancelada');

  response := jsonb_build_object(
    'routeId', route.id, 'status', route.status,
    'startedAt', route.hora_saida, 'stopCount', stop_count, 'idempotent', false
  );
  INSERT INTO public.rota_operacoes (
    tenant_id, rota_id, tipo, idempotency_key, request_fingerprint,
    payload, resultado, criado_por
  ) VALUES (
    current_tenant, route.id, 'ROTA_INICIADA', _idempotency_key, fingerprint,
    jsonb_build_object('initialKm', _km_inicial), response, auth.uid()
  );
  RETURN response;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_evento_parada_rota(
  _parada_id uuid,
  _expected_version integer,
  _tipo text,
  _motivo text,
  _reagendada_para timestamptz,
  _recebedor_nome text,
  _recebedor_documento text,
  _foto_comprovante_url text,
  _assinatura_url text,
  _entrega_id uuid,
  _endereco_corrigido jsonb,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  existing_operation public.rota_operacoes%ROWTYPE;
  route public.rotas_entrega%ROWTYPE;
  stop public.paradas_rota%ROWTYPE;
  event_type text := upper(coalesce(_tipo, ''));
  fingerprint text;
  response jsonb;
  next_status text;
  previous_address jsonb;
  next_address jsonb;
  delivery_items jsonb;
  delivery_result jsonb;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['agenda']) THEN
    RAISE EXCEPTION 'Acesso negado à execução de rotas';
  END IF;
  IF event_type NOT IN (
    'CHEGADA', 'OCORRENCIA', 'TENTATIVA_FALHA', 'REAGENDAMENTO',
    'CONCLUIDA', 'ENDERECO_CORRIGIDO'
  ) THEN
    RAISE EXCEPTION 'Evento logístico inválido';
  END IF;
  IF _expected_version IS NULL OR _expected_version < 0 THEN
    RAISE EXCEPTION 'Versão esperada da parada inválida';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;
  IF char_length(trim(coalesce(_motivo, ''))) > 1000
     OR char_length(trim(coalesce(_recebedor_nome, ''))) > 160
     OR char_length(trim(coalesce(_recebedor_documento, ''))) > 60
     OR char_length(trim(coalesce(_foto_comprovante_url, ''))) > 500
     OR char_length(trim(coalesce(_assinatura_url, ''))) > 500 THEN
    RAISE EXCEPTION 'Dados do evento excedem o limite permitido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.paradas_rota p JOIN public.rotas_entrega r ON r.id=p.rota_id AND r.tenant_id=p.tenant_id WHERE p.id=_parada_id AND p.tenant_id=current_tenant AND private.can_access_area(CASE r.operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END)) THEN
    RAISE EXCEPTION 'Parada não encontrada nesta empresa ou área';
  END IF;

  fingerprint := md5(jsonb_build_array(
    _parada_id, _expected_version, event_type, nullif(trim(coalesce(_motivo, '')), ''),
    _reagendada_para, nullif(trim(coalesce(_recebedor_nome, '')), ''),
    nullif(trim(coalesce(_recebedor_documento, '')), ''),
    nullif(trim(coalesce(_foto_comprovante_url, '')), ''),
    nullif(trim(coalesce(_assinatura_url, '')), ''), _entrega_id,
    coalesce(_endereco_corrigido, '{}'::jsonb), auth.uid()
  )::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route:' || _idempotency_key, 0
  ));
  SELECT * INTO existing_operation FROM public.rota_operacoes
  WHERE tenant_id = current_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_operation.request_fingerprint IS DISTINCT FROM fingerprint
       OR existing_operation.tipo <> event_type THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outro evento logístico';
    END IF;
    RETURN existing_operation.resultado || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO stop FROM public.paradas_rota
  WHERE id = _parada_id AND tenant_id = current_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parada não encontrada nesta empresa'; END IF;
  IF stop.versao <> _expected_version THEN
    RAISE EXCEPTION 'Parada foi atualizada por outra operação; recarregue os dados';
  END IF;
  SELECT * INTO route FROM public.rotas_entrega
  WHERE id = stop.rota_id AND tenant_id = current_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota não encontrada nesta empresa'; END IF;

  is_admin := private.is_tenant_admin(current_tenant);
  IF NOT is_admin AND NOT EXISTS (
    SELECT 1
    FROM public.motoristas driver
    JOIN public.funcionarios employee
      ON employee.id = driver.funcionario_id
     AND employee.tenant_id = driver.tenant_id
    WHERE driver.id = route.motorista_id
      AND driver.tenant_id = current_tenant
      AND driver.ativo
      AND employee.ativo
      AND employee.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Somente o motorista designado ou administrador pode executar esta rota';
  END IF;

  IF event_type = 'ENDERECO_CORRIGIDO' THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Somente administrador pode corrigir o endereço da parada';
    END IF;
    IF route.status NOT IN ('pendente', 'em_rota') THEN
      RAISE EXCEPTION 'Rota encerrada não aceita correção de endereço';
    END IF;
    next_address := jsonb_strip_nulls(coalesce(_endereco_corrigido, '{}'::jsonb));
    IF jsonb_typeof(next_address) <> 'object'
       OR nullif(trim(coalesce(next_address->>'logradouro', '')), '') IS NULL
       OR nullif(trim(coalesce(next_address->>'cidade', '')), '') IS NULL
       OR char_length(coalesce(next_address::text, '')) > 2000 THEN
      RAISE EXCEPTION 'Endereço corrigido inválido';
    END IF;
    previous_address := stop.endereco_snapshot;
    UPDATE public.paradas_rota
    SET endereco_snapshot = next_address,
        versao = versao + 1, atualizado_por = auth.uid(), updated_at = now()
    WHERE id = stop.id
    RETURNING * INTO stop;
    next_status := stop.status;
  ELSE
    IF route.status <> 'em_rota' THEN
      RAISE EXCEPTION 'A rota precisa estar em execução';
    END IF;
    IF stop.status IN ('realizada', 'cancelada') THEN
      RAISE EXCEPTION 'Parada encerrada não aceita novo resultado';
    END IF;

    CASE event_type
      WHEN 'CHEGADA' THEN
        IF stop.status NOT IN ('pendente', 'reagendada', 'tentativa_falha') THEN
          RAISE EXCEPTION 'Chegada incompatível com o estado atual da parada';
        END IF;
        UPDATE public.paradas_rota
        SET status = 'em_atendimento', hora_chegada = coalesce(hora_chegada, now()),
            versao = versao + 1, atualizado_por = auth.uid(), updated_at = now()
        WHERE id = stop.id RETURNING * INTO stop;
      WHEN 'OCORRENCIA' THEN
        IF char_length(trim(coalesce(_motivo, ''))) < 3 THEN
          RAISE EXCEPTION 'Ocorrência exige descrição';
        END IF;
        UPDATE public.paradas_rota
        SET versao = versao + 1, atualizado_por = auth.uid(), updated_at = now()
        WHERE id = stop.id RETURNING * INTO stop;
      WHEN 'TENTATIVA_FALHA' THEN
        IF stop.status <> 'em_atendimento' THEN
          RAISE EXCEPTION 'Registre a chegada antes da tentativa sem sucesso';
        END IF;
        IF char_length(trim(coalesce(_motivo, ''))) < 3 THEN
          RAISE EXCEPTION 'Tentativa frustrada exige motivo';
        END IF;
        IF _reagendada_para IS NOT NULL AND _reagendada_para <= now() THEN
          RAISE EXCEPTION 'Reagendamento precisa estar no futuro';
        END IF;
        UPDATE public.paradas_rota
        SET status = CASE WHEN _reagendada_para IS NULL THEN 'tentativa_falha' ELSE 'reagendada' END,
            tentativas = tentativas + 1,
            versao = versao + 1,
            reagendada_para = _reagendada_para,
            motivo_nao_entrega = left(trim(_motivo), 1000),
            hora_saida = now(), atualizado_por = auth.uid(), updated_at = now()
        WHERE id = stop.id RETURNING * INTO stop;
        IF stop.ordem_servico_id IS NOT NULL THEN
          UPDATE public.ordens_servico
          SET status_logistica = CASE
            WHEN _reagendada_para IS NULL THEN 'tentativa_falha'
            ELSE 'aguardando_entrega'
          END
          WHERE id = stop.ordem_servico_id AND tenant_id = current_tenant
            AND status_logistica NOT IN ('entregue', 'cancelada');
        END IF;
      WHEN 'REAGENDAMENTO' THEN
        IF char_length(trim(coalesce(_motivo, ''))) < 3
           OR _reagendada_para IS NULL OR _reagendada_para <= now() THEN
          RAISE EXCEPTION 'Reagendamento exige motivo e nova data futura';
        END IF;
        UPDATE public.paradas_rota
        SET status = 'reagendada', reagendada_para = _reagendada_para,
            motivo_nao_entrega = left(trim(_motivo), 1000),
            versao = versao + 1, atualizado_por = auth.uid(), updated_at = now()
        WHERE id = stop.id RETURNING * INTO stop;
        IF stop.ordem_servico_id IS NOT NULL THEN
          UPDATE public.ordens_servico
          SET status_logistica = 'aguardando_entrega'
          WHERE id = stop.ordem_servico_id AND tenant_id = current_tenant
            AND status_logistica NOT IN ('entregue', 'cancelada');
        END IF;
      WHEN 'CONCLUIDA' THEN
        IF stop.status <> 'em_atendimento' THEN
          RAISE EXCEPTION 'Registre a chegada antes de concluir a parada';
        END IF;
        IF char_length(trim(coalesce(_recebedor_nome, ''))) < 2 THEN
          RAISE EXCEPTION 'Informe quem confirmou a operação física';
        END IF;
        IF nullif(trim(coalesce(_recebedor_documento, '')), '') IS NULL
           AND nullif(trim(coalesce(_foto_comprovante_url, '')), '') IS NULL
           AND nullif(trim(coalesce(_assinatura_url, '')), '') IS NULL THEN
          RAISE EXCEPTION 'Conclusão exige documento, foto ou assinatura como evidência';
        END IF;
        IF stop.tipo = 'entrega' AND stop.ordem_servico_id IS NOT NULL THEN
          IF _entrega_id IS NULL THEN
            IF NOT EXISTS (SELECT 1 FROM public.itens_ordem_servico WHERE ordem_servico_id=stop.ordem_servico_id AND tenant_id=current_tenant)
               OR EXISTS (SELECT 1 FROM public.itens_ordem_servico WHERE ordem_servico_id=stop.ordem_servico_id AND tenant_id=current_tenant
                 AND (nullif(trim(coalesce(posicao_prateleira,'')),'') IS NULL OR quantidade_retida>0 OR quantidade_retrabalho>0)) THEN
              RAISE EXCEPTION 'Todos os itens devem estar disponibilizados e sem pendências de qualidade';
            END IF;
            SELECT jsonb_agg(jsonb_build_object('item_id', id, 'quantidade', quantidade-quantidade_entregue)) INTO delivery_items
            FROM public.itens_ordem_servico WHERE ordem_servico_id=stop.ordem_servico_id AND tenant_id=current_tenant AND quantidade>quantidade_entregue;
            IF delivery_items IS NULL THEN RAISE EXCEPTION 'Pedido sem itens pendentes para entrega'; END IF;
            delivery_result := public.registrar_entrega_parcial_pedido(stop.ordem_servico_id, delivery_items,
              _recebedor_nome, _recebedor_documento, 'Entrega confirmada na rota', false, NULL, NULL,
              'route-delivery:' || md5(_idempotency_key));
            _entrega_id := (delivery_result->>'deliveryId')::uuid;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM public.entregas_pedido delivery
            WHERE delivery.id = _entrega_id
              AND delivery.tenant_id = current_tenant
              AND delivery.ordem_servico_id = stop.ordem_servico_id
              AND delivery.status = 'confirmada'
          ) THEN
            RAISE EXCEPTION 'Entrega exige comprovante de itens confirmado para o mesmo pedido';
          END IF;
        ELSIF _entrega_id IS NOT NULL THEN
          RAISE EXCEPTION 'Coleta não aceita comprovante de entrega de itens';
        END IF;
        UPDATE public.paradas_rota
        SET status = 'realizada', hora_saida = now(),
            recebedor_nome = left(trim(_recebedor_nome), 160),
            recebedor_documento = nullif(left(trim(coalesce(_recebedor_documento, '')), 60), ''),
            foto_comprovante_url = nullif(left(trim(coalesce(_foto_comprovante_url, '')), 500), ''),
            assinatura_url = nullif(left(trim(coalesce(_assinatura_url, '')), 500), ''),
            entrega_id = _entrega_id,
            versao = versao + 1, atualizado_por = auth.uid(), updated_at = now()
        WHERE id = stop.id RETURNING * INTO stop;
        IF stop.agendamento_id IS NOT NULL THEN
          UPDATE public.agendamentos SET status = 'realizado'
          WHERE id = stop.agendamento_id AND tenant_id = current_tenant;
        END IF;
    END CASE;
    next_status := stop.status;
  END IF;

  response := jsonb_build_object(
    'routeId', route.id,
    'stopId', stop.id,
    'eventType', event_type,
    'stopStatus', next_status,
    'attempts', stop.tentativas,
    'version', stop.versao,
    'rescheduledAt', stop.reagendada_para,
    'idempotent', false
  );
  INSERT INTO public.rota_operacoes (
    tenant_id, rota_id, parada_id, tipo, idempotency_key,
    request_fingerprint, payload, resultado,
    endereco_anterior, endereco_novo, criado_por
  ) VALUES (
    current_tenant, route.id, stop.id, event_type, _idempotency_key,
    fingerprint,
    jsonb_strip_nulls(jsonb_build_object(
      'reason', nullif(trim(coalesce(_motivo, '')), ''),
      'rescheduledAt', _reagendada_para,
      'receiverName', nullif(trim(coalesce(_recebedor_nome, '')), ''),
      'receiverDocument', nullif(trim(coalesce(_recebedor_documento, '')), ''),
      'photoReference', nullif(trim(coalesce(_foto_comprovante_url, '')), ''),
      'signatureReference', nullif(trim(coalesce(_assinatura_url, '')), ''),
      'deliveryId', _entrega_id
    )),
    response, previous_address, next_address, auth.uid()
  );
  RETURN response;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_rota_planejada(
  _rota_id uuid,
  _km_final numeric,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
  current_tenant uuid := private.current_tenant_id();
  existing_operation public.rota_operacoes%ROWTYPE;
  route public.rotas_entrega%ROWTYPE;
  fingerprint text;
  response jsonb;
  unresolved_count integer;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR current_tenant IS NULL
     OR NOT private.has_any_module_access(ARRAY['agenda']) THEN
    RAISE EXCEPTION 'Acesso negado à execução de rotas';
  END IF;
  IF _km_final IS NULL OR _km_final < 0 THEN
    RAISE EXCEPTION 'Informe a quilometragem final';
  END IF;
  IF _idempotency_key IS NULL OR _idempotency_key !~ '^[A-Za-z0-9:._-]{8,200}$' THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.rotas_entrega r WHERE r.id = _rota_id AND r.tenant_id = current_tenant AND private.can_access_area(CASE r.operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END)) THEN
    RAISE EXCEPTION 'Rota não encontrada nesta empresa ou área';
  END IF;

  fingerprint := md5(jsonb_build_array(_rota_id, _km_final, auth.uid())::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(
    current_tenant::text || ':route:' || _idempotency_key, 0
  ));
  SELECT * INTO existing_operation FROM public.rota_operacoes
  WHERE tenant_id = current_tenant AND idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF existing_operation.request_fingerprint IS DISTINCT FROM fingerprint
       OR existing_operation.tipo <> 'ROTA_FINALIZADA' THEN
      RAISE EXCEPTION 'A chave de idempotência já pertence a outra operação logística';
    END IF;
    RETURN existing_operation.resultado || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO route FROM public.rotas_entrega
  WHERE id = _rota_id AND tenant_id = current_tenant FOR UPDATE;
  IF NOT FOUND OR route.status <> 'em_rota' THEN
    RAISE EXCEPTION 'Rota não está em execução';
  END IF;
  is_admin := private.is_tenant_admin(current_tenant);
  IF NOT is_admin AND NOT EXISTS (
    SELECT 1 FROM public.motoristas driver
    JOIN public.funcionarios employee
      ON employee.id = driver.funcionario_id
     AND employee.tenant_id = driver.tenant_id
    WHERE driver.id = route.motorista_id
      AND driver.tenant_id = current_tenant
      AND employee.user_id = auth.uid()
      AND driver.ativo AND employee.ativo
  ) THEN
    RAISE EXCEPTION 'Somente o motorista designado ou administrador pode finalizar a rota';
  END IF;
  IF route.km_inicial IS NOT NULL AND _km_final < route.km_inicial THEN
    RAISE EXCEPTION 'Quilometragem final menor que a inicial';
  END IF;
  SELECT count(*) INTO unresolved_count FROM public.paradas_rota
  WHERE rota_id = route.id AND tenant_id = current_tenant
    AND status IN ('pendente', 'em_atendimento');
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'Resolva todas as paradas antes de finalizar a rota';
  END IF;

  UPDATE public.rotas_entrega
  SET status = 'concluida', km_final = _km_final, hora_retorno = now()
  WHERE id = route.id RETURNING * INTO route;
  response := jsonb_build_object(
    'routeId', route.id, 'status', route.status,
    'finishedAt', route.hora_retorno,
    'distanceKm', route.km_final - coalesce(route.km_inicial, route.km_final),
    'idempotent', false
  );
  INSERT INTO public.rota_operacoes (
    tenant_id, rota_id, tipo, idempotency_key, request_fingerprint,
    payload, resultado, criado_por
  ) VALUES (
    current_tenant, route.id, 'ROTA_FINALIZADA', _idempotency_key, fingerprint,
    jsonb_build_object('finalKm', _km_final), response, auth.uid()
  );
  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_rota_planejada(date, uuid, uuid, numeric, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_rota_planejada(date, uuid, uuid, numeric, text, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.adicionar_parada_planejada(uuid, text, uuid, uuid, uuid, time, time, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_parada_planejada(uuid, text, uuid, uuid, uuid, time, time, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.reordenar_paradas_rota(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_paradas_rota(uuid, jsonb, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.iniciar_rota_planejada(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_rota_planejada(uuid, numeric, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.registrar_evento_parada_rota(uuid, integer, text, text, timestamptz, text, text, text, text, uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento_parada_rota(uuid, integer, text, text, timestamptz, text, text, text, text, uuid, jsonb, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.finalizar_rota_planejada(uuid, numeric, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_rota_planejada(uuid, numeric, text)
  TO authenticated;

COMMENT ON TABLE public.rota_operacoes IS
  'Ledger imutável de planejamento, execução, tentativas, reagendamentos e comprovantes logísticos.';
COMMENT ON COLUMN public.paradas_rota.endereco_snapshot IS
  'Fotografia do endereço usada no planejamento; correções ficam auditadas em rota_operacoes.';
COMMENT ON COLUMN public.paradas_rota.entrega_id IS
  'Comprovante de itens confirmado que autoriza concluir uma parada do tipo entrega.';

NOTIFY pgrst, 'reload schema';


DROP POLICY IF EXISTS rotas_area_scope ON public.rotas_entrega;
CREATE POLICY rotas_area_scope ON public.rotas_entrega AS RESTRICTIVE FOR SELECT TO authenticated USING (
 private.can_access_area(CASE operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END));
DROP POLICY IF EXISTS paradas_rota_area_scope ON public.paradas_rota;
CREATE POLICY paradas_rota_area_scope ON public.paradas_rota AS RESTRICTIVE FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.rotas_entrega r WHERE r.id=rota_id AND r.tenant_id=paradas_rota.tenant_id));

-- Private proof-of-delivery media.
-- Object names are tenant/route/stop/purpose/random.ext. The database keeps
-- the object path, never a public or long-lived signed URL.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'delivery-evidence',
  'delivery-evidence',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION private.delivery_evidence_path_matches(
  _object_name text,
  _tenant_id uuid,
  _route_id uuid,
  _stop_id uuid,
  _purpose text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, private, pg_temp
AS $$
  SELECT coalesce(
    _object_name ~ (
      '^' || _tenant_id::text || '/' || _route_id::text || '/' || _stop_id::text ||
      '/(photo|signature)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
    )
    AND (_purpose IS NULL OR split_part(_object_name, '/', 4) = _purpose),
    false
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_delivery_evidence(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.paradas_rota stop
    JOIN public.rotas_entrega route
      ON route.id = stop.rota_id
     AND route.tenant_id = stop.tenant_id
    WHERE stop.tenant_id = private.current_tenant_id()
      AND stop.id = CASE
        WHEN split_part(_object_name, '/', 3) ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN split_part(_object_name, '/', 3)::uuid
      END
      AND route.id = CASE
        WHEN split_part(_object_name, '/', 2) ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN split_part(_object_name, '/', 2)::uuid
      END
      AND private.delivery_evidence_path_matches(
        _object_name, stop.tenant_id, route.id, stop.id, NULL
      )
      AND private.can_access_area(CASE route.operation_type WHEN 'domestico' THEN 'residencial' WHEN 'industrial' THEN 'industrial' ELSE 'central' END)
      AND (
        private.is_tenant_admin(stop.tenant_id)
        OR EXISTS (
          SELECT 1
          FROM public.motoristas driver
          JOIN public.funcionarios employee
            ON employee.id = driver.funcionario_id
           AND employee.tenant_id = driver.tenant_id
          WHERE driver.id = route.motorista_id
            AND driver.tenant_id = stop.tenant_id
            AND driver.ativo
            AND employee.ativo
            AND employee.user_id = auth.uid()
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.can_delete_delivery_evidence(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
  SELECT private.can_access_delivery_evidence(_object_name)
    AND NOT EXISTS (
      SELECT 1
      FROM public.paradas_rota stop
      WHERE stop.tenant_id = private.current_tenant_id()
        AND (
          stop.foto_comprovante_url = _object_name
          OR stop.assinatura_url = _object_name
        )
    )
$$;

REVOKE ALL ON FUNCTION private.delivery_evidence_path_matches(text, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_access_delivery_evidence(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_delete_delivery_evidence(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_delivery_evidence(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_delete_delivery_evidence(text)
  TO authenticated, service_role;

DROP POLICY IF EXISTS delivery_evidence_read ON storage.objects;
DROP POLICY IF EXISTS delivery_evidence_insert ON storage.objects;
DROP POLICY IF EXISTS delivery_evidence_delete_orphan ON storage.objects;

CREATE POLICY delivery_evidence_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-evidence'
    AND (SELECT private.can_access_delivery_evidence(name))
  );

CREATE POLICY delivery_evidence_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-evidence'
    AND (SELECT private.can_access_delivery_evidence(name))
  );

-- Evidence is never overwritten. An uploaded orphan may be removed, but once
-- its path is linked to a stop it becomes immutable through Storage RLS.
CREATE POLICY delivery_evidence_delete_orphan ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'delivery-evidence'
    AND (SELECT private.can_delete_delivery_evidence(name))
  );

CREATE OR REPLACE FUNCTION private.validate_delivery_evidence_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, storage, pg_temp
AS $$
DECLARE
  validate_photo boolean := TG_OP = 'INSERT';
  validate_signature boolean := TG_OP = 'INSERT';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    validate_photo := NEW.foto_comprovante_url IS DISTINCT FROM OLD.foto_comprovante_url;
    validate_signature := NEW.assinatura_url IS DISTINCT FROM OLD.assinatura_url;
  END IF;

  IF validate_photo AND NEW.foto_comprovante_url IS NOT NULL THEN
    IF NOT private.delivery_evidence_path_matches(
      NEW.foto_comprovante_url, NEW.tenant_id, NEW.rota_id, NEW.id, 'photo'
    ) OR NOT EXISTS (
      SELECT 1
      FROM storage.objects object
      WHERE object.bucket_id = 'delivery-evidence'
        AND object.name = NEW.foto_comprovante_url
        AND lower(coalesce(object.metadata->>'mimetype', '')) IN (
          'image/jpeg', 'image/png', 'image/webp'
        )
        AND coalesce((object.metadata->>'size')::bigint, 0) BETWEEN 1 AND 8388608
    ) THEN
      RAISE EXCEPTION 'Foto de comprovação inválida ou inexistente';
    END IF;
  END IF;

  IF validate_signature AND NEW.assinatura_url IS NOT NULL THEN
    IF NOT private.delivery_evidence_path_matches(
      NEW.assinatura_url, NEW.tenant_id, NEW.rota_id, NEW.id, 'signature'
    ) OR NOT EXISTS (
      SELECT 1
      FROM storage.objects object
      WHERE object.bucket_id = 'delivery-evidence'
        AND object.name = NEW.assinatura_url
        AND lower(coalesce(object.metadata->>'mimetype', '')) IN (
          'image/jpeg', 'image/png', 'image/webp'
        )
        AND coalesce((object.metadata->>'size')::bigint, 0) BETWEEN 1 AND 8388608
    ) THEN
      RAISE EXCEPTION 'Assinatura de comprovação inválida ou inexistente';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validate_delivery_evidence_reference()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_delivery_evidence_reference
  ON public.paradas_rota;
CREATE TRIGGER validate_delivery_evidence_reference
  BEFORE INSERT OR UPDATE OF foto_comprovante_url, assinatura_url
  ON public.paradas_rota
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_delivery_evidence_reference();

COMMENT ON COLUMN public.paradas_rota.foto_comprovante_url IS
  'Private delivery-evidence object path. Never store a public or signed URL.';
COMMENT ON COLUMN public.paradas_rota.assinatura_url IS
  'Private delivery-evidence object path. Never store a public or signed URL.';
