CREATE OR REPLACE FUNCTION public.excluir_cliente_sem_historico(_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_cliente public.clientes%ROWTYPE;
  v_bloqueios text[] := ARRAY[]::text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'É necessário autenticar para excluir um cliente.';
  END IF;

  v_tenant_id := private.current_tenant_id();
  IF v_tenant_id IS NULL OR NOT private.is_tenant_admin(v_tenant_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A exclusão definitiva exige administrador da empresa com MFA validado.';
  END IF;

  IF NOT private.has_any_module_access(ARRAY['clientes']::text[]) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Seu perfil não tem permissão para administrar clientes.';
  END IF;

  SELECT cliente.*
    INTO v_cliente
  FROM public.clientes AS cliente
  WHERE cliente.id = _cliente_id
    AND cliente.tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado na empresa ativa.';
  END IF;

  IF NOT private.can_access_area(v_cliente.classificacao) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Seu perfil não tem acesso à operação deste cliente.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.agenda_recorrencia_operacoes WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id)
    OR EXISTS (SELECT 1 FROM public.agendamentos WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id)
    OR EXISTS (SELECT 1 FROM public.paradas_rota WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'agenda ou rota');
  END IF;

  IF EXISTS (SELECT 1 FROM public.asaas_charges WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id)
    OR EXISTS (SELECT 1 FROM public.faturas WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'cobranças ou faturas');
  END IF;

  IF EXISTS (SELECT 1 FROM public.caixa_movimentacoes WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'movimentações de caixa');
  END IF;

  IF EXISTS (SELECT 1 FROM public.contratos_aluguel WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'contratos');
  END IF;

  IF EXISTS (SELECT 1 FROM public.fidelidade_lancamentos WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'fidelidade');
  END IF;

  IF EXISTS (SELECT 1 FROM public.lancamentos WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id)
    OR EXISTS (SELECT 1 FROM public.lancamentos_cliente WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'lançamentos financeiros');
  END IF;

  IF EXISTS (SELECT 1 FROM public.mensagens_log WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id)
    OR EXISTS (SELECT 1 FROM public.notificacoes_enviadas WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'mensagens ou notificações enviadas');
  END IF;

  IF EXISTS (SELECT 1 FROM public.orcamentos WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'orçamentos');
  END IF;

  IF EXISTS (SELECT 1 FROM public.ordens_servico WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'ROLs ou ordens de serviço');
  END IF;

  IF EXISTS (SELECT 1 FROM public.pdv_credit_accounts WHERE client_id = v_cliente.id AND tenant_id = v_tenant_id)
    OR EXISTS (SELECT 1 FROM public.pdv_credit_ledger WHERE client_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'créditos de cliente');
  END IF;

  IF EXISTS (SELECT 1 FROM public.pdv_pagamentos WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'pagamentos');
  END IF;

  IF EXISTS (SELECT 1 FROM public.precos_especiais WHERE cliente_id = v_cliente.id AND tenant_id = v_tenant_id) THEN
    v_bloqueios := array_append(v_bloqueios, 'preços personalizados');
  END IF;

  IF cardinality(v_bloqueios) > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Este cliente possui dados vinculados e não pode ser excluído: ' || array_to_string(v_bloqueios, ', ') || '. Use Arquivar para preservar o histórico.';
  END IF;

  INSERT INTO public.audit_events (
    tenant_id,
    actor_id,
    action,
    entity_schema,
    entity_table,
    entity_id,
    old_data,
    occurred_at,
    operation_type
  ) VALUES (
    v_tenant_id,
    auth.uid(),
    'DELETE',
    'public',
    'clientes',
    v_cliente.id::text,
    jsonb_build_object(
      'id', v_cliente.id,
      'razao_social', v_cliente.razao_social,
      'classificacao', v_cliente.classificacao,
      'tipo_pessoa', v_cliente.tipo_pessoa,
      'ativo', v_cliente.ativo
    ),
    now(),
    CASE WHEN v_cliente.classificacao = 'industrial'
      THEN 'industrial'::public.operation_type
      ELSE 'domestico'::public.operation_type
    END
  );

  DELETE FROM public.clientes
  WHERE id = v_cliente.id
    AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object('deleted', true, 'client_id', v_cliente.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.excluir_cliente_sem_historico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_cliente_sem_historico(uuid) TO authenticated;
