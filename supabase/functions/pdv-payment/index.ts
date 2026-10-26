import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin, requireModule } from "../_shared/auth.ts";
import { isValidCpfCnpj } from "../_shared/br-document.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";

type ManualMethod = "DINHEIRO" | "CARTAO_CREDITO" | "CARTAO_DEBITO";
type PaymentMoment = "ENTRADA" | "RETIRADA";

interface ManualPaymentInput {
  method: ManualMethod;
  amount?: number;
  amountReceived?: number;
  installments: number;
  brand?: string;
  nsu?: string;
  authorizationCode?: string;
}

interface SaleItemInput {
  produto_id: string;
  quantidade: number;
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
}

interface SaleInput {
  action: "create_sale";
  clientId: string;
  cashRegisterId: string | null;
  deliveryDate: string;
  urgent: boolean;
  urgencyPercentage: number;
  discountAmount: number;
  driverId?: string;
  vehicleId?: string;
  items: SaleItemInput[];
  payment: ManualPaymentInput | { method: "PIX" } | null;
  idempotencyKey: string;
}

interface AsaasPayment {
  id: string;
  status: string;
  value?: number;
  dueDate?: string;
  paymentDate?: string;
  confirmedDate?: string;
  billingType?: string;
  externalReference?: string;
}

interface AsaasListResponse<T> {
  data?: T[];
}

interface PixQrCode {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9:._-]{8,200}$/;
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9_-]{3,200}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARD_BRANDS = new Set(["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OUTRA"]);
const PAYMENT_STATUS_FOR_REVERSAL = new Set(["CONFIRMADO", "EM_REVISAO"]);
const PAYMENT_METHODS_FOR_CORRECTION = new Set(["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "OUTRO"]);

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= maxLength ? text : undefined;
}

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new RequestError(`${field} inválido`);
  }
  return value;
}

function requireIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !IDEMPOTENCY_PATTERN.test(value)) {
    throw new RequestError("Chave de idempotência inválida");
  }
  return value;
}

function requireReason(value: unknown): string {
  const reason = boundedText(value, 1000);
  if (!reason || reason.length < 5) {
    throw new RequestError("Informe um motivo de estorno com ao menos 5 caracteres");
  }
  return reason;
}

function requireCorrectionMethod(value: unknown): string {
  if (typeof value !== "string") throw new RequestError("Forma de pagamento inválida");
  const method = value.trim().toUpperCase();
  if (!PAYMENT_METHODS_FOR_CORRECTION.has(method)) {
    throw new RequestError("Forma de pagamento inválida");
  }
  return method;
}

function money(value: unknown, field: string, allowZero = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RequestError(`${field} inválido`);
  const rounded = Math.round(value * 100) / 100;
  if (rounded < 0 || (!allowZero && rounded === 0) || rounded > 9_999_999.99) {
    throw new RequestError(`${field} inválido`);
  }
  return rounded;
}

function validateManualPayment(raw: unknown, requireAmount: boolean): ManualPaymentInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RequestError("Pagamento inválido");
  const input = raw as Record<string, unknown>;
  const method = input.method;
  if (method !== "DINHEIRO" && method !== "CARTAO_CREDITO" && method !== "CARTAO_DEBITO") {
    throw new RequestError("Método de pagamento inválido");
  }
  const amount = requireAmount ? money(input.amount, "Valor") : undefined;
  const installments = Number(input.installments ?? 1);
  if (!Number.isInteger(installments) || installments < 1 || installments > 24) {
    throw new RequestError("Parcelamento inválido");
  }
  if (method !== "CARTAO_CREDITO" && installments !== 1) {
    throw new RequestError("Apenas cartão de crédito pode ser parcelado");
  }
  const brand = boundedText(input.brand, 50)?.toUpperCase();
  const nsu = boundedText(input.nsu, 100);
  const authorizationCode = boundedText(input.authorizationCode, 100);
  if (method.startsWith("CARTAO_")) {
    if (brand && !CARD_BRANDS.has(brand)) throw new RequestError("Bandeira do cartão inválida");
    if (!nsu && !authorizationCode) {
      throw new RequestError("Informe o NSU ou o código de autorização da maquininha");
    }
  }
  const amountReceived = method === "DINHEIRO"
    ? money(input.amountReceived, "Valor recebido")
    : undefined;
  if (method === "DINHEIRO" && amount !== undefined && (amountReceived ?? 0) < amount) {
    throw new RequestError("O valor recebido é insuficiente");
  }
  return { method, amount, amountReceived, installments, brand, nsu, authorizationCode };
}

function validateSale(raw: Record<string, unknown>): SaleInput {
  const clientId = requireUuid(raw.clientId, "Cliente");
  const cashRegisterId = raw.cashRegisterId == null ? null : requireUuid(raw.cashRegisterId, "Caixa");
  const deliveryDate = typeof raw.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.deliveryDate)
    ? raw.deliveryDate
    : "";
  if (!deliveryDate) throw new RequestError("Previsão de entrega inválida");
  if (typeof raw.urgent !== "boolean") throw new RequestError("Indicador de urgência inválido");
  const urgencyPercentage = money(raw.urgencyPercentage, "Percentual de urgência", true);
  if (urgencyPercentage > 100 || (!raw.urgent && urgencyPercentage !== 0)) {
    throw new RequestError("Percentual de urgência inválido");
  }
  const discountAmount = money(raw.discountAmount, "Desconto", true);
  const idempotencyKey = requireIdempotencyKey(raw.idempotencyKey);
  const driverId = raw.driverId === undefined ? undefined : requireUuid(raw.driverId, "Motorista");
  const vehicleId = raw.vehicleId === undefined ? undefined : requireUuid(raw.vehicleId, "Veículo");
  if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > 200) {
    throw new RequestError("A venda deve possuir entre 1 e 200 itens");
  }
  const items = raw.items.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new RequestError("Item da venda inválido");
    }
    const item = candidate as Record<string, unknown>;
    const quantidade = Number(item.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 999) {
      throw new RequestError("Quantidade de item inválida");
    }
    return {
      produto_id: requireUuid(item.produto_id, "Produto"),
      quantidade,
      cor_item: boundedText(item.cor_item, 100),
      marca_item: boundedText(item.marca_item, 100),
      avarias: boundedText(item.avarias, 1_000),
      posicao_prateleira: boundedText(item.posicao_prateleira, 100),
      observacoes: boundedText(item.observacoes, 1_000),
    };
  });

  let payment: SaleInput["payment"] = null;
  if (raw.payment !== null && raw.payment !== undefined) {
    if (!raw.payment || typeof raw.payment !== "object" || Array.isArray(raw.payment)) {
      throw new RequestError("Pagamento inválido");
    }
    const method = (raw.payment as Record<string, unknown>).method;
    payment = method === "PIX" ? { method: "PIX" } : validateManualPayment(raw.payment, false);
  }
  if (payment && !cashRegisterId) throw new RequestError("Abra um caixa para receber o pagamento");
  return {
    action: "create_sale",
    clientId,
    cashRegisterId,
    deliveryDate,
    urgent: raw.urgent,
    urgencyPercentage,
    discountAmount,
    driverId,
    vehicleId,
    items,
    payment,
    idempotencyKey,
  };
}

function loyaltyPoints(value: unknown): number {
  const points = Number(value);
  if (!Number.isInteger(points) || points < 1 || points > 1_000_000) {
    throw new RequestError("Quantidade de pontos inválida");
  }
  return points;
}

async function getCustomerLoyaltySummary(
  supabase: SupabaseClient,
  tenantId: string,
  clientId: string,
) {
  const [{ data: config, error: configError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase
      .from("fidelidade_configuracoes")
      .select("ativo, valor_por_ponto, pontos_minimos_resgate")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("fidelidade_lancamentos")
      .select("pontos")
      .eq("tenant_id", tenantId)
      .eq("cliente_id", clientId),
  ]);

  if (configError || entriesError) throw configError ?? entriesError;

  const saldoPontos = Math.max(
    0,
    (entries ?? []).reduce((total, entry) => total + Number(entry.pontos ?? 0), 0),
  );
  const valorPorPonto = Number(config?.valor_por_ponto ?? 0);

  return {
    programaAtivo: config?.ativo === true,
    saldoPontos,
    valorSaldo: Math.round(saldoPontos * valorPorPonto * 100) / 100,
    pontosGanhosNestaOrdem: 0,
    pontosMinimosResgate: Number(config?.pontos_minimos_resgate ?? 0),
    valorPorPonto,
  };
}

type PdvArea = "industrial" | "residencial";
interface PdvScope {
  tenantId: string;
  areas: Set<PdvArea>;
}

// The service client bypasses RLS. Check both tenant and area before every
// lookup by client/order/payment id, including read-only and provider actions.
async function loadPdvScope(supabase: SupabaseClient, tenantId: string, userId: string): Promise<PdvScope> {
  const [employee, membership, grants] = await Promise.all([
    supabase.from("funcionarios").select("id").eq("tenant_id", tenantId).eq("user_id", userId).eq("ativo", true).maybeSingle(),
    supabase.from("tenant_memberships").select("role").eq("tenant_id", tenantId).eq("user_id", userId).eq("enabled", true).eq("is_active", true).maybeSingle(),
    supabase.from("area_permissoes").select("area").eq("tenant_id", tenantId).eq("user_id", userId),
  ]);
  if (employee.error || membership.error || grants.error) throw employee.error ?? membership.error ?? grants.error;
  if (!employee.data || !membership.data) throw new RequestError("Acesso negado", 403);
  const areas = new Set<PdvArea>();
  if (["owner", "admin"].includes(membership.data.role) || grants.data?.some((grant) => grant.area === "central")) {
    areas.add("industrial");
    areas.add("residencial");
  } else {
    for (const grant of grants.data ?? []) {
      if (grant.area === "industrial" || grant.area === "residencial") areas.add(grant.area);
    }
  }
  return { tenantId, areas };
}

function assertArea(scope: PdvScope, area: unknown): void {
  if ((area !== "industrial" && area !== "residencial") || !scope.areas.has(area)) {
    throw new RequestError("Sem permissão para o setor deste atendimento", 403);
  }
}

async function assertScopedClient(supabase: SupabaseClient, scope: PdvScope, clientId: string) {
  const { data, error } = await supabase.from("clientes").select("id, ativo, classificacao")
    .eq("tenant_id", scope.tenantId).eq("id", clientId).maybeSingle();
  if (error) throw error;
  if (!data) throw new RequestError("Cliente fora da empresa ativa", 403);
  assertArea(scope, data.classificacao);
  if (!data.ativo) throw new RequestError("Cliente inativo", 409);
  return data;
}

async function assertScopedOrder(supabase: SupabaseClient, scope: PdvScope, orderId: string) {
  const { data, error } = await supabase.from("ordens_servico")
    .select("id, numero, cliente_id, valor_total, valor_pago, status, origem, condicao_pagamento")
    .eq("tenant_id", scope.tenantId).eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!data) throw new RequestError("OS fora da empresa ativa", 403);
  assertArea(scope, data.origem === "loja" ? "residencial" : data.origem);
  return data;
}

function assertDirectPayment(order: { condicao_pagamento: string | null; status: string }): void {
  if (order.condicao_pagamento === "faturado") {
    throw new RequestError("Pedido faturado: receba pelo fechamento da fatura", 409);
  }
  if (order.status === "cancelada") throw new RequestError("OS cancelada", 409);
}

async function assertScopedCash(supabase: SupabaseClient, tenantId: string, cashRegisterId: string) {
  const { data, error } = await supabase.from("caixas").select("id, status")
    .eq("tenant_id", tenantId).eq("id", cashRegisterId).maybeSingle();
  if (error) throw error;
  if (!data) throw new RequestError("Caixa fora da empresa ativa", 403);
  if (data.status !== "ABERTO") throw new RequestError("O caixa precisa estar aberto", 409);
}

async function assertScopedPayment(supabase: SupabaseClient, scope: PdvScope, paymentId: string) {
  const { data, error } = await supabase.from("pdv_pagamentos").select("ordem_servico_id")
    .eq("tenant_id", scope.tenantId).eq("id", paymentId).maybeSingle();
  if (error) throw error;
  if (!data?.ordem_servico_id) throw new RequestError("Pagamento fora da empresa ativa", 403);
  return await assertScopedOrder(supabase, scope, data.ordem_servico_id);
}

async function assertScopedOrderAndCash(
  supabase: SupabaseClient,
  scope: PdvScope,
  orderId: string,
  cashRegisterId: string,
) {
  const [order] = await Promise.all([
    assertScopedOrder(supabase, scope, orderId),
    assertScopedCash(supabase, scope.tenantId, cashRegisterId),
  ]);
  assertDirectPayment(order);
  return order;
}

function dateInSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getAsaasBaseUrl(): string {
  const environment = Deno.env.get("ASAAS_ENVIRONMENT");
  if (environment === "production") return "https://api.asaas.com/v3";
  if (environment === "sandbox") return "https://api-sandbox.asaas.com/v3";
  throw new RequestError("Integração PIX não configurada", 503);
}

async function asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey || apiKey.length < 20) throw new RequestError("Integração PIX não configurada", 503);
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
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
    console.error("Asaas request failed", { status: response.status, path });
    throw new RequestError(`O provedor PIX rejeitou a operação (${response.status})`, 502);
  }
  return payload as T;
}

function assertProviderPayment(
  payment: AsaasPayment,
  externalReference: string,
  expectedValue: number,
): void {
  if (
    !PROVIDER_ID_PATTERN.test(payment.id) ||
    !/^[A-Z0-9_]{2,80}$/.test(payment.status) ||
    payment.externalReference !== externalReference ||
    payment.billingType !== "PIX" ||
    Math.round(Number(payment.value) * 100) !== Math.round(expectedValue * 100)
  ) {
    throw new RequestError("A cobrança PIX retornada não corresponde à OS", 502);
  }
}

function providerTimestamp(payment: AsaasPayment): string {
  for (const candidate of [payment.confirmedDate, payment.paymentDate]) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

async function getScopedProviderReference(supabase: SupabaseClient, tenantId: string, chargeId: string): Promise<string> {
  const { data, error } = await supabase.from("asaas_charges").select("external_reference")
    .eq("tenant_id", tenantId).eq("id", chargeId).maybeSingle();
  if (error) throw error;
  if (!data?.external_reference) throw new RequestError("Cobrança PIX fora da empresa ativa", 403);
  return data.external_reference;
}

async function getOrCreatePix(
  supabase: SupabaseClient,
  orderId: string,
  cashRegisterId: string,
  moment: PaymentMoment,
  idempotencyKey: string,
  userId: string,
  scope: PdvScope,
) {
  const { tenantId } = scope;
  // Validate before even returning a previous QR or contacting the provider.
  const order = await assertScopedOrderAndCash(supabase, scope, orderId, cashRegisterId);
  const { data: paymentByKey, error: paymentByKeyError } = await supabase
    .from("pdv_pagamentos")
    .select("id, ordem_servico_id, caixa_id, status, status_provedor, valor, asaas_charge_id, provedor_pagamento_id")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (paymentByKeyError) throw paymentByKeyError;

  const { data: activePayment, error: activePaymentError } = paymentByKey
    ? { data: null, error: null }
    : await supabase
        .from("pdv_pagamentos")
        .select("id, ordem_servico_id, caixa_id, status, status_provedor, valor, asaas_charge_id, provedor_pagamento_id")
        .eq("tenant_id", tenantId)
        .eq("ordem_servico_id", orderId)
        .eq("metodo", "PIX")
        .in("status", ["PENDENTE", "PROCESSANDO"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  if (activePaymentError) throw activePaymentError;

  // A reabertura do modal deve recuperar o PIX ativo da OS. Criar outra
  // cobrança antes de registrar a intenção local deixaria duplicatas no Asaas.
  const existingPayment = paymentByKey ?? activePayment;
  if (existingPayment) {
    if (existingPayment.ordem_servico_id !== orderId) {
      throw new RequestError("A chave de idempotência pertence a outra OS", 409);
    }
    if (existingPayment.caixa_id !== cashRegisterId) {
      throw new RequestError("A OS possui um PIX pendente vinculado a outro caixa", 409);
    }
    const { data: charge, error: chargeError } = await supabase
      .from("asaas_charges")
      .select("pix_qr_code, pix_copy_paste")
      .eq("tenant_id", tenantId)
      .eq("id", existingPayment.asaas_charge_id)
      .single();
    if (chargeError) throw chargeError;
    return {
      paymentId: existingPayment.id,
      paymentStatus: existingPayment.status,
      providerStatus: existingPayment.status_provedor,
      amount: Number(existingPayment.valor),
      qrCode: charge.pix_qr_code,
      copyPaste: charge.pix_copy_paste,
      expiresAt: null,
    };
  }

  const amount = Math.round((Number(order.valor_total ?? 0) - Number(order.valor_pago ?? 0)) * 100) / 100;
  if (amount <= 0) throw new RequestError("A OS não possui saldo pendente", 409);

  const { data: client, error: clientError } = await supabase
    .from("clientes")
    .select("id, razao_social, email, cpf_cnpj, ativo, classificacao")
    .eq("tenant_id", tenantId)
    .eq("id", order.cliente_id)
    .maybeSingle();
  if (clientError) throw clientError;
  const document = typeof client?.cpf_cnpj === "string" ? client.cpf_cnpj.replace(/\D/g, "") : "";
  if (client) assertArea(scope, client.classificacao);
  if (!client?.ativo || !isValidCpfCnpj(document)) {
    throw new RequestError("O cliente precisa ter CPF/CNPJ válido para gerar PIX", 409);
  }
  const candidateEmail = boundedText(client.email, 254)?.toLowerCase();
  const customerEmail = candidateEmail && EMAIL_PATTERN.test(candidateEmail) ? candidateEmail : undefined;

  // Provider searches are global to its account, so a caller-controlled key
  // alone must never recover a charge belonging to a different tenant/order.
  const referenceHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${tenantId}:${orderId}:${idempotencyKey}`));
  const externalReference = `pdv:${Array.from(new Uint8Array(referenceHash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const dueDate = dateInSaoPaulo();
  const existingPayments = await asaasRequest<AsaasListResponse<AsaasPayment>>(
    `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
  );
  let providerPayment = existingPayments.data?.find((item) => item.externalReference === externalReference);
  if (providerPayment?.id) {
    providerPayment = await asaasRequest<AsaasPayment>(
      `/payments/${encodeURIComponent(providerPayment.id)}`,
    );
    assertProviderPayment(providerPayment, externalReference, amount);
  }

  if (!providerPayment) {
    const customers = await asaasRequest<AsaasListResponse<{ id: string }>>(
      `/customers?cpfCnpj=${document}&limit=1`,
    );
    let customerId = customers.data?.[0]?.id;
    if (customerId && !PROVIDER_ID_PATTERN.test(customerId)) {
      throw new RequestError("O provedor retornou um cliente inválido", 502);
    }
    if (!customerId) {
      const customer = await asaasRequest<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: client.razao_social,
          email: customerEmail,
          cpfCnpj: document,
        }),
      });
      customerId = customer.id;
      if (!PROVIDER_ID_PATTERN.test(customerId)) {
        throw new RequestError("O provedor retornou um cliente inválido", 502);
      }
    }
    providerPayment = await asaasRequest<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: amount,
        dueDate,
        description: `AnjoLav ROL ${order.numero}`,
        externalReference,
      }),
    });
    assertProviderPayment(providerPayment, externalReference, amount);
  }

  const qrCode = await asaasRequest<PixQrCode>(
    `/payments/${encodeURIComponent(providerPayment.id)}/pixQrCode`,
  );
  if (qrCode.encodedImage && (qrCode.encodedImage.length > 2_000_000 || !/^[A-Za-z0-9+/=]+$/.test(qrCode.encodedImage))) {
    throw new RequestError("O provedor retornou uma imagem PIX inválida", 502);
  }
  if (!qrCode.payload || qrCode.payload.length > 4_096) {
    throw new RequestError("O provedor não retornou um PIX Copia e Cola válido", 502);
  }

  const [{ data: category }, { data: costCenter }] = await Promise.all([
    supabase.from("categorias_financeiras").select("id").eq("tenant_id", tenantId).eq("nome", "Cobrança Asaas").eq("tipo", "receita").maybeSingle(),
    supabase.from("centros_custo").select("id").eq("tenant_id", tenantId).eq("nome", order.origem === "industrial" ? "Industrial" : "Loja").maybeSingle(),
  ]);
  const chargePayload = {
    tenant_id: tenantId,
    asaas_id: providerPayment.id,
    external_reference: externalReference,
    cliente_id: client.id,
    customer_name: client.razao_social,
    customer_email: customerEmail ?? null,
    customer_cpf_cnpj: document,
    description: `AnjoLav ROL ${order.numero}`,
    value: amount,
    due_date: dueDate,
    billing_type: "PIX",
    status: providerPayment.status,
    pix_qr_code: qrCode.encodedImage ?? null,
    pix_copy_paste: qrCode.payload,
    categoria_id: category?.id ?? null,
    centro_custo_id: costCenter?.id ?? null,
  };
  const chargeLookup = await supabase
    .from("asaas_charges")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_reference", externalReference)
    .maybeSingle();
  let charge = chargeLookup.data;
  if (chargeLookup.error) throw chargeLookup.error;
  if (charge) {
    const { error } = await supabase.from("asaas_charges").update(chargePayload).eq("tenant_id", tenantId).eq("id", charge.id);
    if (error) throw error;
  } else {
    const inserted = await supabase.from("asaas_charges").insert(chargePayload).select("id").single();
    if (inserted.error?.code === "23505") {
      const recovered = await supabase
        .from("asaas_charges")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("external_reference", externalReference)
        .single();
      if (recovered.error) throw recovered.error;
      charge = recovered.data;
    } else if (inserted.error) {
      throw inserted.error;
    } else {
      charge = inserted.data;
    }
  }

  const { data: registered, error: registerError } = await supabase.rpc("registrar_intencao_pix_pdv", {
    _ordem_servico_id: orderId,
    _caixa_id: cashRegisterId,
    _asaas_charge_id: charge.id,
    _provedor_pagamento_id: providerPayment.id,
    _status_provedor: providerPayment.status,
    _idempotency_key: idempotencyKey,
    _momento: moment,
    _criado_por: userId,
  });
  if (registerError) throw registerError;

  let reconciliation = registered;
  if (providerPayment.status === "RECEIVED") {
    const paidAt = providerTimestamp(providerPayment);
    const reconciled = await supabase.rpc("reconciliar_pagamento_pdv", {
      _asaas_charge_id: charge.id,
      _status_provedor: providerPayment.status,
      _confirmado_em: paidAt,
      _evento: "PAYMENT_RECEIVED",
    });
    if (reconciled.error) throw reconciled.error;
    reconciliation = reconciled.data;
  }

  return {
    paymentId: reconciliation.paymentId,
    paymentStatus: reconciliation.paymentStatus,
    providerStatus: providerPayment.status,
    amount,
    qrCode: qrCode.encodedImage ?? null,
    copyPaste: qrCode.payload,
    expiresAt: boundedText(qrCode.expirationDate, 64) ?? null,
  };
}

async function reconcilePix(supabase: SupabaseClient, paymentId: string, scope: PdvScope) {
  const { tenantId } = scope;
  const { data: payment, error: paymentError } = await supabase
    .from("pdv_pagamentos")
    .select("id, ordem_servico_id, asaas_charge_id, provedor_pagamento_id, idempotency_key, status, valor")
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)
    .eq("metodo", "PIX")
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment?.asaas_charge_id || !payment.provedor_pagamento_id) {
    throw new RequestError("Pagamento PIX não encontrado", 404);
  }
  await assertScopedOrder(supabase, scope, payment.ordem_servico_id);
  const externalReference = await getScopedProviderReference(supabase, tenantId, payment.asaas_charge_id);

  const providerPayment = await asaasRequest<AsaasPayment>(
    `/payments/${encodeURIComponent(payment.provedor_pagamento_id)}`,
  );
  assertProviderPayment(providerPayment, externalReference, Number(payment.valor));
  const paidAt = providerPayment.status === "RECEIVED" ? providerTimestamp(providerPayment) : null;
  const { error: chargeUpdateError } = await supabase
    .from("asaas_charges")
    .update({
      status: providerPayment.status,
      paid_at: paidAt,
    })
    .eq("tenant_id", tenantId)
    .eq("id", payment.asaas_charge_id);
  if (chargeUpdateError) throw chargeUpdateError;

  const { data: result, error: reconcileError } = await supabase.rpc("reconciliar_pagamento_pdv", {
    _asaas_charge_id: payment.asaas_charge_id,
    _status_provedor: providerPayment.status,
    _confirmado_em: paidAt,
    _evento: "PAYMENT_UPDATED",
  });
  if (reconcileError) throw reconcileError;
  return result;
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
  try {
    const parsedBody = await readJsonBody(req, 131_072);
    if (!parsedBody.ok) return parsedBody.response;
    if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
      throw new RequestError("Payload inválido");
    }
    const raw = parsedBody.value as Record<string, unknown>;
    const action = raw.action;
    let authorization = await requireModule(req, supabase, "caixa");
    // Billing staff may create unpaid orders, but cannot receive money or
    // access payment histories/provider actions without the caixa permission.
    if (!authorization.ok && authorization.response.status === 403 && action === "create_sale" && raw.payment == null) {
      authorization = await requireModule(req, supabase, "faturamento");
    }
    if (!authorization.ok) return authorization.response;
    const scope = await loadPdvScope(supabase, authorization.tenantId, authorization.user.id);

    if (action === "create_sale") {
      const sale = validateSale(raw);
      await assertScopedClient(supabase, scope, sale.clientId);
      if (sale.cashRegisterId) await assertScopedCash(supabase, scope.tenantId, sale.cashRegisterId);
      for (const [table, id] of [["motoristas", sale.driverId], ["veiculos", sale.vehicleId]] as const) {
        if (!id) continue;
        const { data: reference, error: referenceError } = await supabase.from(table).select("id")
          .eq("tenant_id", scope.tenantId).eq("id", id).maybeSingle();
        if (referenceError) throw referenceError;
        if (!reference) throw new RequestError("Motorista ou veículo fora da empresa ativa", 403);
      }
      const rpcPayment = sale.payment && sale.payment.method !== "PIX"
        ? {
            metodo: sale.payment.method,
            valor_recebido: sale.payment.amountReceived ?? null,
            parcelas: sale.payment.installments,
            bandeira: sale.payment.brand ?? null,
            nsu: sale.payment.nsu ?? null,
            codigo_autorizacao: sale.payment.authorizationCode ?? null,
          }
        : sale.payment?.method === "PIX" ? { metodo: "PIX" } : null;
      const { data, error } = await supabase.rpc("criar_venda_pdv", {
        _cliente_id: sale.clientId,
        _caixa_id: sale.cashRegisterId,
        _data_previsao_entrega: sale.deliveryDate,
        _urgente: sale.urgent,
        _percentual_urgencia: sale.urgencyPercentage,
        _valor_desconto: sale.discountAmount,
        _motorista_id: sale.driverId ?? null,
        _veiculo_id: sale.vehicleId ?? null,
        _itens: sale.items,
        _pagamento: rpcPayment,
        _criado_por: authorization.user.id,
        _idempotency_key: sale.idempotencyKey,
      });
      if (error) throw error;
      const order = data.order as { id: string };
      let pix = null;
      let pixError = null;
      if (sale.payment?.method === "PIX") {
        try {
          pix = await getOrCreatePix(
            supabase,
            order.id,
            requireUuid(sale.cashRegisterId, "Caixa"),
            "ENTRADA",
            `${sale.idempotencyKey}:pix`,
            authorization.user.id,
            scope,
          );
        } catch (error: unknown) {
          pixError = error instanceof Error ? error.message : "Não foi possível gerar o PIX";
          console.error("A OS foi criada, mas o PIX não foi gerado", { orderId: order.id, message: pixError });
        }
      }
      return jsonResponse(req, { success: true, ...data, pix, pixError });
    }

    if (action === "create_pix") {
      const orderId = requireUuid(raw.orderId, "OS");
      const cashRegisterId = requireUuid(raw.cashRegisterId, "Caixa");
      const moment = raw.moment === "ENTRADA" ? "ENTRADA" : "RETIRADA";
      const idempotencyKey = requireIdempotencyKey(raw.idempotencyKey);
      const pix = await getOrCreatePix(
        supabase,
        orderId,
        cashRegisterId,
        moment,
        idempotencyKey,
        authorization.user.id,
        scope,
      );
      return jsonResponse(req, { success: true, pix });
    }

    if (action === "get_pix_status") {
      const paymentId = requireUuid(raw.paymentId, "Pagamento");
      const payment = await reconcilePix(supabase, paymentId, scope);
      return jsonResponse(req, { success: true, payment });
    }

    if (action === "list_payments") {
      const orderId = requireUuid(raw.orderId, "OS");
      const canManagePaymentsForUser = (await requireAdmin(req, supabase)).ok;
      await assertScopedOrder(supabase, scope, orderId);

      const { data: payments, error: paymentsError } = await supabase
        .from("pdv_pagamentos")
        .select("id, metodo, provedor, momento, status, status_provedor, valor, valor_recebido, troco, parcelas, bandeira, nsu, codigo_autorizacao, confirmado_em, cancelado_em, created_at, metadata")
        .eq("tenant_id", authorization.tenantId)
        .eq("ordem_servico_id", orderId)
        .order("created_at", { ascending: false });
      if (paymentsError) throw paymentsError;

      return jsonResponse(req, {
        success: true,
        payments: (payments ?? []).map((payment) => ({
          ...payment,
          canReverse: canManagePaymentsForUser &&
            PAYMENT_STATUS_FOR_REVERSAL.has(payment.status) &&
            ["MANUAL", "LEGACY"].includes(payment.provedor) &&
            payment.metodo !== "FIDELIDADE",
          canEdit: canManagePaymentsForUser &&
            PAYMENT_STATUS_FOR_REVERSAL.has(payment.status) &&
            ["MANUAL", "LEGACY"].includes(payment.provedor) &&
            payment.metodo !== "FIDELIDADE",
          reversalUnavailableReason: payment.status === "ESTORNADO"
            ? "Pagamento já estornado"
            : payment.provedor === "ASAAS" || payment.provedor === "TERMINAL_EXTERNO"
              ? "Exige estorno no provedor externo"
              : payment.metodo === "FIDELIDADE"
                ? "Exige reversão específica dos pontos"
                : undefined,
        })),
      });
    }

    if (action === "reverse_payment") {
      const adminAuthorization = await requireAdmin(req, supabase);
      if (!adminAuthorization.ok) return adminAuthorization.response;
      if (adminAuthorization.tenantId !== scope.tenantId) throw new RequestError("A empresa ativa mudou. Tente novamente", 409);
      const paymentId = requireUuid(raw.paymentId, "Pagamento");
      const reason = requireReason(raw.reason);
      await assertScopedPayment(supabase, scope, paymentId);
      const { data, error } = await supabase.rpc("estornar_pagamento_pdv", {
        _tenant_id: adminAuthorization.tenantId,
        _pagamento_id: paymentId,
        _motivo: reason,
        _estornado_por: adminAuthorization.user.id,
      });
      if (error) throw error;
      return jsonResponse(req, { success: true, payment: data });
    }

    if (action === "edit_payment") {
      const adminAuthorization = await requireAdmin(req, supabase);
      if (!adminAuthorization.ok) return adminAuthorization.response;
      if (adminAuthorization.tenantId !== scope.tenantId) throw new RequestError("A empresa ativa mudou. Tente novamente", 409);
      const paymentId = requireUuid(raw.paymentId, "Pagamento");
      const reason = requireReason(raw.reason);
      const newValue = money(raw.newValue, "Novo valor");
      const newMethod = requireCorrectionMethod(raw.newMethod);
      const order = await assertScopedPayment(supabase, scope, paymentId);
      assertDirectPayment(order);
      const { data, error } = await supabase.rpc("editar_pagamento_pdv", {
        _tenant_id: adminAuthorization.tenantId,
        _pagamento_id: paymentId,
        _novo_valor: newValue,
        _novo_metodo: newMethod,
        _motivo: reason,
        _editado_por: adminAuthorization.user.id,
      });
      if (error) throw error;
      return jsonResponse(req, { success: true, payment: data });
    }

    if (action === "record_payment") {
      const orderId = requireUuid(raw.orderId, "OS");
      const cashRegisterId = requireUuid(raw.cashRegisterId, "Caixa");
      const moment: PaymentMoment = raw.moment === "ENTRADA" ? "ENTRADA" : "RETIRADA";
      const idempotencyKey = requireIdempotencyKey(raw.idempotencyKey);
      const payment = validateManualPayment(raw.payment, true);
      await assertScopedOrderAndCash(supabase, scope, orderId, cashRegisterId);
      const { data, error } = await supabase.rpc("registrar_pagamento_pdv", {
        _ordem_servico_id: orderId,
        _caixa_id: cashRegisterId,
        _metodo: payment.method,
        _valor: payment.amount,
        _valor_recebido: payment.amountReceived ?? null,
        _parcelas: payment.installments,
        _bandeira: payment.brand ?? null,
        _nsu: payment.nsu ?? null,
        _codigo_autorizacao: payment.authorizationCode ?? null,
        _momento: moment,
        _idempotency_key: idempotencyKey,
        _criado_por: authorization.user.id,
      });
      if (error) throw error;
      return jsonResponse(req, { success: true, payment: data });
    }

    if (action === "redeem_loyalty") {
      const orderId = requireUuid(raw.orderId, "OS");
      const cashRegisterId = requireUuid(raw.cashRegisterId, "Caixa");
      const moment: PaymentMoment = raw.moment === "ENTRADA" ? "ENTRADA" : "RETIRADA";
      const idempotencyKey = requireIdempotencyKey(raw.idempotencyKey);
      const points = loyaltyPoints(raw.points);
      const order = await assertScopedOrderAndCash(supabase, scope, orderId, cashRegisterId);
      if (order.origem === "industrial") {
        throw new RequestError("O resgate de fidelidade está disponível somente para atendimentos residenciais", 409);
      }
      const { data, error } = await supabase.rpc("resgatar_pontos_fidelidade_pdv", {
        _ordem_servico_id: orderId,
        _caixa_id: cashRegisterId,
        _pontos: points,
        _momento: moment,
        _idempotency_key: idempotencyKey,
        _criado_por: authorization.user.id,
      });
      if (error) throw error;
      return jsonResponse(req, { success: true, payment: data });
    }

    if (action === "loyalty_summary") {
      const orderId = requireUuid(raw.orderId, "OS");
      await assertScopedOrder(supabase, scope, orderId);
      const { data, error } = await supabase.rpc("consultar_fidelidade_pdv", { _ordem_servico_id: orderId });
      if (error) throw error;
      return jsonResponse(req, { success: true, loyalty: data });
    }

    if (action === "loyalty_customer_summary") {
      const clientId = requireUuid(raw.clientId, "Cliente");
      await assertScopedClient(supabase, scope, clientId);

      const loyalty = await getCustomerLoyaltySummary(supabase, authorization.tenantId, clientId);
      return jsonResponse(req, { success: true, loyalty });
    }

    if (action === "cancel_pix") {
      const paymentId = requireUuid(raw.paymentId, "Pagamento");
      await assertScopedPayment(supabase, scope, paymentId);
      const { data: payment, error: paymentError } = await supabase
        .from("pdv_pagamentos")
        .select("id, status, asaas_charge_id, provedor_pagamento_id, idempotency_key, valor")
        .eq("tenant_id", authorization.tenantId)
        .eq("id", paymentId)
        .eq("metodo", "PIX")
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment?.asaas_charge_id || !payment.provedor_pagamento_id) {
        throw new RequestError("Pagamento PIX não encontrado", 404);
      }
      const externalReference = await getScopedProviderReference(supabase, scope.tenantId, payment.asaas_charge_id);
      const current = await asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(payment.provedor_pagamento_id)}`);
      assertProviderPayment(current, externalReference, Number(payment.valor));
      if (current.status === "RECEIVED") {
        await reconcilePix(supabase, payment.id, scope);
        throw new RequestError("O PIX já foi recebido e não pode ser cancelado", 409);
      }
      await asaasRequest<unknown>(`/payments/${encodeURIComponent(payment.provedor_pagamento_id)}`, { method: "DELETE" });
      const { error: chargeError } = await supabase
        .from("asaas_charges")
        .update({ status: "DELETED" })
        .eq("tenant_id", authorization.tenantId)
        .eq("id", payment.asaas_charge_id);
      if (chargeError) throw chargeError;
      const { data, error } = await supabase.rpc("cancelar_intencao_pagamento_pdv", {
        _pagamento_id: payment.id,
        _status_provedor: "DELETED",
      });
      if (error) throw error;
      return jsonResponse(req, { success: true, payment: data });
    }

    throw new RequestError("Ação inválida");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const status = error instanceof RequestError ? error.status : 500;
    console.error("Falha no fluxo de pagamento do PDV", { message, status });
    return jsonResponse(
      req,
      { error: status >= 500 ? "Não foi possível processar o pagamento" : message },
      status,
    );
  }
});
