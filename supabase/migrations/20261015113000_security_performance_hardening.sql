-- Phase A: cache statement-stable RLS context without changing tenant,
-- module, area, or row-dependent authorization semantics.
DO $tenant_rls$
DECLARE
  table_name text;
  allowed_modules text[];
  module_check text;
  area_check text;
  access_check text;
  tenant_tables constant text[] := ARRAY[
    'agendamentos', 'area_permissoes', 'asaas_charges', 'asaas_webhook_events',
    'automacoes_config', 'beneficios_catalogo', 'caixa_movimentacoes', 'caixas',
    'categorias_financeiras', 'centros_custo', 'clientes', 'configuracoes_cliente',
    'configuracoes_fiscais', 'configuracoes_gerais', 'configuracoes_pagamento_cliente',
    'contas_pagar', 'contratos_aluguel', 'descricoes_servicos_fiscais', 'enderecos_clientes',
    'estoque_produtos', 'etiquetas_configuracoes', 'eventos_agenda', 'faturas',
    'folha_beneficios', 'folha_pagamento', 'folha_pagamento_historico', 'fornecedores',
    'funcionarios', 'historico_envios', 'historico_producao', 'itens_contrato_aluguel',
    'itens_lancamento', 'itens_lancamento_cliente', 'itens_ordem_servico',
    'lancamentos', 'lancamentos_cliente', 'lancamentos_fatura', 'lotes_ordens',
    'lotes_producao', 'mensagens_log', 'modulo_permissoes', 'motoristas',
    'movimentacoes_estoque', 'notificacoes_config', 'notificacoes_enviadas',
    'orcamentos', 'ordens_servico', 'paradas_rota', 'pdv_pagamentos', 'portal_config',
    'precos_especiais', 'produtos', 'rol_configuracoes', 'rotas_entrega', 'user_roles',
    'veiculos', 'whatsapp_instancias'
  ];
  admin_tables constant text[] := ARRAY[
    'area_permissoes', 'automacoes_config', 'beneficios_catalogo',
    'categorias_financeiras', 'centros_custo', 'configuracoes_fiscais',
    'configuracoes_gerais', 'descricoes_servicos_fiscais', 'etiquetas_configuracoes',
    'folha_beneficios', 'folha_pagamento', 'folha_pagamento_historico',
    'funcionarios', 'modulo_permissoes', 'notificacoes_config', 'portal_config',
    'rol_configuracoes', 'user_roles', 'whatsapp_instancias'
  ];
  service_tables constant text[] := ARRAY[
    'asaas_charges', 'asaas_webhook_events', 'pdv_pagamentos'
  ];
  no_delete_tables constant text[] := ARRAY[
    'caixa_movimentacoes', 'faturas', 'historico_envios', 'historico_producao',
    'lancamentos', 'lancamentos_cliente', 'mensagens_log', 'movimentacoes_estoque',
    'notificacoes_enviadas', 'ordens_servico'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    allowed_modules := CASE
      WHEN table_name = ANY(ARRAY[
        'agendamentos', 'eventos_agenda', 'rotas_entrega', 'paradas_rota'
      ]) THEN ARRAY['agenda', 'ordens', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'clientes', 'enderecos_clientes', 'configuracoes_cliente',
        'configuracoes_pagamento_cliente', 'contratos_aluguel',
        'itens_contrato_aluguel', 'precos_especiais'
      ]) THEN ARRAY['clientes', 'ordens', 'agenda', 'faturamento', 'caixa', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'produtos', 'estoque_produtos', 'movimentacoes_estoque', 'fornecedores'
      ]) THEN ARRAY['produtos', 'ordens', 'producao', 'caixa', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'ordens_servico', 'itens_ordem_servico', 'historico_producao',
        'lotes_ordens', 'lotes_producao'
      ]) THEN ARRAY['ordens', 'producao', 'faturamento', 'caixa', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'caixas', 'caixa_movimentacoes', 'contas_pagar', 'faturas',
        'historico_envios', 'itens_lancamento', 'itens_lancamento_cliente',
        'lancamentos', 'lancamentos_cliente', 'lancamentos_fatura'
      ]) THEN ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'dashboard', 'relatorios']
      WHEN table_name = ANY(ARRAY[
        'mensagens_log', 'notificacoes_enviadas'
      ]) THEN ARRAY['ordens', 'faturamento', 'agenda', 'dashboard']
      WHEN table_name = ANY(ARRAY['motoristas', 'veiculos'])
        THEN ARRAY['agenda', 'ordens', 'producao', 'configuracoes']
      ELSE ARRAY['dashboard']
    END;
    module_check := format('(select private.has_any_module_access(%L::text[]))', allowed_modules);
    area_check := CASE
      WHEN table_name = 'clientes'
        THEN 'private.can_access_area(classificacao)'
      WHEN table_name = 'ordens_servico'
        THEN 'private.can_access_area(CASE WHEN lower(coalesce(origem, ''industrial'')) IN (''residencial'', ''loja'') THEN ''residencial'' ELSE ''industrial'' END)'
      WHEN table_name = 'produtos'
        THEN 'CASE coalesce(unidade_negocio, ''ambos'') WHEN ''ID1'' THEN private.can_access_area(''industrial'') WHEN ''ID2'' THEN private.can_access_area(''residencial'') ELSE private.can_access_area(''industrial'') OR private.can_access_area(''residencial'') END'
      WHEN table_name = ANY(ARRAY[
        'agendamentos', 'configuracoes_cliente', 'configuracoes_pagamento_cliente',
        'contratos_aluguel', 'enderecos_clientes', 'faturas', 'lancamentos',
        'lancamentos_cliente', 'orcamentos'
      ]) THEN 'private.can_access_client(cliente_id)'
      WHEN table_name = 'precos_especiais'
        THEN 'private.can_access_client(cliente_id) AND private.can_access_product(produto_id)'
      WHEN table_name = ANY(ARRAY[
        'historico_producao', 'itens_ordem_servico', 'lotes_ordens',
        'notificacoes_enviadas'
      ]) THEN 'private.can_access_order(ordem_servico_id)'
      WHEN table_name = 'mensagens_log'
        THEN '(private.can_access_order(ordem_servico_id) OR private.can_access_client(cliente_id))'
      WHEN table_name = 'paradas_rota'
        THEN '(private.can_access_order(ordem_servico_id) OR private.can_access_client(cliente_id) OR private.can_access_appointment(agendamento_id))'
      WHEN table_name = 'historico_envios'
        THEN 'private.can_access_invoice(fatura_id)'
      WHEN table_name = 'itens_lancamento'
        THEN 'private.can_access_launch(lancamento_id)'
      WHEN table_name = 'itens_lancamento_cliente'
        THEN 'private.can_access_portal_launch(lancamento_id)'
      WHEN table_name = 'lancamentos_fatura'
        THEN 'private.can_access_launch(lancamento_id) AND private.can_access_invoice(fatura_id)'
      WHEN table_name = 'itens_contrato_aluguel'
        THEN 'private.can_access_contract(contrato_id)'
      ELSE 'true'
    END;
    access_check := format('(%s) AND (%s)', module_check, area_check);

    IF NOT table_name = ANY(service_tables) AND NOT table_name = ANY(admin_tables) AND table_name NOT IN (
      'configuracoes_fiscais', 'folha_pagamento', 'folha_beneficios',
      'folha_pagamento_historico', 'funcionarios', 'user_roles',
      'area_permissoes', 'modulo_permissoes', 'whatsapp_instancias'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_select ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (tenant_id = (select private.current_tenant_id()) AND %s)',
        table_name, access_check
      );
    END IF;

    IF NOT table_name = ANY(admin_tables) AND NOT table_name = ANY(service_tables) THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = (select private.current_tenant_id()) AND %s)',
        table_name, access_check
      );
      EXECUTE format('DROP POLICY IF EXISTS tenant_update ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (tenant_id = (select private.current_tenant_id()) AND %s) WITH CHECK (tenant_id = (select private.current_tenant_id()) AND %s)',
        table_name, access_check, access_check
      );
      IF NOT table_name = ANY(no_delete_tables) THEN
        EXECUTE format('DROP POLICY IF EXISTS tenant_delete ON public.%I', table_name);
        EXECUTE format(
          'CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (tenant_id = (select private.current_tenant_id()) AND %s)',
          table_name, access_check
        );
      END IF;
    END IF;
  END LOOP;
END
$tenant_rls$;

DROP POLICY IF EXISTS tenant_member_read_membership ON public.tenant_memberships;
CREATE POLICY tenant_member_read_membership ON public.tenant_memberships
  FOR SELECT TO authenticated USING (
    user_id = (select auth.uid()) OR private.is_tenant_admin(tenant_id)
  );

DROP POLICY IF EXISTS employee_self_read ON public.funcionarios;
CREATE POLICY employee_self_read ON public.funcionarios
  FOR SELECT TO authenticated
  USING (tenant_id = (select private.current_tenant_id()) AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS own_roles_read ON public.user_roles;
CREATE POLICY own_roles_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = (select private.current_tenant_id()) AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS own_areas_read ON public.area_permissoes;
CREATE POLICY own_areas_read ON public.area_permissoes
  FOR SELECT TO authenticated
  USING (tenant_id = (select private.current_tenant_id()) AND user_id = (select auth.uid()));

DROP POLICY IF EXISTS own_module_permissions_read ON public.modulo_permissoes;
CREATE POLICY own_module_permissions_read ON public.modulo_permissoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = (select private.current_tenant_id())
    AND funcionario_id = (select public.get_funcionario_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS tenant_member_read_general_config ON public.configuracoes_gerais;
CREATE POLICY tenant_member_read_general_config ON public.configuracoes_gerais
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND private.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS tenant_finance_read_categories ON public.categorias_financeiras;
CREATE POLICY tenant_finance_read_categories ON public.categorias_financeiras
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'relatorios']))
  );

DROP POLICY IF EXISTS tenant_finance_read_cost_centers ON public.centros_custo;
CREATE POLICY tenant_finance_read_cost_centers ON public.centros_custo
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'relatorios']))
  );

DROP POLICY IF EXISTS tenant_billing_read_service_descriptions ON public.descricoes_servicos_fiscais;
CREATE POLICY tenant_billing_read_service_descriptions ON public.descricoes_servicos_fiscais
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['clientes', 'faturamento']))
  );

DROP POLICY IF EXISTS tenant_operations_read_label_config ON public.etiquetas_configuracoes;
CREATE POLICY tenant_operations_read_label_config ON public.etiquetas_configuracoes
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['ordens', 'producao', 'caixa']))
  );

DROP POLICY IF EXISTS tenant_operations_read_rol_config ON public.rol_configuracoes;
CREATE POLICY tenant_operations_read_rol_config ON public.rol_configuracoes
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['ordens', 'producao', 'faturamento']))
  );

DROP POLICY IF EXISTS tenant_clients_read_portal_config ON public.portal_config;
CREATE POLICY tenant_clients_read_portal_config ON public.portal_config
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['clientes']))
  );

DROP POLICY IF EXISTS employee_read_own_payroll ON public.folha_pagamento;
CREATE POLICY employee_read_own_payroll ON public.folha_pagamento
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND funcionario_id = (select public.get_funcionario_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS employee_read_own_benefits ON public.folha_beneficios;
CREATE POLICY employee_read_own_benefits ON public.folha_beneficios
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND funcionario_id = (select public.get_funcionario_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS employee_read_own_payroll_history ON public.folha_pagamento_historico;
CREATE POLICY employee_read_own_payroll_history ON public.folha_pagamento_historico
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND funcionario_id = (select public.get_funcionario_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS tenant_admin_read_audit ON public.audit_events;
CREATE POLICY tenant_admin_read_audit ON public.audit_events
  FOR SELECT TO authenticated USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.is_tenant_admin((select private.current_tenant_id())))
  );

DROP POLICY IF EXISTS fidelidade_lancamentos_leitura_empresa ON public.fidelidade_lancamentos;
CREATE POLICY fidelidade_lancamentos_leitura_empresa ON public.fidelidade_lancamentos
  FOR SELECT TO authenticated
  USING (
    tenant_id = (select private.current_tenant_id())
    AND (select private.has_any_module_access(ARRAY['caixa', 'clientes']))
  );
