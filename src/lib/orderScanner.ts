export const ORDER_SCAN_PREFIX = "ANJOLAV:O:";
export const ITEM_SCAN_PREFIX = "ANJOLAV:I:";
export const SCAN_DUPLICATE_WINDOW_MS = 2_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SCAN_LENGTH = 96;

export type CanonicalOrderScan =
  | { kind: "order"; orderNumber: string; canonicalValue: string }
  | { kind: "item"; itemId: string; canonicalValue: string };

export interface RecentOrderScan {
  key: string;
  scannedAt: number;
}

export function normalizeOrderScanInput(value: string): string {
  return [...value]
    .filter(character => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, MAX_SCAN_LENGTH);
}

export function buildOrderScanCode(orderNumber: string): string {
  const normalized = normalizeOrderScanInput(orderNumber);
  if (!normalized) throw new Error("Número da OS inválido para etiqueta.");
  return `${ORDER_SCAN_PREFIX}${normalized}`;
}

export function buildItemScanCode(itemId: string): string {
  const normalized = normalizeOrderScanInput(itemId).toLowerCase();
  if (!UUID_PATTERN.test(normalized)) throw new Error("Identificador de item inválido para etiqueta.");
  return `${ITEM_SCAN_PREFIX}${normalized}`;
}

export function parseCanonicalOrderScan(value: string): CanonicalOrderScan | null {
  const normalized = normalizeOrderScanInput(value);
  if (!normalized) return null;

  if (normalized.toUpperCase().startsWith(ORDER_SCAN_PREFIX)) {
    const orderNumber = normalizeOrderScanInput(normalized.slice(ORDER_SCAN_PREFIX.length));
    return orderNumber
      ? { kind: "order", orderNumber, canonicalValue: buildOrderScanCode(orderNumber) }
      : null;
  }

  if (normalized.toUpperCase().startsWith(ITEM_SCAN_PREFIX)) {
    const itemId = normalizeOrderScanInput(normalized.slice(ITEM_SCAN_PREFIX.length)).toLowerCase();
    return UUID_PATTERN.test(itemId)
      ? { kind: "item", itemId, canonicalValue: buildItemScanCode(itemId) }
      : null;
  }

  return null;
}

export function getOrderScanKey(value: string): string | null {
  const normalized = normalizeOrderScanInput(value);
  return normalized ? normalized.toLocaleUpperCase("pt-BR") : null;
}

export function isDuplicateOrderScan(
  recent: RecentOrderScan | null,
  value: string,
  now = Date.now(),
  duplicateWindowMs = SCAN_DUPLICATE_WINDOW_MS,
): boolean {
  const key = getOrderScanKey(value);
  return !!recent && !!key && recent.key === key && now - recent.scannedAt >= 0 && now - recent.scannedAt <= duplicateWindowMs;
}
