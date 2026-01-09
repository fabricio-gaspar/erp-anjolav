-- Create table for cash registers (caixas)
CREATE TABLE public.caixas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operador TEXT NOT NULL,
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fechamento TIMESTAMP WITH TIME ZONE,
  valor_abertura NUMERIC NOT NULL DEFAULT 0,
  valor_vendas NUMERIC NOT NULL DEFAULT 0,
  valor_sangrias NUMERIC NOT NULL DEFAULT 0,
  valor_reforcos NUMERIC NOT NULL DEFAULT 0,
  valor_esperado NUMERIC NOT NULL DEFAULT 0,
  valor_contado NUMERIC,
  diferenca NUMERIC,
  status TEXT NOT NULL DEFAULT 'ABERTO',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for cash register transactions
CREATE TABLE public.caixa_movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caixa_id UUID NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'VENDA', 'SANGRIA', 'REFORCO'
  valor NUMERIC NOT NULL,
  descricao TEXT,
  forma_pagamento TEXT, -- 'DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Create policies for caixas
CREATE POLICY "Allow all operations on caixas" 
ON public.caixas 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create policies for caixa_movimentacoes
CREATE POLICY "Allow all operations on caixa_movimentacoes" 
ON public.caixa_movimentacoes 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates on caixas
CREATE TRIGGER update_caixas_updated_at
BEFORE UPDATE ON public.caixas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();