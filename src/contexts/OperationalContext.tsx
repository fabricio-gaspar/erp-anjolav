/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface OperationalContextValue {
  isOperationSwitchLocked: boolean;
  setOperationSwitchLocked: (locked: boolean) => void;
}

const OperationalContext = createContext<OperationalContextValue | undefined>(undefined);

export function OperationalProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [isOperationSwitchLocked, setOperationSwitchLocked] = useState(false);

  useEffect(() => {
    if (!pathname.startsWith("/pdv/")) {
      setOperationSwitchLocked(false);
    }
  }, [pathname]);

  const setLocked = useCallback((locked: boolean) => {
    setOperationSwitchLocked(locked);
  }, []);

  const value = useMemo(() => ({
    isOperationSwitchLocked,
    setOperationSwitchLocked: setLocked,
  }), [isOperationSwitchLocked, setLocked]);

  return <OperationalContext.Provider value={value}>{children}</OperationalContext.Provider>;
}

export function useOperationalContext(): OperationalContextValue {
  const context = useContext(OperationalContext);
  if (!context) {
    throw new Error("useOperationalContext must be used within an OperationalProvider");
  }
  return context;
}
