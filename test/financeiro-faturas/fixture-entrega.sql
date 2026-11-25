\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
ALTER TABLE public.ordens_servico ADD COLUMN data_entrega date, ADD COLUMN status_logistica text;
ALTER TABLE public.pdv_pagamentos ADD COLUMN ordem_servico_id uuid, ADD COLUMN status text, ADD COLUMN valor numeric;
