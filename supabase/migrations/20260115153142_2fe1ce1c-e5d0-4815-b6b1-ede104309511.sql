-- Adicionar campos de pagamento e urgência na tabela ordens_servico
ALTER TABLE ordens_servico
ADD COLUMN IF NOT EXISTS valor_total NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS pago_na_entrada BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS urgente BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS percentual_urgencia NUMERIC(5, 2) DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN ordens_servico.forma_pagamento IS 'DINHEIRO, PIX, CARTAO_CREDITO, CARTAO_DEBITO, BOLETO, FATURADO';
COMMENT ON COLUMN ordens_servico.status_pagamento IS 'pendente, parcial, pago';
COMMENT ON COLUMN ordens_servico.pago_na_entrada IS 'true = pago na retirada, false = pago na entrega';