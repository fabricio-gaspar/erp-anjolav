import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  normalizeBrazilianWhatsApp,
  sendWaAkgMedia,
  sendWaAkgText,
  type WaAkgSendOutcome,
  waAkgBaseUrl,
  waAkgSessionId,
} from "./wa-akg.ts";

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
  mediaStoragePath?: string | null;
  mediaMimeType?: "image/png" | "application/pdf" | null;
  mediaKind?: "image" | "document" | null;
};

type DeliveryRow = {
  id: string;
  status: string;
  attempt_count: number;
  tenant_id: string;
  cliente_id: string | null;
  telefone: string;
  mensagem: string;
  evento: string;
  ordem_servico_id: string | null;
  media_storage_path: string | null;
  media_mime_type: string | null;
  media_kind: string | null;
};

const DELIVERY_SELECT = "id, status, attempt_count, tenant_id, cliente_id, telefone, mensagem, evento, ordem_servico_id, media_storage_path, media_mime_type, media_kind";

function validRolMediaPath(row: DeliveryRow): boolean {
  if (!row.ordem_servico_id || !row.media_storage_path) return false;
  const expectedPrefix = `${row.tenant_id}/${row.ordem_servico_id}/documento/`;
  return row.media_storage_path.startsWith(expectedPrefix)
    && /^[0-9a-f-]{36}\/([0-9a-f-]{36})\/documento\/[0-9a-f-]{36}\.(png|pdf)$/i.test(row.media_storage_path)
    && ((row.media_mime_type === "image/png" && row.media_kind === "image" && row.media_storage_path.endsWith(".png"))
      || (row.media_mime_type === "application/pdf" && row.media_kind === "document" && row.media_storage_path.endsWith(".pdf")));
}

export function buildRolImageFallbackMessage(message: string): string {
  // WA-AKG can occasionally reject media uploads. The customer should still
  // receive the configured ROL summary, but never a private Storage URL.
  return message.slice(0, 4_000).trimEnd();
}

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
    media_storage_path: draft.mediaStoragePath ?? null,
    media_mime_type: draft.mediaMimeType ?? null,
    media_kind: draft.mediaKind ?? null,
  }).select(DELIVERY_SELECT).single();
  if (!error && data) return { row: data as DeliveryRow, duplicate: false };
  if (error?.code !== "23505") throw error ?? new Error("Não foi possível registrar a notificação");

  const { data: duplicate, error: lookupError } = await supabase.from("mensagens_log")
    .select(DELIVERY_SELECT)
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
    .select(DELIVERY_SELECT)
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
      .select("ativo, whatsapp_opt_out, telefone, telefone2")
      .eq("tenant_id", tenantId).eq("id", current.cliente_id).maybeSingle();
    if (clientError) throw clientError;
    const allowedPhones = [client?.telefone, client?.telefone2]
      .map((phone) => normalizeBrazilianWhatsApp(phone || ""))
      .filter((phone): phone is string => Boolean(phone));
    const blockedCode = !client?.ativo ? "CLIENT_INACTIVE"
      : client.whatsapp_opt_out ? "CLIENT_OPT_OUT"
      : !allowedPhones.includes(current.telefone) ? "PHONE_CHANGED" : null;
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

  let rolImage: Uint8Array | null = null;
  if (current.evento.startsWith("rol_")) {
    if (!validRolMediaPath(current as DeliveryRow)) {
      const { error } = await supabase.from("mensagens_log")
        .update({ status: "falhou", provider_attempted_at: null, last_error_code: "ROL_IMAGE_MISSING", erro: "Imagem visual do ROL indisponível" })
        .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente");
      if (error) throw error;
      return;
    }
    const { data: storedImage, error: downloadError } = await supabase.storage
      .from("order-attachments")
      .download(current.media_storage_path);
    if (downloadError || !storedImage) {
      const { error } = await supabase.from("mensagens_log")
        .update({ status: "falhou", provider_attempted_at: null, last_error_code: "ROL_IMAGE_UNAVAILABLE", erro: "Imagem visual do ROL não pôde ser carregada" })
        .eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "pendente");
      if (error) throw error;
      return;
    }
    rolImage = new Uint8Array(await storedImage.arrayBuffer());
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

  let outcome: WaAkgSendOutcome = current.evento.startsWith("rol_") && rolImage
    ? await sendWaAkgMedia(
      baseUrl,
      apiKey,
      waAkgSessionId(tenantId),
      current.telefone,
      rolImage,
      `ROL-${current.ordem_servico_id || deliveryId}.${current.media_kind === "document" ? "pdf" : "png"}`,
      current.media_mime_type!,
      "AnjoLav · comprovante do ROL",
      current.media_kind === "document" ? "document" : "image",
    )
    : await sendWaAkgText(
      baseUrl, apiKey, waAkgSessionId(tenantId), current.telefone, current.mensagem,
    );
  const patch = outcome.state === "accepted"
    ? { status: "enviado", provider_message_id: outcome.messageId ?? null, sent_at: new Date().toISOString(), last_error_code: null, erro: null }
    : outcome.state === "rejected"
      ? { status: "falhou", provider_attempted_at: null, last_error_code: outcome.code, erro: outcome.hint ? `WA-AKG rejeitou o envio: ${outcome.hint}` : "WA-AKG rejeitou o envio" }
      : { status: "incerto", last_error_code: outcome.code, erro: outcome.hint ? `WA-AKG: ${outcome.hint}; concilie antes de reenviar` : "Resultado do envio incerto; concilie antes de reenviar" };
  const { error: updateError } = await supabase.from("mensagens_log")
    .update(patch).eq("tenant_id", tenantId).eq("id", deliveryId).eq("status", "processando");
  if (updateError) {
    // The outbox remains 'processando'. No automatic retry is safe now.
    console.error("Falha ao persistir resultado WA-AKG", { deliveryId });
    throw updateError;
  }
}


