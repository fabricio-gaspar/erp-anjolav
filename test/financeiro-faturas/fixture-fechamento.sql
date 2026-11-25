\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'financeiro_teste' THEN RAISE EXCEPTION 'Use somente banco descartável financeiro_teste'; END IF; END $$;
ALTER TABLE public.faturas ALTER COLUMN id SET DEFAULT gen_random_uuid();
CREATE TYPE public.operation_type AS ENUM ('domestico','industrial');
ALTER TABLE public.faturas ADD COLUMN operation_type public.operation_type;
ALTER TABLE public.faturas ADD CONSTRAINT faturas_operation_type_required CHECK (operation_type IS NOT NULL) NOT VALID;
ALTER TABLE public.faturas ADD COLUMN periodo_inicio date, ADD COLUMN periodo_fim date, ADD COLUMN relatorio_gerado boolean, ADD COLUMN relatorio_data timestamptz, ADD COLUMN tipo_relatorio text, ADD COLUMN itens_snapshot jsonb, ADD COLUMN snapshot_cliente jsonb, ADD COLUMN observacao_fatura text, ADD COLUMN billing_idempotency_key text, ADD COLUMN fechamento_aprovado_em timestamptz, ADD COLUMN fechamento_aprovado_por uuid;
ALTER TABLE public.ordens_servico ADD COLUMN taxa_entrega numeric DEFAULT 0;
ALTER TABLE public.lancamentos ADD COLUMN status text;
CREATE TABLE public.clientes(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,razao_social text,cpf_cnpj text,email text,telefone text,ativo boolean);
CREATE TABLE public.configuracoes_cliente(cliente_id uuid,tenant_id uuid,tipo_relatorio text);
CREATE TABLE public.itens_lancamento(id uuid PRIMARY KEY,tenant_id uuid,lancamento_id uuid,produto_nome text,quantidade numeric,unidade text,preco_unitario numeric,subtotal numeric);
GRANT SELECT,INSERT,UPDATE ON public.faturas,public.lancamentos,public.ordens_servico,public.lancamentos_fatura TO authenticated;
GRANT SELECT,UPDATE ON public.clientes TO authenticated;
GRANT SELECT ON public.configuracoes_cliente,public.itens_lancamento TO authenticated;
