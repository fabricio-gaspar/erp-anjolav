-- Durable, service-only retry queue for failed Asaas webhook processing.
-- This migration does not call Asaas or schedule a hosted worker.

ALTER TABLE public.asaas_webhook_events
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

ALTER TABLE public.asaas_webhook_events
  DROP CONSTRAINT IF EXISTS asaas_webhook_events_processing_status_check;
ALTER TABLE public.asaas_webhook_events
  ADD CONSTRAINT asaas_webhook_events_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter'));

ALTER TABLE public.asaas_webhook_events
  ADD CONSTRAINT asaas_webhook_events_last_error_code_check
  CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z][A-Z0-9_]{1,79}$');

UPDATE public.asaas_webhook_events
SET next_attempt_at = coalesce(next_attempt_at, received_at, now()),
    last_error = 'RETRY_SCHEDULED',
    last_error_code = 'RETRY_SCHEDULED'
WHERE processing_status = 'failed'
  AND attempt_count < 5;

UPDATE public.asaas_webhook_events
SET locked_at = coalesce(locked_at, now())
WHERE processing_status = 'processing';

UPDATE public.asaas_webhook_events
SET processing_status = 'dead_letter',
    next_attempt_at = NULL,
    locked_at = NULL,
    dead_lettered_at = coalesce(dead_lettered_at, now()),
    last_error = 'RETRY_LIMIT_REACHED',
    last_error_code = 'RETRY_LIMIT_REACHED'
WHERE processing_status = 'failed'
  AND attempt_count >= 5;

CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_retry_queue
  ON public.asaas_webhook_events (tenant_id, processing_status, next_attempt_at, received_at)
  WHERE processing_status IN ('pending', 'failed', 'processing');

CREATE OR REPLACE FUNCTION public.claim_asaas_webhook_events(
  _event_id uuid DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL,
  _limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  charge_id uuid,
  payment_id text,
  event_type text,
  payload jsonb,
  attempt_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := least(greatest(coalesce(_limit, 10), 1), 25);
BEGIN
  UPDATE public.asaas_webhook_events AS event
  SET processing_status = 'dead_letter',
      next_attempt_at = NULL,
      locked_at = NULL,
      dead_lettered_at = coalesce(event.dead_lettered_at, now()),
      last_error = 'RETRY_LIMIT_REACHED',
      last_error_code = 'RETRY_LIMIT_REACHED'
  WHERE (_event_id IS NULL OR event.id = _event_id)
    AND (_tenant_id IS NULL OR event.tenant_id = _tenant_id)
    AND event.processing_status = 'processing'
    AND event.attempt_count >= 5
    AND event.locked_at IS NOT NULL
    AND event.locked_at <= now() - interval '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT event.id
    FROM public.asaas_webhook_events AS event
    WHERE (_event_id IS NULL OR event.id = _event_id)
      AND (_tenant_id IS NULL OR event.tenant_id = _tenant_id)
      AND event.attempt_count < 5
      AND (
        (
          event.processing_status IN ('pending', 'failed')
          AND (event.next_attempt_at IS NULL OR event.next_attempt_at <= now())
        )
        OR (
          event.processing_status = 'processing'
          AND event.locked_at IS NOT NULL
          AND event.locked_at <= now() - interval '10 minutes'
        )
      )
    ORDER BY event.received_at ASC, event.id ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.asaas_webhook_events AS event
    SET processing_status = 'processing',
        attempt_count = event.attempt_count + 1,
        locked_at = now(),
        next_attempt_at = NULL,
        last_error = NULL,
        last_error_code = NULL
    FROM candidates
    WHERE event.id = candidates.id
    RETURNING
      event.id,
      event.tenant_id,
      event.charge_id,
      event.payment_id,
      event.event_type,
      event.payload,
      event.attempt_count
  )
  SELECT
    claimed.id,
    claimed.tenant_id,
    claimed.charge_id,
    claimed.payment_id,
    claimed.event_type,
    claimed.payload,
    claimed.attempt_count
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_asaas_webhook_events(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_asaas_webhook_events(uuid, uuid, integer)
  TO service_role;
