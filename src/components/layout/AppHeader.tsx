import { Building2, ChevronRight, Menu, LayoutGrid, Moon, Sun } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import {
  getAppRoute,
  getWorkspaceRoute,
  WORKSPACE_AREAS,
  type AppRouteDefinition,
} from "@/lib/appRoutes";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { useThemeMode } from "@/contexts/ThemeModeContext";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function AppHeader({ title, subtitle, onMenuClick, showMenuButton }: AppHeaderProps) {
  const { activeArea } = useWorkspace();
  const { activeTenant, tenants, switchTenant } = useAuth();
  const { resolveWorkspaceRoute } = useNavigationAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleMode } = useThemeMode();
  const activeWorkspace = getWorkspaceRoute(activeArea);
  const workspaceRoutes = WORKSPACE_AREAS
    .map((area) => {
      const route = getWorkspaceRoute(area);
      const destination = resolveWorkspaceRoute(area);
      return route && destination ? { route, destination } : null;
    })
    .filter((entry): entry is { route: AppRouteDefinition; destination: string } => !!entry);

  return (
    <header className={cn(
      "h-16 shadow-none flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 transition-colors border-b border-border bg-background/95 backdrop-blur shrink-0",
      activeArea === "central" ? "bg-background/95" : "bg-card/95"
    )}>
      <div className="flex items-center gap-4 w-full">
        {showMenuButton && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Abrir menu" className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
          <div className="w-px h-7 shrink-0 bg-border" />

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate text-foreground">
                {title || getAppRoute(location.pathname)?.label || "AnjoLav"}
              </h1>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground truncate">
              {subtitle || "AnjoLav ERP"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleMode}
          aria-label={isDark ? "Ativar modo diurno" : "Ativar modo noturno"}
          aria-pressed={isDark}
          title={isDark ? "Modo diurno" : "Modo noturno"}
          className="h-9 w-9 shrink-0 border-strong bg-card text-foreground hover:bg-accent"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {activeTenant && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "max-w-48 gap-2 text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                aria-label={`Empresa ativa: ${activeTenant.name}`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="hidden truncate text-xs font-bold md:inline">{activeTenant.name}</span>
                {tenants.length > 1 && <ChevronRight className="h-3 w-3 rotate-90 opacity-60" />}
              </Button>
            </DropdownMenuTrigger>
            {tenants.length > 1 && (
              <DropdownMenuContent align="end" className="w-64">
                {tenants.map((tenant) => (
                  <DropdownMenuItem
                    key={tenant.id}
                    onClick={() => void switchTenant(tenant.id)}
                    className={cn(tenant.id === activeTenant.id && "bg-muted font-bold")}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="truncate">{tenant.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        )}
        <GlobalSearch />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Trocar painel. Painel atual: ${activeWorkspace?.label ?? "AnjoLav"}`}
              className={cn(
                "max-w-[12rem] gap-2 rounded-lg px-2 sm:px-3 text-foreground hover:bg-accent",
              )}
            >
              <LayoutGrid className="h-5 w-5 shrink-0 text-primary" />
              <span className="hidden truncate font-black text-[13px] uppercase tracking-wider sm:inline">
                {activeWorkspace?.label ?? "AnjoLav"}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl">
            {workspaceRoutes.map(({ route, destination }) => (
              <DropdownMenuItem
                key={route.path}
                onClick={() => navigate(destination)}
                className={cn("rounded-lg mb-1", activeArea === route.area && "bg-slate-100 font-black")}
              >
                {route.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
