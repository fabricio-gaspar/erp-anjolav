ALTER TABLE public.fidelidade_configuracoes
  ADD COLUMN IF NOT EXISTS portal_exibir_fidelidade boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fidelidade_configuracoes.portal_exibir_fidelidade IS
  'Permite exibir a fidelidade no Portal do Cliente; não controla a impressão da ROL.';
