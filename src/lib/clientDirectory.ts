export const CLIENT_DIRECTORY_PAGE_SIZE = 25;
const MAX_CLIENT_SEARCH_LENGTH = 80;

export type ClientDirectoryStatus = "all" | "active" | "inactive";

export function normalizeClientDirectoryPage(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function sanitizeClientDirectorySearch(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_CLIENT_SEARCH_LENGTH).join("").trim();
}

export function getClientDirectoryRange(page: number, pageSize = CLIENT_DIRECTORY_PAGE_SIZE) {
  const safePage = normalizeClientDirectoryPage(page);
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, 100)
    : CLIENT_DIRECTORY_PAGE_SIZE;
  const from = (safePage - 1) * safePageSize;

  return { from, to: from + safePageSize - 1, page: safePage, pageSize: safePageSize };
}

export function buildClientDirectorySearchFilter(term: string): string | null {
  const safeTerm = sanitizeClientDirectorySearch(term);
  if (!safeTerm) return null;

  const namePattern = `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
  const digits = safeTerm.replace(/\D/g, "");
  const identityPattern = digits.length >= 3 ? `%${[...digits].join("%")}%` : namePattern;

  return [
    `razao_social.ilike.${namePattern}`,
    `nome_fantasia.ilike.${namePattern}`,
    `cpf_cnpj.ilike.${identityPattern}`,
    `telefone.ilike.${identityPattern}`,
    `telefone2.ilike.${identityPattern}`,
  ].join(",");
}
