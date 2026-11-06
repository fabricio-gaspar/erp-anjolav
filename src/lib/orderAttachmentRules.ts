export const ORDER_ATTACHMENT_BUCKET = "order-attachments";
export const ORDER_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const ORDER_ATTACHMENT_SIGNED_URL_SECONDS = 5 * 60;

export const ORDER_ATTACHMENT_CATEGORIES = [
  "recebimento",
  "avaria",
  "qualidade",
  "documento",
  "outro",
] as const;

export type OrderAttachmentCategory = typeof ORDER_ATTACHMENT_CATEGORIES[number];

const extensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

const uuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const orderAttachmentPathPattern = new RegExp(
  `^${uuidPattern}/${uuidPattern}/(?:${ORDER_ATTACHMENT_CATEGORIES.join("|")})/${uuidPattern}\\.(?:jpg|jpeg|png|webp|pdf)$`,
);

export function validateOrderAttachmentFile(file: File): keyof typeof extensionByMimeType {
  if (!(file.type in extensionByMimeType)) {
    throw new Error("Use uma imagem JPG, PNG, WebP ou um documento PDF.");
  }
  if (file.size < 1) throw new Error("O arquivo selecionado está vazio.");
  if (file.size > ORDER_ATTACHMENT_MAX_BYTES) {
    throw new Error("O anexo deve ter no máximo 8 MB.");
  }
  return file.type as keyof typeof extensionByMimeType;
}

export function sanitizeOrderAttachmentFileName(fileName: string): string {
  const normalized = [...fileName.normalize("NFKC")]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127 || character === "/" || character === "\\"
        ? " "
        : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const safeName = [...normalized].slice(0, 180).join("");
  if (!safeName) throw new Error("O nome do arquivo é inválido.");
  return safeName;
}

export function createOrderAttachmentPath(input: {
  tenantId: string;
  orderId: string;
  category: OrderAttachmentCategory;
  file: File;
}) {
  const mimeType = validateOrderAttachmentFile(input.file);
  return [
    input.tenantId.toLowerCase(),
    input.orderId.toLowerCase(),
    input.category,
    `${crypto.randomUUID()}.${extensionByMimeType[mimeType]}`,
  ].join("/");
}

export function isOrderAttachmentPath(path: string | null | undefined): path is string {
  return Boolean(path && orderAttachmentPathPattern.test(path));
}
