export const ORDER_DIRECTORY_PAGE_SIZE = 25;
const MAX_ORDER_SEARCH_LENGTH = 80;

export const ORDER_OPERATIONAL_FILTERS = [
  "all",
  "open",
  "retirada",
  "separacao",
  "lavagem",
  "secagem",
  "passadoria",
  "embalagem",
  "expedicao",
  "entregue",
  "cancelada",
] as const;

export const ORDER_PAYMENT_FILTERS = ["all", "pendente", "parcial", "pago"] as const;
export const ORDER_QUALITY_FILTERS = ["all", "nao_iniciada", "em_analise", "aprovada", "com_pendencias"] as const;
export const ORDER_LOGISTICS_FILTERS = [
  "all",
  "nao_iniciada",
  "aguardando_coleta",
  "coletado",
  "aguardando_entrega",
  "em_rota",
  "entrega_parcial",
  "entregue",
  "tentativa_falha",
  "cancelada",
] as const;
export const ORDER_FISCAL_FILTERS = ["all", "nao_aplicavel", "pendente", "emitida", "cancelada"] as const;
export const ORDER_DEADLINE_FILTERS = ["all", "late", "today", "next_7_days", "without_deadline"] as const;

export type OrderOperationalFilter = typeof ORDER_OPERATIONAL_FILTERS[number];
export type OrderPaymentFilter = typeof ORDER_PAYMENT_FILTERS[number];
export type OrderQualityFilter = typeof ORDER_QUALITY_FILTERS[number];
export type OrderLogisticsFilter = typeof ORDER_LOGISTICS_FILTERS[number];
export type OrderFiscalFilter = typeof ORDER_FISCAL_FILTERS[number];
export type OrderDeadlineFilter = typeof ORDER_DEADLINE_FILTERS[number];

export interface OrderDirectoryFilters {
  orderSearch: string;
  clientSearch: string;
  responsibleSearch: string;
  operational: OrderOperationalFilter;
  payment: OrderPaymentFilter;
  quality: OrderQualityFilter;
  logistics: OrderLogisticsFilter;
  fiscal: OrderFiscalFilter;
  deadline: OrderDeadlineFilter;
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

export function sanitizeOrderDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_ORDER_SEARCH_LENGTH).join("").trim();
}

export function buildOrderDirectoryPattern(term: string): string | null {
  const safeTerm = sanitizeOrderDirectorySearch(term);
  if (!safeTerm) return null;
  return `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
}

export function buildOrderIdentifierPattern(term: string): string | null {
  const safeTerm = sanitizeOrderDirectorySearch(term);
  if (!safeTerm) return null;
  const chunks = safeTerm.match(/[\p{L}]+|\p{N}+/gu) ?? [];
  return chunks.length > 0 ? `%${chunks.join("%")}%` : null;
}

export function buildOrderDirectoryRelatedFilter(term: string, fields: readonly string[]): string | null {
  const pattern = buildOrderDirectoryPattern(term);
  if (!pattern) return null;
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}

export function buildOrderDirectoryClientFilter(term: string): string | null {
  const safeTerm = sanitizeOrderDirectorySearch(term);
  if (!safeTerm) return null;
  const namePattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  const digits = safeTerm.replace(/\D/g, "");
  const identityPattern = digits.length >= 3 ? `%${[...digits].join("%")}%` : namePattern;

  return [
    `razao_social.ilike.${namePattern}`,
    `nome_fantasia.ilike.${namePattern}`,
    `cpf_cnpj.ilike.${identityPattern}`,
    `telefone.ilike.${identityPattern}`,
    `telefone2.ilike.${identityPattern}`,
  ].join(",");
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
    filters.orderSearch
    || filters.clientSearch
    || filters.responsibleSearch
    || filters.operational !== "all"
    || filters.payment !== "all"
    || filters.quality !== "all"
    || filters.logistics !== "all"
    || filters.fiscal !== "all"
    || filters.deadline !== "all",
  );
}
