
-- 1. Configuração da instância WhatsApp (Evolution API)
CREATE TABLE public.whatsapp_instancias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_instancia TEXT NOT NULL DEFAULT 'loja1',
  api_url TEXT,
  api_key_encrypted TEXT,
  webhook_n8n_url TEXT,
  status TEXT NOT NULL DEFAULT 'desconectado',
  qr_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select whatsapp_instancias" ON public.whatsapp_instancias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert whatsapp_instancias" ON public.whatsapp_instancias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update whatsapp_instancias" ON public.whatsapp_instancias FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete whatsapp_instancias" ON public.whatsapp_instancias FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_whatsapp_instancias_updated_at BEFORE UPDATE ON public.whatsapp_instancias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Log de mensagens enviadas via WhatsApp
CREATE TABLE public.mensagens_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  evento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  erro TEXT,
  canal TEXT NOT NULL DEFAULT 'wa.me',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select mensagens_log" ON public.mensagens_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert mensagens_log" ON public.mensagens_log FOR INSERT TO authenticated WITH CHECK (true);
