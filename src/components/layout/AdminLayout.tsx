import { Fragment, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAdminContext } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeMode } from "@/contexts/ThemeModeContext";
import { ADMIN_ROUTES, toAdminPermissionRoute } from "@/lib/adminRoutes";
import { OPERATION_LABELS } from "@/lib/operations";
import { cn } from "@/lib/utils";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { useOperationalAccessContext } from "@/hooks/useOperationalAccessContext";

interface AdminLayoutProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const DATE_RANGE_LABELS = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
} as const;

export function AdminLayout({ title, subtitle, children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeTenant,
    tenants,
    funcionario,
    user,
    signOut,
    switchTenant,
  } = useAuth();
  const { isDark, toggleMode } = useThemeMode();
  const { canAccessRoute, isLoading: isLoadingAccess } = useNavigationAccess();
  const operationalAccess = useOperationalAccessContext();
  const {
    operation,
    dateRange,
    unitId,
    setOperation,
    setDateRange,
    setUnitId,
  } = useAdminContext();
  const content = children || <Outlet />;
  const displayName = funcionario?.nome || user?.email?.split("@")[0] || "Usuário";
  const availableUnits = operationalAccess.data?.units ?? [];
  const availableOperations = operationalAccess.data?.operations.length
    ? operationalAccess.data.operations
    : ["industrial", "domestico"] as const;
  const unitSelectorUnavailable = operationalAccess.isLoading || operationalAccess.isError;

  const navigation = useMemo(() => {
    const visible = ADMIN_ROUTES.filter((route) => isLoadingAccess || canAccessRoute(toAdminPermissionRoute(route)));
    return visible.reduce<Array<{ section: string; routes: typeof visible }>>((groups, route) => {
      const current = groups.at(-1);
      if (current?.section === route.section) {
        current.routes.push(route);
      } else {
        groups.push({ section: route.section, routes: [route] });
      }
      return groups;
    }, []);
  }, [canAccessRoute, isLoadingAccess]);

  const isActive = (path: string) => location.pathname === path;

  const handleTenantChange = async (tenantId: string) => {
    if (tenantId === activeTenant?.id) return;
    const { error } = await switchTenant(tenantId);
    if (!error) navigate("/admin/visao-geral", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const navigationItems = (compact = false) => navigation.map((group) => (
    <Fragment key={group.section}>
      {!compact && <p className="px-3 pb-1 pt-5 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{group.section}</p>}
      {group.routes.map((route) => {
        const Icon = route.icon;
        return (
          <Link
            key={route.path}
            to={route.path}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              isActive(route.path)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              compact && "whitespace-nowrap",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {route.label}
          </Link>
        );
      })}
    </Fragment>
  ));

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <div className="flex min-h-16 items-center gap-3 border-b px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">AnjoLav</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Administração</p>
          </div>
        </div>
        <nav aria-label="Navegação administrativa" className="flex-1 overflow-y-auto px-3 pb-5">
          {navigationItems()}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <p className="truncate font-semibold text-foreground">{displayName}</p>
          <p className="truncate">{funcionario?.cargo || "Acesso autorizado"}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="flex min-h-16 flex-wrap items-center gap-2 px-3 py-2 sm:px-5">
            <div className="min-w-0 flex-1 lg:hidden">
              <p className="truncate text-sm font-black">AnjoLav · Administração</p>
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-base font-black">{title || "Painel administrativo"}</p>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2 lg:flex-none">
              {activeTenant && (
                <label className="flex min-w-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs font-semibold">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="sr-only">Empresa</span>
                  <select
                    aria-label="Empresa ativa"
                    value={activeTenant.id}
                    onChange={(event) => void handleTenantChange(event.target.value)}
                    className="max-w-28 bg-transparent outline-none sm:max-w-44"
                  >
                    {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                  </select>
                  {tenants.length > 1 && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </label>
              )}

              <label
                className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs font-semibold"
                title={operationalAccess.isError ? "Não foi possível carregar as unidades autorizadas." : undefined}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="sr-only">Unidade</span>
                <select
                  aria-label="Unidade"
                  value={unitId ?? ""}
                  onChange={(event) => setUnitId(event.target.value || null)}
                  className="max-w-28 bg-transparent outline-none"
                  disabled={unitSelectorUnavailable}
                >
                  <option value="">Todas as unidades</option>
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs font-semibold">
                <span className="sr-only">Operação</span>
                <select
                  aria-label="Operação"
                  value={operation}
                  onChange={(event) => setOperation(event.target.value as typeof operation)}
                  className="max-w-24 bg-transparent outline-none sm:max-w-32"
                >
                  <option value="all">Todas</option>
                  {availableOperations.map((operationType) => (
                    <option key={operationType} value={operationType}>{OPERATION_LABELS[operationType]}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 text-xs font-semibold">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="sr-only">Período</span>
                <select
                  aria-label="Período"
                  value={dateRange}
                  onChange={(event) => setDateRange(event.target.value as typeof dateRange)}
                  className="max-w-32 bg-transparent outline-none"
                >
                  {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMode}
                aria-label={isDark ? "Ativar modo diurno" : "Ativar modo noturno"}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleSignOut()} aria-label="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav aria-label="Navegação administrativa móvel" className="scrollbar-hide flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
            {navigationItems(true)}
          </nav>
        </header>
        <main className="w-full flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto h-full w-full max-w-[1920px]">{content}</div>
        </main>
      </div>
    </div>
  );
}
