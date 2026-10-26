import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  nextWebhookFailureState,
  shouldProcessWebhookEvent,
  type WebhookFailureState,
} from "./asaas-webhook-retry.ts";

export interface AsaasWebhookPayment {
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
}

export interface AsaasWebhookPayload {
  id: string;
  event: string;
  payment?: AsaasWebhookPayment;
}

export interface AsaasWebhookEvent {
  id: string;
  tenantId: string;
  chargeId: string;
  payload: AsaasWebhookPayload;
  attemptCount: number;
  processingStatus: "processing";
}

type AsaasWebhookFailureEvent = Pick<AsaasWebhookEvent, "id" | "tenantId" | "attemptCount">;

interface AsaasIdentification {
  identificationField?: string;
}

export class AsaasWebhookProcessingError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
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
  const parsed = Date.parse(rawTimestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export function normalizeAsaasWebhookPayload(raw: unknown): AsaasWebhookPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const event = boundedString(input.event, 100);
  const id = boundedString(input.id, 200);
  if (!id || !event || !/^[A-Z0-9_]+$/.test(event)) return null;

  const payload: AsaasWebhookPayload = { event, id };
  if (input.payment !== undefined) {
    if (!input.payment || typeof input.payment !== "object" || Array.isArray(input.payment)) return null;
    const paymentInput = input.payment as Record<string, unknown>;
    const paymentId = boundedString(paymentInput.id, 200);
    const status = boundedString(paymentInput.status, 80);
    const value = typeof paymentInput.value === "number" ? paymentInput.value : undefined;
    const billingType = boundedString(paymentInput.billingType, 80);
    if (
      !paymentId ||
      !/^[A-Za-z0-9_-]+$/.test(paymentId) ||
      (status && !/^[A-Z0-9_]+$/.test(status)) ||
      (billingType && !/^[A-Z0-9_]+$/.test(billingType)) ||
      (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 9_999_999.99))
    ) return null;

    payload.payment = {
      id: paymentId,
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
  throw new AsaasWebhookProcessingError("ASAAS_ENVIRONMENT_INVALID");
}

async function asaasGet<T>(path: string): Promise<T> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey || apiKey.length < 20) throw new AsaasWebhookProcessingError("ASAAS_API_KEY_UNAVAILABLE");

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
    console.error("Asaas reconciliation request failed", {
      status: response.status,
      errorCode: "ASAAS_RECONCILIATION_FAILED",
    });
    throw new AsaasWebhookProcessingError("ASAAS_RECONCILIATION_FAILED");
  }
  return result as T;
}

async function getCurrentPayment(paymentId: string): Promise<AsaasWebhookPayment> {
  const raw = await asaasGet<Record<string, unknown>>(`/payments/${encodeURIComponent(paymentId)}`);
  const normalized = normalizeAsaasWebhookPayload({ id: "reconciliation", event: "PAYMENT_UPDATED", payment: raw });
  if (!normalized?.payment || normalized.payment.id !== paymentId || !normalized.payment.status) {
    throw new AsaasWebhookProcessingError("ASAAS_PAYMENT_INVALID");
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
    throw new AsaasWebhookProcessingError("ASAAS_IDENTIFICATION_INVALID");
  }
  return digits;
}

function databaseError(code: string): AsaasWebhookProcessingError {
  return new AsaasWebhookProcessingError(code);
}

export function asaasWebhookErrorCode(error: unknown): string {
  return error instanceof AsaasWebhookProcessingError ? error.code : "WEBHOOK_PROCESSING_FAILED";
}

export async function markAsaasWebhookEventFailure(
  supabase: SupabaseClient,
  event: AsaasWebhookFailureEvent,
  error: unknown,
): Promise<WebhookFailureState> {
  const failureState = nextWebhookFailureState(event.attemptCount);
  const errorCode = asaasWebhookErrorCode(error);
  const { error: updateError } = await supabase
    .from("asaas_webhook_events")
    .update({
      processing_status: failureState.processingStatus,
      next_attempt_at: failureState.nextAttemptAt,
      locked_at: null,
      dead_lettered_at: failureState.deadLetteredAt,
      last_error: errorCode,
      last_error_code: errorCode,
    })
    .eq("tenant_id", event.tenantId)
    .eq("id", event.id)
    .eq("processing_status", "processing");
  if (updateError) {
    console.error("Unable to persist Asaas webhook failure", { eventId: event.id, errorCode });
  }
  return failureState;
}

export async function processAsaasWebhookEvent(
  supabase: SupabaseClient,
  event: AsaasWebhookEvent,
): Promise<boolean> {
  if (!shouldProcessWebhookEvent(event.processingStatus)) return false;
  if (!event.payload.payment) throw new AsaasWebhookProcessingError("ASAAS_PAYMENT_MISSING");

  const { data: knownCharge, error: chargeError } = await supabase
    .from("asaas_charges")
    .select("id, billing_type")
    .eq("tenant_id", event.tenantId)
    .eq("id", event.chargeId)
    .maybeSingle();
  if (chargeError || !knownCharge) throw databaseError("ASAAS_CHARGE_NOT_FOUND");

  const payment = NON_STATE_EVENTS.has(event.payload.event)
    ? event.payload.payment
    : await getCurrentPayment(event.payload.payment.id);
  const effectiveBillingType = payment.billingType ?? knownCharge.billing_type ?? null;
  const identificationField = event.payload.event === "PAYMENT_UPDATED" && effectiveBillingType === "BOLETO"
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
      .eq("tenant_id", event.tenantId)
      .eq("id", event.chargeId);
    if (updateError) throw databaseError("ASAAS_CHARGE_UPDATE_FAILED");
  }

  if (identificationField) {
    const invoiceUpdate: Record<string, string> = { boleto_linha_digitavel: identificationField };
    const boletoUrl = payment.bankSlipUrl ?? payment.invoiceUrl;
    if (boletoUrl) invoiceUpdate.boleto_url = boletoUrl;
    if (payment.dueDate) invoiceUpdate.data_vencimento = payment.dueDate;
    const { error: invoiceUpdateError } = await supabase
      .from("faturas")
      .update(invoiceUpdate)
      .eq("tenant_id", event.tenantId)
      .eq("asaas_charge_id", event.chargeId);
    if (invoiceUpdateError) throw databaseError("ASAAS_INVOICE_UPDATE_FAILED");
  }

  if (payment.status === "RECEIVED") {
    const { error: invoiceUpdateError } = await supabase
      .from("faturas")
      .update({ status: "pago" })
      .eq("tenant_id", event.tenantId)
      .eq("asaas_charge_id", event.chargeId);
    if (invoiceUpdateError) throw databaseError("ASAAS_INVOICE_SETTLEMENT_FAILED");
  }

  if (payment.status !== "RECEIVED" && [
    "PAYMENT_DELETED",
    "PAYMENT_REFUNDED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_RECEIVED_IN_CASH_UNDONE",
    "PAYMENT_CHARGEBACK_REQUESTED",
  ].includes(event.payload.event)) {
    const { error: invoiceUpdateError } = await supabase
      .from("faturas")
      .update({ status: "pendente" })
      .eq("tenant_id", event.tenantId)
      .eq("asaas_charge_id", event.chargeId);
    if (invoiceUpdateError) throw databaseError("ASAAS_INVOICE_REVERSAL_FAILED");
  }

  const { error: pdvReconcileError } = await supabase.rpc("reconciliar_pagamento_pdv", {
    _asaas_charge_id: event.chargeId,
    _status_provedor: payment.status ?? "",
    _confirmado_em: payment.paymentDate ?? payment.confirmedDate ?? null,
    _evento: event.payload.event,
  });
  if (pdvReconcileError) throw databaseError("PDV_RECONCILIATION_FAILED");

  const { error: eventUpdateError } = await supabase
    .from("asaas_webhook_events")
    .update({
      charge_id: event.chargeId,
      processing_status: "processed",
      processed_at: new Date().toISOString(),
      next_attempt_at: null,
      locked_at: null,
      last_error: null,
      last_error_code: null,
    })
    .eq("tenant_id", event.tenantId)
    .eq("id", event.id)
    .eq("processing_status", "processing");
  if (eventUpdateError) throw databaseError("WEBHOOK_EVENT_COMPLETE_FAILED");
  return true;
}
