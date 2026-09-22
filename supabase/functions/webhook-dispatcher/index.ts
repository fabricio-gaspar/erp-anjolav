import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";
import { requireAllowlistedHttpsUrl } from "../_shared/safe-url.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookToken = Deno.env.get("N8N_WEBHOOK_TOKEN");
  if (!supabaseUrl || !serviceRoleKey || !webhookToken || webhookToken.length < 32) {
    console.error("Webhook n8n ou credenciais Supabase não configurados de forma segura");
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authorization = await requireAdmin(req, supabase);
  if (!authorization.ok) return authorization.response;

  try {
    const parsedBody = await readJsonBody(req, 262_144);
    if (!parsedBody.ok) return parsedBody.response;
    if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
      return jsonResponse(req, { error: "JSON inválido" }, 400);
    }
    const body = parsedBody.value as Record<string, unknown>;
    const event = typeof body.evento === "string" ? body.evento.trim() : "";
    const orderId = typeof body.ordem_servico_id === "string" ? body.ordem_servico_id : "";
    const clientName = typeof body.cliente_nome === "string" ? body.cliente_nome.trim().slice(0, 200) : "";
    const clientPhone = typeof body.cliente_telefone === "string"
      ? body.cliente_telefone.replace(/\D/g, "").slice(0, 15)
      : "";
    const status = typeof body.status_os === "string" ? body.status_os.trim().slice(0, 80) : "";
    const shelf = typeof body.prateleira === "string" ? body.prateleira.trim().slice(0, 80) : null;
    const position = typeof body.posicao === "string" ? body.posicao.trim().slice(0, 80) : null;
    const items = Array.isArray(body.itens) ? body.itens.slice(0, 200) : [];
    const idempotencyKey = typeof body.idempotency_key === "string"
      ? body.idempotency_key.trim()
      : `${event}:${orderId}:${status}`;

    if (!/^[a-z0-9._-]{1,80}$/i.test(event) || !UUID_PATTERN.test(orderId)) {
      return jsonResponse(req, { error: "Evento ou ordem de serviço inválida" }, 400);
    }
    if (!/^[A-Za-z0-9:._-]{8,200}$/.test(idempotencyKey)) {
      return jsonResponse(req, { error: "Chave de idempotência inválida" }, 400);
    }

    const { data: instance, error: configError } = await supabase
      .from("whatsapp_instancias")
      .select("webhook_n8n_url")
      .limit(1)
      .maybeSingle();
    if (configError) throw configError;
    if (!instance?.webhook_n8n_url) {
      return jsonResponse(req, { error: "Webhook n8n não configurado" }, 409);
    }

    const webhookUrl = requireAllowlistedHttpsUrl(instance.webhook_n8n_url, "N8N_ALLOWED_HOSTS");
    const payload = {
      evento: event,
      ordem_servico_id: orderId,
      cliente: clientName,
      telefone: clientPhone,
      itens: items,
      status,
      prateleira: shelf,
      posicao: position,
      timestamp: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/json",
        "X-AnjoLav-Idempotency-Key": idempotencyKey,
        "X-AnjoLav-Webhook-Token": webhookToken,
      },
      body: JSON.stringify(payload),
    });
    const success = response.ok;

    const { error: logError } = await supabase.from("mensagens_log").insert({
      ordem_servico_id: orderId,
      telefone: "n8n",
      mensagem: `Webhook ${event} para a ordem ${orderId}`,
      evento: event,
      status: success ? "enviado" : "erro",
      erro: success ? null : `n8n retornou ${response.status}`,
      canal: "n8n",
    });
    if (logError) throw logError;

    return jsonResponse(req, { success, status: response.status }, success ? 200 : 502);
  } catch (error: unknown) {
    console.error("Falha ao despachar webhook", error instanceof Error ? error.message : "unknown");
    return jsonResponse(req, { error: "Falha ao despachar webhook" }, 500);
  }
});
