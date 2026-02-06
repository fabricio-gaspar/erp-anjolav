import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { aplicarTema, getTemaIdFromCorPrimaria } from "@/lib/themeUtils";

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppLayout({
  title,
  subtitle,
  children
}: AppLayoutProps) {
  const { isCollapsed } = useSidebarContext();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { configuracao } = useConfiguracoesGerais();

  // Aplicar tema salvo no banco ao carregar
  useEffect(() => {
    if (configuracao?.cor_primaria) {
      const temaId = getTemaIdFromCorPrimaria(configuracao.cor_primaria);
      aplicarTema(temaId);
    }
  }, [configuracao?.cor_primaria]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && <AppSidebar />}
      
      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-72 bg-sidebar border-none">
            <AppSidebar isMobile onItemClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
      
      <div className={cn(
        "flex-1 min-w-0 transition-all duration-300",
        !isMobile && (isCollapsed ? "ml-16" : "ml-56")
      )}>
        <AppHeader 
          title={title} 
          subtitle={subtitle} 
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={isMobile}
        />
        <main className={cn(
          "py-3 sm:py-4 pr-3 sm:pr-4",
          isMobile ? "pl-3 sm:pl-4" : "pl-2.5"
        )}>
          <div className="w-full">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}