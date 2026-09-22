import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin, requireModule } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";
import { requireAllowlistedHttpsUrl } from "../_shared/safe-url.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function providerRequest(
  url: URL,
  apiKey: string,
  init: RequestInit,
): Promise<{ response: Response; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, data };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !apiKey) {
    console.error("Evolution API or Supabase credentials are not configured");
    return jsonResponse(req, { error: "Integração WhatsApp não configurada" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const parsedBody = await readJsonBody(req, 16_384);
    if (!parsedBody.ok) return parsedBody.response;
    if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
      return jsonResponse(req, { error: "JSON inválido" }, 400);
    }
    const body = parsedBody.value as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const hasScopedOrderReferences = action === "send" &&
      typeof body.ordem_servico_id === "string" &&
      typeof body.fatura_id !== "string";
    const hasScopedInvoiceReferences = action === "send" &&
      typeof body.fatura_id === "string" &&
      typeof body.ordem_servico_id !== "string";
    const authorization = hasScopedOrderReferences
      ? await requireModule(req, supabase, "ordens")
      : hasScopedInvoiceReferences
        ? await requireModule(req, supabase, "faturamento")
        : await requireAdmin(req, supabase);
    if (!authorization.ok) return authorization.response;

    const { data: instance, error: configError } = await supabase
      .from("whatsapp_instancias")
      .select("id, api_url, nome_instancia, qr_code")
      .limit(1)
      .maybeSingle();
    if (configError) throw configError;
    if (!instance?.api_url) return jsonResponse(req, { error: "URL da Evolution API não configurada" }, 409);

    const apiUrl = requireAllowlistedHttpsUrl(instance.api_url, "EVOLUTION_ALLOWED_HOSTS");
    const instanceName = instance.nome_instancia || "loja1";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(instanceName)) {
      return jsonResponse(req, { error: "Nome da instância inválido" }, 409);
    }

    const endpoint = (path: string) => new URL(path, `${apiUrl.toString().replace(/\/$/, "")}/`);

    if (action === "connect") {
      const creation = await providerRequest(endpoint("instance/create"), apiKey, {
        method: "POST",
        body: JSON.stringify({ instanceName }),
      });
      if (!creation.response.ok && creation.response.status !== 409) {
        return jsonResponse(req, { error: "Não foi possível preparar a instância WhatsApp" }, 502);
      }

      const connection = await providerRequest(
        endpoint(`instance/connect/${encodeURIComponent(instanceName)}`),
        apiKey,
        { method: "GET" },
      );
      if (!connection.response.ok) {
        return jsonResponse(req, { error: "Não foi possível obter o QR Code" }, 502);
      }

      const nestedQr = connection.data.qrcode as Record<string, unknown> | undefined;
      const qrCode = typeof connection.data.base64 === "string"
        ? connection.data.base64
        : typeof nestedQr?.base64 === "string"
          ? nestedQr.base64
          : null;

      const { error: updateError } = await supabase
        .from("whatsapp_instancias")
        .update({ qr_code: qrCode, status: "aguardando_scan" })
        .eq("id", instance.id);
      if (updateError) throw updateError;
      return jsonResponse(req, { success: true, qr_code: qrCode });
    }

    if (action === "status") {
      const statusResult = await providerRequest(
        endpoint(`instance/connectionState/${encodeURIComponent(instanceName)}`),
        apiKey,
        { method: "GET" },
      );
      if (!statusResult.response.ok) {
        return jsonResponse(req, { error: "Não foi possível consultar o WhatsApp" }, 502);
      }

      const nestedInstance = statusResult.data.instance as Record<string, unknown> | undefined;
      const state = nestedInstance?.state ?? statusResult.data.state;
      const connected = state === "open";
      const newStatus = connected ? "conectado" : "desconectado";
      const { error: updateError } = await supabase
        .from("whatsapp_instancias")
        .update({ status: newStatus, qr_code: connected ? null : instance.qr_code })
        .eq("id", instance.id);
      if (updateError) throw updateError;
      return jsonResponse(req, { success: true, connected, status: newStatus });
    }

    if (action === "send") {
      let rawPhone = typeof body.telefone === "string" ? body.telefone : "";
      const message = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
      const orderId = typeof body.ordem_servico_id === "string" ? body.ordem_servico_id : null;
      const invoiceId = typeof body.fatura_id === "string" ? body.fatura_id : null;
      const requestedClientId = typeof body.cliente_id === "string" ? body.cliente_id : null;
      let clientId = requestedClientId;
      const event = typeof body.evento === "string" && /^[a-z0-9._-]{1,80}$/i.test(body.evento)
        ? body.evento
        : "manual";

      if (!message || message.length > 4_000) {
        return jsonResponse(req, { error: "Mensagem vazia ou acima de 4.000 caracteres" }, 400);
      }
      const scopedReferenceCount = Number(Boolean(orderId)) + Number(Boolean(invoiceId));
      if (scopedReferenceCount > 1 || (requestedClientId && scopedReferenceCount !== 1)) {
        return jsonResponse(
          req,
          { error: "Cliente informado exige exatamente uma referência; ordem e fatura são mutuamente exclusivas" },
          400,
        );
      }
      if (
        (orderId && !UUID_PATTERN.test(orderId)) ||
        (invoiceId && !UUID_PATTERN.test(invoiceId)) ||
        (requestedClientId && !UUID_PATTERN.test(requestedClientId))
      ) {
        return jsonResponse(req, { error: "Referência de ordem, fatura ou cliente inválida" }, 400);
      }

      if (orderId || invoiceId) {
        if (orderId) {
          const { data: order, error: orderError } = await supabase
            .from("ordens_servico")
            .select("id, cliente_id")
            .eq("id", orderId)
            .maybeSingle();
          if (orderError) throw orderError;
          if (!order) {
            return jsonResponse(req, { error: "Ordem indisponível" }, 403);
          }
          clientId = order.cliente_id;
        }

        if (invoiceId) {
          const { data: invoice, error: invoiceError } = await supabase
            .from("faturas")
            .select("id, cliente_id")
            .eq("id", invoiceId)
            .maybeSingle();
          if (invoiceError) throw invoiceError;
          if (!invoice) {
            return jsonResponse(req, { error: "Fatura indisponível" }, 403);
          }
          clientId = invoice.cliente_id;
        }

        if (!clientId || (requestedClientId && requestedClientId !== clientId)) {
          return jsonResponse(req, { error: "Referência de cliente divergente" }, 403);
        }

        const { data: client, error: clientError } = await supabase
          .from("clientes")
          .select("id, telefone, ativo")
          .eq("id", clientId)
          .maybeSingle();
        if (clientError) throw clientError;
        if (!client?.ativo) {
          return jsonResponse(req, { error: "Cliente indisponível para envio" }, 403);
        }
        rawPhone = client.telefone ?? "";
      }

      const digits = rawPhone.replace(/\D/g, "");
      const normalizedPhone = digits.startsWith("55") ? digits : `55${digits}`;
      if (!/^55\d{10,11}$/.test(normalizedPhone)) {
        return jsonResponse(req, { error: "Telefone inválido" }, 400);
      }

      const sending = await providerRequest(
        endpoint(`message/sendText/${encodeURIComponent(instanceName)}`),
        apiKey,
        {
          method: "POST",
          body: JSON.stringify({
            number: normalizedPhone,
            textMessage: { text: message },
          }),
        },
      );
      const providerStatus = typeof sending.data.status === "string"
        ? sending.data.status.toLowerCase()
        : "";
      const success = sending.response.ok && !["error", "failed", "rejected"].includes(providerStatus);
      const providerKey = sending.data.key as Record<string, unknown> | undefined;
      const providerMessageId = typeof providerKey?.id === "string" && providerKey.id.length <= 256
        ? providerKey.id
        : null;

      const { error: logError } = await supabase.from("mensagens_log").insert({
        ordem_servico_id: orderId,
        cliente_id: clientId,
        telefone: normalizedPhone,
        mensagem: message,
        evento: event,
        status: success ? "enviado" : "erro",
        erro: success ? null : `Evolution API retornou ${sending.response.status}`,
        canal: "evolution",
      });
      if (logError) throw logError;

      return jsonResponse(
        req,
        {
          success,
          providerMessageId,
        },
        success ? 200 : 502,
      );
    }

    if (action === "disconnect") {
      const logout = await providerRequest(
        endpoint(`instance/logout/${encodeURIComponent(instanceName)}`),
        apiKey,
        { method: "DELETE" },
      );
      if (!logout.response.ok && logout.response.status !== 404) {
        return jsonResponse(req, { error: "Não foi possível desconectar o WhatsApp" }, 502);
      }

      const { error: updateError } = await supabase
        .from("whatsapp_instancias")
        .update({ status: "desconectado", qr_code: null })
        .eq("id", instance.id);
      if (updateError) throw updateError;
      return jsonResponse(req, { success: true });
    }

    return jsonResponse(req, { error: "Ação inválida" }, 400);
  } catch (error: unknown) {
    console.error("Falha na integração WhatsApp", error instanceof Error ? error.message : "unknown");
    return jsonResponse(req, { error: "Falha ao processar a integração WhatsApp" }, 500);
  }
});
