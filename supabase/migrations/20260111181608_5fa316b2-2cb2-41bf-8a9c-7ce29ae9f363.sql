-- =====================================================
-- FASE 1: Reestruturação do Banco de Dados
-- Sistema de Faturamento Completo em 4 Etapas
-- =====================================================

-- 1. Expandir tabela faturas com todos os campos necessários
ALTER TABLE public.faturas
  -- Campos para ETAPA 1 (Relatório)
  ADD COLUMN IF NOT EXISTS relatorio_gerado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS relatorio_data TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tipo_relatorio TEXT DEFAULT 'detalhado',
  ADD COLUMN IF NOT EXISTS itens_snapshot JSONB DEFAULT '[]'::jsonb,
  
  -- Campos para ETAPA 2 (Nota Fiscal)
  ADD COLUMN IF NOT EXISTS chave_acesso TEXT,
  ADD COLUMN IF NOT EXISTS link_pdf_nf TEXT,
  ADD COLUMN IF NOT EXISTS data_emissao_nf TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_cliente JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_emitente JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS descricao_servico TEXT,
  
  -- Campos para ETAPA 3 (Pagamento)
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS boleto_url TEXT,
  ADD COLUMN IF NOT EXISTS boleto_linha_digitavel TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_copia_cola TEXT,
  ADD COLUMN IF NOT EXISTS dados_transferencia JSONB DEFAULT '{}'::jsonb,
  
  -- Campos para ETAPA 4 (Envio)
  ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canais_envio TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS destinatario_envio TEXT,
  ADD COLUMN IF NOT EXISTS mensagem_enviada TEXT;

-- 2. Adicionar fatura_id diretamente em lancamentos para facilitar queries
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS fatura_id UUID REFERENCES public.faturas(id);

-- 3. Criar tabela de histórico de envios
CREATE TABLE IF NOT EXISTS public.historico_envios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fatura_id UUID NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  canal TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  destinatario TEXT NOT NULL,
  mensagem TEXT,
  documentos_enviados TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'entregue', 'erro', 'lido')),
  erro_mensagem TEXT,
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Habilitar RLS na nova tabela
ALTER TABLE public.historico_envios ENABLE ROW LEVEL SECURITY;

-- 5. Criar política de acesso
CREATE POLICY "Allow all on historico_envios" 
  ON public.historico_envios 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_periodo 
  ON public.faturas(cliente_id, periodo_inicio, periodo_fim);

CREATE INDEX IF NOT EXISTS idx_faturas_status 
  ON public.faturas(status);

CREATE INDEX IF NOT EXISTS idx_lancamentos_fatura_id 
  ON public.lancamentos(fatura_id);

CREATE INDEX IF NOT EXISTS idx_historico_envios_fatura_id 
  ON public.historico_envios(fatura_id);

-- 7. Adicionar comentários para documentação
COMMENT ON COLUMN public.faturas.relatorio_gerado IS 'Indica se o relatório da Etapa 1 foi gerado';
COMMENT ON COLUMN public.faturas.tipo_relatorio IS 'Tipo: detalhado, mapa_pecas, mapa_mensal';
COMMENT ON COLUMN public.faturas.itens_snapshot IS 'Snapshot dos itens faturados no momento da geração';
COMMENT ON COLUMN public.faturas.chave_acesso IS 'Chave de acesso da NF-e (44 dígitos)';
COMMENT ON COLUMN public.faturas.snapshot_cliente IS 'Dados do cliente no momento da emissão da NF';
COMMENT ON COLUMN public.faturas.snapshot_emitente IS 'Dados do emitente no momento da emissão da NF';
COMMENT ON COLUMN public.faturas.forma_pagamento IS 'Forma: boleto, pix, transferencia';
COMMENT ON COLUMN public.faturas.canais_envio IS 'Canais utilizados para envio: email, whatsapp';
COMMENT ON TABLE public.historico_envios IS 'Histórico de todos os envios de faturas aos clientes';