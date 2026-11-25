import { Outlet, useLocation } from "react-router-dom";

import { AdminLayout } from "./AdminLayout";
import { PdvLayout } from "./PdvLayout";
import { usePdvModuleDialog } from "./PdvModuleDialog";

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

function isOperationalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/pdv/")
    || pathname === "/industrial"
    || pathname.startsWith("/industrial/")
    || pathname === "/residencial"
    || pathname.startsWith("/residencial/")
  );
}

/**
 * The ERP exposes only two visual shells. Legacy Industrial and Residential
 * URLs remain valid, but render in the operational shell instead of reviving
 * separate dashboards or a second administrative menu.
 */
export function AppLayout({ title, subtitle, children }: AppLayoutProps) {
  const { pathname } = useLocation();
  const content = children || <Outlet />;
  const inPdvModuleDialog = usePdvModuleDialog();

  if (inPdvModuleDialog) return <>{content}</>;

  if (isOperationalPath(pathname)) {
    return <PdvLayout title={title} subtitle={subtitle}>{content}</PdvLayout>;
  }

  return <AdminLayout title={title} subtitle={subtitle}>{content}</AdminLayout>;
}
