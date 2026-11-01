import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isOperationType, type OperationType } from "@/lib/operations";

export type OperationalAccessMode = "admin" | "pdv" | "hybrid";

export interface OperationalAccessUnit {
  id: string;
  code: string;
  name: string;
}

export interface OperationalAccessContext {
  tenantId: string;
  isAdmin: boolean;
  operations: OperationType[];
  units: OperationalAccessUnit[];
  unitScope: "all" | "assigned";
  accessMode: OperationalAccessMode;
  defaultRoute: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUnit(value: unknown): OperationalAccessUnit | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string"
    || typeof value.code !== "string"
    || typeof value.name !== "string"
  ) {
    return null;
  }

  return { id: value.id, code: value.code, name: value.name };
}

function normalizeAccessContext(value: unknown, activeTenantId: string): OperationalAccessContext {
  if (!isRecord(value) || value.tenantId !== activeTenantId) {
    throw new Error("O contexto operacional retornado não corresponde à empresa ativa.");
  }

  const operations = Array.isArray(value.operations)
    ? value.operations.filter(isOperationType)
    : [];
  const units = Array.isArray(value.units)
    ? value.units.map(normalizeUnit).filter((unit): unit is OperationalAccessUnit => unit !== null)
    : [];
  const accessMode: OperationalAccessMode = ["admin", "pdv", "hybrid"].includes(String(value.accessMode))
    ? value.accessMode as OperationalAccessMode
    : "pdv";

  return {
    tenantId: activeTenantId,
    isAdmin: value.isAdmin === true,
    operations,
    units,
    unitScope: value.unitScope === "all" ? "all" : "assigned",
    accessMode,
    defaultRoute: typeof value.defaultRoute === "string" ? value.defaultRoute : null,
  };
}

/**
 * Reads the already-authorized operational context from the database. The RPC
 * is deliberately read-only and RLS/tenant checks remain the source of truth.
 */
export function useOperationalAccessContext() {
  const { activeTenant, session } = useAuth();

  return useQuery({
    queryKey: ["operational-access-context", activeTenant?.id, session?.user.id],
    enabled: Boolean(activeTenant?.id && session?.user.id),
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<OperationalAccessContext> => {
      if (!activeTenant?.id) {
        throw new Error("Uma empresa ativa é necessária para carregar o contexto operacional.");
      }

      const { data, error } = await supabase.rpc("get_my_access_context");
      if (error) throw error;
      return normalizeAccessContext(data, activeTenant.id);
    },
  });
}
