-- Criar tabela para lançamentos feitos pelo cliente no portal
CREATE TABLE public.lancamentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  ordem_servico_id UUID,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'conferido', 'divergente')),
  data_lancamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela para itens do lançamento do cliente
CREATE TABLE public.itens_lancamento_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.lancamentos_cliente(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL,
  quantidade INTEGER NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS com políticas públicas (acesso pelo código do portal)
ALTER TABLE public.lancamentos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_lancamento_cliente ENABLE ROW LEVEL SECURITY;

-- Políticas para lancamentos_cliente
CREATE POLICY "Allow all on lancamentos_cliente" 
ON public.lancamentos_cliente FOR ALL USING (true) WITH CHECK (true);

-- Políticas para itens_lancamento_cliente
CREATE POLICY "Allow all on itens_lancamento_cliente" 
ON public.itens_lancamento_cliente FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_lancamentos_cliente_updated_at
BEFORE UPDATE ON public.lancamentos_cliente
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();