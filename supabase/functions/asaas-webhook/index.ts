import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { readServerJsonBody, serverJsonResponse } from "../_shared/http.ts";

interface AsaasWebhookPayload {
  id: string;
  event: string;
  payment?: {
    id: string;
    status?: string;
    value?: number;
    dueDate?: string;
    billingType?: string;
    confirmedDate?: string;
    paymentDate?: string;
    externalReference?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
  };
}

interface AsaasIdentification {
  identificationField?: string;
}

const NON_STATE_EVENTS = new Set([
  "PAYMENT_BANK_SLIP_VIEWED",
  "PAYMENT_CHECKOUT_VIEWED",
]);

function boundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function safeProviderUrl(value: unknown): string | undefined {
  const rawUrl = boundedString(value, 2_048);
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeIsoDate(value: unknown): string | undefined {
  const rawDate = boundedString(value, 10);
  const match = rawDate && /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === rawDate ? rawDate : undefined;
}

function safeProviderTimestamp(value: unknown): string | undefined {
  const rawTimestamp = boundedString(value, 64);
  if (!rawTimestamp) return undefined;
  const isoDate = safeIsoDate(rawTimestamp);
  if (isoDate) return `${isoDate}T00:00:00.000Z`;
  const timestamp = Date.parse(rawTimestamp);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function normalizePayload(raw: unknown): AsaasWebhookPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const event = boundedString(input.event, 100);
  const id = boundedString(input.id, 200);
  if (!id || !event || !/^[A-Z0-9_]+$/.test(event)) return null;

  const payload: AsaasWebhookPayload = {
    event,
    id,
  };

  if (input.payment !== undefined) {
    if (!input.payment || typeof input.payment !== "object" || Array.isArray(input.payment)) return null;
    const paymentInput = input.payment as Record<string, unknown>;
    const id = boundedString(paymentInput.id, 200);
    const status = boundedString(paymentInput.status, 80);
    const value = typeof paymentInput.value === "number" ? paymentInput.value : undefined;
    const billingType = boundedString(paymentInput.billingType, 80);
    if (
      !id ||
      !/^[A-Za-z0-9_-]+$/.test(id) ||
      (status && !/^[A-Z0-9_]+$/.test(status)) ||
      (billingType && !/^[A-Z0-9_]+$/.test(billingType)) ||
      (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 9_999_999.99))
    ) return null;
    payload.payment = {
      id,
      status,
      value,
      dueDate: safeIsoDate(paymentInput.dueDate),
      billingType,
      confirmedDate: safeProviderTimestamp(paymentInput.confirmedDate),
      paymentDate: safeProviderTimestamp(paymentInput.paymentDate),
      externalReference: boundedString(paymentInput.externalReference, 200),
      invoiceUrl: safeProviderUrl(paymentInput.invoiceUrl),
      bankSlipUrl: safeProviderUrl(paymentInput.bankSlipUrl),
    };
  }

  return payload;
}

function getAsaasBaseUrl(): string {
  const environment = Deno.env.get("ASAAS_ENVIRONMENT");
  if (environment === "production") return "https://api.asaas.com/v3";
  if (environment === "sandbox") return "https://api-sandbox.asaas.com/v3";
  throw new Error("ASAAS_ENVIRONMENT não configurado corretamente");
}

async function asaasGet<T>(path: string): Promise<T> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey || apiKey.length < 20) {
    throw new Error("ASAAS_API_KEY ausente para reconciliar a cobrança");
  }

  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    method: "GET",
    signal: AbortSignal.timeout(20_000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "AnjoLav-ERP/1.0",
      "access_token": apiKey,
    },
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || typeof result !== "object" || Array.isArray(result)) {
    console.error("Asaas reconciliation request failed", { status: response.status, path });
    throw new Error("Asaas não permitiu reconciliar a cobrança");
  }
  return result as T;
}

async function getCurrentPayment(paymentId: string): Promise<NonNullable<AsaasWebhookPayload["payment"]>> {
  const raw = await asaasGet<Record<string, unknown>>(`/payments/${encodeURIComponent(paymentId)}`);
  const normalized = normalizePayload({ id: "reconciliation", event: "PAYMENT_UPDATED", payment: raw });
  if (!normalized?.payment || normalized.payment.id !== paymentId || !normalized.payment.status) {
    throw new Error("Asaas retornou uma cobrança inválida durante a reconciliação");
  }
  return normalized.payment;
}

async function getIdentificationField(paymentId: string): Promise<string> {
  const result = await asaasGet<AsaasIdentification>(
    `/payments/${encodeURIComponent(paymentId)}/identificationField`,
  );

  const digits = typeof result?.identificationField === "string"
    ? result.identificationField.replace(/\D/g, "")
    : "";
  if (digits.length < 44 || digits.length > 48) {
    throw new Error("Asaas retornou uma linha digitável inválida");
  }
  return digits;
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

async function deterministicEventId(eventKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(eventKey));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  let eventRecordId: string | null = null;

  try {
    const parsedBody = await readServerJsonBody(req, 262_144);
    if (!parsedBody.ok) return parsedBody.response;
    const payload = normalizePayload(parsedBody.value);
    if (!payload) {
      return serverJsonResponse({ error: "Evento inválido" }, 400);
    }

    const { data: knownCharge, error: chargeLookupError } = payload.payment?.id
      ? await supabase
          .from("asaas_charges")
          .select("id, tenant_id, billing_type")
          .eq("asaas_id", payload.payment.id)
          .maybeSingle()
      : { data: null, error: null };
    if (chargeLookupError) throw chargeLookupError;
    if (
      payload.payment &&
      !knownCharge &&
      /^(?:fatura|manual|pdv):[A-Za-z0-9:._-]{1,190}$/.test(payload.payment.externalReference ?? "")
    ) {
      throw new Error("Cobrança gerenciada ainda não encontrada no banco local");
    }
    if (!knownCharge) {
      console.info("Evento Asaas não gerenciado ignorado", { event: payload.event });
      return serverJsonResponse({ success: true, ignored: true }, 202);
    }

    const eventKey = payload.id;
    eventRecordId = await deterministicEventId(eventKey);
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
    });
    if (inboxError?.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("asaas_webhook_events")
        .select("processing_status, attempt_count")
        .eq("id", eventRecordId)
        .single();
      if (duplicateError) throw duplicateError;
      if (duplicate.processing_status === "processed") {
        return serverJsonResponse({ success: true, duplicate: true });
      }
      const { error: retryError } = await supabase
        .from("asaas_webhook_events")
        .update({
          processing_status: "processing",
          attempt_count: Number(duplicate.attempt_count ?? 1) + 1,
          last_error: null,
        })
        .eq("id", eventRecordId);
      if (retryError) throw retryError;
    } else if (inboxError) {
      throw inboxError;
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("asaas_webhook_events")
      .select("id")
      .eq("id", eventRecordId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (!duplicate) throw new Error("Evento não foi persistido antes do processamento");

    const chargeId: string = knownCharge.id;
    const chargeBillingType: string | null = knownCharge.billing_type ?? null;

    if (chargeId && payload.payment) {
      const payment = NON_STATE_EVENTS.has(payload.event)
        ? payload.payment
        : await getCurrentPayment(payload.payment.id);
      const effectiveBillingType = payment.billingType ?? chargeBillingType;
      const identificationField = payload.event === "PAYMENT_UPDATED" && effectiveBillingType === "BOLETO"
        ? await getIdentificationField(payment.id)
        : null;
      const update: Record<string, string | number | null> = {};
      if (payment.status) update.status = payment.status;
      if (payment.value !== undefined) update.value = Math.round(payment.value * 100) / 100;
      if (payment.dueDate) update.due_date = payment.dueDate;
      if (payment.billingType) update.billing_type = payment.billingType;
      if (payment.invoiceUrl) update.invoice_url = payment.invoiceUrl;
      if (payment.bankSlipUrl) update.bank_slip_url = payment.bankSlipUrl;
      if (payment.status === "RECEIVED") {
        update.paid_at = payment.paymentDate ?? payment.confirmedDate ?? new Date().toISOString();
      }

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from("asaas_charges")
          .update(update)
          .eq("tenant_id", knownCharge.tenant_id)
          .eq("id", chargeId);
        if (updateError) throw updateError;
      }

      if (identificationField) {
        const invoiceUpdate: Record<string, string> = {
          boleto_linha_digitavel: identificationField,
        };
        const boletoUrl = payment.bankSlipUrl ?? payment.invoiceUrl;
        if (boletoUrl) invoiceUpdate.boleto_url = boletoUrl;
        if (payment.dueDate) invoiceUpdate.data_vencimento = payment.dueDate;

        const { error: invoiceUpdateError } = await supabase
          .from("faturas")
          .update(invoiceUpdate)
          .eq("tenant_id", knownCharge.tenant_id)
          .eq("asaas_charge_id", chargeId);
        if (invoiceUpdateError) throw invoiceUpdateError;
      }

      if (payment.status === "RECEIVED") {
        const { error: invoiceUpdateError } = await supabase
          .from("faturas")
          .update({ status: "pago" })
          .eq("tenant_id", knownCharge.tenant_id)
          .eq("asaas_charge_id", chargeId);
        if (invoiceUpdateError) throw invoiceUpdateError;
      }

      if (payment.status !== "RECEIVED" && [
        "PAYMENT_DELETED",
        "PAYMENT_REFUNDED",
        "PAYMENT_PARTIALLY_REFUNDED",
        "PAYMENT_REFUND_IN_PROGRESS",
        "PAYMENT_RECEIVED_IN_CASH_UNDONE",
        "PAYMENT_CHARGEBACK_REQUESTED",
      ].includes(payload.event)) {
        const { error: invoiceUpdateError } = await supabase
          .from("faturas")
          .update({ status: "pendente" })
          .eq("tenant_id", knownCharge.tenant_id)
          .eq("asaas_charge_id", chargeId);
        if (invoiceUpdateError) throw invoiceUpdateError;
      }

      const { error: pdvReconcileError } = await supabase.rpc("reconciliar_pagamento_pdv", {
        _asaas_charge_id: chargeId,
        _status_provedor: payment.status ?? "",
        _confirmado_em: payment.paymentDate ?? payment.confirmedDate ?? null,
        _evento: payload.event,
      });
      if (pdvReconcileError) throw pdvReconcileError;
    }

    const { error: eventError } = await supabase.from("asaas_webhook_events").update({
      charge_id: chargeId,
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("tenant_id", knownCharge.tenant_id).eq("id", eventRecordId);
    if (eventError) throw eventError;

    console.log("Webhook Asaas processado", {
      event: payload.event,
      paymentId: payload.payment?.id ?? null,
      chargeFound: chargeId !== null,
    });
    return serverJsonResponse({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown";
    if (eventRecordId) {
      const { error: inboxUpdateError } = await supabase
        .from("asaas_webhook_events")
        .update({ processing_status: "failed", last_error: message.slice(0, 1_000) })
        .eq("id", eventRecordId);
      if (inboxUpdateError) console.error("Falha ao registrar erro do webhook", inboxUpdateError.message);
    }
    console.error("Falha ao processar webhook Asaas", message);
    return serverJsonResponse({ error: "Falha ao processar webhook" }, 500);
  }
});
