
-- ===== Storage: certificates (fix inverted anon → admin only) =====
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can read certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete certificates" ON storage.objects;

CREATE POLICY "Admins can read certificates"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can upload certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update certificates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete certificates"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== Storage: company-assets (writes admin-only, public read OK) =====
DROP POLICY IF EXISTS "Allow upload to company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow update on company-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete on company-assets" ON storage.objects;

CREATE POLICY "Admins can upload company-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update company-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete company-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== Storage: avatars (writes scoped to owner folder or admin) =====
DROP POLICY IF EXISTS "Qualquer usuário pode fazer upload de avatars" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer usuário pode atualizar avatars" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer usuário pode deletar avatars" ON storage.objects;

CREATE POLICY "Users can upload own avatar or admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Users can update own avatar or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Users can delete own avatar or admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- ===== rol_configuracoes: writes admin only, keep SELECT public (used by printing) =====
DROP POLICY IF EXISTS "Allow insert on rol_configuracoes" ON public.rol_configuracoes;
DROP POLICY IF EXISTS "Allow update on rol_configuracoes" ON public.rol_configuracoes;
DROP POLICY IF EXISTS "Allow delete on rol_configuracoes" ON public.rol_configuracoes;

CREATE POLICY "Admins can insert rol_configuracoes"
ON public.rol_configuracoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update rol_configuracoes"
ON public.rol_configuracoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete rol_configuracoes"
ON public.rol_configuracoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== whatsapp_instancias: admin-only for all ops =====
DROP POLICY IF EXISTS "Authenticated can select whatsapp_instancias" ON public.whatsapp_instancias;
DROP POLICY IF EXISTS "Authenticated can insert whatsapp_instancias" ON public.whatsapp_instancias;
DROP POLICY IF EXISTS "Authenticated can update whatsapp_instancias" ON public.whatsapp_instancias;
DROP POLICY IF EXISTS "Authenticated can delete whatsapp_instancias" ON public.whatsapp_instancias;

CREATE POLICY "Admins can select whatsapp_instancias"
ON public.whatsapp_instancias FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert whatsapp_instancias"
ON public.whatsapp_instancias FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update whatsapp_instancias"
ON public.whatsapp_instancias FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete whatsapp_instancias"
ON public.whatsapp_instancias FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== configuracoes_fiscais: SELECT admin-only (contains cert password) =====
DROP POLICY IF EXISTS "Authenticated can select configuracoes_fiscais" ON public.configuracoes_fiscais;
CREATE POLICY "Admins can select configuracoes_fiscais"
ON public.configuracoes_fiscais FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== asaas_charges: SELECT admin-only (customer PII + payment data) =====
DROP POLICY IF EXISTS "Authenticated can select asaas_charges" ON public.asaas_charges;
DROP POLICY IF EXISTS "Authenticated can insert asaas_charges" ON public.asaas_charges;
DROP POLICY IF EXISTS "Authenticated can update asaas_charges" ON public.asaas_charges;
DROP POLICY IF EXISTS "Authenticated can delete asaas_charges" ON public.asaas_charges;

CREATE POLICY "Admins can select asaas_charges"
ON public.asaas_charges FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert asaas_charges"
ON public.asaas_charges FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update asaas_charges"
ON public.asaas_charges FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete asaas_charges"
ON public.asaas_charges FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== folha_pagamento: SELECT admin-only =====
DROP POLICY IF EXISTS "Authenticated can select folha_pagamento" ON public.folha_pagamento;
CREATE POLICY "Admins can select folha_pagamento"
ON public.folha_pagamento FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== folha_beneficios: SELECT admin-only =====
DROP POLICY IF EXISTS "Authenticated can select folha_beneficios" ON public.folha_beneficios;
CREATE POLICY "Admins can select folha_beneficios"
ON public.folha_beneficios FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
