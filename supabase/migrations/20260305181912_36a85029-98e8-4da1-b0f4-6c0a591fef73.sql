
-- Tabela fornecedores
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  razao_social text,
  cnpj_cpf text,
  telefone text,
  email text,
  contato_nome text,
  endereco jsonb DEFAULT '{}'::jsonb,
  categoria text DEFAULT 'outros',
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela estoque_produtos
CREATE TABLE public.estoque_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text DEFAULT 'outros',
  unidade text DEFAULT 'unidade',
  quantidade_atual numeric NOT NULL DEFAULT 0,
  quantidade_minima numeric NOT NULL DEFAULT 0,
  preco_custo numeric NOT NULL DEFAULT 0,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  localizacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela movimentacoes_estoque
CREATE TABLE public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estoque_produto_id uuid NOT NULL REFERENCES public.estoque_produtos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'entrada',
  quantidade numeric NOT NULL,
  motivo text,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  custo_unitario numeric DEFAULT 0,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS fornecedores
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select fornecedores" ON public.fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fornecedores" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fornecedores" ON public.fornecedores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fornecedores" ON public.fornecedores FOR DELETE TO authenticated USING (true);

-- RLS estoque_produtos
ALTER TABLE public.estoque_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select estoque_produtos" ON public.estoque_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert estoque_produtos" ON public.estoque_produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update estoque_produtos" ON public.estoque_produtos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete estoque_produtos" ON public.estoque_produtos FOR DELETE TO authenticated USING (true);

-- RLS movimentacoes_estoque
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select movimentacoes_estoque" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert movimentacoes_estoque" ON public.movimentacoes_estoque FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update movimentacoes_estoque" ON public.movimentacoes_estoque FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete movimentacoes_estoque" ON public.movimentacoes_estoque FOR DELETE TO authenticated USING (true);

-- Triggers updated_at
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_estoque_produtos_updated_at BEFORE UPDATE ON public.estoque_produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
