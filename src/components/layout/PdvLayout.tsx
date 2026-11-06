import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  Factory,
  Leaf,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings2,
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

function formatOperationalDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatOperationalTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function PdvLayout({ title, subtitle, children }: PdvLayoutProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
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

  const accessiblePdvAreas = PDV_AREAS.filter((area) => canAccessRoute(`/${area}/caixa`));
  const requestedArea = new URLSearchParams(search).get("operacao");
  const workspaceOperation = activeArea === "industrial" ? "industrial" : "residencial";
  const preferredOperation = requestedArea === "industrial" || requestedArea === "residencial"
    ? requestedArea
    : workspaceOperation;
  const operationArea = accessiblePdvAreas.includes(preferredOperation)
    ? preferredOperation
    : accessiblePdvAreas[0] ?? preferredOperation;
  const canUseCash = canAccessRoute(`/${operationArea}/caixa`);
  const { data: caixaAberto, isLoading: isLoadingCash } = useCaixaAberto(canUseCash);
  const areaLabel = operationArea === "industrial" ? "Industrial" : "Doméstico";
  const displayName = funcionario?.nome || user?.email?.split("@")[0] || "Usuário";
  const AreaIcon = operationArea === "industrial" ? Factory : Store;
  const currentPdvPath = getCanonicalPdvOperationPath(operationFromLegacyArea(operationArea));
  const isPdvHome = pathname === currentPdvPath;
  const isPdvModuleHub = pathname === "/pdv" || pathname === "/pdv/painel" || pathname === "/admin/pdv-caixas";
  const isAdministrativePdvHub = pathname === "/admin/pdv-caixas";
  const isLegacyOperationalLanding = pathname === "/industrial" || pathname === "/residencial";
  const unitLabel = getUnitLabel(
    operationalAccess.data?.units,
    operationalAccess.isLoading,
    operationalAccess.isError,
  );
  const cashIdentifier = caixaAberto?.identificador_caixa?.trim();
  const cashLabel = !canUseCash
    ? "Acesso restrito"
    : isLoadingCash
      ? "Verificando…"
      : caixaAberto
        ? cashIdentifier ? `Caixa ${cashIdentifier} aberto` : "Caixa aberto"
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
        <div className="flex min-h-[64px] items-center justify-between gap-4 px-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex shrink-0 items-center gap-2.5" aria-label="AnjoLav">
              <Leaf className="h-9 w-9 fill-success/15 text-success" strokeWidth={2.25} />
              <span className="hidden text-[30px] font-black tracking-[-0.06em] text-foreground sm:inline">Anjo<span className="text-success">Lav</span></span>
            </div>
            <span className="hidden h-8 w-px bg-border md:block" aria-hidden="true" />
            <h1 className="shrink-0 whitespace-nowrap text-lg font-black tracking-[-0.045em] text-foreground sm:text-[25px]">
              {title || "PDV / Caixa"}
            </h1>
            <span className="hidden rounded-full bg-success-light px-4 py-2 text-sm font-bold text-success 2xl:inline">
              Atendimento
            </span>
          </div>

          <div aria-label="Contexto operacional" className="scrollbar-hide flex min-w-0 items-center justify-end gap-2 overflow-x-auto text-sm">
            <span className="hidden shrink-0 items-center gap-2 border-r border-border pr-4 xl:inline-flex" title={subtitle || `${activeTenant?.name ?? "Empresa"} · ${areaLabel}`}>
              <Building2 className="h-4 w-4 text-primary" />
              <span><span className="text-muted-foreground">Unidade:</span> <strong>{unitLabel}</strong></span>
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden h-9 shrink-0 gap-1.5 px-2 text-sm md:inline-flex"
                  aria-label={`Operação ${areaLabel}`}
                  disabled={isOperationSwitchLocked || accessiblePdvAreas.length < 2}
                  title={isOperationSwitchLocked
                    ? "Finalize ou limpe a venda atual antes de trocar de operação."
                    : accessiblePdvAreas.length < 2
                      ? "Seu perfil possui somente esta operação autorizada."
                      : undefined}
                >
                  <Settings2 className="h-4 w-4 text-primary" />
                  <span><span className="text-muted-foreground">Operação:</span> <strong>{areaLabel}</strong></span>
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
                        onClick={() => navigate(
                          isPdvModuleHub
                            ? `/pdv?operacao=${area}`
                            : area === "industrial" ? "/pdv/industrial" : "/pdv/domestico",
                        )}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              )}
            </DropdownMenu>

            {!isPdvModuleHub && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 gap-1.5 px-2"
                onClick={() => navigate(`/pdv?operacao=${operationArea}`)}
                aria-label="Abrir painel de módulos do PDV"
              >
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <span className="hidden text-sm font-semibold lg:inline">Módulos</span>
              </Button>
            )}

            {canUseCash && (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-success-light px-3 py-1.5 font-bold text-success lg:inline-flex">
                <WalletCards className="h-4 w-4" />
                {cashLabel}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 px-2" aria-label={`Usuário: ${displayName}`}>
                  <UserRound className="h-4 w-4" />
                  <span className="hidden max-w-48 truncate text-sm font-bold lg:inline"><span className="font-medium text-muted-foreground">Usuário:</span> {displayName}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 lg:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate">{displayName}</span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                    {funcionario?.cargo || "Operador"}
                  </span>
                </DropdownMenuLabel>
                {activeTenant && tenants.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Empresa ativa</DropdownMenuLabel>
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
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleMode}>
                  {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  {isDark ? "Ativar modo diurno" : "Ativar modo noturno"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <time className="hidden min-w-[208px] shrink-0 items-center gap-2 border-l border-border pl-4 font-semibold md:inline-flex" dateTime={now.toISOString()}>
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>{formatOperationalDate(now)}</span>
              <Clock3 className="ml-1 h-4 w-4 text-primary" />
              <strong className="text-sm">{formatOperationalTime(now)}</strong>
            </time>
          </div>
        </div>
      </header>

      {isAdministrativePdvHub && (
        <div className="border-b bg-muted/30 px-3 py-2 sm:px-5">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/admin/visao-geral")}>
            Voltar ao Painel Administrativo
          </Button>
        </div>
      )}

      {!isPdvHome && !isLegacyOperationalLanding && !isPdvModuleHub && (
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

      <main className="mx-auto w-full max-w-[1920px] flex-1 p-3 xl:px-6 xl:pt-[25px] xl:pb-[21px]">
        {children}
      </main>
    </div>
  );
}
