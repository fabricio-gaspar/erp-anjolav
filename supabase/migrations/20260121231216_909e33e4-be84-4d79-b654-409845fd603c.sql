-- =============================================
-- CORREÇÃO DE SEGURANÇA: Atualizar políticas RLS
-- Restringir acesso apenas para usuários autenticados
-- =============================================

-- AGENDAMENTOS
DROP POLICY IF EXISTS "Allow all on agendamentos" ON agendamentos;
CREATE POLICY "Authenticated can select agendamentos" ON agendamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert agendamentos" ON agendamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update agendamentos" ON agendamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete agendamentos" ON agendamentos FOR DELETE TO authenticated USING (true);

-- ASAAS_CHARGES
DROP POLICY IF EXISTS "Allow all operations on asaas_charges" ON asaas_charges;
CREATE POLICY "Authenticated can select asaas_charges" ON asaas_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert asaas_charges" ON asaas_charges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update asaas_charges" ON asaas_charges FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete asaas_charges" ON asaas_charges FOR DELETE TO authenticated USING (true);

-- ASAAS_WEBHOOK_EVENTS (manter público para webhooks externos)
DROP POLICY IF EXISTS "Allow all operations on asaas_webhook_events" ON asaas_webhook_events;
CREATE POLICY "Anyone can insert webhook events" ON asaas_webhook_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can select webhook events" ON asaas_webhook_events FOR SELECT TO authenticated USING (true);

-- CAIXA_MOVIMENTACOES
DROP POLICY IF EXISTS "Allow all operations on caixa_movimentacoes" ON caixa_movimentacoes;
CREATE POLICY "Authenticated can select caixa_movimentacoes" ON caixa_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert caixa_movimentacoes" ON caixa_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update caixa_movimentacoes" ON caixa_movimentacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete caixa_movimentacoes" ON caixa_movimentacoes FOR DELETE TO authenticated USING (true);

-- CAIXAS
DROP POLICY IF EXISTS "Allow all operations on caixas" ON caixas;
CREATE POLICY "Authenticated can select caixas" ON caixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert caixas" ON caixas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update caixas" ON caixas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete caixas" ON caixas FOR DELETE TO authenticated USING (true);

-- CLIENTES
DROP POLICY IF EXISTS "Allow all on clientes" ON clientes;
CREATE POLICY "Authenticated can select clientes" ON clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clientes" ON clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clientes" ON clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete clientes" ON clientes FOR DELETE TO authenticated USING (true);

-- CONFIGURACOES_CLIENTE
DROP POLICY IF EXISTS "Allow all on configuracoes_cliente" ON configuracoes_cliente;
CREATE POLICY "Authenticated can select configuracoes_cliente" ON configuracoes_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert configuracoes_cliente" ON configuracoes_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update configuracoes_cliente" ON configuracoes_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete configuracoes_cliente" ON configuracoes_cliente FOR DELETE TO authenticated USING (true);

-- CONFIGURACOES_FISCAIS
DROP POLICY IF EXISTS "Allow all on configuracoes_fiscais" ON configuracoes_fiscais;
CREATE POLICY "Authenticated can select configuracoes_fiscais" ON configuracoes_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert configuracoes_fiscais" ON configuracoes_fiscais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update configuracoes_fiscais" ON configuracoes_fiscais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete configuracoes_fiscais" ON configuracoes_fiscais FOR DELETE TO authenticated USING (true);

-- CONFIGURACOES_GERAIS
DROP POLICY IF EXISTS "Allow all on configuracoes_gerais" ON configuracoes_gerais;
CREATE POLICY "Authenticated can select configuracoes_gerais" ON configuracoes_gerais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert configuracoes_gerais" ON configuracoes_gerais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update configuracoes_gerais" ON configuracoes_gerais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete configuracoes_gerais" ON configuracoes_gerais FOR DELETE TO authenticated USING (true);

-- CONFIGURACOES_PAGAMENTO_CLIENTE
DROP POLICY IF EXISTS "Allow all on configuracoes_pagamento_cliente" ON configuracoes_pagamento_cliente;
CREATE POLICY "Authenticated can select configuracoes_pagamento_cliente" ON configuracoes_pagamento_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert configuracoes_pagamento_cliente" ON configuracoes_pagamento_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update configuracoes_pagamento_cliente" ON configuracoes_pagamento_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete configuracoes_pagamento_cliente" ON configuracoes_pagamento_cliente FOR DELETE TO authenticated USING (true);

-- CONTAS_PAGAR
DROP POLICY IF EXISTS "Allow all on contas_pagar" ON contas_pagar;
CREATE POLICY "Authenticated can select contas_pagar" ON contas_pagar FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contas_pagar" ON contas_pagar FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contas_pagar" ON contas_pagar FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contas_pagar" ON contas_pagar FOR DELETE TO authenticated USING (true);

-- CONTRATOS_ALUGUEL
DROP POLICY IF EXISTS "Allow all for contratos_aluguel" ON contratos_aluguel;
CREATE POLICY "Authenticated can select contratos_aluguel" ON contratos_aluguel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contratos_aluguel" ON contratos_aluguel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contratos_aluguel" ON contratos_aluguel FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contratos_aluguel" ON contratos_aluguel FOR DELETE TO authenticated USING (true);

-- DESCRICOES_SERVICOS_FISCAIS
DROP POLICY IF EXISTS "Allow all on descricoes_servicos_fiscais" ON descricoes_servicos_fiscais;
CREATE POLICY "Authenticated can select descricoes_servicos_fiscais" ON descricoes_servicos_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert descricoes_servicos_fiscais" ON descricoes_servicos_fiscais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update descricoes_servicos_fiscais" ON descricoes_servicos_fiscais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete descricoes_servicos_fiscais" ON descricoes_servicos_fiscais FOR DELETE TO authenticated USING (true);

-- ENDERECOS_CLIENTES
DROP POLICY IF EXISTS "Allow all on enderecos_clientes" ON enderecos_clientes;
CREATE POLICY "Authenticated can select enderecos_clientes" ON enderecos_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert enderecos_clientes" ON enderecos_clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update enderecos_clientes" ON enderecos_clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete enderecos_clientes" ON enderecos_clientes FOR DELETE TO authenticated USING (true);

-- FATURAS
DROP POLICY IF EXISTS "Allow all on faturas" ON faturas;
CREATE POLICY "Authenticated can select faturas" ON faturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert faturas" ON faturas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update faturas" ON faturas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete faturas" ON faturas FOR DELETE TO authenticated USING (true);

-- HISTORICO_ENVIOS
DROP POLICY IF EXISTS "Allow all on historico_envios" ON historico_envios;
CREATE POLICY "Authenticated can select historico_envios" ON historico_envios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert historico_envios" ON historico_envios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update historico_envios" ON historico_envios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete historico_envios" ON historico_envios FOR DELETE TO authenticated USING (true);

-- HISTORICO_PRODUCAO
DROP POLICY IF EXISTS "Allow all on historico_producao" ON historico_producao;
CREATE POLICY "Authenticated can select historico_producao" ON historico_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert historico_producao" ON historico_producao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update historico_producao" ON historico_producao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete historico_producao" ON historico_producao FOR DELETE TO authenticated USING (true);

-- ITENS_CONTRATO_ALUGUEL
DROP POLICY IF EXISTS "Allow all for itens_contrato_aluguel" ON itens_contrato_aluguel;
CREATE POLICY "Authenticated can select itens_contrato_aluguel" ON itens_contrato_aluguel FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert itens_contrato_aluguel" ON itens_contrato_aluguel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update itens_contrato_aluguel" ON itens_contrato_aluguel FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete itens_contrato_aluguel" ON itens_contrato_aluguel FOR DELETE TO authenticated USING (true);

-- ITENS_LANCAMENTO
DROP POLICY IF EXISTS "Allow all for itens_lancamento" ON itens_lancamento;
CREATE POLICY "Authenticated can select itens_lancamento" ON itens_lancamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert itens_lancamento" ON itens_lancamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update itens_lancamento" ON itens_lancamento FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete itens_lancamento" ON itens_lancamento FOR DELETE TO authenticated USING (true);

-- ITENS_LANCAMENTO_CLIENTE
DROP POLICY IF EXISTS "Allow all on itens_lancamento_cliente" ON itens_lancamento_cliente;
CREATE POLICY "Authenticated can select itens_lancamento_cliente" ON itens_lancamento_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert itens_lancamento_cliente" ON itens_lancamento_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update itens_lancamento_cliente" ON itens_lancamento_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete itens_lancamento_cliente" ON itens_lancamento_cliente FOR DELETE TO authenticated USING (true);

-- ITENS_ORDEM_SERVICO
DROP POLICY IF EXISTS "Allow all on itens_ordem_servico" ON itens_ordem_servico;
CREATE POLICY "Authenticated can select itens_ordem_servico" ON itens_ordem_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert itens_ordem_servico" ON itens_ordem_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update itens_ordem_servico" ON itens_ordem_servico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete itens_ordem_servico" ON itens_ordem_servico FOR DELETE TO authenticated USING (true);

-- LANCAMENTOS
DROP POLICY IF EXISTS "Allow all for lancamentos" ON lancamentos;
CREATE POLICY "Authenticated can select lancamentos" ON lancamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert lancamentos" ON lancamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update lancamentos" ON lancamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete lancamentos" ON lancamentos FOR DELETE TO authenticated USING (true);

-- LANCAMENTOS_CLIENTE
DROP POLICY IF EXISTS "Allow all on lancamentos_cliente" ON lancamentos_cliente;
CREATE POLICY "Authenticated can select lancamentos_cliente" ON lancamentos_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert lancamentos_cliente" ON lancamentos_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update lancamentos_cliente" ON lancamentos_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete lancamentos_cliente" ON lancamentos_cliente FOR DELETE TO authenticated USING (true);

-- LANCAMENTOS_FATURA
DROP POLICY IF EXISTS "Allow all for lancamentos_fatura" ON lancamentos_fatura;
CREATE POLICY "Authenticated can select lancamentos_fatura" ON lancamentos_fatura FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert lancamentos_fatura" ON lancamentos_fatura FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update lancamentos_fatura" ON lancamentos_fatura FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete lancamentos_fatura" ON lancamentos_fatura FOR DELETE TO authenticated USING (true);

-- MOTORISTAS
DROP POLICY IF EXISTS "Allow all on motoristas" ON motoristas;
CREATE POLICY "Authenticated can select motoristas" ON motoristas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert motoristas" ON motoristas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update motoristas" ON motoristas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete motoristas" ON motoristas FOR DELETE TO authenticated USING (true);

-- ORDENS_SERVICO
DROP POLICY IF EXISTS "Allow all on ordens_servico" ON ordens_servico;
CREATE POLICY "Authenticated can select ordens_servico" ON ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ordens_servico" ON ordens_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ordens_servico" ON ordens_servico FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete ordens_servico" ON ordens_servico FOR DELETE TO authenticated USING (true);

-- PARADAS_ROTA
DROP POLICY IF EXISTS "Allow all on paradas_rota" ON paradas_rota;
CREATE POLICY "Authenticated can select paradas_rota" ON paradas_rota FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert paradas_rota" ON paradas_rota FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update paradas_rota" ON paradas_rota FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete paradas_rota" ON paradas_rota FOR DELETE TO authenticated USING (true);

-- PRECOS_ESPECIAIS
DROP POLICY IF EXISTS "Allow all on precos_especiais" ON precos_especiais;
CREATE POLICY "Authenticated can select precos_especiais" ON precos_especiais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert precos_especiais" ON precos_especiais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update precos_especiais" ON precos_especiais FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete precos_especiais" ON precos_especiais FOR DELETE TO authenticated USING (true);

-- PRODUTOS
DROP POLICY IF EXISTS "Allow all on produtos" ON produtos;
CREATE POLICY "Authenticated can select produtos" ON produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert produtos" ON produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update produtos" ON produtos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete produtos" ON produtos FOR DELETE TO authenticated USING (true);

-- ROTAS_ENTREGA
DROP POLICY IF EXISTS "Allow all on rotas_entrega" ON rotas_entrega;
CREATE POLICY "Authenticated can select rotas_entrega" ON rotas_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert rotas_entrega" ON rotas_entrega FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update rotas_entrega" ON rotas_entrega FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete rotas_entrega" ON rotas_entrega FOR DELETE TO authenticated USING (true);

-- VEICULOS
DROP POLICY IF EXISTS "Allow all on veiculos" ON veiculos;
CREATE POLICY "Authenticated can select veiculos" ON veiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert veiculos" ON veiculos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update veiculos" ON veiculos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete veiculos" ON veiculos FOR DELETE TO authenticated USING (true);