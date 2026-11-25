\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS cobranca_reservada_em timestamptz, ADD COLUMN IF NOT EXISTS cobranca_reserva_vencimento date, ADD COLUMN boleto_url text, ADD COLUMN boleto_linha_digitavel text, ADD COLUMN forma_pagamento text, ADD COLUMN data_vencimento date;
ALTER TABLE public.asaas_charges ADD COLUMN cliente_id uuid, ADD COLUMN due_date date, ADD COLUMN bank_slip_url text, ADD COLUMN paid_at timestamptz;
CREATE TABLE public.configuracoes_pagamento_cliente(tenant_id uuid,cliente_id uuid,forma_pagamento text,condicao_pagamento text);
