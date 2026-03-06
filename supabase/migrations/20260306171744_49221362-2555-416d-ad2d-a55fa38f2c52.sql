
-- Add recurring payment fields to fornecedores
ALTER TABLE public.fornecedores 
  ADD COLUMN valor_recorrente NUMERIC DEFAULT NULL,
  ADD COLUMN dia_vencimento INTEGER DEFAULT NULL,
  ADD COLUMN frequencia_pagamento TEXT DEFAULT 'mensal';

-- Add fornecedor_id FK to contas_pagar
ALTER TABLE public.contas_pagar 
  ADD COLUMN fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL DEFAULT NULL;
