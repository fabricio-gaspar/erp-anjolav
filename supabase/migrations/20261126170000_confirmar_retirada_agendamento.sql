-- OP-05: one ROL per pickup appointment, even when requests are retried.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ordens_servico_tenant_agendamento
  ON public.ordens_servico (tenant_id, agendamento_id)
  WHERE agendamento_id IS NOT NULL;

-- Keep privileged writes in the non-exposed schema. The public RPC is an
-- invoker-only entry point; the helper rechecks actor, tenant, area and state.
CREATE OR REPLACE FUNCTION private.confirmar_retirada_agendamento_impl(
  _agendamento_id uuid,
  _status_esperado text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_agendamento public.agendamentos%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_rol public.ordens_servico%ROWTYPE;
  v_funcionario_id uuid;
  v_origem text;
  v_operation_type public.operation_type;
  v_constraint text;
  v_attempt integer;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
     OR NOT private.is_tenant_member(v_tenant)
     OR NOT private.has_any_module_access(ARRAY['agenda', 'ordens', 'producao']::text[])
  THEN
    RAISE EXCEPTION 'Sem permissão para confirmar a retirada' USING ERRCODE = '42501';
  END IF;
  IF _agendamento_id IS NULL OR _status_esperado IS NULL
     OR _status_esperado NOT IN ('agendado', 'confirmado')
  THEN
    RAISE EXCEPTION 'Agendamento ou status esperado inválido' USING ERRCODE = '22023';
  END IF;

  -- The appointment lock serializes concurrent confirmations and status changes.
  SELECT * INTO v_agendamento
  FROM public.agendamentos
  WHERE id = _agendamento_id AND tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND OR v_agendamento.tipo IS DISTINCT FROM 'retirada' THEN
    RAISE EXCEPTION 'Agendamento de retirada não encontrado nesta empresa' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE id = v_agendamento.cliente_id AND tenant_id = v_tenant
  FOR SHARE;
  IF NOT FOUND OR v_cliente.classificacao NOT IN ('industrial', 'domestico', 'residencial')
  THEN
    RAISE EXCEPTION 'Cliente indisponível para esta retirada' USING ERRCODE = '22023';
  END IF;
  IF NOT private.can_access_area(v_cliente.classificacao) THEN
    RAISE EXCEPTION 'Sem permissão para atender este cliente' USING ERRCODE = '42501';
  END IF;

  v_origem := CASE WHEN v_cliente.classificacao = 'industrial'
    THEN 'industrial' ELSE 'residencial' END;
  v_operation_type := CASE WHEN v_cliente.classificacao = 'industrial'
    THEN 'industrial'::public.operation_type ELSE 'domestico'::public.operation_type END;

  SELECT * INTO v_rol
  FROM public.ordens_servico
  WHERE tenant_id = v_tenant AND agendamento_id = _agendamento_id;
  IF FOUND THEN
    IF v_rol.cliente_id IS DISTINCT FROM v_cliente.id
       OR v_rol.status = 'cancelada'
       OR v_agendamento.status IS DISTINCT FROM 'realizado'
    THEN
      RAISE EXCEPTION 'ROL vinculado e agendamento em estados incompatíveis' USING ERRCODE = '55000';
    END IF;
    RETURN jsonb_build_object('id', v_rol.id, 'numero', v_rol.numero, 'idempotent', true);
  END IF;

  IF v_cliente.ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Cliente indisponível para esta retirada' USING ERRCODE = '22023';
  END IF;
  IF v_agendamento.status IS DISTINCT FROM _status_esperado THEN
    RAISE EXCEPTION 'O status do agendamento mudou. Atualize a agenda antes de confirmar' USING ERRCODE = '55000';
  END IF;
  IF v_agendamento.data > CURRENT_DATE THEN
    RAISE EXCEPTION 'A retirada não pode ser confirmada antes da data agendada' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_funcionario_id
  FROM public.funcionarios
  WHERE tenant_id = v_tenant AND user_id = auth.uid() AND ativo
  ORDER BY created_at
  LIMIT 1;

  -- The existing order trigger allocates numero from MAX(numero). Retry only
  -- collisions with that number; never swallow an appointment uniqueness error.
  FOR v_attempt IN 1..3 LOOP
    BEGIN
      INSERT INTO public.ordens_servico (
        numero, tenant_id, cliente_id, agendamento_id, unidade_id,
        motorista_id, atendente_id, data_retirada, status,
        status_logistica, recebimento_modalidade, origem, operation_type,
        observacoes
      ) VALUES (
        '', v_tenant, v_cliente.id, v_agendamento.id, v_agendamento.unidade_id,
        v_agendamento.motorista_id, v_funcionario_id, CURRENT_DATE, 'separacao',
        'coletado', 'coleta', v_origem, v_operation_type,
        v_agendamento.observacoes
      ) RETURNING * INTO v_rol;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint <> 'uq_ordens_servico_tenant_numero' OR v_attempt = 3 THEN
        RAISE;
      END IF;
    END;
  END LOOP;

  -- A new order does not fire the status-update history trigger.
  INSERT INTO public.historico_producao (
    tenant_id, ordem_servico_id, etapa_anterior, etapa_nova,
    funcionario_id, observacoes, dados_formulario
  ) VALUES (
    v_tenant, v_rol.id, 'retirada', 'separacao',
    v_funcionario_id, v_agendamento.observacoes,
    jsonb_build_object(
      'tipo', 'confirmacao_retirada',
      'agendamento_id', v_agendamento.id,
      'horario_retirada', now(),
      'actor_user_id', auth.uid()
    )
  );

  UPDATE public.agendamentos
  SET status = 'realizado'
  WHERE id = v_agendamento.id AND tenant_id = v_tenant
    AND status = _status_esperado;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O status do agendamento mudou. Atualize a agenda antes de confirmar' USING ERRCODE = '55000';
  END IF;

  RETURN jsonb_build_object('id', v_rol.id, 'numero', v_rol.numero, 'idempotent', false);
END;
$function$;

REVOKE ALL ON FUNCTION private.confirmar_retirada_agendamento_impl(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.confirmar_retirada_agendamento_impl(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_retirada_agendamento(
  _agendamento_id uuid,
  _status_esperado text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.confirmar_retirada_agendamento_impl(_agendamento_id, _status_esperado);
$function$;

REVOKE ALL ON FUNCTION public.confirmar_retirada_agendamento(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_retirada_agendamento(uuid, text) TO authenticated;
