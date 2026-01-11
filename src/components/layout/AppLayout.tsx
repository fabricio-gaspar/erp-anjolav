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
export function AppLayout({
  title,
  subtitle,
  children
}: AppLayoutProps) {
  const {
    isCollapsed
  } = useSidebarContext();
  return <div className="min-h-screen bg-slate-50/50 flex w-full border">
      <AppSidebar />
      <div className={cn("flex-1 transition-all duration-300", isCollapsed ? "ml-16" : "ml-56")}>
        <AppHeader title={title} subtitle={subtitle} />
        <main className="px-4 py-4">
          <div className="max-w-[1800px] mx-auto">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>;
}