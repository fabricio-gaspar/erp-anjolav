-- Create table for ROL configurations
CREATE TABLE public.rol_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identidade Visual
  nome_curto TEXT NOT NULL DEFAULT 'AnjoLav',
  slogan TEXT DEFAULT 'Sistema de Gestão de Lavanderia',
  nome_completo TEXT DEFAULT 'ANJOLAV SERVIÇOS DE LAVANDERIA',
  cor_primaria TEXT DEFAULT '#3c62f6',
  cor_secundaria TEXT DEFAULT '#2583eb',
  
  -- Dados de Contato
  telefone TEXT,
  email TEXT,
  cnpj TEXT,
  endereco TEXT,
  
  -- Logomarca
  exibir_logo BOOLEAN DEFAULT true,
  logo_url TEXT,
  
  -- Impressão
  largura_papel TEXT DEFAULT '80mm',
  tipo_impressora TEXT DEFAULT 'termica',
  margem_superior INTEGER DEFAULT 10,
  margem_lateral INTEGER DEFAULT 8,
  
  -- Tipografia
  fonte_principal TEXT DEFAULT 'courier',
  tamanho_nome INTEGER DEFAULT 14,
  tamanho_item INTEGER DEFAULT 11,
  tamanho_total INTEGER DEFAULT 14,
  
  -- Elementos do ROL
  previsao_entrega BOOLEAN DEFAULT true,
  bloco BOOLEAN DEFAULT false,
  observacoes BOOLEAN DEFAULT true,
  assinatura_cliente BOOLEAN DEFAULT true,
  tipo_preco BOOLEAN DEFAULT true,
  linha_desconto BOOLEAN DEFAULT true,
  texto_rodape TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.rol_configuracoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read on rol_configuracoes"
  ON public.rol_configuracoes FOR SELECT USING (true);

CREATE POLICY "Allow insert on rol_configuracoes"
  ON public.rol_configuracoes FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on rol_configuracoes"
  ON public.rol_configuracoes FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_rol_configuracoes_updated_at
  BEFORE UPDATE ON public.rol_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true);

-- Storage policies for company assets
CREATE POLICY "Public read access for company-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-assets');

CREATE POLICY "Allow upload to company-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Allow update on company-assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'company-assets');

CREATE POLICY "Allow delete on company-assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'company-assets');

-- Insert default config
INSERT INTO public.rol_configuracoes (id) VALUES (gen_random_uuid());