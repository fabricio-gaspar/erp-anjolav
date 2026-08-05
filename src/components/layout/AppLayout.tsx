import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && <AppSidebar />}
      
      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-[100px] bg-white border-none">
            <AppSidebar isMobile onItemClick={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      )}
      
      <div className={cn(
        "flex-1 min-w-0 transition-all duration-300",
        !isMobile && (isCollapsed ? "ml-16" : "ml-60")
      )}>
        <AppHeader 
          title={title} 
          subtitle={subtitle} 
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={isMobile}
        />
        <main className={cn(
          "py-6 px-6",
        )}>
          <div className="w-full">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}