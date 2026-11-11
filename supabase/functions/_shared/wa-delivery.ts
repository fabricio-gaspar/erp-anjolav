import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { normalizeBrazilianWhatsApp, sendWaAkgText, waAkgBaseUrl, waAkgSessionId } from "./wa-akg.ts";

export type DeliveryDraft = {
  tenantId: string;
  orderId?: string | null;
  invoiceId?: string | null;
  clientId?: string | null;
  phone: string;
  message: string;
  event: string;
  idempotencyKey: string;
  requestedBy?: string | null;
  manualParentId?: string | null;
  blockedCode?: string | null;
};

type DeliveryRow = {
  id: string;
  status: string;
  attempt_count: number;
  tenant_id: string;
  cliente_id: string | null;
  telefone: string;
  mensagem: string;
};

export async function reserveDelivery(
  supabase: SupabaseClient,
  draft: DeliveryDraft,
): Promise<{ row: DeliveryRow; duplicate: boolean }> {
  const { data, error } = await supabase.from("mensagens_log").insert({
    tenant_id: draft.tenantId,
    ordem_servico_id: draft.orderId ?? null,
    fatura_id: draft.invoiceId ?? null,
    cliente_id: draft.clientId ?? null,
    telefone: draft.phone,
    mensagem: draft.message,
    evento: draft.event,
    status: draft.blockedCode ? "falhou" : "pendente",
    erro: draft.blockedCode ? "Envio bloqueado antes do provedor" : null,
    last_error_code: draft.blockedCode ?? null,
    canal: "wa-akg",
    idempotency_key: draft.idempotencyKey,
    requested_by: draft.requestedBy ?? null,
    manual_parent_id: draft.manualParentId ?? null,
  }).select("id, status, attempt_count, tenant_id, cliente_id, telefone, mensagem").single();
  if (!error && data) return { row: data as DeliveryRow, duplicate: false };
  if (error?.code !== "23505") throw error ?? new Error("Não foi possível registrar a notificação");

  const { data: duplicate, error: lookupError } = await supabase.from("mensagens_log")
    .select("id, status, attempt_count, tenant_id, cliente_id, telefone, mensagem")
    .eq("tenant_id", draft.tenantId)
    .eq("idempotency_key", draft.idempotencyKey)
    .maybeSingle();
  if (lookupError || !duplicate) throw lookupError ?? new Error("Envio duplicado indisponível");
  return { row: duplicate as DeliveryRow, duplicate: true };
}

export async function processReservedDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
  tenantId: string,
): Promise<void> {
  const { data: current, error: readError } = await supabase.from("mensagens_log")
    .select("id, status, attempt_count, tenant_id, cliente_id, telefone, mensagem")
    .eq("tenant_id", tenantId).eq("id", deliveryId).maybeSingle();
  if (readError) throw readError;
  if (!current || current.status !== "pendente") return;

  if (Deno.env.get("WA_AKG_ENABLED") !== "true") {
    const { error } = await supabase.from("mensagens_log")
      .update({ status: "falhou", last_error_code: "PROVIDER_DISABLED", erro: "Envio WA-AKG desativado" })
      .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente");
    if (error) throw error;
    return;
  }

  if (current.cliente_id) {
    const { data: client, error: clientError } = await supabase.from("clientes")
      .select("ativo, whatsapp_opt_out, telefone")
      .eq("tenant_id", tenantId).eq("id", current.cliente_id).maybeSingle();
    if (clientError) throw clientError;
    const normalized = normalizeBrazilianWhatsApp(client?.telefone || "");
    const blockedCode = !client?.ativo ? "CLIENT_INACTIVE"
      : client.whatsapp_opt_out ? "CLIENT_OPT_OUT"
      : normalized !== current.telefone ? "PHONE_CHANGED" : null;
    if (blockedCode) {
      const { error } = await supabase.from("mensagens_log")
        .update({ status: "falhou", last_error_code: blockedCode, erro: "Envio bloqueado antes do provedor" })
        .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente");
      if (error) throw error;
      return;
    }
  }

  const { data: instance, error: instanceError } = await supabase.from("whatsapp_instancias")
    .select("api_url")
    .eq("tenant_id", tenantId).maybeSingle();
  if (instanceError) throw instanceError;
  const apiKey = Deno.env.get("WA_AKG_API_KEY");
  if (!instance?.api_url || !apiKey) {
    const { error } = await supabase.from("mensagens_log")
      .update({ status: "falhou", last_error_code: "PROVIDER_UNCONFIGURED", erro: "WA-AKG não configurado" })
      .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente");
    if (error) throw error;
    return;
  }

  let baseUrl: URL;
  try {
    baseUrl = waAkgBaseUrl(instance.api_url);
  } catch {
    const { error } = await supabase.from("mensagens_log")
      .update({ status: "falhou", last_error_code: "PROVIDER_URL_INVALID", erro: "Origem WA-AKG não autorizada" })
      .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente");
    if (error) throw error;
    return;
  }

  // Conditional update is the outbox claim. Only the winner can call WA-AKG.
  const { data: claimed, error: claimError } = await supabase.from("mensagens_log")
    .update({
      status: "processando",
      attempt_count: current.attempt_count + 1,
      provider_attempted_at: new Date().toISOString(),
      last_error_code: null,
      erro: null,
    })
    .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente")
    .select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  const outcome = await sendWaAkgText(
    baseUrl, apiKey, waAkgSessionId(tenantId), current.telefone, current.mensagem,
  );
  const patch = outcome.state === "accepted"
    ? { status: "enviado", provider_message_id: outcome.messageId, sent_at: new Date().toISOString(), last_error_code: null, erro: null }
    : outcome.state === "rejected"
      ? { status: "falhou", provider_attempted_at: null, last_error_code: outcome.code, erro: "WA-AKG rejeitou o envio" }
      : { status: "incerto", last_error_code: outcome.code, erro: "Resultado do envio incerto; concilie antes de reenviar" };
  const { error: updateError } = await supabase.from("mensagens_log")
    .update(patch).eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "processando");
  if (updateError) {
    // The outbox remains 'processando'. No automatic retry is safe now.
    console.error("Falha ao persistir resultado WA-AKG", { deliveryId });
    throw updateError;
  }
}
