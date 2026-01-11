-- Adicionar campos de endereço da empresa em configuracoes_gerais
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_cidade TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_uf TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_latitude DOUBLE PRECISION;
ALTER TABLE public.configuracoes_gerais ADD COLUMN IF NOT EXISTS endereco_longitude DOUBLE PRECISION;