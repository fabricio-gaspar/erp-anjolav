export const FINANCIAL_ACCOUNT_PAGE_SIZE = 25;

export type ReceivableOriginFilter =
  | "todos"
  | "fatura"
  | "pdv_loja"
  | "pdv_industrial"
  | "asaas"
  | "manual";

export type ReceivableStatusFilter =
  | "todos"
  | "pendente"
  | "atrasado"
  | "parcial"
  | "recebido"
  | "cancelado"
  | "estornado";

export type PayableStatusFilter =
  | "todos"
  | "pendente"
  | "atrasado"
  | "parcial"
  | "pago"
  | "cancelado";

export function normalizeFinancialAccountPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeFinancialAccountDate(value: string | null): string | undefined {
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

export function normalizeReceivableOrigin(value: string | null): ReceivableOriginFilter {
  return ["fatura", "pdv_loja", "pdv_industrial", "asaas", "manual"].includes(value ?? "")
    ? value as ReceivableOriginFilter
    : "todos";
}

export function normalizeReceivableStatus(value: string | null): ReceivableStatusFilter {
  return ["pendente", "atrasado", "parcial", "recebido", "cancelado", "estornado"].includes(value ?? "")
    ? value as ReceivableStatusFilter
    : "todos";
}

export function normalizePayableStatus(value: string | null): PayableStatusFilter {
  return ["pendente", "atrasado", "parcial", "pago", "cancelado"].includes(value ?? "")
    ? value as PayableStatusFilter
    : "todos";
}

export function sanitizeFinancialAccountSearch(value: string): string {
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

export function financialAccountDateRangeIsValid(start?: string, end?: string): boolean {
  return !start || !end || start <= end;
}
