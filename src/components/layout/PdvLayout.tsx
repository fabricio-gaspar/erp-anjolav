import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  Factory,
  LogOut,
  Moon,
  Search,
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
import { getPdvFrontPath, type PdvArea } from "@/lib/authorization";
import { cn } from "@/lib/utils";

interface PdvLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Mantém a frente operacional com o chrome de balcão da referência. */
  variant?: "standard" | "front";
  operation?: PdvArea;
}

const PDV_AREAS = ["residencial", "industrial"] as const;

function HangerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" fill="none" className={className} aria-hidden="true">
      <path d="M31.5 12.5a6.5 6.5 0 1 1 9.6 5.72c-2.58 1.45-4.1 3.38-4.1 6.05v1.48" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M36.9 25.75 7 43h50L36.9 25.75Z" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
    </svg>
  );
}

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

export function PdvLayout({
  title,
  subtitle,
  children,
  variant = "standard",
  operation: requestedOperation,
}: PdvLayoutProps) {
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
  const [frontSearch, setFrontSearch] = useState("");

  const operationArea = requestedOperation ?? (activeArea === "industrial" ? "industrial" : "residencial");
  const canUseCash = canAccessRoute(`/${operationArea}/caixa`);
  const { data: caixaAberto, isLoading: isLoadingCash } = useCaixaAberto(canUseCash);
  const accessiblePdvAreas = PDV_AREAS.filter((area) => canAccessRoute(`/${area}/caixa`));
  const areaLabel = operationArea === "industrial" ? "Industrial" : "Doméstico";
  const displayName = funcionario?.nome || user?.email?.split("@")[0] || "Usuário";
  const currentPdvPath = getCanonicalPdvOperationPath(operationFromLegacyArea(operationArea));
  const isPdvCashier = pathname === currentPdvPath;
  const isPdvFront = variant === "front" || pathname.startsWith("/pdv/painel");
  const isLegacyOperationalLanding = pathname === "/industrial" || pathname === "/residencial";
  const isPdvRoute = pathname.startsWith("/pdv/");
  const operationalHomePath = `/${operationArea}`;
  const navigationTarget = isPdvRoute ? getPdvFrontPath(operationArea) : operationalHomePath;
  const navigationLabel = isPdvRoute ? "Voltar ao painel principal" : "Voltar ao painel operacional";
  const shellBadge = isPdvCashier ? "Atendimento" : "Operação";
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
        ? caixaAberto.identificador_caixa
          ? `Caixa ${caixaAberto.identificador_caixa} Aberto`
          : "Caixa aberto"
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

  const handleFrontSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = frontSearch.trim();
    if (!query) return;
    navigate(`${currentPdvPath}/clientes?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className={cn("flex min-h-screen w-full flex-col overflow-x-hidden", isPdvFront ? "bg-[#06213a]" : "bg-[#edf3f8]")}>
      <header className="sticky top-0 z-40 border-b border-white/15 bg-[#062443] text-white shadow-lg shadow-slate-950/20">
        <div className={cn("flex items-center justify-between gap-4 px-3 sm:px-5 lg:px-6", isPdvFront ? "min-h-[48px]" : "min-h-[64px]")}>
          <div className={cn("flex min-w-0 items-center", isPdvFront ? "gap-3" : "gap-6")}>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-white/90"
              aria-label="AnjoLav"
              title="Abrir painel principal"
              onClick={() => navigate(getPdvFrontPath(operationArea))}
            >
              <HangerMark className={cn("text-white", isPdvFront ? "h-7 w-8" : "h-9 w-10")} />
              <span className={cn("font-black tracking-[-0.05em] text-white", isPdvFront ? "text-[18px] uppercase tracking-[-0.02em]" : "hidden text-[30px] sm:inline")}>
                Anjo<span className={cn(!isPdvFront && "text-emerald-300")}>Lav</span>
              </span>
            </button>
            {!isPdvFront && (
              <>
                <span className="hidden h-8 w-px bg-white/25 md:block" aria-hidden="true" />
                <h1 className="truncate text-lg font-black tracking-[-0.045em] text-white sm:text-[25px]">
                  {title || "PDV / Caixa"}
                </h1>
                <span className="hidden rounded-full border border-emerald-300/25 bg-emerald-300/15 px-4 py-2 text-sm font-bold text-emerald-100 lg:inline">
                  {shellBadge}
                </span>
              </>
            )}
          </div>

          <div aria-label="Contexto operacional" className="scrollbar-hide flex min-w-0 items-center justify-end gap-2 overflow-x-auto text-sm">
            {isPdvFront && (
              <form onSubmit={handleFrontSearch} className="relative hidden w-[240px] lg:block xl:w-[310px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input
                  value={frontSearch}
                  onChange={(event) => setFrontSearch(event.target.value)}
                  placeholder="Buscar módulo, cliente ou ROL..."
                  aria-label="Buscar cliente ou ROL"
                  className="h-7 w-full rounded border border-white/20 bg-white/10 pl-8 pr-2 text-[11px] text-white placeholder:text-slate-300 outline-none transition focus:border-sky-200 focus:bg-white/15"
                />
              </form>
            )}
            <span className="hidden shrink-0 items-center gap-2 border-r border-white/20 pr-4 text-slate-100 xl:inline-flex" title={subtitle || `${activeTenant?.name ?? "Empresa"} · ${areaLabel}`}>
              <Building2 className="h-4 w-4 text-[#78c8f6]" />
              <span><span className="text-slate-300">{isPdvFront ? "Unidade" : "Unidade:"}</span> <strong className="text-white">{unitLabel}</strong></span>
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("hidden shrink-0 gap-1.5 px-2 text-white hover:bg-white/10 hover:text-white md:inline-flex", isPdvFront ? "h-8 text-[11px]" : "h-9 text-sm")}
                  aria-label={`Operação ${areaLabel}`}
                  disabled={isOperationSwitchLocked || accessiblePdvAreas.length < 2}
                  title={isOperationSwitchLocked
                    ? "Finalize ou limpe a venda atual antes de trocar de operação."
                    : accessiblePdvAreas.length < 2
                      ? "Seu perfil possui somente esta operação autorizada."
                      : undefined}
                >
                  <Settings2 className="h-4 w-4 text-[#78c8f6]" />
                  <span><span className="text-slate-300">Operação:</span> <strong>{areaLabel}</strong></span>
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
                        onClick={() => navigate(isPdvFront ? getPdvFrontPath(area) : (area === "industrial" ? "/pdv/industrial" : "/pdv/domestico"))}
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
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/15 px-3 py-1.5 font-bold text-emerald-100 lg:inline-flex">
                <WalletCards className="h-4 w-4" />
                {cashLabel}
              </span>
            )}

            {isPdvFront && (
              <span className="hidden h-8 w-8 shrink-0 items-center justify-center text-white md:inline-flex" aria-label="Notificações">
                <Bell className="h-4 w-4" />
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 px-2 text-white hover:bg-white/10 hover:text-white" aria-label={`Usuário: ${displayName}`}>
                  <UserRound className="h-4 w-4 text-[#78c8f6]" />
                  <span className="hidden max-w-48 truncate text-sm font-bold lg:inline"><span className="font-medium text-slate-300">Usuário:</span> {displayName}</span>
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

            <time className={cn("hidden min-w-[208px] shrink-0 items-center gap-2 border-l border-white/20 pl-4 font-semibold text-white md:inline-flex", isPdvFront && "!hidden")} dateTime={now.toISOString()}>
              <CalendarDays className="h-4 w-4 text-[#78c8f6]" />
              <span>{formatOperationalDate(now)}</span>
              <Clock3 className="ml-1 h-4 w-4 text-[#78c8f6]" />
              <strong className="text-sm">{formatOperationalTime(now)}</strong>
            </time>
          </div>
        </div>
      </header>

      {!isPdvCashier && !isPdvFront && !isLegacyOperationalLanding && (
        <div className="border-b bg-muted/30 px-3 py-2 sm:px-5">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(navigationTarget)}>
            {navigationLabel}
          </Button>
        </div>
      )}

      <main className={cn(
        "mx-auto w-full max-w-[1920px] flex-1",
        isPdvFront || isLegacyOperationalLanding ? "max-w-none p-0" : "p-3 xl:px-6 xl:pt-[25px] xl:pb-[21px]",
      )}>
        {children}
      </main>

      <footer className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/15 bg-[#062443] px-4 py-2 text-[11px] font-medium text-slate-300 sm:px-6", isPdvFront ? "min-h-7 py-1 text-[9px]" : "min-h-11")}>
        <span>{isPdvFront ? "SRV-SERVIDOR" : "AnjoLav ERP · Ambiente operacional"}</span>
        <span>{isPdvFront ? "Backup em nuvem" : `${areaLabel} · Acesso controlado por permissões`}</span>
        {isPdvFront && <span>Operação {areaLabel}</span>}
      </footer>
    </div>
  );
}
