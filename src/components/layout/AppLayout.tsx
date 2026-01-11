import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const { isCollapsed } = useSidebarContext();
  
  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />
      <div className={cn(
        "flex-1 transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-56"
      )}>
        <AppHeader title={title} subtitle={subtitle} />
        <main className="p-4">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
