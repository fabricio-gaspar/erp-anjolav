
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS empregador_cnpj text,
  ADD COLUMN IF NOT EXISTS empregador_nome text,
  ADD COLUMN IF NOT EXISTS codigo_externo text,
  ADD COLUMN IF NOT EXISTS cbo text,
  ADD COLUMN IF NOT EXISTS matricula_inss text,
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS filial text;

ALTER TABLE public.folha_pagamento
  ADD COLUMN IF NOT EXISTS reflexo_dsr numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_extras_50 numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_extras_70 numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_extras_100 numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adiantamento_salarial numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_emprestimo numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_cesta_basica numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contribuicao_assistencial numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS troco_mes numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS troco_mes_anterior numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estorno_provisao numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_fgts numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_fgts numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_irrf numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faixa_irrf numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salario_contrib_inss numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_trabalhados numeric(5,2) DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_funcionarios_empregador_cnpj ON public.funcionarios(empregador_cnpj);
