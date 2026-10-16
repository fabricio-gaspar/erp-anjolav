import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";
import {
  asaasWebhookErrorCode,
  markAsaasWebhookEventFailure,
  normalizeAsaasWebhookPayload,
  processAsaasWebhookEvent,
  type AsaasWebhookEvent,
} from "../_shared/asaas-webhook-processing.ts";
import { shouldProcessWebhookEvent } from "../_shared/asaas-webhook-retry.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface RetryRequest {
  eventId: string | null;
  limit: number;
}

interface ClaimedWebhookRow {
  id?: unknown;
  tenant_id?: unknown;
  charge_id?: unknown;
  payload?: unknown;
  attempt_count?: unknown;
}

function parseRetryRequest(raw: unknown): RetryRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const eventId = input.eventId;
  if (eventId !== undefined && (typeof eventId !== "string" || !UUID_PATTERN.test(eventId))) return null;
  const rawLimit = input.limit ?? 10;
  if (!Number.isInteger(rawLimit) || typeof rawLimit !== "number" || rawLimit < 1 || rawLimit > 25) return null;
  return { eventId: eventId ?? null, limit: rawLimit };
}

async function secureEquals(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0 && left.length === right.length;
}

function claimedMetadata(row: ClaimedWebhookRow) {
  const id = typeof row.id === "string" && UUID_PATTERN.test(row.id) ? row.id : null;
  const tenantId = typeof row.tenant_id === "string" && UUID_PATTERN.test(row.tenant_id) ? row.tenant_id : null;
  const attemptCount = typeof row.attempt_count === "number" && Number.isInteger(row.attempt_count)
    ? row.attempt_count
    : null;
  return id && tenantId && attemptCount ? { id, tenantId, attemptCount } : null;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const expectedWorkerToken = Deno.env.get("ASAAS_RETRY_TOKEN");
  const providedWorkerToken = req.headers.get("x-asaas-retry-token") ?? "";
  const serviceWorkerAuthorized = Boolean(
    expectedWorkerToken &&
      expectedWorkerToken.length >= 32 &&
      providedWorkerToken &&
      await secureEquals(providedWorkerToken, expectedWorkerToken),
  );
  let tenantId: string | null = null;
  if (!serviceWorkerAuthorized) {
    const authorization = await requireAdmin(req, supabase);
    if (!authorization.ok) return authorization.response;
    tenantId = authorization.tenantId;
  }

  const parsedBody = await readJsonBody(req, 16_384);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parseRetryRequest(parsedBody.value);
  if (!body) return jsonResponse(req, { error: "Solicitação de retentativa inválida" }, 400);

  try {
    const { data, error: claimError } = await supabase.rpc("claim_asaas_webhook_events", {
      _event_id: body.eventId,
      _tenant_id: tenantId,
      _limit: body.limit,
    });
    if (claimError || !Array.isArray(data)) throw new Error("ASAAS_RETRY_CLAIM_FAILED");

    let processed = 0;
    let failed = 0;
    let deadLettered = 0;
    for (const row of data as ClaimedWebhookRow[]) {
      const metadata = claimedMetadata(row);
      if (!metadata) {
        console.error("Claimed Asaas webhook has invalid metadata", { errorCode: "ASAAS_CLAIMED_EVENT_INVALID" });
        failed += 1;
        continue;
      }
      const payload = normalizeAsaasWebhookPayload(row.payload);
      const chargeId = typeof row.charge_id === "string" && UUID_PATTERN.test(row.charge_id) ? row.charge_id : null;
      if (!payload || !chargeId) {
        const failureState = await markAsaasWebhookEventFailure(
          supabase,
          { ...metadata },
          new Error("ASAAS_STORED_EVENT_INVALID"),
        );
        failed += 1;
        if (failureState.processingStatus === "dead_letter") deadLettered += 1;
        console.error("Stored Asaas webhook rejected", {
          eventId: metadata.id,
          errorCode: "ASAAS_STORED_EVENT_INVALID",
        });
        continue;
      }

      const event: AsaasWebhookEvent = {
        ...metadata,
        chargeId,
        payload,
        processingStatus: "processing",
      };
      if (!shouldProcessWebhookEvent(event.processingStatus)) continue;
      try {
        await processAsaasWebhookEvent(supabase, event);
        processed += 1;
      } catch (error: unknown) {
        const failureState = await markAsaasWebhookEventFailure(supabase, event, error);
        failed += 1;
        if (failureState.processingStatus === "dead_letter") deadLettered += 1;
        console.error("Asaas webhook retry failed", {
          eventId: event.id,
          errorCode: asaasWebhookErrorCode(error),
        });
      }
    }

    return jsonResponse(req, {
      success: true,
      claimed: data.length,
      processed,
      failed,
      deadLettered,
    });
  } catch (error: unknown) {
    console.error("Asaas retry worker failed", { errorCode: asaasWebhookErrorCode(error) });
    return jsonResponse(req, { error: "Falha ao processar retentativas" }, 500);
  }
});
