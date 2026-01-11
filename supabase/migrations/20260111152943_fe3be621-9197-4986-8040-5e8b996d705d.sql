-- Adicionar campos específicos para lavanderia industrial na tabela produtos
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS codigo text,
ADD COLUMN IF NOT EXISTS peso_medio_kg numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tempo_processo_min integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS processo_lavagem text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS temperatura_maxima integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS requer_secadora boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS cor text DEFAULT 'branco',
ADD COLUMN IF NOT EXISTS composicao text DEFAULT 'algodao',
ADD COLUMN IF NOT EXISTS instrucoes_especiais text;

-- Criar índice para busca por código
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON public.produtos(codigo);

-- Criar índice para categoria
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(categoria);

-- Criar índice para processo de lavagem
CREATE INDEX IF NOT EXISTS idx_produtos_processo ON public.produtos(processo_lavagem);