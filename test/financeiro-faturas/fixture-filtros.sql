\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
ALTER TABLE public.faturas ADD COLUMN link_pdf_nf text, ADD COLUMN protocolo_nfse text, ADD COLUMN data_envio timestamptz, ADD COLUMN configuracao_fiscal_id uuid, ADD COLUMN nfse_status text;
CREATE TABLE public.nfse_documentos(id uuid,fatura_id uuid,tenant_id uuid,status text,ambiente text,numero text,chave_acesso text,protocolo text,tentativas integer,autorizado_em timestamptz,cancelado_em timestamptz,erros jsonb);
CREATE TABLE public.configuracoes_fiscais(id uuid,tenant_id uuid,nome text,cnpj text,ambiente text,credencial_status text,operation_type text);
GRANT SELECT ON public.nfse_documentos,public.configuracoes_fiscais,public.configuracoes_pagamento_cliente TO authenticated;
