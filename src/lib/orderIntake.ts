export interface OrderPreviewItem {
  quantity: number;
  unitPrice: number;
}

export interface OrderPreviewTotals {
  subtotal: number;
  discount: number;
  urgency: number;
  total: number;
}

const DECIMAL_UNITS = new Set(["kg", "m", "metro", "metros", "m²", "m2", "litro", "l"]);

export function orderUnitLabel(unit: string | null | undefined) {
  switch ((unit ?? "").toLowerCase()) {
    case "kg": return "kg";
    case "m":
    case "metro":
    case "metros": return "m";
    case "m²":
    case "m2": return "m²";
    case "litro":
    case "l": return "L";
    case "peca": return "peça";
    case "unidade":
    case "un": return "un";
    default: return unit || "un";
  }
}

export function orderUnitAllowsDecimals(unit: string | null | undefined) {
  return DECIMAL_UNITS.has((unit ?? "").toLowerCase());
}

export function isValidOrderQuantity(value: number, unit: string | null | undefined) {
  return Number.isFinite(value) && value > 0 && value <= 999 &&
    (orderUnitAllowsDecimals(unit) || Number.isInteger(value));
}

function money(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateOrderPreview(
  items: OrderPreviewItem[],
  discountAmount: number,
  urgent: boolean,
  urgencyPercentage: number,
): OrderPreviewTotals {
  const subtotal = money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const discount = money(Math.min(Math.max(discountAmount || 0, 0), subtotal));
  const urgency = urgent
    ? money((subtotal - discount) * Math.min(Math.max(urgencyPercentage || 0, 0), 100) / 100)
    : 0;
  return { subtotal, discount, urgency, total: money(subtotal - discount + urgency) };
}

export function formatOrderAddress(address?: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}) {
  if (!address?.logradouro || !address.cidade || !address.uf) return "Endereço incompleto";
  return [
    [address.logradouro, address.numero].filter(Boolean).join(", "),
    address.complemento,
    address.bairro,
    [address.cidade, address.uf].filter(Boolean).join("/")
  ].filter(Boolean).join(" • ");
}
