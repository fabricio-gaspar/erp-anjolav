
-- 1. Orçamentos formais
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  itens_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  validade DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_orcamentos_updated_at BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Log de notificações enviadas
CREATE TABLE public.notificacoes_enviadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_enviadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select notificacoes_enviadas" ON public.notificacoes_enviadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert notificacoes_enviadas" ON public.notificacoes_enviadas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete notificacoes_enviadas" ON public.notificacoes_enviadas FOR DELETE TO authenticated USING (true);

-- 3. Lotes de produção
CREATE TABLE public.lotes_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_lote TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto',
  etapa_atual TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lotes_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select lotes_producao" ON public.lotes_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert lotes_producao" ON public.lotes_producao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update lotes_producao" ON public.lotes_producao FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete lotes_producao" ON public.lotes_producao FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_lotes_producao_updated_at BEFORE UPDATE ON public.lotes_producao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar número do lote automaticamente
CREATE OR REPLACE FUNCTION public.generate_lote_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero_lote FROM 7) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.lotes_producao
  WHERE numero_lote LIKE 'L-' || year_prefix || '-%';
  NEW.numero_lote := 'L-' || year_prefix || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_generate_lote_number BEFORE INSERT ON public.lotes_producao FOR EACH ROW EXECUTE FUNCTION public.generate_lote_number();

-- 4. Vinculação lote <-> OS
CREATE TABLE public.lotes_ordens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID NOT NULL REFERENCES public.lotes_producao(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lote_id, ordem_servico_id)
);

ALTER TABLE public.lotes_ordens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select lotes_ordens" ON public.lotes_ordens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert lotes_ordens" ON public.lotes_ordens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete lotes_ordens" ON public.lotes_ordens FOR DELETE TO authenticated USING (true);
