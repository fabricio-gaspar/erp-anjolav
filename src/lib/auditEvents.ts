import type { Database } from "../integrations/supabase/types.ts";

const DEFAULT_AUDIT_PAGE_SIZE = 25;
const MAX_AUDIT_PAGE_SIZE = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const AUDIT_EVENT_SUMMARY_COLUMNS = [
  "id",
  "action",
  "entity_schema",
  "entity_table",
  "occurred_at",
] as const;

export const AUDIT_EVENT_SUMMARY_SELECT = "id,action,entity_schema,entity_table,occurred_at" as const;

type AuditEventRow = Database["public"]["Tables"]["audit_events"]["Row"];

export type AuditEventSummary = Pick<
  AuditEventRow,
  (typeof AUDIT_EVENT_SUMMARY_COLUMNS)[number]
>;

export type AuditEventAction = "INSERT" | "UPDATE" | "DELETE";

export interface AuditEventFilters {
  action?: AuditEventAction | "";
  entity?: string;
  from?: string;
  to?: string;
}

export interface AuditEventsOptions {
  cursor?: string | null;
  limit?: number;
  filters?: AuditEventFilters;
}

export interface AuditEventsCursor {
  id: string;
  occurredAt: string;
}

export interface AuditEventsQueryPlan {
  columns: readonly string[];
  cursor: AuditEventsCursor | null;
  limit: number;
  filters: {
    action: AuditEventAction | null;
    entity: string | null;
    occurredAtFrom: string | null;
    occurredAtBefore: string | null;
  };
}

function normalizeAuditAction(action: AuditEventFilters["action"]): AuditEventAction | null {
  return action === "INSERT" || action === "UPDATE" || action === "DELETE" ? action : null;
}

function toUtcDateStart(value: string | undefined): string | null {
  if (!value || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date.toISOString();
}

function toUtcDateAfter(value: string | undefined): string | null {
  const start = toUtcDateStart(value);
  if (!start) return null;
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function normalizeAuditEntity(value: string | undefined): string | null {
  const normalized = value?.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() ?? "";
  return normalized || null;
}

function normalizeAuditPageSize(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_AUDIT_PAGE_SIZE;
  return Math.min(MAX_AUDIT_PAGE_SIZE, Math.max(1, Math.floor(limit ?? DEFAULT_AUDIT_PAGE_SIZE)));
}

function toValidOccurredAt(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function decodeAuditEventsCursor(cursor: string | null | undefined): AuditEventsCursor | null {
  if (!cursor) return null;

  try {
    const [occurredAt, id, extra] = decodeURIComponent(cursor).split("|");
    const normalizedOccurredAt = occurredAt ? toValidOccurredAt(occurredAt) : null;
    if (!normalizedOccurredAt || !id || extra || !UUID_PATTERN.test(id)) return null;
    return { occurredAt: normalizedOccurredAt, id };
  } catch {
    return null;
  }
}

export function createAuditEventsCursor(
  event: Pick<AuditEventSummary, "id" | "occurred_at">,
): string {
  const occurredAt = toValidOccurredAt(event.occurred_at);
  if (!occurredAt || !UUID_PATTERN.test(event.id)) {
    throw new Error("Evento de auditoria inválido para paginação");
  }
  return encodeURIComponent(`${occurredAt}|${event.id}`);
}

export function buildAuditEventsQueryPlan(options: AuditEventsOptions = {}): AuditEventsQueryPlan {
  return {
    columns: AUDIT_EVENT_SUMMARY_COLUMNS,
    cursor: decodeAuditEventsCursor(options.cursor),
    limit: normalizeAuditPageSize(options.limit),
    filters: {
      action: normalizeAuditAction(options.filters?.action),
      entity: normalizeAuditEntity(options.filters?.entity),
      occurredAtFrom: toUtcDateStart(options.filters?.from),
      occurredAtBefore: toUtcDateAfter(options.filters?.to),
    },
  };
}
