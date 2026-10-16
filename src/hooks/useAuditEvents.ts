import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AUDIT_EVENT_SUMMARY_SELECT,
  buildAuditEventsQueryPlan,
  createAuditEventsCursor,
  type AuditEventSummary,
  type AuditEventsOptions,
} from "@/lib/auditEvents";

export type {
  AuditEventAction,
  AuditEventFilters,
  AuditEventsCursor,
  AuditEventsOptions,
  AuditEventsQueryPlan,
} from "@/lib/auditEvents";
export {
  buildAuditEventsQueryPlan,
  createAuditEventsCursor,
} from "@/lib/auditEvents";

export interface AuditEventsPage {
  events: AuditEventSummary[];
  nextCursor: string | null;
}

export function useAuditEvents(options: AuditEventsOptions = {}) {
  const { session, activeTenant } = useAuth();
  const plan = buildAuditEventsQueryPlan(options);
  const enabled = Boolean(session?.user && activeTenant?.id);

  return useQuery<AuditEventsPage>({
    queryKey: ["audit-events", activeTenant?.id, plan],
    enabled,
    retry: false,
    queryFn: async () => {
      if (!session?.user || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar a auditoria");
      }

      let query = supabase
        .from("audit_events")
        .select(AUDIT_EVENT_SUMMARY_SELECT)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(plan.limit + 1);

      if (plan.filters.action) query = query.eq("action", plan.filters.action);
      if (plan.filters.entity) query = query.ilike("entity_table", `%${plan.filters.entity}%`);
      if (plan.filters.occurredAtFrom) query = query.gte("occurred_at", plan.filters.occurredAtFrom);
      if (plan.filters.occurredAtBefore) query = query.lt("occurred_at", plan.filters.occurredAtBefore);
      if (plan.cursor) {
        query = query.or(
          `occurred_at.lt.${plan.cursor.occurredAt},and(occurred_at.eq.${plan.cursor.occurredAt},id.lt.${plan.cursor.id})`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const events = (data ?? []).slice(0, plan.limit);
      const hasMore = (data?.length ?? 0) > plan.limit;

      return {
        events,
        nextCursor: hasMore && events.length > 0
          ? createAuditEventsCursor(events[events.length - 1])
          : null,
      };
    },
  });
}
