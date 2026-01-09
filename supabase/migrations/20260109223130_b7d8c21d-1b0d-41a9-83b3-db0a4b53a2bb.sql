-- Tabela para armazenar cobranças do Asaas
CREATE TABLE IF NOT EXISTS public.asaas_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_cpf_cnpj TEXT,
  description TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('BOLETO', 'PIX', 'BOLETO_PIX')),
  status TEXT NOT NULL DEFAULT 'PENDING',
  invoice_url TEXT,
  bank_slip_url TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Tabela para armazenar eventos de webhook
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  payment_id TEXT,
  charge_id UUID REFERENCES public.asaas_charges(id),
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asaas_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies for asaas_charges
CREATE POLICY "Allow all operations on asaas_charges" 
ON public.asaas_charges 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Policies for webhook events
CREATE POLICY "Allow all operations on asaas_webhook_events" 
ON public.asaas_webhook_events 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for updated_at
CREATE TRIGGER update_asaas_charges_updated_at
BEFORE UPDATE ON public.asaas_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();