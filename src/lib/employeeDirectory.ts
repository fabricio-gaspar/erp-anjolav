export const EMPLOYEE_DIRECTORY_PAGE_SIZE = 25;
const MAX_EMPLOYEE_SEARCH_LENGTH = 80;

export type EmployeeDirectoryStatus = "all" | "active" | "inactive";

export function normalizeEmployeeDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function sanitizeEmployeeDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}_\x2F@+-]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_EMPLOYEE_SEARCH_LENGTH).join("").trim();
}

export function buildEmployeeDirectorySearchFilter(term: string): string | null {
  const safeTerm = sanitizeEmployeeDirectorySearch(term);
  if (!safeTerm) return null;

  const pattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  return ["nome", "login", "cargo", "departamento", "email", "telefone", "cpf"]
    .map(column => `${column}.ilike.${pattern}`)
    .join(",");
}

export function getEmployeeDirectoryRange(page: number, pageSize = EMPLOYEE_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeEmployeeDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : EMPLOYEE_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}
