import { supabase } from "@/integrations/supabase/client";
import {
  createOrderAttachmentPath,
  isOrderAttachmentPath,
  ORDER_ATTACHMENT_BUCKET,
  ORDER_ATTACHMENT_SIGNED_URL_SECONDS,
  type OrderAttachmentCategory,
  validateOrderAttachmentFile,
} from "./orderAttachmentRules";

export * from "./orderAttachmentRules";

export async function uploadOrderAttachment(input: {
  tenantId: string;
  orderId: string;
  category: OrderAttachmentCategory;
  file: File;
  objectPath?: string;
}) {
  validateOrderAttachmentFile(input.file);
  const path = input.objectPath ?? createOrderAttachmentPath(input);
  const expectedPrefix = `${input.tenantId.toLowerCase()}/${input.orderId.toLowerCase()}/${input.category}/`;
  if (!isOrderAttachmentPath(path) || !path.startsWith(expectedPrefix)) {
    throw new Error("Referência de anexo inválida.");
  }
  const { error } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .upload(path, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false,
    });
  if (error) {
    const statusCode = "statusCode" in error ? String(error.statusCode) : "";
    if (statusCode !== "409" && !/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Não foi possível enviar o anexo: ${error.message}`);
    }
  }
  return path;
}

export async function removeOrphanOrderAttachment(path: string) {
  if (!isOrderAttachmentPath(path)) return;
  await supabase.storage.from(ORDER_ATTACHMENT_BUCKET).remove([path]);
}

export async function createOrderAttachmentSignedUrl(path: string) {
  if (!isOrderAttachmentPath(path)) throw new Error("Referência de anexo inválida.");
  const { data, error } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .createSignedUrl(path, ORDER_ATTACHMENT_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(`Não foi possível abrir o anexo: ${error?.message || "link indisponível"}`);
  }
  return data.signedUrl;
}
