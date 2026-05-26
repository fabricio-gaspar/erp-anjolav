
-- =====================================================
-- FASE 1: Fundação Financeira ERP
-- =====================================================

-- 1. Tabela: categorias_financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  cor text DEFAULT 'slate',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, tipo)
);

GRANT SELECT ON public.categorias_financeiras TO authenticated;
GRANT ALL ON public.categorias_financeiras TO service_role;

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select categorias_financeiras"
  ON public.categorias_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert categorias_financeiras"
  ON public.categorias_financeiras FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update categorias_financeiras"
  ON public.categorias_financeiras FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete categorias_financeiras"
  ON public.categorias_financeiras FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_categorias_financeiras_updated
  BEFORE UPDATE ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela: centros_custo
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select centros_custo"
  ON public.centros_custo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert centros_custo"
  ON public.centros_custo FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update centros_custo"
  ON public.centros_custo FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete centros_custo"
  ON public.centros_custo FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_centros_custo_updated
  BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Seeds: centros de custo
INSERT INTO public.centros_custo (nome, descricao) VALUES
  ('Industrial', 'Operação industrial / lavanderia ID1'),
  ('Loja', 'PDV Loja / residencial ID2')
ON CONFLICT (nome) DO NOTHING;

-- 4. Seeds: categorias de despesa
INSERT INTO public.categorias_financeiras (nome, tipo, cor, ordem) VALUES
  ('Folha de Pagamento','despesa','red',10),
  ('Insumos / Produtos','despesa','orange',20),
  ('Utilidades','despesa','blue',30),
  ('Aluguel','despesa','purple',40),
  ('Manutenção','despesa','amber',50),
  ('Transporte','despesa','cyan',60),
  ('Impostos','despesa','rose',70),
  ('Marketing','despesa','pink',80),
  ('Serviços Terceiros','despesa','indigo',90),
  ('Outras Despesas','despesa','slate',999)
ON CONFLICT (nome, tipo) DO NOTHING;

-- 5. Seeds: categorias de receita
INSERT INTO public.categorias_financeiras (nome, tipo, cor, ordem) VALUES
  ('Faturamento Industrial','receita','emerald',10),
  ('Venda PDV Loja','receita','green',20),
  ('Cobrança Asaas','receita','teal',30),
  ('Aluguel / Contrato','receita','lime',40),
  ('Outras Receitas','receita','slate',999)
ON CONFLICT (nome, tipo) DO NOTHING;

-- 6. Extender contas_pagar
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_pago numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_categoria ON public.contas_pagar(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_centro_custo ON public.contas_pagar(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento ON public.contas_pagar(vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON public.contas_pagar(status);

-- 7. Backfill contas_pagar.categoria_id a partir do texto categoria
UPDATE public.contas_pagar cp
SET categoria_id = cf.id
FROM public.categorias_financeiras cf
WHERE cp.categoria_id IS NULL
  AND cf.tipo = 'despesa'
  AND lower(cp.categoria) IN (
    CASE cf.nome
      WHEN 'Folha de Pagamento' THEN lower(cp.categoria) END,
    CASE cf.nome
      WHEN 'Insumos / Produtos' THEN lower(cp.categoria) END
  ) -- placeholder; mapping below is the real one
  AND false;

-- Mapping textual -> categoria_id
WITH mapping AS (
  SELECT * FROM (VALUES
    ('folha_pagamento','Folha de Pagamento'),
    ('salarios','Folha de Pagamento'),
    ('salários','Folha de Pagamento'),
    ('produtos_insumos','Insumos / Produtos'),
    ('insumos','Insumos / Produtos'),
    ('produtos','Insumos / Produtos'),
    ('contas_mensais','Utilidades'),
    ('utilidades','Utilidades'),
    ('aluguel','Aluguel'),
    ('manutenção','Manutenção'),
    ('manutencao','Manutenção'),
    ('transporte','Transporte'),
    ('impostos','Impostos'),
    ('marketing','Marketing'),
    ('servicos_terceiros','Serviços Terceiros'),
    ('serviços terceiros','Serviços Terceiros')
  ) AS m(txt,nome)
)
UPDATE public.contas_pagar cp
SET categoria_id = cf.id
FROM mapping m
JOIN public.categorias_financeiras cf
  ON cf.nome = m.nome AND cf.tipo='despesa'
WHERE cp.categoria_id IS NULL
  AND lower(coalesce(cp.categoria,'')) = m.txt;

-- Fallback "Outras Despesas" para o restante
UPDATE public.contas_pagar cp
SET categoria_id = cf.id
FROM public.categorias_financeiras cf
WHERE cp.categoria_id IS NULL
  AND cf.nome = 'Outras Despesas' AND cf.tipo = 'despesa';

-- Default centro de custo Industrial em contas_pagar
UPDATE public.contas_pagar cp
SET centro_custo_id = cc.id
FROM public.centros_custo cc
WHERE cp.centro_custo_id IS NULL AND cc.nome = 'Industrial';

-- 8. Extender faturas
ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas(status);
CREATE INDEX IF NOT EXISTS idx_faturas_vencimento ON public.faturas(data_vencimento);

UPDATE public.faturas f
SET categoria_id = cf.id
FROM public.categorias_financeiras cf
WHERE f.categoria_id IS NULL AND cf.nome='Faturamento Industrial' AND cf.tipo='receita';

UPDATE public.faturas f
SET centro_custo_id = cc.id
FROM public.centros_custo cc
WHERE f.centro_custo_id IS NULL AND cc.nome='Industrial';

-- 9. Extender caixa_movimentacoes
ALTER TABLE public.caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

UPDATE public.caixa_movimentacoes cm
SET centro_custo_id = cc.id
FROM public.centros_custo cc
WHERE cm.centro_custo_id IS NULL AND cc.nome='Loja';

UPDATE public.caixa_movimentacoes cm
SET categoria_id = cf.id
FROM public.categorias_financeiras cf
WHERE cm.categoria_id IS NULL
  AND cm.tipo IN ('VENDA','venda')
  AND cf.nome='Venda PDV Loja' AND cf.tipo='receita';

-- 10. Extender asaas_charges
ALTER TABLE public.asaas_charges
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asaas_charges_cliente ON public.asaas_charges(cliente_id);

-- Backfill cliente_id por CPF/CNPJ (somente dígitos)
UPDATE public.asaas_charges ac
SET cliente_id = c.id
FROM public.clientes c
WHERE ac.cliente_id IS NULL
  AND ac.customer_cpf_cnpj IS NOT NULL
  AND regexp_replace(coalesce(ac.customer_cpf_cnpj,''),'[^0-9]','','g')
    = regexp_replace(coalesce(c.cpf_cnpj,''),'[^0-9]','','g')
  AND length(regexp_replace(coalesce(c.cpf_cnpj,''),'[^0-9]','','g')) > 0;

UPDATE public.asaas_charges ac
SET categoria_id = cf.id
FROM public.categorias_financeiras cf
WHERE ac.categoria_id IS NULL AND cf.nome='Cobrança Asaas' AND cf.tipo='receita';

UPDATE public.asaas_charges ac
SET centro_custo_id = cc.id
FROM public.centros_custo cc
WHERE ac.centro_custo_id IS NULL AND cc.nome='Industrial';

-- 11. View unificada: v_contas_receber
DROP VIEW IF EXISTS public.v_contas_receber CASCADE;
CREATE VIEW public.v_contas_receber
WITH (security_invoker = true) AS
-- Faturas industriais
SELECT
  f.id,
  'fatura'::text AS origem,
  f.cliente_id,
  c.razao_social AS cliente_nome,
  coalesce(f.numero_nf, 'Fatura ' || substr(f.id::text,1,8)) AS descricao,
  f.valor_total AS valor,
  CASE WHEN f.status = 'pago' THEN f.valor_total ELSE 0 END AS valor_recebido,
  coalesce(f.data_vencimento, f.periodo_fim) AS data_vencimento,
  CASE WHEN f.status = 'pago' THEN coalesce(f.data_emissao_nf, f.updated_at)::date ELSE NULL END AS data_recebimento,
  lower(f.status) AS status,
  f.categoria_id,
  f.centro_custo_id,
  f.created_at
FROM public.faturas f
LEFT JOIN public.clientes c ON c.id = f.cliente_id
UNION ALL
-- Vendas PDV Loja
SELECT
  cm.id,
  'pdv_loja'::text AS origem,
  cm.cliente_id,
  coalesce(cl.razao_social, 'Venda Balcão') AS cliente_nome,
  coalesce(cm.descricao, 'Venda PDV') AS descricao,
  cm.valor,
  cm.valor AS valor_recebido,
  cm.created_at::date AS data_vencimento,
  cm.created_at::date AS data_recebimento,
  'recebido'::text AS status,
  cm.categoria_id,
  cm.centro_custo_id,
  cm.created_at
FROM public.caixa_movimentacoes cm
LEFT JOIN public.clientes cl ON cl.id = cm.cliente_id
WHERE upper(cm.tipo) = 'VENDA'
UNION ALL
-- Cobranças Asaas
SELECT
  ac.id,
  'asaas'::text AS origem,
  ac.cliente_id,
  ac.customer_name AS cliente_nome,
  ac.description AS descricao,
  ac.value AS valor,
  CASE WHEN ac.status IN ('RECEIVED','CONFIRMED') THEN ac.value ELSE 0 END AS valor_recebido,
  ac.due_date AS data_vencimento,
  ac.paid_at::date AS data_recebimento,
  CASE ac.status
    WHEN 'RECEIVED' THEN 'recebido'
    WHEN 'CONFIRMED' THEN 'recebido'
    WHEN 'OVERDUE' THEN 'atrasado'
    WHEN 'PENDING' THEN 'pendente'
    ELSE lower(ac.status)
  END AS status,
  ac.categoria_id,
  ac.centro_custo_id,
  ac.created_at
FROM public.asaas_charges ac
UNION ALL
-- Contratos de aluguel (recorrência mensal — apresentado como pendente do mês corrente)
SELECT
  ct.id,
  'contrato'::text AS origem,
  ct.cliente_id,
  c.razao_social AS cliente_nome,
  ct.descricao,
  ct.valor_servico AS valor,
  0::numeric AS valor_recebido,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date AS data_vencimento,
  NULL::date AS data_recebimento,
  'pendente'::text AS status,
  (SELECT id FROM public.categorias_financeiras WHERE nome='Aluguel / Contrato' AND tipo='receita' LIMIT 1) AS categoria_id,
  (SELECT id FROM public.centros_custo WHERE nome='Industrial' LIMIT 1) AS centro_custo_id,
  ct.created_at
FROM public.contratos_aluguel ct
LEFT JOIN public.clientes c ON c.id = ct.cliente_id
WHERE ct.ativo = true;

GRANT SELECT ON public.v_contas_receber TO authenticated;

-- 12. View unificada: v_fluxo_caixa
DROP VIEW IF EXISTS public.v_fluxo_caixa CASCADE;
CREATE VIEW public.v_fluxo_caixa
WITH (security_invoker = true) AS
-- Receitas (apenas recebidas / liquidadas)
SELECT
  ('R-' || vr.id::text) AS id,
  vr.origem AS origem,
  'receita'::text AS tipo,
  vr.descricao,
  vr.valor_recebido AS valor,
  coalesce(vr.data_recebimento, vr.data_vencimento) AS data,
  vr.categoria_id,
  vr.centro_custo_id,
  vr.cliente_id,
  NULL::uuid AS fornecedor_id
FROM public.v_contas_receber vr
WHERE vr.valor_recebido > 0
UNION ALL
-- Despesas pagas
SELECT
  ('P-' || cp.id::text) AS id,
  'conta_pagar'::text AS origem,
  'despesa'::text AS tipo,
  cp.descricao,
  CASE WHEN cp.valor_pago > 0 THEN cp.valor_pago ELSE cp.valor END AS valor,
  coalesce(cp.data_pagamento, cp.vencimento) AS data,
  cp.categoria_id,
  cp.centro_custo_id,
  NULL::uuid AS cliente_id,
  cp.fornecedor_id
FROM public.contas_pagar cp
WHERE cp.status IN ('pago','parcial');

GRANT SELECT ON public.v_fluxo_caixa TO authenticated;
