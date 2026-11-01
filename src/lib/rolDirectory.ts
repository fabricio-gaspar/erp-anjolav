export const ROL_DIRECTORY_PAGE_SIZE = 25;

export type RolDirectoryStatus = "todos" | "pendente" | "faturado" | "cancelado";

export function normalizeRolDirectoryPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeRolDirectoryStatus(value: string | null): RolDirectoryStatus {
  return value === "pendente" || value === "faturado" || value === "cancelado"
    ? value
    : "todos";
}

export function normalizeRolDirectoryDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return value;
}

export function sanitizeRolDirectorySearch(value: string): string {
  return [...value.normalize("NFKC")]
    .map(character => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127 ? character : " ";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function rolDirectoryDateRangeIsValid(start?: string, end?: string): boolean {
  return !start || !end || start <= end;
}
