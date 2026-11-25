import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { parseOperationFilter, type OperationFilter } from "@/lib/operations";

interface AdminContextValue {
  operation: OperationFilter;
  setOperation: (operation: OperationFilter) => void;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const operation = parseOperationFilter(searchParams.get("operacao"));

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

  return (
    <AdminContext.Provider value={{
      operation,
      setOperation,
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
