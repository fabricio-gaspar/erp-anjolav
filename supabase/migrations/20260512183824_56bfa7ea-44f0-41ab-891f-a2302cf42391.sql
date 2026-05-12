
DROP POLICY IF EXISTS "Authenticated can select funcionarios" ON public.funcionarios;

CREATE POLICY "Admins or self can select funcionarios"
ON public.funcionarios FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR user_id = auth.uid()
);
