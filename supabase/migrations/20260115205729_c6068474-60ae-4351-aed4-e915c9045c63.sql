-- Drop the existing check constraint
ALTER TABLE public.faturas DROP CONSTRAINT IF EXISTS faturas_status_check;

-- Add updated check constraint with all valid status values
ALTER TABLE public.faturas ADD CONSTRAINT faturas_status_check 
CHECK (status = ANY (ARRAY['pendente'::text, 'relatorio_gerado'::text, 'nota_emitida'::text, 'pagamento_configurado'::text, 'enviada'::text, 'faturado'::text, 'pago'::text, 'cancelado'::text]));