-- Create table for module permissions
CREATE TABLE public.modulo_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE NOT NULL,
  modulo_key TEXT NOT NULL,
  tem_acesso BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(funcionario_id, modulo_key)
);

-- Enable RLS
ALTER TABLE public.modulo_permissoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read on modulo_permissoes"
  ON public.modulo_permissoes FOR SELECT
  USING (true);

CREATE POLICY "Allow insert on modulo_permissoes"
  ON public.modulo_permissoes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update on modulo_permissoes"
  ON public.modulo_permissoes FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete on modulo_permissoes"
  ON public.modulo_permissoes FOR DELETE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_modulo_permissoes_updated_at
  BEFORE UPDATE ON public.modulo_permissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();