import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { WorkspaceArea as AppWorkspaceArea } from "@/lib/appRoutes";
import { parseOperationFilter } from "@/lib/operations";

export type WorkspaceArea = AppWorkspaceArea;

interface WorkspaceContextType {
  activeArea: WorkspaceArea;
  setActiveArea: (area: WorkspaceArea) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  
  const getAreaFromPath = (path: string, search = ""): WorkspaceArea => {
    if (path.startsWith("/industrial") || path.startsWith("/pdv/industrial")) return "industrial";
    if (path.startsWith("/residencial") || path.startsWith("/pdv/residencial") || path.startsWith("/pdv/domestico")) return "residencial";
    if (path.startsWith("/admin")) {
      const operation = parseOperationFilter(new URLSearchParams(search).get("operacao"));
      if (operation === "industrial") return "industrial";
      if (operation === "domestico") return "residencial";
    }
    return "central";
  };

  const [activeArea, setActiveArea] = useState<WorkspaceArea>(() => 
    getAreaFromPath(location.pathname, location.search)
  );

  useEffect(() => {
    const area = getAreaFromPath(location.pathname, location.search);
    setActiveArea(area);
    document.documentElement.setAttribute("data-workspace", area);
  }, [location.pathname, location.search]);

  return (
    <WorkspaceContext.Provider value={{ activeArea, setActiveArea }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
