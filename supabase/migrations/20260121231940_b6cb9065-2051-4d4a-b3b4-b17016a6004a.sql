-- Tabela para configurações de notificações automáticas
CREATE TABLE notificacoes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'sms')),
  evento TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  template TEXT NOT NULL,
  variaveis JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para configurações de automações
CREATE TABLE automacoes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('backup', 'fechamento', 'limpeza', 'notificacao')),
  ativo BOOLEAN DEFAULT false,
  configuracao JSONB DEFAULT '{}'::jsonb,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para configurações do portal do cliente
CREATE TABLE portal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_ativo BOOLEAN DEFAULT true,
  modulos_visiveis JSONB DEFAULT '{"os": true, "documentos": true, "agendamento": false, "historico": true}'::jsonb,
  texto_boas_vindas TEXT,
  cor_primaria TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE notificacoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE automacoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_config ENABLE ROW LEVEL SECURITY;

-- Policies para notificacoes_config
CREATE POLICY "Authenticated can select notificacoes_config" 
  ON notificacoes_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notificacoes_config" 
  ON notificacoes_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update notificacoes_config" 
  ON notificacoes_config FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete notificacoes_config" 
  ON notificacoes_config FOR DELETE TO authenticated USING (true);

-- Policies para automacoes_config
CREATE POLICY "Authenticated can select automacoes_config" 
  ON automacoes_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert automacoes_config" 
  ON automacoes_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update automacoes_config" 
  ON automacoes_config FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete automacoes_config" 
  ON automacoes_config FOR DELETE TO authenticated USING (true);

-- Policies para portal_config
CREATE POLICY "Authenticated can select portal_config" 
  ON portal_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert portal_config" 
  ON portal_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update portal_config" 
  ON portal_config FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete portal_config" 
  ON portal_config FOR DELETE TO authenticated USING (true);

-- Inserir templates padrão de notificação
INSERT INTO notificacoes_config (canal, evento, ativo, template, variaveis) VALUES
  ('whatsapp', 'os_retirada', true, 'Olá {cliente}! Sua OS #{numero} foi retirada e está a caminho da lavanderia. Previsão de entrega: {previsao}', '["cliente", "numero", "previsao"]'),
  ('whatsapp', 'os_producao', true, 'Olá {cliente}! Sua OS #{numero} entrou em produção. Em breve estará pronta!', '["cliente", "numero"]'),
  ('whatsapp', 'os_pronto', true, 'Olá {cliente}! Sua OS #{numero} está pronta para entrega! Total: R$ {valor}', '["cliente", "numero", "valor"]'),
  ('whatsapp', 'os_entregue', true, 'Olá {cliente}! Sua OS #{numero} foi entregue com sucesso. Obrigado pela preferência!', '["cliente", "numero"]'),
  ('whatsapp', 'fatura_vencimento', true, 'Olá {cliente}! Sua fatura de R$ {valor} vence em {dias} dias. Pague via PIX ou boleto.', '["cliente", "valor", "dias"]'),
  ('email', 'fatura_emitida', true, 'Prezado(a) {cliente}, sua fatura #{numero} no valor de R$ {valor} foi emitida.', '["cliente", "numero", "valor"]');

-- Inserir configurações padrão de automação
INSERT INTO automacoes_config (tipo, ativo, configuracao) VALUES
  ('backup', false, '{"frequencia": "diario", "hora": "02:00", "manter_dias": 30}'),
  ('fechamento', false, '{"dia_mes": 1, "gerar_faturas": true, "enviar_email": false}'),
  ('limpeza', false, '{"dias_historico": 90, "limpar_logs": true, "limpar_envios": false}');

-- Inserir configuração padrão do portal
INSERT INTO portal_config (portal_ativo, modulos_visiveis, texto_boas_vindas) VALUES
  (true, '{"os": true, "documentos": true, "agendamento": true, "historico": true, "financeiro": false}', 'Bem-vindo ao Portal do Cliente! Aqui você pode acompanhar suas ordens de serviço e documentos.');