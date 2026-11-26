import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CloudUpload,
  Clock3,
  Factory,
  KeyRound,
  LogOut,
  Moon,
  Search,
  Settings2,
  Store,
  Sun,
  UserRound,
  WalletCards,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ChangeOwnPasswordDialog } from "@/components/auth/ChangeOwnPasswordDialog";
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
import { useOfflineRuntime } from "@/contexts/OfflineRuntimeContext";
import { useThemeMode } from "@/contexts/ThemeModeContext";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { getCanonicalPdvOperationPath, operationFromLegacyArea } from "@/lib/operations";
import { getPdvFrontPath, type PdvArea } from "@/lib/authorization";
import { cn } from "@/lib/utils";
import "@/styles/pdv-layout.css";

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
  const { isDark, toggleMode } = useThemeMode();
  const offlineRuntime = useOfflineRuntime();
  const [now, setNow] = useState(() => new Date());
  const [frontSearch, setFrontSearch] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const operationArea = requestedOperation ?? (activeArea === "industrial" ? "industrial" : "residencial");
  const canUseCash = canAccessRoute(`/${operationArea}/caixa`);
  const isCashReport = pathname.includes("/relatorios/caixa");
  const { data: caixaAberto, isLoading: isLoadingCash } = useCaixaAberto(canUseCash && !isCashReport);
  const accessiblePdvAreas = PDV_AREAS.filter((area) => canAccessRoute(`/${area}/caixa`));
  const areaLabel = operationArea === "industrial" ? "Industrial" : "Doméstico";
  const displayName = funcionario?.nome || user?.email?.split("@")[0] || "Usuário";
  const currentPdvPath = getCanonicalPdvOperationPath(operationFromLegacyArea(operationArea));
  const isPdvFront = variant === "front" || pathname.startsWith("/pdv/painel");
  const isLegacyOperationalLanding = pathname === "/industrial" || pathname === "/residencial";
  const cashLabel = !canUseCash
    ? "Acesso restrito"
    : isLoadingCash
      ? "Verificando…"
      : caixaAberto
        ? "Caixa aberto"
        : "Caixa fechado";
  const connectionLabel = offlineRuntime.reviewCount > 0
    ? `${offlineRuntime.reviewCount} para revisar`
    : offlineRuntime.isSyncing
      ? "Sincronizando"
      : offlineRuntime.pendingCount > 0
        ? `${offlineRuntime.pendingCount} pendente${offlineRuntime.pendingCount > 1 ? "s" : ""}`
        : offlineRuntime.isOperationalOnline
          ? "Online"
          : "Offline";

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
    navigate("/login/pdv", { replace: true });
  };

  const handleFrontSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = frontSearch.trim();
    if (!query) return;
    navigate(`${currentPdvPath}/clientes?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="pdv-app-shell flex min-h-screen w-full flex-col overflow-x-hidden" data-pdv-template="oceano">
      <header className="pdv-app-header sticky top-0 z-40 border-b border-white/15 text-white shadow-lg shadow-slate-950/20" aria-label={title || "AnjoLav PDV"}>
        <div className="pdv-app-header__inner flex min-h-[64px] items-center justify-between gap-4 px-3 sm:px-5 lg:px-6">
          <div className="pdv-app-header__brand-area flex min-w-0 items-center gap-5">
            <button
              type="button"
              className="pdv-app-brand flex shrink-0 items-center gap-2.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-white/90"
              aria-label="AnjoLav"
              title="Abrir painel principal"
              onClick={() => navigate(getPdvFrontPath(operationArea))}
            >
              <HangerMark className="h-8 w-9 text-white" />
              <span className="font-black text-[26px] tracking-[-0.05em] text-white">
                Anjo<span className="text-blue-300">Lav</span>
              </span>
            </button>
            <span className="hidden h-8 w-px bg-white/25 lg:block" aria-hidden="true" />
            <form onSubmit={handleFrontSearch} className="pdv-app-search relative hidden w-[220px] xl:block 2xl:w-[300px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                value={frontSearch}
                onChange={(event) => setFrontSearch(event.target.value)}
                placeholder="Buscar cliente..."
                aria-label="Buscar cliente"
                className="h-9 w-full rounded border border-white/20 bg-white/10 pl-9 pr-3 text-xs text-white placeholder:text-slate-300 outline-none transition focus:border-blue-200 focus:bg-white/15"
              />
            </form>
          </div>

          <div aria-label="Contexto operacional" className="pdv-app-header__context scrollbar-hide flex min-w-0 items-center justify-end gap-2 overflow-x-auto text-sm">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="pdv-app-operation hidden h-9 shrink-0 gap-1.5 px-2 text-sm text-white hover:bg-white/10 hover:text-white md:inline-flex"
                  aria-label={`Operação ${areaLabel}`}
                  disabled={isOperationSwitchLocked || accessiblePdvAreas.length < 2}
                  title={isOperationSwitchLocked
                    ? "Finalize ou limpe a venda atual antes de trocar de operação."
                    : accessiblePdvAreas.length < 2
                      ? "Seu perfil possui somente esta operação autorizada."
                      : undefined}
                >
                  <Settings2 className="h-4 w-4 text-blue-200" />
                  <span><strong>{areaLabel}</strong></span>
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

            {canUseCash && !isCashReport && (
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/15 px-3 py-1.5 font-bold text-emerald-100 lg:inline-flex">
                <WalletCards className="h-4 w-4" />
                {cashLabel}
              </span>
            )}

            <button
              type="button"
              onClick={offlineRuntime.openQueue}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                offlineRuntime.reviewCount > 0
                  ? "border-red-200/50 bg-red-500/25 text-red-50 hover:bg-red-500/35"
                  : offlineRuntime.isOperationalOnline
                    ? "border-emerald-200/35 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/25"
                    : "border-amber-200/45 bg-amber-400/20 text-amber-50 hover:bg-amber-400/30",
              )}
              aria-label={`${connectionLabel}. Abrir Central de sincronização`}
              aria-live="polite"
            >
              {offlineRuntime.isSyncing || offlineRuntime.pendingCount > 0
                ? <CloudUpload className={cn("h-4 w-4", offlineRuntime.isSyncing && "animate-pulse")} />
                : offlineRuntime.isOperationalOnline
                  ? <Wifi className="h-4 w-4" />
                  : <WifiOff className="h-4 w-4" />}
              <span>{connectionLabel}</span>
            </button>

            <span className="hidden h-9 w-9 shrink-0 items-center justify-center text-white md:inline-flex" aria-label="Notificações" title="Notificações">
              <Bell className="h-4 w-4" />
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 px-2 text-white hover:bg-white/10 hover:text-white" aria-label={`Usuário: ${displayName}`}>
                  <UserRound className="h-4 w-4 text-blue-200" />
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
                        disabled={!offlineRuntime.isOperationalOnline}
                        onClick={() => void handleTenantChange(tenant.id)}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        <span className="truncate">{tenant.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!offlineRuntime.isOperationalOnline} onSelect={() => setChangePasswordOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Alterar minha senha
                </DropdownMenuItem>
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

            <time className="hidden min-w-[208px] shrink-0 items-center gap-2 border-l border-white/20 pl-4 font-semibold text-white 2xl:inline-flex" dateTime={now.toISOString()}>
              <CalendarDays className="h-4 w-4 text-blue-200" />
              <span>{formatOperationalDate(now)}</span>
              <Clock3 className="ml-1 h-4 w-4 text-blue-200" />
              <strong className="text-sm">{formatOperationalTime(now)}</strong>
            </time>
          </div>
        </div>
      </header>

      <main className={cn(
        "pdv-layout-main mx-auto w-full max-w-[1920px] flex-1",
        isPdvFront || isLegacyOperationalLanding
          ? "pdv-layout-main--front max-w-none p-0"
          : "pdv-layout-main--workspace px-3 py-3 sm:px-4 xl:px-6 xl:py-5",
      )}>
        {children}
      </main>

      <ChangeOwnPasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

    </div>
  );
}
