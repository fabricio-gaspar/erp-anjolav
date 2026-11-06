export const VEHICLE_DIRECTORY_PAGE_SIZE = 25;
const MAX_VEHICLE_SEARCH_LENGTH = 80;

export type VehicleDirectoryStatus = "all" | "active" | "inactive";

export function normalizeVehicleDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function sanitizeVehicleDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}_\x2F@+-]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_VEHICLE_SEARCH_LENGTH).join("").trim();
}

export function buildVehicleDirectorySearchFilter(term: string): string | null {
  const safeTerm = sanitizeVehicleDirectorySearch(term);
  if (!safeTerm) return null;

  const pattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  return ["placa", "modelo", "tipo", "cor"]
    .map(column => `${column}.ilike.${pattern}`)
    .join(",");
}

export function getVehicleDirectoryRange(page: number, pageSize = VEHICLE_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeVehicleDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : VEHICLE_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}
