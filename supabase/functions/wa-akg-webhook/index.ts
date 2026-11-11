import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { serverJsonResponse } from "../_shared/http.ts";

const SESSION = /^anjolav-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return serverJsonResponse({ error: "Método não permitido" }, 405);
  const secret = Deno.env.get("WA_AKG_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 32 || !url || !key) {
    return serverJsonResponse({ error: "Webhook indisponível" }, 503);
  }
  const signature = req.headers.get("x-webhook-signature") || "";
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signature);
  if (!match) return serverJsonResponse({ error: "Assinatura inválida" }, 401);
  const raw = new Uint8Array(await req.arrayBuffer());
  if (raw.byteLength > 65_536) return serverJsonResponse({ error: "Payload excede o limite" }, 413);
  const hmacKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  const supplied = Uint8Array.from(match[1].match(/.{2}/g)!, (hex) => Number.parseInt(hex, 16));
  if (!await crypto.subtle.verify("HMAC", hmacKey, supplied, raw)) {
    return serverJsonResponse({ error: "Assinatura inválida" }, 401);
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return serverJsonResponse({ error: "JSON inválido" }, 400);
  }
  if (payload.event !== "message.status") return serverJsonResponse({ success: true, ignored: true });
  const tenantId = SESSION.exec(String(payload.sessionId || ""))?.[1];
  const data = payload.data as Record<string, unknown> | undefined;
  const messageId = typeof data?.keyId === "string" ? data.keyId : "";
  const status = typeof data?.status === "string" ? data.status.toUpperCase() : "";
  if (!tenantId || !messageId || messageId.length > 256 || !["DELIVERED", "READ"].includes(status)) {
    return serverJsonResponse({ success: true, ignored: true });
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: delivery, error } = await db.from("mensagens_log")
    .select("id, status").eq("tenant_id", tenantId).eq("canal", "wa-akg")
    .eq("provider_message_id", messageId).limit(1).maybeSingle();
  if (error) return serverJsonResponse({ error: "Falha ao consultar envio" }, 500);
  if (!delivery) return serverJsonResponse({ success: true, ignored: true });
  const next = status === "READ" ? "lido" : "entregue";
  if (delivery.status === "lido" || delivery.status === next || !["enviado", "entregue"].includes(delivery.status)) {
    return serverJsonResponse({ success: true, idempotent: true });
  }
  const { error: updateError } = await db.from("mensagens_log")
    .update({
      status: next,
      ...(delivery.status === "enviado" ? { delivered_at: new Date().toISOString() } : {}),
      ...(next === "lido" ? { read_at: new Date().toISOString() } : {}),
    })
    .eq("tenant_id", tenantId).eq("id", delivery.id).eq("status", delivery.status);
  if (updateError) return serverJsonResponse({ error: "Falha ao atualizar envio" }, 500);
  return serverJsonResponse({ success: true });
});
