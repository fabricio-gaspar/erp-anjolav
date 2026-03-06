
-- =============================================
-- PROBLEMA 1: CRIAR TRIGGERS AUSENTES
-- =============================================

-- 1a. Trigger para gerar numero automatico da OS
CREATE TRIGGER trg_generate_os_number
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_os_number();

-- 1b. Trigger para registrar historico de status da OS
CREATE TRIGGER trg_registrar_historico_status
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historico_status();

-- 1c. Trigger para auto-atribuir role ao vincular funcionario
CREATE TRIGGER trg_handle_new_user_role
  AFTER UPDATE ON public.funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 1d. Triggers updated_at em todas as tabelas relevantes
CREATE TRIGGER trg_updated_at_ordens_servico BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_clientes BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_produtos BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_funcionarios BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_motoristas BEFORE UPDATE ON public.motoristas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_veiculos BEFORE UPDATE ON public.veiculos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_agendamentos BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_lancamentos BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_faturas BEFORE UPDATE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_contas_pagar BEFORE UPDATE ON public.contas_pagar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_fornecedores BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_caixas BEFORE UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_contratos_aluguel BEFORE UPDATE ON public.contratos_aluguel FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_configuracoes_gerais BEFORE UPDATE ON public.configuracoes_gerais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_configuracoes_fiscais BEFORE UPDATE ON public.configuracoes_fiscais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_configuracoes_cliente BEFORE UPDATE ON public.configuracoes_cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_configuracoes_pagamento_cliente BEFORE UPDATE ON public.configuracoes_pagamento_cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_enderecos_clientes BEFORE UPDATE ON public.enderecos_clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_etiquetas_configuracoes BEFORE UPDATE ON public.etiquetas_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_rol_configuracoes BEFORE UPDATE ON public.rol_configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_lancamentos_cliente BEFORE UPDATE ON public.lancamentos_cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_precos_especiais BEFORE UPDATE ON public.precos_especiais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_automacoes_config BEFORE UPDATE ON public.automacoes_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_notificacoes_config BEFORE UPDATE ON public.notificacoes_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_updated_at_estoque_produtos BEFORE UPDATE ON public.estoque_produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PROBLEMA 2: COLUNAS FALTANDO NO CAIXA
-- =============================================

-- 2a. Adicionar operador_id na tabela caixas
ALTER TABLE public.caixas
  ADD COLUMN IF NOT EXISTS operador_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL;

-- 2b. Adicionar cliente_id e ordem_servico_id na tabela caixa_movimentacoes
ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL;
