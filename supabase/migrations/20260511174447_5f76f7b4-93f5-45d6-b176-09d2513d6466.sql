
-- Onda 1.4: Endurecer policies sensíveis (admin-only para writes)
-- Tabelas: funcionarios, folha_pagamento, folha_beneficios, modulo_permissoes,
--         configuracoes_fiscais, configuracoes_gerais, automacoes_config

-- FUNCIONARIOS
DROP POLICY IF EXISTS "Authenticated can insert funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Authenticated can update funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Authenticated can delete funcionarios" ON public.funcionarios;

CREATE POLICY "Admins can insert funcionarios" ON public.funcionarios
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update funcionarios" ON public.funcionarios
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete funcionarios" ON public.funcionarios
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- FOLHA_PAGAMENTO
DROP POLICY IF EXISTS "Authenticated can insert folha_pagamento" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Authenticated can update folha_pagamento" ON public.folha_pagamento;
DROP POLICY IF EXISTS "Authenticated can delete folha_pagamento" ON public.folha_pagamento;

CREATE POLICY "Admins can insert folha_pagamento" ON public.folha_pagamento
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update folha_pagamento" ON public.folha_pagamento
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete folha_pagamento" ON public.folha_pagamento
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- FOLHA_BENEFICIOS
DROP POLICY IF EXISTS "Authenticated can insert folha_beneficios" ON public.folha_beneficios;
DROP POLICY IF EXISTS "Authenticated can update folha_beneficios" ON public.folha_beneficios;
DROP POLICY IF EXISTS "Authenticated can delete folha_beneficios" ON public.folha_beneficios;

CREATE POLICY "Admins can insert folha_beneficios" ON public.folha_beneficios
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update folha_beneficios" ON public.folha_beneficios
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete folha_beneficios" ON public.folha_beneficios
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- MODULO_PERMISSOES
DROP POLICY IF EXISTS "Authenticated can insert modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Authenticated can update modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Authenticated can delete modulo_permissoes" ON public.modulo_permissoes;

CREATE POLICY "Admins can insert modulo_permissoes" ON public.modulo_permissoes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update modulo_permissoes" ON public.modulo_permissoes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete modulo_permissoes" ON public.modulo_permissoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- CONFIGURACOES_FISCAIS
DROP POLICY IF EXISTS "Authenticated can insert configuracoes_fiscais" ON public.configuracoes_fiscais;
DROP POLICY IF EXISTS "Authenticated can update configuracoes_fiscais" ON public.configuracoes_fiscais;
DROP POLICY IF EXISTS "Authenticated can delete configuracoes_fiscais" ON public.configuracoes_fiscais;

CREATE POLICY "Admins can insert configuracoes_fiscais" ON public.configuracoes_fiscais
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update configuracoes_fiscais" ON public.configuracoes_fiscais
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete configuracoes_fiscais" ON public.configuracoes_fiscais
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- CONFIGURACOES_GERAIS
DROP POLICY IF EXISTS "Authenticated can insert configuracoes_gerais" ON public.configuracoes_gerais;
DROP POLICY IF EXISTS "Authenticated can update configuracoes_gerais" ON public.configuracoes_gerais;
DROP POLICY IF EXISTS "Authenticated can delete configuracoes_gerais" ON public.configuracoes_gerais;

CREATE POLICY "Admins can insert configuracoes_gerais" ON public.configuracoes_gerais
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update configuracoes_gerais" ON public.configuracoes_gerais
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete configuracoes_gerais" ON public.configuracoes_gerais
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- AUTOMACOES_CONFIG
DROP POLICY IF EXISTS "Authenticated can insert automacoes_config" ON public.automacoes_config;
DROP POLICY IF EXISTS "Authenticated can update automacoes_config" ON public.automacoes_config;
DROP POLICY IF EXISTS "Authenticated can delete automacoes_config" ON public.automacoes_config;

CREATE POLICY "Admins can insert automacoes_config" ON public.automacoes_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update automacoes_config" ON public.automacoes_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete automacoes_config" ON public.automacoes_config
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
