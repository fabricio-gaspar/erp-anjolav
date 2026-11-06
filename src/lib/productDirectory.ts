export const PRODUCT_DIRECTORY_PAGE_SIZE = 25;
const MAX_PRODUCT_SEARCH_LENGTH = 80;

export type ProductDirectoryStatus = "all" | "active" | "inactive";

export function normalizeProductDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function sanitizeProductDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}_\x2F-]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_PRODUCT_SEARCH_LENGTH).join("").trim();
}

export function getProductDirectoryRange(page: number, pageSize = PRODUCT_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeProductDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : PRODUCT_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}

export function buildProductDirectorySearchFilter(term: string): string | null {
  const safeTerm = sanitizeProductDirectorySearch(term);
  if (!safeTerm) return null;

  const namePattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  const codePattern = `%${safeTerm.replace(/\s+/g, "%")}%`;
  return `nome.ilike.${namePattern},codigo.ilike.${codePattern}`;
}

export function normalizeProductDirectoryLetter(value: string | null | undefined): string {
  const normalized = value?.normalize("NFKC").toLocaleUpperCase("pt-BR") ?? "";
  return /^[A-Z]$/.test(normalized) ? normalized : "TODOS";
}

export function escapeProductCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export function buildProductDirectoryCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map(row => row.map(escapeProductCsvCell).join(";"))
    .join("\n");
}
