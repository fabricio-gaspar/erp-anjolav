import { supabase } from "@/integrations/supabase/client";

export const DELIVERY_EVIDENCE_BUCKET = "delivery-evidence";
export const DELIVERY_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
export const DELIVERY_EVIDENCE_SIGNED_URL_SECONDS = 5 * 60;

export type DeliveryEvidencePurpose = "photo" | "signature";

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const uuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const deliveryEvidencePathPattern = new RegExp(
  `^${uuidPattern}/${uuidPattern}/${uuidPattern}/(?:photo|signature)/${uuidPattern}\\.(?:jpg|jpeg|png|webp)$`,
);

export function validateDeliveryEvidenceFile(file: File): keyof typeof extensionByMimeType {
  if (!(file.type in extensionByMimeType)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }
  if (file.size < 1) throw new Error("O arquivo selecionado está vazio.");
  if (file.size > DELIVERY_EVIDENCE_MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 8 MB.");
  }
  return file.type as keyof typeof extensionByMimeType;
}

export function createDeliveryEvidencePath(input: {
  tenantId: string;
  routeId: string;
  stopId: string;
  purpose: DeliveryEvidencePurpose;
  file: File;
}) {
  const mimeType = validateDeliveryEvidenceFile(input.file);
  return [
    input.tenantId.toLowerCase(),
    input.routeId.toLowerCase(),
    input.stopId.toLowerCase(),
    input.purpose,
    `${crypto.randomUUID()}.${extensionByMimeType[mimeType]}`,
  ].join("/");
}

export function isDeliveryEvidencePath(path: string | null | undefined): path is string {
  return Boolean(path && deliveryEvidencePathPattern.test(path));
}

export async function uploadDeliveryEvidence(input: {
  tenantId: string;
  routeId: string;
  stopId: string;
  purpose: DeliveryEvidencePurpose;
  file: File;
}) {
  const path = createDeliveryEvidencePath(input);
  const { error } = await supabase.storage
    .from(DELIVERY_EVIDENCE_BUCKET)
    .upload(path, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false,
    });
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`);
  return path;
}

export async function removeOrphanDeliveryEvidence(paths: string[]) {
  const safePaths = [...new Set(paths.filter(isDeliveryEvidencePath))];
  if (safePaths.length === 0) return;
  await supabase.storage.from(DELIVERY_EVIDENCE_BUCKET).remove(safePaths);
}

export async function createDeliveryEvidenceSignedUrl(path: string) {
  if (!isDeliveryEvidencePath(path)) throw new Error("Referência de comprovante inválida.");
  const { data, error } = await supabase.storage
    .from(DELIVERY_EVIDENCE_BUCKET)
    .createSignedUrl(path, DELIVERY_EVIDENCE_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(`Não foi possível abrir o comprovante: ${error?.message || "link indisponível"}`);
  }
  return data.signedUrl;
}
