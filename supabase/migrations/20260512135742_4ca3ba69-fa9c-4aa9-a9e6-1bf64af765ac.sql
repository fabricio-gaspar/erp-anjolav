CREATE TABLE IF NOT EXISTS public.beneficios_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cor text NOT NULL DEFAULT 'slate',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficios_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select beneficios_catalogo"
  ON public.beneficios_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert beneficios_catalogo"
  ON public.beneficios_catalogo FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update beneficios_catalogo"
  ON public.beneficios_catalogo FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete beneficios_catalogo"
  ON public.beneficios_catalogo FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_beneficios_catalogo_updated_at
  BEFORE UPDATE ON public.beneficios_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.beneficios_catalogo (nome, cor, ordem) VALUES
  ('Vale Transporte', 'blue', 1),
  ('Vale Alimentação', 'green', 2),
  ('Vale Refeição', 'orange', 3),
  ('Plano de Saúde', 'rose', 4),
  ('Plano Odontológico', 'cyan', 5),
  ('Cesta Básica', 'amber', 6),
  ('Bonificação', 'purple', 7),
  ('Outros', 'slate', 8)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.folha_beneficios
  ADD COLUMN IF NOT EXISTS beneficio_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS folha_beneficios_folha_beneficio_unique
  ON public.folha_beneficios (folha_id, beneficio_id)
  WHERE beneficio_id IS NOT NULL;