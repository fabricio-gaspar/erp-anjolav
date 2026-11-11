import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin, requireModule } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";
import { normalizeBrazilianWhatsApp, waAkgBaseUrl, waAkgRequest, waAkgSessionId } from "../_shared/wa-akg.ts";
import { processReservedDelivery, reserveDelivery } from "../_shared/wa-delivery.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT = /^[a-z0-9._-]{1,80}$/i;
const KEY = /^[A-Za-z0-9:._-]{8,200}$/;

function providerState(body: Record<string, unknown>): string {
  const data = body.data as Record<string, unknown> | undefined;
  return String(data?.status ?? data?.state ?? "desconectado").toLowerCase();
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalid = requireJsonPost(req);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse(req, { error: "Serviço indisponível" }, 503);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const parsed = await readJsonBody(req, 16_384);
    if (!parsed.ok) return parsed.response;
    const body = parsed.value as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse(req, { error: "JSON inválido" }, 400);
    }
    const action = typeof body.action === "string" ? body.action : "";
    const orderId = typeof body.ordem_servico_id === "string" ? body.ordem_servico_id : null;
    const invoiceId = typeof body.fatura_id === "string" ? body.fatura_id : null;
    const scoped = action === "send" && Boolean(orderId || invoiceId);
    const auth = scoped
      ? await requireModule(req, db, orderId ? "ordens" : "faturamento")
      : await requireAdmin(req, db);
    if (!auth.ok) return auth.response;

    if (["retry", "resolve"].includes(action)) {
      const id = typeof body.delivery_id === "string" ? body.delivery_id : "";
      if (!UUID.test(id)) return jsonResponse(req, { error: "Identificador inválido" }, 400);
      const { data: delivery, error } = await db.from("mensagens_log")
        .select("id, status, attempt_count, provider_attempted_at, updated_at")
        .eq("tenant_id", auth.tenantId).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!delivery) return jsonResponse(req, { error: "Envio não encontrado" }, 404);

      if (action === "retry") {
        if (delivery.status !== "falhou" || delivery.provider_attempted_at || delivery.attempt_count >= 3) {
          return jsonResponse(req, { error: "Esta tentativa não pode ser reenviada com segurança" }, 409);
        }
        const { data: reset, error: resetError } = await db.from("mensagens_log")
          .update({ status: "pendente", last_error_code: null, erro: null, requested_by: auth.user.id })
          .eq("tenant_id", auth.tenantId).eq("id", id).eq("status", "falhou")
          .is("provider_attempted_at", null).lt("attempt_count", 3).select("id").maybeSingle();
        if (resetError) throw resetError;
        if (!reset) return jsonResponse(req, { error: "A tentativa já mudou de estado" }, 409);
        await processReservedDelivery(db, id, auth.tenantId);
      } else {
        const resolution = body.resolution;
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";
        if (!["CONFIRMADO_ENVIADO", "CONFIRMADO_NAO_ENVIADO"].includes(String(resolution)) || reason.length < 10 || reason.length > 1_000) {
          return jsonResponse(req, { error: "Informe a decisão e evidência da conferência" }, 400);
        }
        if (delivery.status !== "incerto" && !(delivery.status === "processando" && Date.now() - Date.parse(delivery.updated_at) > 120_000)) {
          return jsonResponse(req, { error: "Somente resultado incerto pode ser conciliado" }, 409);
        }
        const { data: resolved, error: resolveError } = await db.from("mensagens_log")
          .update({
            status: resolution === "CONFIRMADO_ENVIADO" ? "enviado" : "falhou",
            provider_attempted_at: resolution === "CONFIRMADO_ENVIADO" ? delivery.provider_attempted_at : null,
            sent_at: resolution === "CONFIRMADO_ENVIADO" ? new Date().toISOString() : null,
            reconciled_at: new Date().toISOString(),
            reconciliation_result: resolution,
            reconciliation_reason: reason,
            requested_by: auth.user.id,
            last_error_code: resolution === "CONFIRMADO_ENVIADO" ? null : "MANUALLY_CONFIRMED_NOT_SENT",
            erro: null,
          })
          .eq("tenant_id", auth.tenantId).eq("id", id).eq("status", delivery.status)
          .select("id").maybeSingle();
        if (resolveError) throw resolveError;
        if (!resolved) return jsonResponse(req, { error: "A tentativa já mudou de estado" }, 409);
      }
      const { data: current, error: currentError } = await db.from("mensagens_log")
        .select("status, last_error_code").eq("tenant_id", auth.tenantId).eq("id", id).single();
      if (currentError) throw currentError;
      return jsonResponse(req, { success: current.status === "enviado", status: current.status, reason: current.last_error_code });
    }

    if (!["connect", "status", "disconnect", "send"].includes(action)) {
      return jsonResponse(req, { error: "Ação inválida" }, 400);
    }
    if (action !== "send") {
    const { data: instance, error: instanceError } = await db.from("whatsapp_instancias")
      .select("id, api_url, qr_code").eq("tenant_id", auth.tenantId).maybeSingle();
    if (instanceError) throw instanceError;
    if (!instance?.api_url) return jsonResponse(req, { error: "URL WA-AKG não configurada" }, 409);
    const apiKey = Deno.env.get("WA_AKG_API_KEY");
    if (!apiKey) return jsonResponse(req, { error: "Chave WA-AKG não configurada no servidor" }, 503);
    const baseUrl = waAkgBaseUrl(instance.api_url);
    const sessionId = waAkgSessionId(auth.tenantId);

    if (action === "connect") {
      const current = await waAkgRequest(baseUrl, apiKey, `sessions/${sessionId}`, { method: "GET" });
      if (current.response.status === 404) {
        const created = await waAkgRequest(baseUrl, apiKey, "sessions", {
          method: "POST", body: JSON.stringify({ name: `AnjoLav ${auth.tenantId.slice(0, 8)}`, sessionId }),
        });
        if (!created.response.ok) return jsonResponse(req, { error: "WA-AKG não criou a sessão" }, 502);
      } else if (!current.response.ok) {
        return jsonResponse(req, { error: "WA-AKG não respondeu à consulta da sessão" }, 502);
      }
      const started = await waAkgRequest(baseUrl, apiKey, `sessions/${sessionId}/start`, { method: "POST" });
      if (!started.response.ok && started.response.status !== 409) {
        return jsonResponse(req, { error: "WA-AKG não iniciou a sessão" }, 502);
      }
      const qr = await waAkgRequest(baseUrl, apiKey, `sessions/${sessionId}/qr`, { method: "GET" });
      const qrData = qr.body.data as Record<string, unknown> | undefined;
      const qrCode = typeof qrData?.base64 === "string" ? qrData.base64.replace(/^data:image\/png;base64,/, "") : null;
      const connected = providerState(started.body) === "connected";
      const { error: updateError } = await db.from("whatsapp_instancias")
        .update({ status: connected ? "conectado" : "aguardando_scan", qr_code: qrCode })
        .eq("tenant_id", auth.tenantId).eq("id", instance.id);
      if (updateError) throw updateError;
      return jsonResponse(req, { success: true, connected, qr_code: qrCode });
    }
    if (action === "status") {
      const result = await waAkgRequest(baseUrl, apiKey, `sessions/${sessionId}`, { method: "GET" });
      if (!result.response.ok) return jsonResponse(req, { error: "Não foi possível consultar a sessão WA-AKG" }, 502);
      const connected = providerState(result.body) === "connected";
      const status = connected ? "conectado" : "desconectado";
      const { error: updateError } = await db.from("whatsapp_instancias")
        .update({ status, qr_code: connected ? null : instance.qr_code })
        .eq("tenant_id", auth.tenantId).eq("id", instance.id);
      if (updateError) throw updateError;
      return jsonResponse(req, { success: true, connected, status });
    }
    if (action === "disconnect") {
      const result = await waAkgRequest(baseUrl, apiKey, `sessions/${sessionId}/logout`, { method: "POST" });
      if (!result.response.ok) return jsonResponse(req, { error: "WA-AKG não confirmou a desconexão" }, 502);
      const { error: updateError } = await db.from("whatsapp_instancias")
        .update({ status: "desconectado", qr_code: null })
        .eq("tenant_id", auth.tenantId).eq("id", instance.id);
      if (updateError) throw updateError;
      return jsonResponse(req, { success: true });
    }
    }
    if ((orderId && invoiceId) || (orderId && !UUID.test(orderId)) || (invoiceId && !UUID.test(invoiceId))) {
      return jsonResponse(req, { error: "Referência inválida" }, 400);
    }
    if (orderId || invoiceId) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anonKey) return jsonResponse(req, { error: "Validação de acesso indisponível" }, 503);
      const caller = createClient(url, anonKey, {
        global: { headers: { Authorization: req.headers.get("authorization") || "" } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: visible, error: visibilityError } = await caller
        .from(orderId ? "ordens_servico" : "faturas").select("id")
        .eq("tenant_id", auth.tenantId).eq("id", orderId || invoiceId).maybeSingle();
      if (visibilityError) throw visibilityError;
      if (!visible) return jsonResponse(req, { error: "Referência indisponível para este usuário" }, 403);
    }
    const message = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
    const event = typeof body.evento === "string" ? body.evento : "manual";
    if (!message || message.length > 4_000 || !EVENT.test(event) || event.startsWith("rol_")) {
      return jsonResponse(req, { error: "Mensagem ou evento inválido" }, 400);
    }
    let clientId: string | null = null;
    let rawPhone = typeof body.telefone === "string" ? body.telefone : "";
    if (orderId || invoiceId) {
      const { data: reference, error: referenceError } = await db.from(orderId ? "ordens_servico" : "faturas")
        .select("cliente_id").eq("tenant_id", auth.tenantId).eq("id", orderId || invoiceId).maybeSingle();
      if (referenceError) throw referenceError;
      if (!reference?.cliente_id || (body.cliente_id && body.cliente_id !== reference.cliente_id)) {
        return jsonResponse(req, { error: "Cliente ou referência indisponível" }, 403);
      }
      clientId = reference.cliente_id;
    } else if (event !== "teste") {
      return jsonResponse(req, { error: "Envio sem pedido somente para destinatário de teste" }, 400);
    }
    let blockedCode: string | null = null;
    if (clientId) {
      const { data: client, error: clientError } = await db.from("clientes")
        .select("ativo, whatsapp_opt_out, telefone")
        .eq("tenant_id", auth.tenantId).eq("id", clientId).maybeSingle();
      if (clientError) throw clientError;
      rawPhone = client?.telefone || "";
      blockedCode = !client?.ativo ? "CLIENT_INACTIVE" : client.whatsapp_opt_out ? "CLIENT_OPT_OUT" : null;
    }
    const phone = normalizeBrazilianWhatsApp(rawPhone);
    if (!phone) blockedCode ??= "PHONE_INVALID";
    const suppliedKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
    if (suppliedKey && !KEY.test(suppliedKey)) return jsonResponse(req, { error: "Chave de envio inválida" }, 400);
    const idempotencyKey = invoiceId && event === "fatura_envio"
      ? `fatura:${invoiceId}:envio`
      : suppliedKey || `manual:${crypto.randomUUID()}`;
    const { row, duplicate } = await reserveDelivery(db, {
      tenantId: auth.tenantId, orderId, invoiceId, clientId, phone: phone || "",
      message, event, idempotencyKey, requestedBy: auth.user.id, blockedCode,
    });
    if (!duplicate && !blockedCode) await processReservedDelivery(db, row.id, auth.tenantId);
    const { data: current, error: resultError } = await db.from("mensagens_log")
      .select("status, last_error_code, provider_message_id")
      .eq("tenant_id", auth.tenantId).eq("id", row.id).single();
    if (resultError) throw resultError;
    const success = ["enviado", "entregue", "lido"].includes(current.status);
    const failureText: Record<string, string> = {
      CLIENT_INACTIVE: "Cliente inativo para WhatsApp",
      CLIENT_OPT_OUT: "O cliente bloqueou mensagens por WhatsApp",
      PHONE_INVALID: "Telefone WhatsApp ausente ou inválido",
      PROVIDER_DISABLED: "Envio WA-AKG desativado",
      PROVIDER_UNCONFIGURED: "WA-AKG não configurado",
      PROVIDER_URL_INVALID: "URL WA-AKG não autorizada",
      PHONE_CHANGED: "Telefone do cliente foi alterado; confira antes de reenviar",
    };
    return jsonResponse(req, {
      success, idempotent: duplicate, status: current.status,
      reason: current.last_error_code, providerMessageId: current.provider_message_id,
      error: success ? null : failureText[current.last_error_code] || "O envio não foi confirmado; consulte o histórico",
    });
  } catch (error) {
    console.error("Falha no gateway WA-AKG", error instanceof Error ? error.message : "unknown");
    return jsonResponse(req, { error: "Falha ao processar o WhatsApp" }, 500);
  }
});
