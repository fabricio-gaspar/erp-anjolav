import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { normalizeBrazilianWhatsApp } from "../_shared/wa-akg.ts";
import { processReservedDelivery, reserveDelivery } from "../_shared/wa-delivery.ts";

type AutomaticEvent = "rol_entrada" | "rol_pronto_retirada" | "rol_pronto_delivery";

type AuthorizedSender = {
  tenantId: string;
  userId: string;
};

type ServiceSupabaseClient = {
  auth: {
    getUser(token?: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  from(table: string): any;
};

const AUTOMATIC_EVENTS = new Set<AutomaticEvent>([
  "rol_entrada",
  "rol_pronto_retirada",
  "rol_pronto_delivery",
]);

const DEFAULT_TEMPLATES: Record<AutomaticEvent, string> = {
  rol_entrada: `*{empresa}*
{endereco_empresa}
Telefone: {telefone_empresa} · {email_empresa}
CNPJ: {cnpj_empresa}

*AVISO DE ENTRADA · ROL Nº {numero}*
Entrada: {data_entrada}
Previsão: {previsao}
Atendente: {atendente}
Modalidade: {modalidade}
Bloco: {bloco}
{delivery_details}

*DADOS DO CLIENTE*
Nome: {cliente}
Cód. cliente: {cliente_codigo}
Endereço: {cliente_endereco}
Telefone: {cliente_telefone}

*PEÇAS*
{itens}

Total de peças: {total_pecas}
Valor bruto: {valor_bruto}
Desconto: {desconto}
Lavagem Expressa: {acrescimo_express}
Total do ROL: {valor}
Total recebido: {valor_recebido}
A pagar: {a_pagar}

Informações para produção: {observacoes}
Assinatura do cliente: ____________________

{rodape}`,
  rol_pronto_retirada: `*{empresa}*
{endereco_empresa}
Telefone: {telefone_empresa} · {email_empresa}
CNPJ: {cnpj_empresa}

*AVISO DE DISPONIBILIDADE PARA RETIRADA · ROL Nº {numero}*
Disponível em: {data_disponibilidade}
Previsão original: {previsao}
Atendente: {atendente}
{delivery_details}

*DADOS DO CLIENTE*
Nome: {cliente}
Cód. cliente: {cliente_codigo}
Endereço: {cliente_endereco}
Telefone: {cliente_telefone}

*PEÇAS DISPONÍVEIS*
{itens}

Total de peças: {total_pecas}
Localização: {localizacao}
Lavagem Expressa: {acrescimo_express}
Valor do ROL: {valor}
Total recebido: {valor_recebido}
A pagar: {a_pagar}

Apresente este ROL no balcão para retirada.

{rodape}`,
  rol_pronto_delivery: `*{empresa}*
{endereco_empresa}
Telefone: {telefone_empresa} · {email_empresa}
CNPJ: {cnpj_empresa}

*AVISO DE DISPONIBILIDADE PARA DELIVERY · ROL Nº {numero}*
Disponível em: {data_disponibilidade}
Previsão: {previsao}
Atendente: {atendente}
{delivery_details}

*DADOS DO CLIENTE*
Nome: {cliente}
Cód. cliente: {cliente_codigo}
Endereço: {cliente_endereco}
Telefone: {cliente_telefone}

*PEÇAS PRONTAS*
{itens}

Total de peças: {total_pecas}
Localização: {localizacao}
Lavagem Expressa: {acrescimo_express}
Valor do ROL: {valor}
Total recebido: {valor_recebido}
A pagar: {a_pagar}

O ROL foi encaminhado para Agenda, coletas e rotas.

{rodape}`,
};

function allowedOrigins() {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([
    "https://anjolav-erp.fabriciogasparr.chatgpt.site",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    ...configured,
  ]);
}

async function idempotencyKeyForRecipient(baseKey: string, phone: string, isPrimary: boolean) {
  // Keep the primary phone's preexisting key stable so retries after deployment
  // do not resend ROLs already delivered by the previous version.
  if (isPrimary) return baseKey;
  const bytes = new TextEncoder().encode(phone);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const suffix = Array.from(new Uint8Array(digest).slice(0, 8), (value) => value.toString(16).padStart(2, "0")).join("");
  return `${baseKey}:phone:${suffix}`;
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function getBearer(req: Request) {
  const match = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function plainText(value: unknown, limit = 280) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

// Preserve the complete, multiline text supplied by the attendant.
function writtenDetails(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatCurrency(value: unknown) {
  const amount = Number(value);
  if (value === null || value === undefined || !Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    amount,
  );
}

function formatQuantity(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(amount);
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function addressText(address: Record<string, unknown> | null | undefined) {
  if (!address) return "";
  const street = [address.logradouro, address.numero, address.complemento]
    .map((value) => plainText(value, 100))
    .filter(Boolean)
    .join(", ");
  const locality = [address.bairro, address.cidade, address.uf]
    .map((value) => plainText(value, 80))
    .filter(Boolean)
    .join(" - ");
  const cep = plainText(address.cep, 20);
  return [street, locality, cep].filter(Boolean).join(" · ");
}

function configuredCnpj(value: unknown) {
  const text = plainText(value, 40);
  const digits = text.replace(/\D/g, "");
  return digits.length === 14 && !/^0+$/.test(digits) ? text : "";
}

function fillTemplate(template: string, variables: Record<string, string>) {
  const withoutMissingLines = template.split("\n").filter((line) =>
    !Object.entries(variables).some(([name, value]) => !value && line.includes(`{${name}}`))
  ).join("\n");
  return Object.entries(variables).reduce(
    (message, [name, value]) => message.split(`{${name}}`).join(value),
    withoutMissingLines,
  );
}

async function authorizeSender(req: Request, supabase: ServiceSupabaseClient): Promise<AuthorizedSender | null> {
  const token = getBearer(req);
  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenant:tenants!inner(status)")
    .eq("user_id", authData.user.id)
    .eq("enabled", true)
    .eq("is_active", true)
    .eq("tenant.status", "active")
    .maybeSingle();
  if (membershipError || !membership?.tenant_id) return null;

  const { data: adminMembership, error: adminError } = await supabase
    .from("tenant_memberships")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", authData.user.id)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (adminError) return null;
  if (adminMembership) return { tenantId: membership.tenant_id, userId: authData.user.id };

  const { data: employee, error: employeeError } = await supabase
    .from("funcionarios")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("user_id", authData.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (employeeError || !employee) return null;

  const { data: permission, error: permissionError } = await supabase
    .from("modulo_permissoes")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("funcionario_id", employee.id)
    .eq("tem_acesso", true)
    .in("modulo_key", ["caixa", "ordens", "producao"])
    .limit(1)
    .maybeSingle();
  if (permissionError || !permission) return null;

  return { tenantId: membership.tenant_id, userId: authData.user.id };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins().has(origin)) return json(req, { error: "Origem não autorizada" }, 403);
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (origin && !allowedOrigins().has(origin)) return json(req, { error: "Origem não autorizada" }, 403);
  if (req.method !== "POST" || !req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json(req, { error: "Método ou conteúdo inválido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(req, { error: "Integração WhatsApp não configurada" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json() as Record<string, unknown>;
    const evento = typeof body.evento === "string" ? body.evento : "";
    const orderId = typeof body.ordem_servico_id === "string" ? body.ordem_servico_id : "";
    if (!AUTOMATIC_EVENTS.has(evento as AutomaticEvent) || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return json(req, { error: "Evento ou ROL inválido" }, 400);
    }

    const authorization = await authorizeSender(req, supabase);
    if (!authorization) return json(req, { error: "Acesso negado" }, 403);

    // The service-role client bypasses RLS. Check this specific ROL with the
    // caller's JWT before reading any customer details or reserving delivery.
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("authorization") || "" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: visibleOrder, error: visibilityError } = await caller
      .from("ordens_servico").select("id")
      .eq("tenant_id", authorization.tenantId).eq("id", orderId).maybeSingle();
    if (visibilityError) throw visibilityError;
    if (!visibleOrder) return json(req, { error: "ROL indisponível para este usuário" }, 403);

    const { data: order, error: orderError } = await supabase
      .from("ordens_servico")
      .select("id, numero, cliente_id, atendente_id, created_at, data_retirada, data_previsao_entrega, entrega_modalidade, recebimento_modalidade, valor_total, taxa_entrega, delivery_modelo_snapshot, delivery_distancia_km_snapshot, delivery_taxa_base_snapshot, delivery_taxa_km_snapshot, valor_desconto, valor_pago, valor_acrescimo_express, urgente, percentual_urgencia, pago_na_entrada, observacoes, status, status_logistica")
      .eq("tenant_id", authorization.tenantId)
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json(req, { error: "ROL indisponível" }, 403);
    if (order.status === "cancelada") {
      return json(req, { error: "ROL cancelado não pode gerar aviso de entrada ou liberação" }, 409);
    }
    const idempotencyKey = evento === "rol_entrada"
      ? `rol:${order.id}:entrada`
      : `rol:${order.id}:disponivel:${evento === "rol_pronto_delivery" ? "entrega" : "balcao"}`;

    const { data: client, error: clientError } = await supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia, telefone, telefone2, ativo, whatsapp_opt_out")
      .eq("tenant_id", authorization.tenantId)
      .eq("id", order.cliente_id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return json(req, { error: "Cliente indisponível" }, 403);

    const [{ data: address, error: addressError }, { data: employee, error: employeeError }, { data: rolConfig, error: rolConfigError }] = await Promise.all([
      supabase.from("enderecos_clientes")
        .select("nome, logradouro, numero, complemento, bairro, cidade, uf, cep")
        .eq("cliente_id", client.id)
        .eq("ativo", true)
        .order("principal", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("funcionarios")
        .select("nome")
        .eq("tenant_id", authorization.tenantId)
        .eq("id", order.atendente_id || "00000000-0000-0000-0000-000000000000")
        .eq("ativo", true)
        .maybeSingle(),
      supabase.from("rol_configuracoes")
        .select("nome_curto, nome_completo, telefone, email, cnpj, endereco, texto_rodape, logo_url, exibir_logo")
        .eq("tenant_id", authorization.tenantId)
        .maybeSingle(),
    ]);
    if (addressError || employeeError || rolConfigError) {
      throw addressError ?? employeeError ?? rolConfigError;
    }

    const { data: templateConfig, error: templateError } = await supabase
      .from("notificacoes_config")
      .select("ativo, template")
      .eq("tenant_id", authorization.tenantId)
      .eq("canal", "whatsapp")
      .eq("evento", evento)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (templateError) throw templateError;
    if (templateConfig && !templateConfig.ativo) {
      return json(req, { success: true, skipped: true, reason: "template_inativo" });
    }

    const { data: itemRows, error: itemError } = await supabase
      .from("itens_ordem_servico")
      .select("quantidade, preco_unitario, subtotal, cor_item, marca_item, avarias, observacoes, posicao_prateleira, produto:produtos!itens_ordem_servico_produto_id_fkey(nome)")
      .eq("ordem_servico_id", order.id);
    if (itemError) throw itemError;

    const rawItems = (itemRows || []) as unknown as Array<{
      quantidade: number;
      preco_unitario: number | null;
      subtotal: number | null;
      cor_item: string | null;
      marca_item: string | null;
      avarias: string | null;
      observacoes: string | null;
      posicao_prateleira: string | null;
      produto: { nome: string } | Array<{ nome: string }> | null;
    }>;
    const items = rawItems.map((item) => ({
      ...item,
      produto: Array.isArray(item.produto) ? item.produto[0] ?? null : item.produto,
    }));
    if (items.length === 0) return json(req, { error: "ROL sem peças persistidas" }, 409);
    const allItemsPositioned = items.length > 0 && items.every((item) => Boolean(plainText(item.posicao_prateleira, 120)));
    const isReady = allItemsPositioned;
    if (evento !== "rol_entrada" && !isReady) {
      return json(req, { error: "O ROL só pode avisar o cliente após ficar pronto e ter todas as posições registradas" }, 409);
    }
    if (evento === "rol_pronto_retirada" && order.entrega_modalidade !== "balcao") {
      return json(req, { error: "Este ROL não é de retirada" }, 409);
    }
    if (evento === "rol_pronto_delivery" && order.entrega_modalidade !== "entrega") {
      return json(req, { error: "Este ROL não é de delivery" }, 409);
    }

    const itemSummary = items.map((item, index) => {
      const details = [
        `qtd.: ${formatQuantity(item.quantidade)}`,
        `unit.: ${formatCurrency(item.preco_unitario) || "não informado"}`,
        `total: ${formatCurrency(item.subtotal) || "não informado"}`,
        plainText(item.cor_item, 100) && `cor: ${plainText(item.cor_item, 100)}`,
        plainText(item.marca_item, 100) && `marca: ${plainText(item.marca_item, 100)}`,
        writtenDetails(item.avarias) && `avarias: ${writtenDetails(item.avarias)}`,
        writtenDetails(item.observacoes) && `obs.: ${writtenDetails(item.observacoes)}`,
        evento !== "rol_entrada" && plainText(item.posicao_prateleira, 120) && `local: ${plainText(item.posicao_prateleira, 120)}`,
      ].filter(Boolean).join(" · ");
      return `${index + 1}. ${plainText(item.produto?.nome || "Peça", 120)}\n   ${details}`;
    }).join("\n");
    const totalPieces = items.reduce((total, item) => total + (Number(item.quantidade) || 0), 0);
    const grossItemsValue = items.reduce((total, item) => total + (Number(item.subtotal) || 0), 0);
    const localizacao = [...new Set(items.map((item) => plainText(item.posicao_prateleira, 120)).filter(Boolean))].join(" · ");
    const deliveryMode = order.entrega_modalidade === "entrega" ? "Delivery" : "Retirada";
    const valorTotal = Number(order.valor_total ?? 0);
    const desconto = Number(order.valor_desconto ?? 0);
    const valorPago = Number(order.valor_pago ?? 0);
    const eventAt = new Date().toISOString();
    const expressSurcharge = Math.max(0, Number(order.valor_acrescimo_express ?? 0));
    const deliveryFee = Math.max(0, Number(order.taxa_entrega ?? 0));
    const deliveryKm = order.delivery_modelo_snapshot === "km" && order.delivery_distancia_km_snapshot != null
      ? Math.max(0, Number(order.delivery_distancia_km_snapshot))
      : null;
    const deliveryDetails = order.entrega_modalidade === "entrega"
      ? [
        `Taxa de delivery: ${formatCurrency(deliveryFee)}`,
        ...(deliveryKm == null ? [] : [
          `Distância cobrada: ${formatQuantity(deliveryKm)} km`,
          `Tarifa: base ${formatCurrency(order.delivery_taxa_base_snapshot)} + ${formatCurrency(order.delivery_taxa_km_snapshot)}/km`,
        ]),
      ].join("\n")
      : "";
    let template = templateConfig?.template || DEFAULT_TEMPLATES[evento as AutomaticEvent];
    // Templates personalizados não podem omitir os detalhes informados no ROL.
    if (!template.includes("{itens}")) template += "\n\n*PEÇAS*\n{itens}";
    if (!template.includes("{observacoes}")) template += "\n\nObservações do ROL: {observacoes}";
    let message = fillTemplate(template, {
      empresa: plainText(rolConfig?.nome_completo || rolConfig?.nome_curto, 160) || "ANJOLAV LAVANDERIA",
      endereco_empresa: plainText(rolConfig?.endereco, 220),
      telefone_empresa: plainText(rolConfig?.telefone, 80),
      email_empresa: plainText(rolConfig?.email, 120),
      cnpj_empresa: configuredCnpj(rolConfig?.cnpj),
      cliente: plainText(client.nome_fantasia || client.razao_social, 120),
      numero: plainText(order.numero, 80),
      data_entrada: formatDateTime(order.created_at),
      data_disponibilidade: formatDateTime(eventAt),
      atendente: plainText(employee?.nome, 120) || "Atendente do sistema",
      bloco: "não informado",
      cliente_codigo: "não cadastrado",
      cliente_endereco: addressText(address as Record<string, unknown> | null),
      cliente_telefone: plainText([client.telefone, client.telefone2].filter(Boolean).join(" / "), 80),
      itens: itemSummary,
      total_pecas: formatQuantity(totalPieces),
      valor_bruto: formatCurrency(grossItemsValue),
      desconto: formatCurrency(desconto),
      valor: formatCurrency(valorTotal),
      acrescimo_express: expressSurcharge > 0 ? `+ ${formatCurrency(expressSurcharge)}` : "",
      valor_recebido: formatCurrency(valorPago),
      a_pagar: formatCurrency(Math.max(0, valorTotal - valorPago)),
      previsao: formatDate(order.data_previsao_entrega),
      modalidade: deliveryMode,
      delivery_details: deliveryDetails,
      localizacao,
      observacoes: writtenDetails(order.observacoes),
      rodape: plainText(rolConfig?.texto_rodape, 240) || "AnjoLav · comprovante do ROL",
    }).trim();
    if (itemSummary && !message.includes(itemSummary)) message += `\n\n*PEÇAS*\n${itemSummary}`;
    const orderNotes = writtenDetails(order.observacoes);
    if (orderNotes && !message.includes(orderNotes)) message += `\n\nObservações do ROL: ${orderNotes}`;
    if (deliveryDetails && !message.includes(deliveryDetails)) message = `${message}\n\n${deliveryDetails}`;
    if (expressSurcharge > 0 && !/lavagem\s+expressa/i.test(message)) {
      const expressLine = `Lavagem Expressa: + ${formatCurrency(expressSurcharge)}`;
      const totalLine = /^(.*(?:Total|Valor)\s+do\s+ROL\s*:.*)$/im;
      if (totalLine.test(message)) message = message.replace(totalLine, `${expressLine}\n$1`);
      else message = `${message}\n${expressLine}`;
    }
    if (message.length > 4_000) return json(req, { success: false, skipped: true, reason: "MESSAGE_TOO_LONG" });
    if (!message || /\{[a-z_]+\}/i.test(message)) return json(req, { error: "Não foi possível montar a mensagem automática" }, 422);
    const phoneInputs = [
      { raw: client.telefone || "", slot: "primary" as const },
      { raw: client.telefone2 || "", slot: "secondary" as const },
    ].filter((item) => item.raw.trim());
    const seenPhones = new Set<string>();
    const recipients = phoneInputs.flatMap((item) => {
      const phone = normalizeBrazilianWhatsApp(item.raw);
      if (!phone || seenPhones.has(phone)) return [];
      seenPhones.add(phone);
      return [{ phone, slot: item.slot }];
    });
    const invalidPhoneCount = new Set(phoneInputs
      .filter((item) => !normalizeBrazilianWhatsApp(item.raw))
      .map((item) => item.raw.replace(/\D/g, "")))
      .size;
    const clientBlockedCode = !client.ativo ? "CLIENT_INACTIVE"
      : client.whatsapp_opt_out ? "CLIENT_OPT_OUT" : null;
    const reserveTargets = recipients.length > 0
      ? recipients
      : [{ phone: "", slot: "primary" as const }];
    const reservations: Array<{
      row: Awaited<ReturnType<typeof reserveDelivery>>["row"];
      duplicate: boolean;
      slot: "primary" | "secondary";
    }> = [];
    for (const recipient of reserveTargets) {
      const recipientKey = recipients.length === 0
        ? idempotencyKey
        : await idempotencyKeyForRecipient(idempotencyKey, recipient.phone, recipient.slot === "primary");
      const { row, duplicate } = await reserveDelivery(supabase, {
        tenantId: authorization.tenantId,
        orderId: order.id,
        clientId: client.id,
        phone: recipient.phone,
        message,
        event: evento,
        idempotencyKey: recipientKey,
        requestedBy: authorization.userId,
        blockedCode: clientBlockedCode || (recipients.length === 0 ? "PHONE_INVALID" : null),
      });
      reservations.push({ row, duplicate, slot: recipient.slot });
    }

    for (const item of reservations) {
      if (item.row.status === "pendente") {
        await processReservedDelivery(supabase, item.row.id, authorization.tenantId);
      }
    }

    const recipientResults = await Promise.all(reservations.map(async (item) => {
      const { data: current, error: statusError } = await supabase.from("mensagens_log")
        .select("status, last_error_code")
        .eq("tenant_id", authorization.tenantId)
        .eq("id", item.row.id)
        .single();
      if (statusError) throw statusError;
      return {
        sent: current.status === "enviado" || current.status === "entregue" || current.status === "lido",
        idempotent: item.duplicate,
        reason: current.last_error_code || current.status,
      };
    }));
    const sentCount = recipientResults.filter((item) => item.sent).length;
    const recipientCount = recipients.length + invalidPhoneCount;
    const success = recipientCount > 0 && sentCount === recipientCount;
    const failedCount = Math.max(0, recipientCount - sentCount);
    return json(req, {
      success,
      partial: sentCount > 0 && !success,
      skipped: Boolean(clientBlockedCode) || recipients.length === 0,
      idempotent: reservations.length > 0 && reservations.every((item) => item.duplicate),
      recipient_count: recipientCount,
      sent_count: sentCount,
      failed_count: failedCount,
      reason: recipientResults.find((item) => !item.sent)?.reason
        || (invalidPhoneCount > 0 ? "PHONE_INVALID" : recipientResults[0]?.reason),
    });
  } catch (error) {
    console.error("Falha na notificação automática do ROL", error instanceof Error ? error.message : "unknown");
    return json(req, { error: "Falha ao processar a notificação automática do ROL" }, 500);
  }
});


