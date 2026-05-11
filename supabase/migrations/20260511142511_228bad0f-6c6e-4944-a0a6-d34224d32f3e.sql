
CREATE TABLE public.folha_beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folha_id uuid NOT NULL REFERENCES public.folha_pagamento(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL,
  nome text NOT NULL,
  categoria text DEFAULT 'beneficio',
  tipo text NOT NULL DEFAULT 'beneficio',
  valor numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_folha_beneficios_folha ON public.folha_beneficios(folha_id);
CREATE INDEX idx_folha_beneficios_func ON public.folha_beneficios(funcionario_id);

ALTER TABLE public.folha_beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select folha_beneficios"
  ON public.folha_beneficios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert folha_beneficios"
  ON public.folha_beneficios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update folha_beneficios"
  ON public.folha_beneficios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete folha_beneficios"
  ON public.folha_beneficios FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_folha_beneficios_updated
  BEFORE UPDATE ON public.folha_beneficios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
