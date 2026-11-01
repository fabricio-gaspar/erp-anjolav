export const PURCHASE_DIRECTORY_PAGE_SIZE = 25;
export const PURCHASE_DIRECTORY_MAX_PAGE = 1_000_000;

export const PURCHASE_DIRECTORY_STATUSES = [
  "all",
  "open",
  "rascunho",
  "aprovado",
  "parcial",
  "recebido",
  "cancelado",
] as const;

export type PurchaseDirectoryStatus = (typeof PURCHASE_DIRECTORY_STATUSES)[number];

export function sanitizePurchaseDirectorySearch(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function normalizePurchaseDirectorySearchInput(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 80);
}

export function normalizePurchaseDirectoryStatus(value: string | null): PurchaseDirectoryStatus {
  return PURCHASE_DIRECTORY_STATUSES.includes(value as PurchaseDirectoryStatus)
    ? value as PurchaseDirectoryStatus
    : "open";
}

export function normalizePurchaseDirectoryPage(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= PURCHASE_DIRECTORY_MAX_PAGE ? page : 1;
}
