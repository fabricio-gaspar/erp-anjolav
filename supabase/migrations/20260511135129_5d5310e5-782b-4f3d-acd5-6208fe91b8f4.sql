
-- 1. ALTER funcionarios — ficha completa
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS rg_orgao_emissor text,
  ADD COLUMN IF NOT EXISTS pis text,
  ADD COLUMN IF NOT EXISTS ctps_numero text,
  ADD COLUMN IF NOT EXISTS ctps_serie text,
  ADD COLUMN IF NOT EXISTS ctps_uf text,
  ADD COLUMN IF NOT EXISTS titulo_eleitor text,
  ADD COLUMN IF NOT EXISTS cnh_numero text,
  ADD COLUMN IF NOT EXISTS cnh_categoria text,
  ADD COLUMN IF NOT EXISTS cnh_validade date,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS genero text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS nacionalidade text DEFAULT 'Brasileira',
  ADD COLUMN IF NOT EXISTS naturalidade text,
  ADD COLUMN IF NOT EXISTS nome_mae text,
  ADD COLUMN IF NOT EXISTS nome_pai text,
  ADD COLUMN IF NOT EXISTS escolaridade text,
  ADD COLUMN IF NOT EXISTS endereco jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco text,
  ADD COLUMN IF NOT EXISTS data_demissao date,
  ADD COLUMN IF NOT EXISTS tipo_contrato text DEFAULT 'CLT',
  ADD COLUMN IF NOT EXISTS regime_jornada text DEFAULT 'mensalista',
  ADD COLUMN IF NOT EXISTS salario_base numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_hora numeric(12,2),
  ADD COLUMN IF NOT EXISTS vale_transporte numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_alimentacao numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vale_refeicao numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano_saude numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plano_odontologico numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_percentual numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gratificacao numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS periculosidade boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS insalubridade_percentual numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_inss_percentual numeric(5,2),
  ADD COLUMN IF NOT EXISTS desconto_vt_percentual numeric(5,2) DEFAULT 6,
  ADD COLUMN IF NOT EXISTS outros_descontos numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_beneficios numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banco_nome text,
  ADD COLUMN IF NOT EXISTS banco_agencia text,
  ADD COLUMN IF NOT EXISTS banco_conta text,
  ADD COLUMN IF NOT EXISTS banco_tipo_conta text,
  ADD COLUMN IF NOT EXISTS pix_chave text,
  ADD COLUMN IF NOT EXISTS pix_tipo_chave text,
  ADD COLUMN IF NOT EXISTS observacoes text;

-- 2. CREATE folha_pagamento
CREATE TABLE IF NOT EXISTS public.folha_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  salario_base numeric(12,2) NOT NULL DEFAULT 0,
  horas_extras numeric(12,2) NOT NULL DEFAULT 0,
  comissoes numeric(12,2) NOT NULL DEFAULT 0,
  gratificacao numeric(12,2) NOT NULL DEFAULT 0,
  vale_transporte numeric(12,2) NOT NULL DEFAULT 0,
  vale_alimentacao numeric(12,2) NOT NULL DEFAULT 0,
  vale_refeicao numeric(12,2) NOT NULL DEFAULT 0,
  plano_saude numeric(12,2) NOT NULL DEFAULT 0,
  plano_odontologico numeric(12,2) NOT NULL DEFAULT 0,
  outros_beneficios numeric(12,2) NOT NULL DEFAULT 0,
  desconto_inss numeric(12,2) NOT NULL DEFAULT 0,
  desconto_irrf numeric(12,2) NOT NULL DEFAULT 0,
  desconto_vt numeric(12,2) NOT NULL DEFAULT 0,
  outros_descontos numeric(12,2) NOT NULL DEFAULT 0,
  total_proventos numeric(12,2) NOT NULL DEFAULT 0,
  total_descontos numeric(12,2) NOT NULL DEFAULT 0,
  liquido numeric(12,2) NOT NULL DEFAULT 0,
  custo_total_empresa numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto',
  data_pagamento date,
  conta_pagar_id uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_folha_competencia ON public.folha_pagamento(competencia);
CREATE INDEX IF NOT EXISTS idx_folha_funcionario ON public.folha_pagamento(funcionario_id);

ALTER TABLE public.folha_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select folha_pagamento" ON public.folha_pagamento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert folha_pagamento" ON public.folha_pagamento
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update folha_pagamento" ON public.folha_pagamento
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete folha_pagamento" ON public.folha_pagamento
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_folha_pagamento_updated_at
  BEFORE UPDATE ON public.folha_pagamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
