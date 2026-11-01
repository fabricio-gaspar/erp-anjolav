import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  Clock3,
  Droplets,
  Factory,
  LogOut,
  Moon,
  Store,
  Sun,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOperationalContext } from "@/contexts/OperationalContext";
import { useThemeMode } from "@/contexts/ThemeModeContext";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useOperationalAccessContext } from "@/hooks/useOperationalAccessContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { getCanonicalPdvOperationPath, operationFromLegacyArea } from "@/lib/operations";
import { cn } from "@/lib/utils";

interface PdvLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

const PDV_AREAS = ["residencial", "industrial"] as const;

function getUnitLabel(
  units: Array<{ name: string }> | undefined,
  isLoading: boolean,
  hasError: boolean,
): string {
  if (isLoading) return "Carregando…";
  if (hasError) return "Indisponível";
  if (!units?.length) return "Não definida";
  if (units.length === 1) return units[0].name;
  return `${units.length} unidades autorizadas`;
}

function formatOperationalDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function PdvLayout({ title, subtitle, children }: PdvLayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { activeArea } = useWorkspace();
  const { isOperationSwitchLocked } = useOperationalContext();
  const {
    activeTenant,
    tenants,
    funcionario,
    user,
    signOut,
    switchTenant,
  } = useAuth();
  const { canAccessRoute } = useNavigationAccess();
  const operationalAccess = useOperationalAccessContext();
  const { isDark, toggleMode } = useThemeMode();
  const [now, setNow] = useState(() => new Date());

  const operationArea = activeArea === "industrial" ? "industrial" : "residencial";
  const canUseCash = canAccessRoute(`/${operationArea}/caixa`);
  const { data: caixaAberto, isLoading: isLoadingCash } = useCaixaAberto(canUseCash);
  const accessiblePdvAreas = PDV_AREAS.filter((area) => canAccessRoute(`/${area}/caixa`));
  const areaLabel = operationArea === "industrial" ? "Industrial" : "Doméstico";
  const displayName = funcionario?.nome || user?.email?.split("@")[0] || "Usuário";
  const AreaIcon = operationArea === "industrial" ? Factory : Store;
  const currentPdvPath = getCanonicalPdvOperationPath(operationFromLegacyArea(operationArea));
  const isPdvHome = pathname === currentPdvPath;
  const isLegacyOperationalLanding = pathname === "/industrial" || pathname === "/residencial";
  const unitLabel = getUnitLabel(
    operationalAccess.data?.units,
    operationalAccess.isLoading,
    operationalAccess.isError,
  );
  const cashLabel = !canUseCash
    ? "Acesso restrito"
    : isLoadingCash
      ? "Verificando…"
      : caixaAberto
        ? `Aberto · ${caixaAberto.identificador_caixa}`
        : "Fechado";

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleTenantChange = async (tenantId: string) => {
    const { error } = await switchTenant(tenantId);
    if (!error) navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 shadow-sm backdrop-blur">
        <div className="flex min-h-16 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <Droplets className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black tracking-tight sm:text-base">
                  {title || "Portal operacional"}
                </p>
                <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary sm:inline">
                  Operação
                </span>
              </div>
              <p className="truncate text-[11px] font-semibold text-muted-foreground">
                {subtitle || `${activeTenant?.name ?? "Empresa"} · ${areaLabel}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={toggleMode}
              aria-label={isDark ? "Ativar modo diurno" : "Ativar modo noturno"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Usuário: ${displayName}`}>
                  <UserRound className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate">{displayName}</span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                    {funcionario?.cargo || "Operador"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          aria-label="Contexto operacional"
          className="scrollbar-hide flex items-center gap-2 overflow-x-auto border-t bg-muted/20 px-3 py-2 sm:px-5"
        >
          {activeTenant && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="font-medium text-muted-foreground">Empresa</span>
                  <span className="max-w-32 truncate font-bold">{activeTenant.name}</span>
                  {tenants.length > 1 && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
                </Button>
              </DropdownMenuTrigger>
              {tenants.length > 1 && (
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Empresa ativa</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tenants.map((tenant) => (
                    <DropdownMenuItem
                      key={tenant.id}
                      className={cn(tenant.id === activeTenant.id && "bg-muted font-bold")}
                      onClick={() => void handleTenantChange(tenant.id)}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <span className="truncate">{tenant.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          )}

          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-muted-foreground">Unidade</span>
            <span className="max-w-40 truncate font-bold">{unitLabel}</span>
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 text-xs"
                aria-label={`PDV ${areaLabel}`}
                disabled={isOperationSwitchLocked || accessiblePdvAreas.length < 2}
                title={isOperationSwitchLocked
                  ? "Finalize ou limpe a venda atual antes de trocar de operação."
                  : accessiblePdvAreas.length < 2
                    ? "Seu perfil possui somente esta operação autorizada."
                    : undefined}
              >
                <AreaIcon className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-muted-foreground">Operação</span>
                <span className="font-bold">{areaLabel}</span>
                {accessiblePdvAreas.length > 1 && <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
              </Button>
            </DropdownMenuTrigger>
            {accessiblePdvAreas.length > 1 && (
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Operação autorizada</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accessiblePdvAreas.map((area) => {
                  const Icon = area === "industrial" ? Factory : Store;
                  const label = area === "industrial" ? "Industrial" : "Doméstico";
                  return (
                    <DropdownMenuItem
                      key={area}
                      className={cn(area === operationArea && "bg-muted font-bold")}
                      onClick={() => navigate(area === "industrial" ? "/pdv/industrial" : "/pdv/domestico")}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            )}
          </DropdownMenu>

          {canUseCash && (
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
              <WalletCards className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium text-muted-foreground">Caixa</span>
              <span className="font-bold">{cashLabel}</span>
            </span>
          )}

          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
            <UserRound className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-muted-foreground">Usuário</span>
            <span className="max-w-36 truncate font-bold">{displayName}</span>
          </span>

          <time className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs font-bold" dateTime={now.toISOString()}>
            <Clock3 className="h-3.5 w-3.5 text-primary" />
            {formatOperationalDateTime(now)}
          </time>
        </div>
      </header>

      {!isPdvHome && !isLegacyOperationalLanding && (
        <div className="border-b bg-muted/30 px-3 py-2 sm:px-5">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(currentPdvPath)}>
            Voltar ao atendimento
          </Button>
        </div>
      )}

      {isLegacyOperationalLanding && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 sm:px-5">
          <p className="text-xs font-medium text-muted-foreground">Visão operacional da empresa ativa.</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(currentPdvPath)}>
            Abrir atendimento
          </Button>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1920px] flex-1 p-3 sm:p-5">
        {children}
      </main>
    </div>
  );
}
