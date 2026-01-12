-- Adicionar novas colunas na tabela faturas para suporte às melhorias do fluxo
ALTER TABLE faturas 
ADD COLUMN IF NOT EXISTS observacao_fatura TEXT,
ADD COLUMN IF NOT EXISTS imposto_calculado JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS vencimento_ajustado_por TEXT;