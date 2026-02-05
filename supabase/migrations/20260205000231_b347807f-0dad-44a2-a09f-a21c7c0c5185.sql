-- Adicionar campos de configuração fiscal padrão na tabela configuracoes_pagamento_cliente
ALTER TABLE public.configuracoes_pagamento_cliente 
ADD COLUMN IF NOT EXISTS cnpj_emissor_id uuid REFERENCES public.configuracoes_fiscais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS descricao_nf_id uuid REFERENCES public.descricoes_servicos_fiscais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS listar_itens_detalhados boolean DEFAULT true;