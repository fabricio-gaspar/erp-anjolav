export const SUPPLIER_DIRECTORY_PAGE_SIZE = 25;
const MAX_SUPPLIER_SEARCH_LENGTH = 80;

export type SupplierDirectoryStatus = "all" | "active" | "inactive";
export type SupplierDirectoryRecurrence = "all" | "configured" | "not_configured";

export function normalizeSupplierDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeSupplierDirectoryLetter(value: string | null | undefined): string {
  const normalized = value?.normalize("NFKC").trim().toLocaleUpperCase("pt-BR") ?? "";
  return /^[A-Z]$/.test(normalized) ? normalized : "TODOS";
}

export function sanitizeSupplierDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}_\x2F-]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_SUPPLIER_SEARCH_LENGTH).join("").trim();
}

export function getSupplierDirectoryRange(page: number, pageSize = SUPPLIER_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeSupplierDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : SUPPLIER_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}

export function buildSupplierDirectorySearchFilter(term: string): string | null {
  const safeTerm = sanitizeSupplierDirectorySearch(term);
  if (!safeTerm) return null;

  const pattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  return ["nome", "razao_social", "cnpj_cpf", "contato_nome", "telefone", "email"]
    .map(column => `${column}.ilike.${pattern}`)
    .join(",");
}

export function getNextSupplierDueDate(day: number, reference = new Date()): string | null {
  if (!Number.isInteger(day) || day < 1 || day > 31 || Number.isNaN(reference.getTime())) return null;

  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  let year = today.getFullYear();
  let month = today.getMonth();
  const buildDate = () => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay));
  };
  let dueDate = buildDate();
  if (dueDate < today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    dueDate = buildDate();
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${dueDate.getFullYear()}-${pad(dueDate.getMonth() + 1)}-${pad(dueDate.getDate())}`;
}

function escapeSupplierCsvCell(value: unknown): string {
  const source = value == null ? "" : String(value);
  const safe = /^[\s]*[=+\-@]/.test(source) ? `'${source}` : source;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildSupplierDirectoryCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map(row => row.map(escapeSupplierCsvCell).join(";"))
    .join("\r\n");
}
