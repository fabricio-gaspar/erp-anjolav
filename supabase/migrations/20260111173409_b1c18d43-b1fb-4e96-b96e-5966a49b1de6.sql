-- Tabela de Lançamentos
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_entrega DATE,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  valor_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Itens do Lançamento
CREATE TABLE itens_lancamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'un',
  preco_unitario NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de relacionamento Lançamentos-Fatura
CREATE TABLE lancamentos_fatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  fatura_id UUID NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lancamento_id, fatura_id)
);

-- RLS
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_fatura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for lancamentos" ON lancamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for itens_lancamento" ON itens_lancamento FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for lancamentos_fatura" ON lancamentos_fatura FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_lancamentos_updated_at
  BEFORE UPDATE ON lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();