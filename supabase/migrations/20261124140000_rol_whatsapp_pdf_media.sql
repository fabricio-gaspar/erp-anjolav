ALTER TABLE public.mensagens_log DROP CONSTRAINT IF EXISTS mensagens_log_media_consistency_check;
ALTER TABLE public.mensagens_log ADD CONSTRAINT mensagens_log_media_consistency_check CHECK (
  (media_storage_path IS NULL AND media_mime_type IS NULL AND media_kind IS NULL)
  OR (
    evento LIKE 'rol\_%' ESCAPE '\'
    AND ordem_servico_id IS NOT NULL
    AND media_storage_path = tenant_id::text || '/' || ordem_servico_id::text || '/documento/' || split_part(media_storage_path, '/', 4)
    AND (
      (media_mime_type = 'image/png' AND media_kind = 'image' AND split_part(media_storage_path, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$')
      OR
      (media_mime_type = 'application/pdf' AND media_kind = 'document' AND split_part(media_storage_path, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$')
    )
  )
) NOT VALID;
ALTER TABLE public.mensagens_log VALIDATE CONSTRAINT mensagens_log_media_consistency_check;
