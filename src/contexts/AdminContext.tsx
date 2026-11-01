/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { parseOperationFilter, type OperationFilter } from "@/lib/operations";

export const ADMIN_DATE_RANGES = ["hoje", "7d", "30d", "mes"] as const;
export type AdminDateRange = (typeof ADMIN_DATE_RANGES)[number];

interface AdminContextValue {
  tenantId: string | null;
  operation: OperationFilter;
  dateRange: AdminDateRange;
  unitId: string | null;
  setOperation: (operation: OperationFilter) => void;
  setDateRange: (dateRange: AdminDateRange) => void;
  setUnitId: (unitId: string | null) => void;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

function parseDateRange(value: string | null): AdminDateRange {
  return ADMIN_DATE_RANGES.includes(value as AdminDateRange) ? value as AdminDateRange : "30d";
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const { activeTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const operation = parseOperationFilter(searchParams.get("operacao"));
  const dateRange = parseDateRange(searchParams.get("periodo"));
  const unitId = searchParams.get("unidade") || null;

  const updateParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setOperation = useCallback((nextOperation: OperationFilter) => {
    updateParam("operacao", nextOperation === "all" ? null : nextOperation);
  }, [updateParam]);

  const setDateRange = useCallback((nextDateRange: AdminDateRange) => {
    updateParam("periodo", nextDateRange === "30d" ? null : nextDateRange);
  }, [updateParam]);

  const setUnitId = useCallback((nextUnitId: string | null) => {
    updateParam("unidade", nextUnitId);
  }, [updateParam]);

  return (
    <AdminContext.Provider value={{
      tenantId: activeTenant?.id ?? null,
      operation,
      dateRange,
      unitId,
      setOperation,
      setDateRange,
      setUnitId,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdminContext must be used within an AdminProvider");
  }
  return context;
}
