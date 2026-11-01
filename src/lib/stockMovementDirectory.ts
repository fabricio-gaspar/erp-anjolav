export const STOCK_MOVEMENT_DIRECTORY_PAGE_SIZE = 25;
export const STOCK_MOVEMENT_DIRECTORY_MAX_PAGE = 1_000_000;

export type StockMovementDirectoryType = "all" | "entrada" | "saida";

const movementTypes = new Set<StockMovementDirectoryType>([
  "all",
  "entrada",
  "saida",
]);

export function normalizeStockMovementDirectoryPage(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, STOCK_MOVEMENT_DIRECTORY_MAX_PAGE)
    : 1;
}

export function normalizeStockMovementDirectoryType(value: string | null): StockMovementDirectoryType {
  return movementTypes.has(value as StockMovementDirectoryType)
    ? value as StockMovementDirectoryType
    : "all";
}

export function normalizeStockMovementDirectorySearchInput(value: string) {
  const normalized = [...value.normalize("NFKC")]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 ? character : " ";
    })
    .join("")
    .replace(/\s+/g, " ");
  return [...normalized].slice(0, 80).join("");
}

export function sanitizeStockMovementDirectorySearch(value: string) {
  return normalizeStockMovementDirectorySearchInput(value).trim();
}
