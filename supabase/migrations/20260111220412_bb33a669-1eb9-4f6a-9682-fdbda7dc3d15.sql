-- Tabela principal de contratos de aluguel
CREATE TABLE public.contratos_aluguel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL DEFAULT 'Contrato de Aluguel',
  valor_servico NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens do contrato de aluguel
CREATE TABLE public.itens_contrato_aluguel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos_aluguel(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao_item TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contratos_cliente ON public.contratos_aluguel(cliente_id);
CREATE INDEX idx_contratos_ativo ON public.contratos_aluguel(ativo) WHERE ativo = true;
CREATE INDEX idx_itens_contrato ON public.itens_contrato_aluguel(contrato_id);

-- Habilitar RLS
ALTER TABLE public.contratos_aluguel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_contrato_aluguel ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow all for contratos_aluguel" ON public.contratos_aluguel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for itens_contrato_aluguel" ON public.itens_contrato_aluguel FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contratos_aluguel_updated_at
  BEFORE UPDATE ON public.contratos_aluguel
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();