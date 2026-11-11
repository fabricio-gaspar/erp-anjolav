import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { normalizeBrazilianWhatsApp } from "../_shared/wa-akg.ts";
import { processReservedDelivery, reserveDelivery } from "../_shared/wa-delivery.ts";

type AutomaticEvent = "rol_entrada" | "rol_pronto_retirada" | "rol_pronto_delivery";

type AuthorizedSender = {
  tenantId: string;
  userId: string;
};

const AUTOMATIC_EVENTS = new Set<AutomaticEvent>([
  "rol_entrada",
  "rol_pronto_retirada",
  "rol_pronto_delivery",
]);

const DEFAULT_TEMPLATES: Record<AutomaticEvent, string> = {
  rol_entrada: `Olá, {cliente}! Recebemos seu ROL de entrada nº {numero}.

Peças lançadas:
{itens}

Total de peças: {total_pecas}
Valor do ROL: {valor}
Previsão: {previsao}
Modalidade: {modalidade}`,
  rol_pronto_retirada: "Olá, {cliente}! Seu ROL nº {numero} está pronto e disponível para retirada. Total: {total_pecas} peça(s).",
  rol_pronto_delivery: "Olá, {cliente}! Seu ROL nº {numero} está pronto para entrega.\nPrevisão: {previsao}",
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

function fillTemplate(template: string, variables: Record<string, string>) {
  const withoutMissingLines = template.split("\n").filter((line) =>
    !Object.entries(variables).some(([name, value]) => !value && line.includes(`{${name}}`))
  ).join("\n");
  return Object.entries(variables).reduce(
    (message, [name, value]) => message.split(`{${name}}`).join(value),
    withoutMissingLines,
  );
}

async function authorizeSender(req: Request, supabase: ReturnType<typeof createClient>): Promise<AuthorizedSender | null> {
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
      .select("id, numero, cliente_id, valor_total, data_previsao_entrega, entrega_modalidade, status, status_logistica")
      .eq("tenant_id", authorization.tenantId)
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json(req, { error: "ROL indisponível" }, 403);
    const idempotencyKey = evento === "rol_entrada"
      ? `rol:${order.id}:entrada`
      : `rol:${order.id}:disponivel:${evento === "rol_pronto_delivery" ? "entrega" : "balcao"}`;

    const { data: client, error: clientError } = await supabase
      .from("clientes")
      .select("id, razao_social, nome_fantasia, telefone, ativo, whatsapp_opt_out")
      .eq("tenant_id", authorization.tenantId)
      .eq("id", order.cliente_id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return json(req, { error: "Cliente indisponível" }, 403);

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
      .select("quantidade, cor_item, marca_item, avarias, observacoes, posicao_prateleira, produto:produtos(nome)")
      .eq("ordem_servico_id", order.id);
    if (itemError) throw itemError;

    const items = (itemRows || []) as Array<{
      quantidade: number;
      cor_item: string | null;
      marca_item: string | null;
      avarias: string | null;
      observacoes: string | null;
      posicao_prateleira: string | null;
      produto: { nome: string } | null;
    }>;
    if (items.length === 0) return json(req, { error: "ROL sem peças persistidas" }, 409);
    const allItemsPositioned = items.length > 0 && items.every((item) => Boolean(plainText(item.posicao_prateleira, 120)));
    const isReady = order.status === "expedicao" && allItemsPositioned;
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
        plainText(item.cor_item, 80) && `cor: ${plainText(item.cor_item, 80)}`,
        plainText(item.marca_item, 80) && `marca: ${plainText(item.marca_item, 80)}`,
        plainText(item.avarias, 120) && `avarias: ${plainText(item.avarias, 120)}`,
        plainText(item.observacoes, 160) && `obs.: ${plainText(item.observacoes, 160)}`,
      ].filter(Boolean).join(" · ");
      return `${index + 1}. ${formatQuantity(item.quantidade)} × ${plainText(item.produto?.nome || "Peça", 120)}${details ? ` (${details})` : ""}`;
    }).join("\n");
    const totalPieces = items.reduce((total, item) => total + (Number(item.quantidade) || 0), 0);
    const deliveryMode = order.entrega_modalidade === "entrega" ? "Delivery" : "Retirada";
    const message = fillTemplate(templateConfig?.template || DEFAULT_TEMPLATES[evento as AutomaticEvent], {
      cliente: plainText(client.nome_fantasia || client.razao_social, 120),
      numero: plainText(order.numero, 80),
      itens: itemSummary,
      total_pecas: formatQuantity(totalPieces),
      valor: formatCurrency(order.valor_total),
      previsao: formatDate(order.data_previsao_entrega),
      modalidade: deliveryMode,
    }).trim();
    if (!message || message.length > 4_000 || /\{[a-z_]+\}/i.test(message)) {
      return json(req, { error: "A mensagem automática excede o limite de 4.000 caracteres" }, 422);
    }
    const phone = normalizeBrazilianWhatsApp(client.telefone || "");
    const blockedCode = !client.ativo ? "CLIENT_INACTIVE"
      : client.whatsapp_opt_out ? "CLIENT_OPT_OUT"
      : !phone ? "PHONE_INVALID" : null;
    const { row, duplicate } = await reserveDelivery(supabase, {
      tenantId: authorization.tenantId,
      orderId: order.id,
      clientId: client.id,
      phone: phone || "",
      message,
      event: evento,
      idempotencyKey,
      requestedBy: authorization.userId,
      blockedCode,
    });
    if (!duplicate && !blockedCode) {
      await processReservedDelivery(supabase, row.id, authorization.tenantId);
    }
    const { data: current, error: statusError } = await supabase.from("mensagens_log")
      .select("status, last_error_code").eq("tenant_id", authorization.tenantId).eq("id", row.id).single();
    if (statusError) throw statusError;
    return json(req, {
      success: current.status === "enviado" || current.status === "entregue" || current.status === "lido",
      skipped: Boolean(blockedCode),
      idempotent: duplicate,
      reason: current.last_error_code || current.status,
    });
  } catch (error) {
    console.error("Falha na notificação automática do ROL", error instanceof Error ? error.message : "unknown");
    return json(req, { error: "Falha ao processar a notificação automática do ROL" }, 500);
  }
});
