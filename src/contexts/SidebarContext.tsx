import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => setIsCollapsed((prev: boolean) => !prev);
  const setCollapsed = (value: boolean) => setIsCollapsed(value);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  const context = useContext(SidebarContext);

  // Fallback defensivo: evita tela em branco caso algum componente use o hook
  // fora do provider (ex.: hot reload, páginas isoladas, etc.).
  if (context === undefined) {
    if (import.meta.env.DEV) {
      // Mantém o alerta para facilitar debug, mas sem quebrar a UI.
      // eslint-disable-next-line no-console
      console.warn("useSidebarContext foi chamado fora de <SidebarProvider>. Usando fallback.");
    }

    return {
      isCollapsed: false,
      toggleSidebar: () => {},
      setCollapsed: () => {},
    };
  }

  return context;
}
