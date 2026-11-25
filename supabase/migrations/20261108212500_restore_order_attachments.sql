-- Restore the private evidence store used by the ROL detail screen.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'order-attachments', 'order-attachments', false, 8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.ordem_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT private.current_tenant_id()
    REFERENCES public.tenants(id),
  ordem_servico_id uuid NOT NULL,
  categoria text NOT NULL CHECK (categoria IN
    ('recebimento', 'avaria', 'qualidade', 'documento', 'outro')),
  nome_arquivo text NOT NULL CHECK (char_length(nome_arquivo) BETWEEN 1 AND 180),
  descricao text,
  object_path text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN
    ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ordem_anexos_ordem_servico_id_fkey
    FOREIGN KEY (ordem_servico_id, tenant_id)
    REFERENCES public.ordens_servico(id, tenant_id) ON DELETE RESTRICT
);
CREATE INDEX ordem_anexos_ordem_data_idx
  ON public.ordem_anexos (tenant_id, ordem_servico_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.order_attachment_access(_path text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_order uuid;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL OR _path IS NULL
    OR _path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(recebimento|avaria|qualidade|documento|outro)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|pdf)$'
    OR split_part(_path, '/', 1) <> v_tenant::text
    OR NOT private.has_any_module_access(ARRAY['ordens', 'producao', 'caixa']::text[])
  THEN
    RETURN false;
  END IF;
  v_order := split_part(_path, '/', 2)::uuid;
  RETURN EXISTS (
    SELECT 1 FROM public.ordens_servico o
    WHERE o.id = v_order AND o.tenant_id = v_tenant
      AND private.can_access_area(
        CASE WHEN lower(coalesce(o.origem, 'industrial')) IN ('residencial', 'loja')
          THEN 'residencial' ELSE 'industrial' END)
  );
END;
$function$;
REVOKE ALL ON FUNCTION private.order_attachment_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.order_attachment_access(text) TO authenticated;

ALTER TABLE public.ordem_anexos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ordem_anexos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ordem_anexos TO authenticated;
CREATE POLICY ordem_anexos_read ON public.ordem_anexos
FOR SELECT TO authenticated
USING (tenant_id = private.current_tenant_id()
  AND private.order_attachment_access(object_path));

CREATE POLICY order_attachments_read ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'order-attachments'
  AND private.order_attachment_access(name));
CREATE POLICY order_attachments_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-attachments'
  AND private.order_attachment_access(name)
  AND owner_id = auth.uid()::text);
CREATE POLICY order_attachments_remove_orphan ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'order-attachments'
  AND private.order_attachment_access(name)
  AND owner_id = auth.uid()::text
  AND NOT EXISTS (SELECT 1 FROM public.ordem_anexos a WHERE a.object_path = name));

CREATE OR REPLACE FUNCTION public.registrar_anexo_ordem(
  _ordem_servico_id uuid, _categoria text, _nome_arquivo text,
  _descricao text, _object_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth, storage, pg_temp
AS $function$
DECLARE
  v_tenant uuid := private.current_tenant_id();
  v_object storage.objects%ROWTYPE;
  v_attachment public.ordem_anexos%ROWTYPE;
  v_size bigint;
  v_mime text;
BEGIN
  IF auth.uid() IS NULL OR v_tenant IS NULL
    OR NOT private.order_attachment_access(_object_path)
    OR split_part(_object_path, '/', 2) <> _ordem_servico_id::text
    OR split_part(_object_path, '/', 3) <> _categoria
  THEN
    RAISE EXCEPTION 'Anexo fora do pedido ou do escopo autorizado';
  END IF;
  IF nullif(trim(_nome_arquivo), '') IS NULL
    OR char_length(_nome_arquivo) > 180
    OR (_descricao IS NOT NULL AND char_length(_descricao) > 2000)
  THEN
    RAISE EXCEPTION 'Nome ou descrição de anexo inválidos';
  END IF;
  SELECT * INTO v_object FROM storage.objects
  WHERE bucket_id = 'order-attachments' AND name = _object_path
    AND owner_id = auth.uid()::text;
  IF NOT FOUND THEN RAISE EXCEPTION 'Arquivo privado não encontrado'; END IF;
  v_size := nullif(v_object.metadata->>'size', '')::bigint;
  v_mime := v_object.metadata->>'mimetype';
  IF v_size IS NULL OR v_size NOT BETWEEN 1 AND 8388608
    OR v_mime NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  THEN RAISE EXCEPTION 'Arquivo fora dos formatos ou limites permitidos'; END IF;

  INSERT INTO public.ordem_anexos (
    tenant_id, ordem_servico_id, categoria, nome_arquivo, descricao,
    object_path, content_type, size_bytes, criado_por
  ) VALUES (
    v_tenant, _ordem_servico_id, _categoria, trim(_nome_arquivo),
    nullif(trim(_descricao), ''), _object_path, v_mime, v_size, auth.uid()
  ) ON CONFLICT (object_path) DO NOTHING;

  SELECT * INTO v_attachment FROM public.ordem_anexos
  WHERE object_path = _object_path;
  IF v_attachment.tenant_id IS DISTINCT FROM v_tenant
    OR v_attachment.ordem_servico_id IS DISTINCT FROM _ordem_servico_id
    OR v_attachment.categoria IS DISTINCT FROM _categoria
    OR v_attachment.criado_por IS DISTINCT FROM auth.uid()
    OR v_attachment.nome_arquivo IS DISTINCT FROM trim(_nome_arquivo)
    OR v_attachment.descricao IS DISTINCT FROM nullif(trim(_descricao), '')
  THEN RAISE EXCEPTION 'Reutilização inconsistente do anexo'; END IF;
  RETURN jsonb_build_object('id', v_attachment.id, 'object_path', v_attachment.object_path);
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_anexo_ordem(uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_anexo_ordem(uuid, text, text, text, text)
  TO authenticated;
