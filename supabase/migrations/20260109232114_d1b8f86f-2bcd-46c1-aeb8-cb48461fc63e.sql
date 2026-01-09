-- Create table for etiquetas configurations
CREATE TABLE public.etiquetas_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_impressora TEXT DEFAULT 'elgin-l42-pro',
  tipo_impressora TEXT DEFAULT 'termica-etiquetas',
  tamanho_etiqueta TEXT DEFAULT '10x15',
  margem_superior INTEGER DEFAULT 5,
  margem_lateral INTEGER DEFAULT 5,
  tamanho_fonte INTEGER DEFAULT 12,
  altura_codigo_barras INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.etiquetas_configuracoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read on etiquetas_configuracoes"
  ON public.etiquetas_configuracoes FOR SELECT USING (true);

CREATE POLICY "Allow insert on etiquetas_configuracoes"
  ON public.etiquetas_configuracoes FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on etiquetas_configuracoes"
  ON public.etiquetas_configuracoes FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_etiquetas_configuracoes_updated_at
  BEFORE UPDATE ON public.etiquetas_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config
INSERT INTO public.etiquetas_configuracoes (id) VALUES (gen_random_uuid());