-- Create production history table
CREATE TABLE public.historico_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  etapa_anterior TEXT,
  etapa_nova TEXT NOT NULL,
  funcionario_id UUID REFERENCES public.funcionarios(id),
  observacoes TEXT,
  dados_formulario JSONB DEFAULT '{}',
  tempo_na_etapa_anterior INTERVAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.historico_producao ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow all on historico_producao" ON public.historico_producao
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_historico_producao_ordem ON public.historico_producao(ordem_servico_id);
CREATE INDEX idx_historico_producao_etapa ON public.historico_producao(etapa_nova);
CREATE INDEX idx_historico_producao_created ON public.historico_producao(created_at DESC);

-- Add trigger for ordens_servico to auto-register history on status change
CREATE OR REPLACE FUNCTION public.registrar_historico_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.historico_producao (ordem_servico_id, etapa_anterior, etapa_nova, tempo_na_etapa_anterior)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      (now() - COALESCE(
        (SELECT created_at FROM public.historico_producao 
         WHERE ordem_servico_id = NEW.id 
         ORDER BY created_at DESC LIMIT 1),
        OLD.updated_at
      ))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER on_status_change
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_historico_status();