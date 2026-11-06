export const STOCK_DIRECTORY_PAGE_SIZE = 25;
export const STOCK_DIRECTORY_MAX_PAGE = 1_000_000;

export type StockDirectoryStatus = "active" | "archived" | "low" | "zero" | "all";

const stockStatuses = new Set<StockDirectoryStatus>([
  "active",
  "archived",
  "low",
  "zero",
  "all",
]);

export function normalizeStockDirectoryPage(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, STOCK_DIRECTORY_MAX_PAGE)
    : 1;
}

export function normalizeStockDirectoryStatus(value: string | null): StockDirectoryStatus {
  return stockStatuses.has(value as StockDirectoryStatus)
    ? value as StockDirectoryStatus
    : "active";
}

export function normalizeStockDirectorySearchInput(value: string) {
  const normalized = [...value.normalize("NFKC")]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 ? character : " ";
    })
    .join("")
    .replace(/\s+/g, " ");
  return [...normalized].slice(0, 80).join("");
}

export function sanitizeStockDirectorySearch(value: string) {
  return normalizeStockDirectorySearchInput(value).trim();
}

export function normalizeStockDirectoryCategory(value: string | null, allowed: readonly string[]) {
  return value && allowed.includes(value) ? value : "all";
}
