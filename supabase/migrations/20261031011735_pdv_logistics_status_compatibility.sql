
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS status_logistica text NOT NULL DEFAULT 'nao_iniciada';

ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_status_logistica_check,
  ADD CONSTRAINT ordens_servico_status_logistica_check CHECK (
    status_logistica IN (
      'nao_iniciada', 'aguardando_coleta', 'coletado', 'aguardando_entrega',
      'em_rota', 'entrega_parcial', 'entregue', 'tentativa_falha', 'cancelada'
    )
  );

UPDATE public.ordens_servico
SET status_logistica = CASE
  WHEN status = 'entregue' THEN 'entregue'
  WHEN status = 'expedicao' THEN 'aguardando_entrega'
  WHEN status = 'cancelada' THEN 'cancelada'
  ELSE status_logistica
END;

NOTIFY pgrst, 'reload schema';
