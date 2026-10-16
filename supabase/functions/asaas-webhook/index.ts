import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { readServerJsonBody, serverJsonResponse } from "../_shared/http.ts";
import {
  asaasWebhookErrorCode,
  markAsaasWebhookEventFailure,
  normalizeAsaasWebhookPayload,
  processAsaasWebhookEvent,
  type AsaasWebhookEvent,
} from "../_shared/asaas-webhook-processing.ts";
import { webhookDuplicateOutcome, type WebhookProcessingStatus } from "../_shared/asaas-webhook-retry.ts";

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

async function deterministicEventId(eventKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(eventKey));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function knownProcessingStatus(value: unknown): WebhookProcessingStatus {
  return value === "pending" || value === "processing" || value === "processed" || value === "failed" || value === "dead_letter"
    ? value
    : "processing";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return serverJsonResponse({ error: "Método não permitido" }, 405);
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return serverJsonResponse({ error: "Content-Type deve ser application/json" }, 415);
  }

  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const providedToken = req.headers.get("asaas-access-token") ?? "";
  if (!expectedToken || expectedToken.length < 32) {
    console.error("ASAAS_WEBHOOK_TOKEN ausente ou inseguro");
    return serverJsonResponse({ error: "Webhook não configurado" }, 503);
  }
  if (!providedToken || !(await secureEquals(providedToken, expectedToken))) {
    console.warn("Webhook Asaas rejeitado por token inválido");
    return serverJsonResponse({ error: "Não autorizado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return serverJsonResponse({ error: "Serviço temporariamente indisponível" }, 503);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let eventToProcess: AsaasWebhookEvent | null = null;

  try {
    const parsedBody = await readServerJsonBody(req, 262_144);
    if (!parsedBody.ok) return parsedBody.response;
    const payload = normalizeAsaasWebhookPayload(parsedBody.value);
    if (!payload) return serverJsonResponse({ error: "Evento inválido" }, 400);

    const { data: knownCharge, error: chargeLookupError } = payload.payment?.id
      ? await supabase
          .from("asaas_charges")
          .select("id, tenant_id")
          .eq("asaas_id", payload.payment.id)
          .maybeSingle()
      : { data: null, error: null };
    if (chargeLookupError) throw new Error("ASAAS_CHARGE_LOOKUP_FAILED");
    if (
      payload.payment &&
      !knownCharge &&
      /^(?:fatura|manual|pdv):[A-Za-z0-9:._-]{1,190}$/.test(payload.payment.externalReference ?? "")
    ) {
      throw new Error("ASAAS_MANAGED_CHARGE_NOT_FOUND");
    }
    if (!knownCharge) return serverJsonResponse({ success: true, ignored: true }, 202);

    const eventKey = payload.id;
    const eventRecordId = await deterministicEventId(eventKey);
    const storedPayload = { ...payload, _anjolav_event_key: eventKey };
    const { error: inboxError } = await supabase.from("asaas_webhook_events").insert({
      id: eventRecordId,
      tenant_id: knownCharge.tenant_id,
      event_type: payload.event,
      payment_id: payload.payment?.id ?? null,
      charge_id: knownCharge.id,
      payload: storedPayload,
      processing_status: "processing",
      attempt_count: 1,
      processed_at: null,
      locked_at: new Date().toISOString(),
      next_attempt_at: null,
      last_error: null,
      last_error_code: null,
      dead_lettered_at: null,
    });
    if (inboxError?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("asaas_webhook_events")
        .select("processing_status")
        .eq("id", eventRecordId)
        .maybeSingle();
      if (duplicateError || !duplicate) throw new Error("ASAAS_DUPLICATE_LOOKUP_FAILED");
      const outcome = webhookDuplicateOutcome(knownProcessingStatus(duplicate.processing_status));
      return serverJsonResponse({ success: true, [outcome]: true });
    }
    if (inboxError) throw new Error("ASAAS_INBOX_INSERT_FAILED");

    eventToProcess = {
      id: eventRecordId,
      tenantId: knownCharge.tenant_id,
      chargeId: knownCharge.id,
      payload,
      attemptCount: 1,
      processingStatus: "processing",
    };
    await processAsaasWebhookEvent(supabase, eventToProcess);
    console.log("Webhook Asaas processado", { eventId: eventRecordId });
    return serverJsonResponse({ success: true });
  } catch (error: unknown) {
    const errorCode = asaasWebhookErrorCode(error);
    if (eventToProcess) {
      const failureState = await markAsaasWebhookEventFailure(supabase, eventToProcess, error);
      console.error("Falha ao processar webhook Asaas", {
        eventId: eventToProcess.id,
        errorCode,
        processingStatus: failureState.processingStatus,
      });
    } else {
      console.error("Falha ao receber webhook Asaas", { errorCode });
    }
    return serverJsonResponse({ error: "Falha ao processar webhook" }, 500);
  }
});
