import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin } from "../_shared/auth.ts";
import { isValidCpfCnpj } from "../_shared/br-document.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";

type BillingType = "BOLETO" | "PIX";

interface ChargeRequest {
  customer_name: string;
  customer_email?: string;
  customer_cpf_cnpj: string;
  description: string;
  value: number;
  due_date: string;
  billing_type: BillingType;
  idempotency_key: string;
  cliente_id?: string;
}

interface AsaasPayment {
  id: string;
  status: string;
  value?: number;
  dueDate?: string;
  billingType?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  nossoNumero?: string;
  externalReference?: string;
}

interface AsaasListResponse<T> {
  data?: T[];
}

interface AsaasIdentification {
  identificationField?: string;
  nossoNumero?: string;
  barCode?: string;
}

interface AsaasWebhookConfiguration {
  url?: string;
  enabled?: boolean;
  interrupted?: boolean;
  events?: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_WEBHOOK_EVENTS = [
  "PAYMENT_UPDATED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_RECEIVED_IN_CASH_UNDONE",
  "PAYMENT_CHARGEBACK_REQUESTED",
] as const;

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function currentDateInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function safeProviderUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeWebhookUrl(value: unknown): string | null {
  const safeUrl = safeProviderUrl(value);
  if (!safeUrl) return null;
  const url = new URL(safeUrl);
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function getAsaasBaseUrl(): string {
  const environment = Deno.env.get("ASAAS_ENVIRONMENT");
  if (environment === "production") return "https://api.asaas.com/v3";
  if (environment === "sandbox") return "https://api-sandbox.asaas.com/v3";
  throw new Error("ASAAS_ENVIRONMENT deve ser 'sandbox' ou 'production'");
}

function validateCharge(raw: unknown): ChargeRequest {
  if (!raw || typeof raw !== "object") throw new Error("Payload inválido");
  const value = raw as Record<string, unknown>;
  const customerName = typeof value.customer_name === "string" ? value.customer_name.trim() : "";
  const email = typeof value.customer_email === "string" ? value.customer_email.trim().toLowerCase() : "";
  const document = typeof value.customer_cpf_cnpj === "string"
    ? value.customer_cpf_cnpj.replace(/\D/g, "")
    : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const amount = typeof value.value === "number" ? value.value : Number.NaN;
  const dueDate = typeof value.due_date === "string" ? value.due_date : "";
  const billingType = value.billing_type;
  const idempotencyKey = typeof value.idempotency_key === "string"
    ? value.idempotency_key.trim()
    : "";
  const clientId = typeof value.cliente_id === "string" ? value.cliente_id : undefined;

  if (customerName.length < 2 || customerName.length > 200) throw new Error("Nome do cliente inválido");
  if (email && !EMAIL_PATTERN.test(email)) throw new Error("Email do cliente inválido");
  if (!isValidCpfCnpj(document)) throw new Error("CPF/CNPJ inválido");
  if (!description || description.length > 500) throw new Error("Descrição inválida");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999.99) throw new Error("Valor inválido");
  if (!isValidIsoDate(dueDate)) {
    throw new Error("Data de vencimento inválida");
  }
  if (dueDate < currentDateInSaoPaulo()) throw new Error("O vencimento não pode estar no passado");
  if (billingType !== "BOLETO" && billingType !== "PIX") throw new Error("Forma de cobrança inválida");
  if (!/^[A-Za-z0-9:._-]{8,200}$/.test(idempotencyKey)) throw new Error("Chave de idempotência inválida");
  if (clientId && !UUID_PATTERN.test(clientId)) throw new Error("Cliente inválido");

  return {
    customer_name: customerName,
    customer_email: email || undefined,
    customer_cpf_cnpj: document,
    description,
    value: Math.round(amount * 100) / 100,
    due_date: dueDate,
    billing_type: billingType,
    idempotency_key: idempotencyKey,
    cliente_id: clientId,
  };
}

function assertPaymentMatchesRequest(payment: AsaasPayment, request: ChargeRequest): void {
  const paymentValue = typeof payment.value === "number" ? Math.round(payment.value * 100) : Number.NaN;
  if (
    payment.externalReference !== request.idempotency_key ||
    payment.billingType !== request.billing_type ||
    payment.dueDate !== request.due_date ||
    paymentValue !== Math.round(request.value * 100)
  ) {
    throw new Error("A cobrança existente não corresponde aos dados atuais da fatura");
  }
}

async function asaasRequest<T>(
  url: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(20_000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "AnjoLav-ERP/1.0",
      "access_token": apiKey,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Asaas request failed", { status: response.status, pathname: new URL(url).pathname });
    throw new Error(`Asaas rejeitou a operação (${response.status})`);
  }
  return payload as T;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const apiKey = Deno.env.get("ASAAS_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase service credentials are not configured");
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authorization = await requireAdmin(req, supabase);
  if (!authorization.ok) return authorization.response;

  try {
    const parsedBody = await readJsonBody(req, 32_768);
    if (!parsedBody.ok) return parsedBody.response;
    const rawBody = parsedBody.value;
    const isHealthCheck = Boolean(
      rawBody &&
        typeof rawBody === "object" &&
        !Array.isArray(rawBody) &&
        (rawBody as Record<string, unknown>).action === "health",
    );
    const environment = Deno.env.get("ASAAS_ENVIRONMENT");
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

    if (isHealthCheck) {
      const configured = Boolean(
        apiKey &&
          apiKey.length >= 20 &&
          (environment === "sandbox" || environment === "production"),
      );
      if (!configured || !apiKey) {
        return jsonResponse(req, {
          success: false,
          configured: false,
          environment: environment === "sandbox" || environment === "production" ? environment : null,
          webhookConfigured: Boolean(webhookToken && webhookToken.length >= 32),
        });
      }

      const baseUrl = getAsaasBaseUrl();
      const configuredWebhookUrl = Deno.env.get("ASAAS_WEBHOOK_PUBLIC_URL")?.trim() ||
        `${supabaseUrl.replace(/\/$/, "")}/functions/v1/asaas-webhook`;
      const expectedWebhookUrl = normalizeWebhookUrl(configuredWebhookUrl);
      const [, webhooks] = await Promise.all([
        asaasRequest<AsaasListResponse<AsaasPayment>>(`${baseUrl}/payments?limit=1`, apiKey),
        asaasRequest<AsaasListResponse<AsaasWebhookConfiguration>>(
          `${baseUrl}/webhooks?offset=0&limit=100`,
          apiKey,
        ),
      ]);
      const matchingWebhook = expectedWebhookUrl
        ? webhooks.data?.find((webhook) => normalizeWebhookUrl(webhook.url) === expectedWebhookUrl)
        : undefined;
      const webhookEvents = new Set(
        Array.isArray(matchingWebhook?.events)
          ? matchingWebhook.events.filter((event): event is string => typeof event === "string")
          : [],
      );
      const webhookTokenConfigured = Boolean(webhookToken && webhookToken.length >= 32);
      const webhookRegistered = Boolean(matchingWebhook);
      const webhookEnabled = matchingWebhook?.enabled === true;
      const webhookQueueHealthy = matchingWebhook?.interrupted === false;
      const webhookEventsConfigured = REQUIRED_WEBHOOK_EVENTS.every((event) => webhookEvents.has(event));
      return jsonResponse(req, {
        success: true,
        configured: true,
        environment,
        webhookConfigured: Boolean(
          webhookTokenConfigured &&
            webhookRegistered &&
            webhookEnabled &&
            webhookQueueHealthy &&
            webhookEventsConfigured
        ),
        webhookTokenConfigured,
        webhookRegistered,
        webhookEnabled,
        webhookQueueHealthy,
        webhookEventsConfigured,
      });
    }

    if (!apiKey || apiKey.length < 20) {
      return jsonResponse(req, { error: "Integração de cobrança não configurada" }, 503);
    }
    const baseUrl = getAsaasBaseUrl();
    const body = validateCharge(rawBody);

    if (body.cliente_id) {
      const { data: client, error: clientError } = await supabase
        .from("clientes")
        .select("id, razao_social, email, cpf_cnpj, ativo")
        .eq("tenant_id", authorization.tenantId)
        .eq("id", body.cliente_id)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!client?.ativo) throw new Error("Cliente inválido ou inativo");

      const clientDocument = typeof client.cpf_cnpj === "string"
        ? client.cpf_cnpj.replace(/\D/g, "")
        : "";
      if (!isValidCpfCnpj(clientDocument)) {
        throw new Error("O cliente não possui CPF/CNPJ válido para cobrança");
      }
      body.customer_name = client.razao_social.trim();
      body.customer_email = typeof client.email === "string" && EMAIL_PATTERN.test(client.email.trim())
        ? client.email.trim().toLowerCase()
        : undefined;
      body.customer_cpf_cnpj = clientDocument;
    }

    const existingPayments = await asaasRequest<AsaasListResponse<AsaasPayment>>(
      `${baseUrl}/payments?externalReference=${encodeURIComponent(body.idempotency_key)}&limit=1`,
      apiKey,
    );
    let payment = existingPayments.data?.find(
      (candidate) => candidate.externalReference === body.idempotency_key,
    );

    if (payment?.id) {
      if (!/^[A-Za-z0-9_-]{3,200}$/.test(payment.id)) {
        throw new Error("Asaas retornou uma cobrança inválida");
      }
      payment = await asaasRequest<AsaasPayment>(
        `${baseUrl}/payments/${encodeURIComponent(payment.id)}`,
        apiKey,
      );
      assertPaymentMatchesRequest(payment, body);
    }

    if (!payment) {
      const customers = await asaasRequest<AsaasListResponse<{ id: string }>>(
        `${baseUrl}/customers?cpfCnpj=${body.customer_cpf_cnpj}&limit=1`,
        apiKey,
      );
      let customerId = customers.data?.[0]?.id;
      if (customerId && !/^[A-Za-z0-9_-]{3,200}$/.test(customerId)) {
        throw new Error("Asaas retornou um cliente inválido");
      }

      if (!customerId) {
        const customer = await asaasRequest<{ id: string }>(`${baseUrl}/customers`, apiKey, {
          method: "POST",
          body: JSON.stringify({
            name: body.customer_name,
            email: body.customer_email,
            cpfCnpj: body.customer_cpf_cnpj,
          }),
        });
        customerId = customer.id;
        if (!/^[A-Za-z0-9_-]{3,200}$/.test(customerId)) {
          throw new Error("Asaas retornou um cliente inválido");
        }
      }

      payment = await asaasRequest<AsaasPayment>(`${baseUrl}/payments`, apiKey, {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: body.billing_type,
          value: body.value,
          dueDate: body.due_date,
          description: body.description,
          externalReference: body.idempotency_key,
        }),
      });
      assertPaymentMatchesRequest(payment, body);
    }

    if (!payment?.id || !/^[A-Za-z0-9_-]{3,200}$/.test(payment.id)) {
      throw new Error("Asaas retornou uma cobrança inválida");
    }
    if (!payment.status || !/^[A-Z0-9_]{2,80}$/.test(payment.status)) {
      throw new Error("Asaas retornou um status inválido");
    }

    let pixQrCode: string | null = null;
    let pixCopyPaste: string | null = null;
    let identificationField: string | null = null;
    let nossoNumero: string | null = null;
    if (body.billing_type === "PIX") {
      const pix = await asaasRequest<{ encodedImage?: string; payload?: string }>(
        `${baseUrl}/payments/${encodeURIComponent(payment.id)}/pixQrCode`,
        apiKey,
      );
      if (pix.encodedImage && (pix.encodedImage.length > 2_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pix.encodedImage))) {
        throw new Error("Asaas retornou um QR Code inválido");
      }
      if (pix.payload && pix.payload.length > 4_096) {
        throw new Error("Asaas retornou um código PIX inválido");
      }
      pixQrCode = pix.encodedImage ?? null;
      pixCopyPaste = pix.payload ?? null;
    } else {
      const identification = await asaasRequest<AsaasIdentification>(
        `${baseUrl}/payments/${encodeURIComponent(payment.id)}/identificationField`,
        apiKey,
        { method: "GET" },
      );
      const digits = typeof identification.identificationField === "string"
        ? identification.identificationField.replace(/\D/g, "")
        : "";
      if (digits.length < 44 || digits.length > 48) {
        throw new Error("Asaas não retornou uma linha digitável válida");
      }
      identificationField = digits;
      nossoNumero = typeof identification.nossoNumero === "string"
        ? identification.nossoNumero.slice(0, 100)
        : null;
    }

    const chargePayload = {
      tenant_id: authorization.tenantId,
      asaas_id: payment.id,
      external_reference: body.idempotency_key,
      cliente_id: body.cliente_id ?? null,
      customer_name: body.customer_name,
      customer_email: body.customer_email ?? null,
      customer_cpf_cnpj: body.customer_cpf_cnpj,
      description: body.description,
      value: body.value,
      due_date: body.due_date,
      billing_type: body.billing_type,
      status: payment.status,
      invoice_url: safeProviderUrl(payment.invoiceUrl),
      bank_slip_url: safeProviderUrl(payment.bankSlipUrl),
      pix_qr_code: pixQrCode,
      pix_copy_paste: pixCopyPaste,
    };

    const { data: existingCharge, error: lookupError } = await supabase
      .from("asaas_charges")
      .select("id")
      .eq("tenant_id", authorization.tenantId)
      .eq("asaas_id", payment.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const chargeQuery = existingCharge
      ? supabase.from("asaas_charges").update(chargePayload).eq("id", existingCharge.id)
      : supabase.from("asaas_charges").insert(chargePayload);
    const { data: charge, error: dbError } = await chargeQuery.select().single();
    if (dbError) throw dbError;

    return jsonResponse(req, {
      success: true,
      charge: {
        id: charge.id,
        asaasId: payment.id,
        status: payment.status,
        invoiceUrl: safeProviderUrl(payment.invoiceUrl),
        bankSlipUrl: safeProviderUrl(payment.bankSlipUrl),
        identificationField,
        nossoNumero,
        pixQrCode,
        pixCopyPaste,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const validationError = /inválid|obrigatóri|deve ser/.test(message);
    console.error("Falha na integração Asaas", { message });
    return jsonResponse(
      req,
      { error: validationError ? message : "Não foi possível criar a cobrança" },
      validationError ? 400 : 502,
    );
  }
});
