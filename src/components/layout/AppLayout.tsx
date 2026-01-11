import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />
      <div className="flex-1 ml-56">
        <AppHeader title={title} subtitle={subtitle} />
        <main className="p-4">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
