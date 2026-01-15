-- Adicionar colunas para detalhes do item na tabela itens_ordem_servico
ALTER TABLE public.itens_ordem_servico
ADD COLUMN cor_item TEXT,
ADD COLUMN marca_item TEXT,
ADD COLUMN avarias TEXT,
ADD COLUMN posicao_prateleira TEXT;

-- Comentários para documentação
COMMENT ON COLUMN public.itens_ordem_servico.cor_item IS 'Cor específica da peça do cliente';
COMMENT ON COLUMN public.itens_ordem_servico.marca_item IS 'Marca da peça do cliente';
COMMENT ON COLUMN public.itens_ordem_servico.avarias IS 'Descrição de danos ou avarias identificadas na entrada';
COMMENT ON COLUMN public.itens_ordem_servico.posicao_prateleira IS 'Localização da peça após finalização do processo';