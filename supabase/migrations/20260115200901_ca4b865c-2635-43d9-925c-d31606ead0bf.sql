-- Adicionar campo dia_fechamento na tabela configuracoes_pagamento_cliente
ALTER TABLE public.configuracoes_pagamento_cliente
ADD COLUMN dia_fechamento integer NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.configuracoes_pagamento_cliente.dia_fechamento IS 'Dia do mês em que deve ser feito o fechamento/faturamento do cliente';