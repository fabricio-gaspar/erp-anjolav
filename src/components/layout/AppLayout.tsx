import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  title?: string;
  children?: React.ReactNode;
}

export function AppLayout({ title, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex w-full">
      <AppSidebar />
      <div className="flex-1 ml-56">
        <AppHeader title={title} />
        <main className="p-6">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
