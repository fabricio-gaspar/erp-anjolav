import type { CustomerPaymentTerms } from "./customerPaymentTerms";

const DAY = 86_400_000;

function utcDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : null;
}

function iso(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function closingDate(year: number, month: number, day: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(day, last));
}

/** Most recent completed billing interval. A suggestion never closes a fatura. */
export function suggestBillingPeriod(
  terms: Pick<CustomerPaymentTerms, "condition" | "frequency" | "closingDay" | "baseDate">,
  today: string,
): { start: string; end: string } | null {
  const current = utcDay(today);
  if (current === null || terms.condition !== "faturado") return null;
  if (terms.frequency === "a_cada_10_dias" || terms.frequency === "a_cada_20_dias") {
    const base = utcDay(terms.baseDate ?? "");
    const length = terms.frequency === "a_cada_10_dias" ? 10 : 20;
    if (base === null || current < base) return null;
    const completed = Math.floor((Math.floor((current - base) / DAY) + 1) / length);
    if (completed < 1) return null;
    const start = base + (completed - 1) * length * DAY;
    return { start: iso(start), end: iso(start + (length - 1) * DAY) };
  }
  if (terms.frequency !== "mensal" && terms.frequency !== "quinzenal") return null;
  const day = terms.closingDay;
  if (!day || day < 1 || day > (terms.frequency === "quinzenal" ? 16 : 31)) return null;
  const reference = new Date(current);
  const closings: number[] = [];
  for (let offset = -3; offset <= 0; offset++) {
    const month = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, 1));
    closings.push(closingDate(month.getUTCFullYear(), month.getUTCMonth(), day));
    if (terms.frequency === "quinzenal") closings.push(closingDate(month.getUTCFullYear(), month.getUTCMonth(), day + 15));
  }
  const sorted = [...new Set(closings)].sort((a, b) => a - b);
  let lastIndex = -1;
  for (let index = 0; index < sorted.length; index++) {
    if (sorted[index] <= current) lastIndex = index;
  }
  if (lastIndex < 1) return null;
  return { start: iso(sorted[lastIndex - 1] + DAY), end: iso(sorted[lastIndex]) };
}
