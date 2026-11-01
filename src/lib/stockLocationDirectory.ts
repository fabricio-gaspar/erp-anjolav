export const STOCK_LOCATION_DIRECTORY_PAGE_SIZE = 25;
export const STOCK_LOCATION_DIRECTORY_MAX_PAGE = 1_000_000;

export type StockLocationDirectoryStatus = "active" | "archived" | "all";
export type StockLocationBalanceStatus = "active" | "archived" | "with_balance" | "zero" | "all";

const locationStatuses = new Set<StockLocationDirectoryStatus>(["active", "archived", "all"]);
const balanceStatuses = new Set<StockLocationBalanceStatus>(["active", "archived", "with_balance", "zero", "all"]);

export function normalizeStockLocationDirectoryPage(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, STOCK_LOCATION_DIRECTORY_MAX_PAGE)
    : 1;
}

export function normalizeStockLocationDirectoryStatus(value: string | null): StockLocationDirectoryStatus {
  return locationStatuses.has(value as StockLocationDirectoryStatus)
    ? value as StockLocationDirectoryStatus
    : "active";
}

export function normalizeStockLocationBalanceStatus(value: string | null): StockLocationBalanceStatus {
  return balanceStatuses.has(value as StockLocationBalanceStatus)
    ? value as StockLocationBalanceStatus
    : "active";
}

export function normalizeStockLocationDirectorySearchInput(value: string) {
  const normalized = [...value.normalize("NFKC")]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 ? character : " ";
    })
    .join("")
    .replace(/\s+/g, " ");
  return [...normalized].slice(0, 80).join("");
}

export function sanitizeStockLocationDirectorySearch(value: string) {
  return normalizeStockLocationDirectorySearchInput(value).trim();
}

export function normalizeStockLocationId(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
