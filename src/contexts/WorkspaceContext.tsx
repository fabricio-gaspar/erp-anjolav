import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type WorkspaceArea = "central" | "industrial" | "residencial";

interface WorkspaceContextType {
  activeArea: WorkspaceArea;
  setActiveArea: (area: WorkspaceArea) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  
  const getAreaFromPath = (path: string): WorkspaceArea => {
    if (path.startsWith("/industrial")) return "industrial";
    if (path.startsWith("/residencial")) return "residencial";
    return "central";
  };

  const [activeArea, setActiveArea] = useState<WorkspaceArea>(() => 
    getAreaFromPath(location.pathname)
  );

  useEffect(() => {
    const area = getAreaFromPath(location.pathname);
    setActiveArea(area);
    document.documentElement.setAttribute("data-workspace", area);
  }, [location.pathname]);

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
