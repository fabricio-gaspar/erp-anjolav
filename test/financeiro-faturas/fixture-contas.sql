\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
ALTER TABLE public.faturas ADD COLUMN numero_nf text, ADD COLUMN categoria_id uuid, ADD COLUMN centro_custo_id uuid, ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE public.clientes ADD COLUMN classificacao text;
ALTER TABLE public.asaas_charges ADD COLUMN customer_name text, ADD COLUMN description text, ADD COLUMN categoria_id uuid, ADD COLUMN centro_custo_id uuid, ADD COLUMN created_at timestamptz DEFAULT now();
CREATE TABLE public.caixa_movimentacoes(id uuid,tenant_id uuid,tipo text,cliente_id uuid,descricao text,valor numeric,created_at timestamptz,categoria_id uuid,centro_custo_id uuid,ordem_servico_id uuid,pdv_pagamento_id uuid);
CREATE TABLE public.pdv_pagamentos(id uuid,tenant_id uuid,asaas_charge_id uuid);
CREATE TABLE public.centros_custo(id uuid,tenant_id uuid,nome text,tipo text);
CREATE TABLE public.categorias_financeiras(id uuid,tenant_id uuid,nome text,tipo text);
CREATE TABLE public.contratos_aluguel(id uuid,tenant_id uuid,cliente_id uuid,descricao text,valor_servico numeric,ativo boolean,created_at timestamptz);
