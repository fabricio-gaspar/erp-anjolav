export const DRIVER_DIRECTORY_PAGE_SIZE = 25;
const MAX_DRIVER_SEARCH_LENGTH = 80;

export type DriverDirectoryStatus = "all" | "active" | "inactive";
export type DriverLicenseStatus = "all" | "valid" | "warning" | "expired" | "missing";

export function normalizeDriverDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function sanitizeDriverDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}_\x2F@+-]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_DRIVER_SEARCH_LENGTH).join("").trim();
}

export function buildDriverDirectorySearchFilter(term: string): string | null {
  const safeTerm = sanitizeDriverDirectorySearch(term);
  if (!safeTerm) return null;

  const pattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  return ["nome", "cnh", "telefone", "email"]
    .map(column => `${column}.ilike.${pattern}`)
    .join(",");
}

export function getDriverDirectoryRange(page: number, pageSize = DRIVER_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeDriverDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : DRIVER_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}

export function getDriverLicenseWindow(reference = new Date()) {
  if (Number.isNaN(reference.getTime())) return null;
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const warningEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const formatDate = (value: Date) => {
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  };

  return { today: formatDate(today), warningEnd: formatDate(warningEnd) };
}
