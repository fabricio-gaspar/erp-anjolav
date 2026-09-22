import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireModule } from "../_shared/auth.ts";
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
  cashRegisterId: string;
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
  const cashRegisterId = requireUuid(raw.cashRegisterId, "Caixa");
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

async function getOrCreatePix(
  supabase: SupabaseClient,
  orderId: string,
  cashRegisterId: string,
  moment: PaymentMoment,
  idempotencyKey: string,
  userId: string,
) {
  const { data: paymentByKey, error: paymentByKeyError } = await supabase
    .from("pdv_pagamentos")
    .select("id, ordem_servico_id, caixa_id, status, status_provedor, valor, asaas_charge_id, provedor_pagamento_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (paymentByKeyError) throw paymentByKeyError;

  const { data: activePayment, error: activePaymentError } = paymentByKey
    ? { data: null, error: null }
    : await supabase
        .from("pdv_pagamentos")
        .select("id, ordem_servico_id, caixa_id, status, status_provedor, valor, asaas_charge_id, provedor_pagamento_id")
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

  const { data: order, error: orderError } = await supabase
    .from("ordens_servico")
    .select("id, numero, cliente_id, valor_total, valor_pago, status, origem")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || !["residencial", "loja"].includes(order.origem) || order.status === "cancelada") {
    throw new RequestError("OS residencial inválida", 404);
  }
  const amount = Math.round((Number(order.valor_total ?? 0) - Number(order.valor_pago ?? 0)) * 100) / 100;
  if (amount <= 0) throw new RequestError("A OS não possui saldo pendente", 409);

  const { data: client, error: clientError } = await supabase
    .from("clientes")
    .select("id, razao_social, email, cpf_cnpj, ativo, classificacao")
    .eq("id", order.cliente_id)
    .maybeSingle();
  if (clientError) throw clientError;
  const document = typeof client?.cpf_cnpj === "string" ? client.cpf_cnpj.replace(/\D/g, "") : "";
  if (!client?.ativo || client.classificacao !== "residencial" || !isValidCpfCnpj(document)) {
    throw new RequestError("O cliente precisa ter CPF/CNPJ válido para gerar PIX", 409);
  }
  const candidateEmail = boundedText(client.email, 254)?.toLowerCase();
  const customerEmail = candidateEmail && EMAIL_PATTERN.test(candidateEmail) ? candidateEmail : undefined;

  const externalReference = idempotencyKey;
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
    supabase.from("categorias_financeiras").select("id").eq("nome", "Cobrança Asaas").eq("tipo", "receita").maybeSingle(),
    supabase.from("centros_custo").select("id").eq("nome", "Loja").maybeSingle(),
  ]);
  const chargePayload = {
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
    .eq("external_reference", externalReference)
    .maybeSingle();
  let charge = chargeLookup.data;
  if (chargeLookup.error) throw chargeLookup.error;
  if (charge) {
    const { error } = await supabase.from("asaas_charges").update(chargePayload).eq("id", charge.id);
    if (error) throw error;
  } else {
    const inserted = await supabase.from("asaas_charges").insert(chargePayload).select("id").single();
    if (inserted.error?.code === "23505") {
      const recovered = await supabase
        .from("asaas_charges")
        .select("id")
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

async function reconcilePix(supabase: SupabaseClient, paymentId: string) {
  const { data: payment, error: paymentError } = await supabase
    .from("pdv_pagamentos")
    .select("id, ordem_servico_id, asaas_charge_id, provedor_pagamento_id, idempotency_key, status, valor")
    .eq("id", paymentId)
    .eq("metodo", "PIX")
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment?.asaas_charge_id || !payment.provedor_pagamento_id) {
    throw new RequestError("Pagamento PIX não encontrado", 404);
  }
  const { data: order, error: orderError } = await supabase
    .from("ordens_servico")
    .select("origem")
    .eq("id", payment.ordem_servico_id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || !["residencial", "loja"].includes(order.origem)) throw new RequestError("Acesso negado", 403);

  const providerPayment = await asaasRequest<AsaasPayment>(
    `/payments/${encodeURIComponent(payment.provedor_pagamento_id)}`,
  );
  assertProviderPayment(providerPayment, payment.idempotency_key, Number(payment.valor));
  const paidAt = providerPayment.status === "RECEIVED" ? providerTimestamp(providerPayment) : null;
  const { error: chargeUpdateError } = await supabase
    .from("asaas_charges")
    .update({
      status: providerPayment.status,
      paid_at: paidAt,
    })
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
  const authorization = await requireModule(req, supabase, "caixa");
  if (!authorization.ok) return authorization.response;

  try {
    const parsedBody = await readJsonBody(req, 131_072);
    if (!parsedBody.ok) return parsedBody.response;
    if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
      throw new RequestError("Payload inválido");
    }
    const raw = parsedBody.value as Record<string, unknown>;
    const action = raw.action;

    if (action === "create_sale") {
      const sale = validateSale(raw);
      const rpcPayment = sale.payment && sale.payment.method !== "PIX"
        ? {
            metodo: sale.payment.method,
            valor_recebido: sale.payment.amountReceived ?? null,
            parcelas: sale.payment.installments,
            bandeira: sale.payment.brand ?? null,
            nsu: sale.payment.nsu ?? null,
            codigo_autorizacao: sale.payment.authorizationCode ?? null,
          }
        : null;
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
            sale.cashRegisterId,
            "ENTRADA",
            `${sale.idempotencyKey}:pix`,
            authorization.user.id,
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
      );
      return jsonResponse(req, { success: true, pix });
    }

    if (action === "get_pix_status") {
      const paymentId = requireUuid(raw.paymentId, "Pagamento");
      const payment = await reconcilePix(supabase, paymentId);
      return jsonResponse(req, { success: true, payment });
    }

    if (action === "record_payment") {
      const orderId = requireUuid(raw.orderId, "OS");
      const cashRegisterId = requireUuid(raw.cashRegisterId, "Caixa");
      const moment: PaymentMoment = raw.moment === "ENTRADA" ? "ENTRADA" : "RETIRADA";
      const idempotencyKey = requireIdempotencyKey(raw.idempotencyKey);
      const payment = validateManualPayment(raw.payment, true);
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

    if (action === "cancel_pix") {
      const paymentId = requireUuid(raw.paymentId, "Pagamento");
      const { data: payment, error: paymentError } = await supabase
        .from("pdv_pagamentos")
        .select("id, status, asaas_charge_id, provedor_pagamento_id, idempotency_key, valor")
        .eq("id", paymentId)
        .eq("metodo", "PIX")
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment?.asaas_charge_id || !payment.provedor_pagamento_id) {
        throw new RequestError("Pagamento PIX não encontrado", 404);
      }
      const current = await asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(payment.provedor_pagamento_id)}`);
      assertProviderPayment(current, payment.idempotency_key, Number(payment.valor));
      if (current.status === "RECEIVED") {
        await reconcilePix(supabase, payment.id);
        throw new RequestError("O PIX já foi recebido e não pode ser cancelado", 409);
      }
      await asaasRequest<unknown>(`/payments/${encodeURIComponent(payment.provedor_pagamento_id)}`, { method: "DELETE" });
      const { error: chargeError } = await supabase
        .from("asaas_charges")
        .update({ status: "DELETED" })
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
