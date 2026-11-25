ALTER TABLE public.configuracoes_gerais
  ADD COLUMN IF NOT EXISTS pdv_template_theme text NOT NULL DEFAULT 'oceano';

ALTER TABLE public.configuracoes_gerais
  DROP CONSTRAINT IF EXISTS configuracoes_gerais_pdv_template_theme_check;

ALTER TABLE public.configuracoes_gerais
  ADD CONSTRAINT configuracoes_gerais_pdv_template_theme_check
  CHECK (pdv_template_theme IN ('oceano', 'esmeralda', 'indigo', 'grafite', 'vinho'));
