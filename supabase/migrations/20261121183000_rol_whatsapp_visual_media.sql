-- Private media metadata for the ROL WhatsApp outbox. The generated PNG is
-- stored in the existing private order-attachments bucket; no public bucket
-- or additional client grant is introduced.
ALTER TABLE public.mensagens_log
  ADD COLUMN IF NOT EXISTS media_storage_path text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_kind text;

ALTER TABLE public.mensagens_log
  DROP CONSTRAINT IF EXISTS mensagens_log_media_consistency_check;

ALTER TABLE public.mensagens_log
  ADD CONSTRAINT mensagens_log_media_consistency_check CHECK (
    (media_storage_path IS NULL AND media_mime_type IS NULL AND media_kind IS NULL)
    OR (
      evento LIKE 'rol\_%' ESCAPE '\'
      AND ordem_servico_id IS NOT NULL
      AND media_mime_type = 'image/png'
      AND media_kind = 'image'
      AND media_storage_path = tenant_id::text || '/' || ordem_servico_id::text || '/documento/'
        || split_part(media_storage_path, '/', 4)
      AND split_part(media_storage_path, '/', 4)
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$'
    )
  ) NOT VALID;

ALTER TABLE public.mensagens_log
  VALIDATE CONSTRAINT mensagens_log_media_consistency_check;

COMMENT ON COLUMN public.mensagens_log.media_storage_path IS
  'Private order-attachments path for the exact media reserved by this outbox row.';
COMMENT ON COLUMN public.mensagens_log.media_mime_type IS
  'Validated MIME type of the reserved WhatsApp media.';
COMMENT ON COLUMN public.mensagens_log.media_kind IS
  'WA-AKG media route type; currently image for visual ROL receipts.';

