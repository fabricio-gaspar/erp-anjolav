
-- =============================================
-- FIX: funcionarios - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow delete on funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Allow insert on funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Allow read access to funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Allow update on funcionarios" ON public.funcionarios;

CREATE POLICY "Authenticated can select funcionarios"
  ON public.funcionarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert funcionarios"
  ON public.funcionarios FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update funcionarios"
  ON public.funcionarios FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete funcionarios"
  ON public.funcionarios FOR DELETE
  TO authenticated
  USING (true);

-- =============================================
-- FIX: modulo_permissoes - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow read on modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Allow insert on modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Allow update on modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Allow delete on modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Authenticated can select modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Authenticated can insert modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Authenticated can update modulo_permissoes" ON public.modulo_permissoes;
DROP POLICY IF EXISTS "Authenticated can delete modulo_permissoes" ON public.modulo_permissoes;

CREATE POLICY "Authenticated can select modulo_permissoes"
  ON public.modulo_permissoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert modulo_permissoes"
  ON public.modulo_permissoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update modulo_permissoes"
  ON public.modulo_permissoes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete modulo_permissoes"
  ON public.modulo_permissoes FOR DELETE
  TO authenticated
  USING (true);

-- =============================================
-- FIX: etiquetas_configuracoes - restrict to authenticated
-- =============================================
DROP POLICY IF EXISTS "Allow insert on etiquetas_configuracoes" ON public.etiquetas_configuracoes;
DROP POLICY IF EXISTS "Allow read on etiquetas_configuracoes" ON public.etiquetas_configuracoes;
DROP POLICY IF EXISTS "Allow update on etiquetas_configuracoes" ON public.etiquetas_configuracoes;

CREATE POLICY "Authenticated can select etiquetas_configuracoes"
  ON public.etiquetas_configuracoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert etiquetas_configuracoes"
  ON public.etiquetas_configuracoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update etiquetas_configuracoes"
  ON public.etiquetas_configuracoes FOR UPDATE
  TO authenticated
  USING (true);
