ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS agendamento_id uuid;
CREATE INDEX IF NOT EXISTS idx_ordens_servico_agendamento_id ON public.ordens_servico(agendamento_id);