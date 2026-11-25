import { format, isValid, parseISO } from "date-fns";

export const ORDER_DIRECTORY_PAGE_SIZE = 25;

export const ORDER_ROL_STATUS_FILTERS = [
  "all",
  "entregue",
  "nao_entregue",
  "retirado",
  "a_retirar",
] as const;

export const ORDER_REPORT_PAYMENT_FILTERS = ["all", "pago", "nao_pago"] as const;

export type OrderRolStatusFilter = typeof ORDER_ROL_STATUS_FILTERS[number];
export type OrderReportPaymentFilter = typeof ORDER_REPORT_PAYMENT_FILTERS[number];
export type RolReportStatus = Exclude<OrderRolStatusFilter, "all"> | "cancelado";

export interface OrderDirectoryFilters {
  rolStatus: OrderRolStatusFilter;
  payment: OrderReportPaymentFilter;
  dataInicio: string;
  dataFim: string;
}

export function normalizeOrderDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeOrderDirectoryFilter<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && allowed.includes(value as T) ? value as T : fallback;
}

export function normalizeOrderDirectoryDate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value ? value : "";
}

export function classifyRolReportStatus(status: string | null | undefined): RolReportStatus {
  if (status === "entregue") return "entregue";
  if (status === "expedicao") return "a_retirar";
  if (status === "retirada") return "retirado";
  if (status === "cancelada") return "cancelado";
  return "nao_entregue";
}

export function classifyRolReportPayment(status: string | null | undefined): Exclude<OrderReportPaymentFilter, "all"> {
  return status === "pago" ? "pago" : "nao_pago";
}

export function getOrderDirectoryRange(page: number, pageSize = ORDER_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeOrderDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : ORDER_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}

export function hasActiveOrderDirectoryFilters(filters: OrderDirectoryFilters): boolean {
  return Boolean(
    filters.rolStatus !== "all"
    || filters.payment !== "all"
    || filters.dataInicio
    || filters.dataFim,
  );
}
