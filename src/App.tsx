import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, type Location } from "react-router-dom";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { queryClient } from "@/lib/queryClient";
import { aplicarTema, getTemaIdFromCorPrimaria } from "@/lib/themeUtils";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThemeModeProvider } from "@/contexts/ThemeModeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { OfflineRuntimeProvider } from "@/contexts/OfflineRuntimeContext";
import { OperationalProvider } from "@/contexts/OperationalContext";
import { useWorkspace, WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import {
  APP_ROUTES,
  LEGACY_ROUTE_REDIRECTS,
  type AppRouteDefinition,
  type AppRoutePath,
  type LegacyRouteRedirect,
} from "@/lib/appRoutes";
import { getCanonicalPdvPath, getPdvFrontPath } from "@/lib/authorization";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { ADMIN_ROUTES, type AdminRoutePath } from "@/lib/adminRoutes";
import { PdvModuleDialog } from "@/components/layout/PdvModuleDialog";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Produtos = lazy(() => import("./pages/Produtos"));
const FluxoProducao = lazy(() => import("./pages/FluxoProducao"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const Agenda = lazy(() => import("./pages/Agenda"));
const CaixaPDV = lazy(() => import("./pages/CaixaPDV"));
const PdvModuleHub = lazy(() => import("./pages/PdvModuleHub"));
const PdvReportsHub = lazy(() => import("./pages/PdvReportsHub"));
const AdminReportsHub = lazy(() => import("./pages/AdminReportsHub"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro"));
const Contas = lazy(() => import("./pages/Contas"));
const RelatoriosCliente = lazy(() => import("./pages/RelatoriosCliente"));
const RelatorioProximidade = lazy(() => import("./pages/RelatorioProximidade"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Login = lazy(() => import("./pages/Login"));
const MfaChallenge = lazy(() => import("./pages/MfaChallenge"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PortalCliente = lazy(() => import("./pages/PortalCliente"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Estoque = lazy(() => import("./pages/Estoque"));
const HistoricoCaixas = lazy(() => import("./pages/HistoricoCaixas"));
const AgendaEventos = lazy(() => import("./pages/AgendaEventos"));
const RelatorioKilometragem = lazy(() => import("./pages/RelatorioKilometragem"));
const RelatorioMensal = lazy(() => import("./pages/RelatorioMensal"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const AdministracaoSaas = lazy(() => import("./pages/AdministracaoSaas"));

function ThemeLoader({ children }: { children: React.ReactNode }) {
  const { session, activeTenant, loading } = useAuth();
  const { configuracao } = useConfiguracoesGerais(Boolean(session && activeTenant && !loading));
  useEffect(() => {
    const temaId = getTemaIdFromCorPrimaria(configuracao?.cor_primaria ?? null);
    aplicarTema(temaId);
  }, [configuracao?.cor_primaria]);
  return <>{children}</>;
}

const ROUTE_COMPONENTS = {
  "/central": Dashboard,
  "/central/financeiro": DashboardFinanceiro,
  "/central/contas": Contas,
  "/central/contas-receber": Contas,
  "/central/contas-pagar": Contas,
  "/central/agenda-eventos": AgendaEventos,
  "/central/relatorios/quilometragem": RelatorioKilometragem,
  "/central/relatorios/mensal": RelatorioMensal,
  "/central/configuracoes": Configuracoes,
  "/central/auditoria": Auditoria,
  "/central/administracao-saas": AdministracaoSaas,
  "/industrial": Dashboard,
  "/industrial/clientes": Clientes,
  "/industrial/produtos": Produtos,
  "/industrial/fornecedores": Fornecedores,
  "/industrial/agenda": Agenda,
  "/industrial/ordens": OrdensServico,
  "/industrial/producao": FluxoProducao,
  "/industrial/caixa": CaixaPDV,
  "/industrial/lancamentos": Lancamentos,
  "/industrial/financeiro": DashboardFinanceiro,
  "/industrial/estoque": Estoque,
  "/industrial/relatorios/clientes": RelatoriosCliente,
  "/industrial/relatorios/proximidade": RelatorioProximidade,
  "/residencial": Dashboard,
  "/residencial/caixa": CaixaPDV,
  "/residencial/lancamentos": Lancamentos,
  "/residencial/clientes": Clientes,
  "/residencial/agenda": Agenda,
  "/residencial/ordens": OrdensServico,
  "/residencial/producao": FluxoProducao,
  "/residencial/financeiro": DashboardFinanceiro,
  "/residencial/produtos": Produtos,
  "/residencial/estoque": Estoque,
  "/residencial/relatorios/caixa": HistoricoCaixas,
} as const satisfies Record<AppRoutePath, LazyExoticComponent<ComponentType>>;

const ADMIN_ROUTE_COMPONENTS: Record<AdminRoutePath, LazyExoticComponent<ComponentType>> = {
  "/admin/visao-geral": Dashboard,
  "/admin/cadastros/clientes": Clientes,
  "/admin/cadastros/produtos": Produtos,
  "/admin/cadastros/fornecedores": Fornecedores,
  "/admin/operacoes/agenda": Agenda,
  "/admin/operacoes/ordens": OrdensServico,
  "/admin/operacoes/producao": FluxoProducao,
  "/admin/financeiro": DashboardFinanceiro,
  "/admin/financeiro/lancamentos": Lancamentos,
  "/admin/financeiro/contas": Contas,
  "/admin/financeiro/contas-receber": Contas,
  "/admin/financeiro/contas-pagar": Contas,
  "/admin/financeiro/caixas": HistoricoCaixas,
  "/admin/estoque": Estoque,
  "/admin/relatorios": RelatorioMensal,
  "/admin/relatorios/central": AdminReportsHub,
  "/admin/relatorios/quilometragem": RelatorioKilometragem,
  "/admin/configuracoes": Configuracoes,
  "/admin/auditoria": Auditoria,
  "/admin/plataforma": AdministracaoSaas,
};

const PDV_ROUTES = [
  { area: "residencial", path: "/pdv/domestico" },
  { area: "industrial", path: "/pdv/industrial" },
] as const;

const PDV_WORKBENCH_ROUTES = [
  { area: "residencial", path: "/pdv/domestico/rol", mode: "rol" },
  { area: "residencial", path: "/pdv/domestico/delivery", mode: "delivery" },
  { area: "residencial", path: "/pdv/domestico/orcamento", mode: "orcamento" },
  { area: "industrial", path: "/pdv/industrial/rol", mode: "rol" },
  { area: "industrial", path: "/pdv/industrial/delivery", mode: "delivery" },
  { area: "industrial", path: "/pdv/industrial/orcamento", mode: "orcamento" },
] as const;

const PDV_FRONT_ROUTES = [
  { area: "residencial", path: "/pdv/painel/domestico" },
  { area: "industrial", path: "/pdv/painel/industrial" },
] as const;

const PDV_OPERATIONAL_ROUTES = [
  { area: "residencial", path: "/pdv/domestico/clientes", title: "Clientes", requiredModule: ["clientes"], Page: Clientes },
  { area: "industrial", path: "/pdv/industrial/clientes", title: "Clientes", requiredModule: ["clientes"], Page: Clientes },
  { area: "residencial", path: "/pdv/domestico/produtos", title: "Catálogo", requiredModule: ["produtos"], Page: Produtos },
  { area: "industrial", path: "/pdv/industrial/produtos", title: "Catálogo", requiredModule: ["produtos"], Page: Produtos },
  { area: "residencial", path: "/pdv/domestico/agenda", title: "Agenda", requiredModule: ["agenda"], Page: Agenda },
  { area: "industrial", path: "/pdv/industrial/agenda", title: "Agenda", requiredModule: ["agenda"], Page: Agenda },
  { area: "residencial", path: "/pdv/domestico/ordens", title: "Entregar pedido", requiredModule: ["ordens"], Page: OrdensServico },
  { area: "industrial", path: "/pdv/industrial/ordens", title: "Entregar pedido", requiredModule: ["ordens"], Page: OrdensServico },
  { area: "residencial", path: "/pdv/domestico/producao", title: "Produção", requiredModule: ["producao"], Page: FluxoProducao },
  { area: "industrial", path: "/pdv/industrial/producao", title: "Produção", requiredModule: ["producao"], Page: FluxoProducao },
  { area: "residencial", path: "/pdv/domestico/estoque", title: "Estoque", requiredModule: ["produtos"], Page: Estoque },
  { area: "industrial", path: "/pdv/industrial/estoque", title: "Estoque", requiredModule: ["produtos"], Page: Estoque },
  { area: "residencial", path: "/pdv/domestico/relatorios", title: "Relatórios", requiredModule: ["relatorios"], Page: PdvReportsHub },
  { area: "industrial", path: "/pdv/industrial/relatorios", title: "Relatórios", requiredModule: ["relatorios"], Page: PdvReportsHub },
  { area: "residencial", path: "/pdv/domestico/relatorios/caixa", title: "Relatórios de caixa", requiredModule: ["relatorios"], Page: HistoricoCaixas },
  { area: "industrial", path: "/pdv/industrial/relatorios/caixa", title: "Relatórios de caixa", requiredModule: ["relatorios"], Page: HistoricoCaixas },
  { area: "residencial", path: "/pdv/domestico/relatorios/quilometragem", title: "Quilometragem", requiredModule: ["relatorios"], Page: RelatorioKilometragem },
  { area: "industrial", path: "/pdv/industrial/relatorios/quilometragem", title: "Quilometragem", requiredModule: ["relatorios"], Page: RelatorioKilometragem },
  { area: "residencial", path: "/pdv/domestico/lancamentos", title: "Lançamentos", requiredModule: ["faturamento"], Page: Lancamentos },
  { area: "industrial", path: "/pdv/industrial/lancamentos", title: "Lançamentos", requiredModule: ["faturamento"], Page: Lancamentos },
] as const;

function isPdvWorkbenchLocation(value: unknown, currentPath: string): value is Location {
  if (!value || typeof value !== "object" || !("pathname" in value) || typeof value.pathname !== "string") return false;
  const areaSegment = currentPath.startsWith("/pdv/industrial/") ? "industrial" : "domestico";
  return new RegExp(`^/pdv/${areaSegment}(?:/(?:rol|delivery|orcamento))?/?$`).test(value.pathname);
}

function PdvRouteLayer({ children, modalRoutes }: { children: ReactNode; modalRoutes: ReactNode }) {
  const location = useLocation();
  const locationState = location.state && typeof location.state === "object" ? location.state as Record<string, unknown> : null;
  const backgroundCandidate = locationState?.pdvBackgroundLocation;
  const isPdvOperationalModule = PDV_OPERATIONAL_ROUTES.some((route) => route.path === location.pathname);
  const backgroundLocation = isPdvOperationalModule && isPdvWorkbenchLocation(backgroundCandidate, location.pathname)
    ? backgroundCandidate
    : null;

  return (
    <>
      <Routes location={backgroundLocation ?? location}>{children}</Routes>
      {backgroundLocation && <Routes>{modalRoutes}</Routes>}
    </>
  );
}

function requiresPlatformAdmin(route: AppRouteDefinition): boolean {
  return route.platformAdminOnly === true;
}

function AuthorizedRouteRedirect({ redirect }: { redirect?: LegacyRouteRedirect }) {
  const {
    isError,
    isLoading,
    resolveDefaultRoute,
    resolveLegacyRoute,
  } = useNavigationAccess();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        Carregando ambientes autorizados…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" role="alert">
        Não foi possível verificar os ambientes autorizados. Tente novamente.
      </div>
    );
  }

  const destination = redirect ? resolveLegacyRoute(redirect) : resolveDefaultRoute();

  if (!destination) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" role="alert">
        {redirect?.from === "/pdv" || redirect?.from === "/caixa"
          ? "Sua conta não possui acesso ao PDV de atendimento em nenhum setor."
          : "Sua conta não possui acesso a um ambiente de trabalho."}
      </div>
    );
  }

  return <Navigate to={destination} replace />;
}

function WorkspaceRootRedirect({ preferPdv = false }: { preferPdv?: boolean }) {
  const { activeArea } = useWorkspace();
  const { canAccessRoute, isLoading } = useNavigationAccess();
  const preferredPdvArea = activeArea === "industrial" && canAccessRoute("/industrial/caixa")
    ? "industrial"
    : canAccessRoute("/residencial/caixa")
      ? "residencial"
      : canAccessRoute("/industrial/caixa")
        ? "industrial"
        : null;
  const { data: caixaAberto, isLoading: isLoadingCaixa, isError: isOpenCashError } = useCaixaAberto(
    Boolean(preferredPdvArea) && !preferPdv && !isLoading,
  );

  // A entrada do PDV deve sempre começar no painel operacional. O estado do
  // caixa muda os indicadores e ações disponíveis, não a página inicial.
  if (preferPdv && preferredPdvArea) {
    return <Navigate to={getPdvFrontPath(preferredPdvArea)} replace />;
  }

  if (preferredPdvArea && isLoadingCaixa) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        Carregando painel principal…
      </div>
    );
  }

  if (preferredPdvArea && !isLoadingCaixa && !isOpenCashError && caixaAberto) {
    return <Navigate to={getPdvFrontPath(preferredPdvArea)} replace />;
  }

  return <AuthorizedRouteRedirect />;
}

function LegacyRouteRedirect({ redirect }: { redirect: LegacyRouteRedirect }) {
  return <AuthorizedRouteRedirect redirect={redirect} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <ThemeModeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <OfflineRuntimeProvider>
              <AdminProvider>
              <OperationalProvider>
                <ThemeLoader>
                <SidebarProvider>
            <Toaster />
            <Sonner />
            <Suspense
              fallback={(
                <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
                  Carregando módulo…
                </div>
              )}
            >
            <PdvRouteLayer
              modalRoutes={PDV_OPERATIONAL_ROUTES.map(({ area, path, requiredModule, Page, title }) => (
                <Route
                  key={`modal-${path}`}
                  path={path}
                  element={(
                    <ProtectedRoute requiredArea={area} requiredModule={requiredModule}>
                      <PdvModuleDialog title={title} operation={area}>
                        <Page />
                      </PdvModuleDialog>
                    </ProtectedRoute>
                  )}
                />
              ))}
            >
              {/* Auth routes - public */}
              <Route path="/login" element={<Login />} />
              <Route path="/login/central" element={<Login />} />
              <Route path="/login/pdv" element={<Login />} />
              <Route path="/mfa" element={<MfaChallenge />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {APP_ROUTES.map((route) => {
                const Page = ROUTE_COMPONENTS[route.path];
                const isLegacyPdvPath = route.path === `/${route.area}/caixa`;
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={(
                      <ProtectedRoute
                        requiredArea={route.area}
                        requiredModule={route.requiredModules}
                        adminOnly={route.adminOnly}
                        platformAdminOnly={requiresPlatformAdmin(route)}
                      >
                        {isLegacyPdvPath
                          ? <Navigate to={getCanonicalPdvPath(route.area as "industrial" | "residencial")} replace />
                          : <Page />}
                      </ProtectedRoute>
                    )}
                  />
                );
              })}

              <Route
                path="/admin"
                element={(
                  <ProtectedRoute requiredArea="central" requiredModule={["dashboard"]}>
                    <Navigate to="/admin/visao-geral" replace />
                  </ProtectedRoute>
                )}
              />
              {ADMIN_ROUTES.map((route) => {
                const Page = ADMIN_ROUTE_COMPONENTS[route.path];
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={(
                      <ProtectedRoute
                        requiredArea="central"
                        requiredModule={route.requiredModules}
                        adminOnly={route.adminOnly}
                        platformAdminOnly={route.platformAdminOnly}
                      >
                        <Page />
                      </ProtectedRoute>
                    )}
                  />
                );
              })}

              {PDV_ROUTES.map(({ area, path }) => (
                <Route
                  key={path}
                  path={path}
                  element={(
                    <ProtectedRoute requiredArea={area} requiredModule={["caixa", "faturamento"]}>
                      <CaixaPDV mode="rol" />
                    </ProtectedRoute>
                  )}
                />
              ))}
              {PDV_WORKBENCH_ROUTES.map(({ area, path, mode }) => (
                <Route
                  key={path}
                  path={path}
                  element={(
                    <ProtectedRoute requiredArea={area} requiredModule={["caixa", "faturamento"]}>
                      <CaixaPDV mode={mode} />
                    </ProtectedRoute>
                  )}
                />
              ))}
              {PDV_FRONT_ROUTES.map(({ area, path }) => (
                <Route
                  key={path}
                  path={path}
                  element={(
                    <ProtectedRoute requiredArea={area} requiredModule={["caixa", "faturamento"]}>
                      <PdvModuleHub operation={area} />
                    </ProtectedRoute>
                  )}
                />
              ))}
              <Route
                path="/pdv/painel"
                element={(
                  <ProtectedRoute>
                    <WorkspaceRootRedirect preferPdv />
                  </ProtectedRoute>
                )}
              />
              <Route
                path="/pdv"
                element={(
                  <ProtectedRoute>
                    <LegacyRouteRedirect redirect={{ from: "/pdv", to: "/residencial/caixa" }} />
                  </ProtectedRoute>
                )}
              />
              {PDV_OPERATIONAL_ROUTES.map(({ area, path, requiredModule, Page }) => (
                <Route
                  key={path}
                  path={path}
                  element={(
                    <ProtectedRoute requiredArea={area} requiredModule={requiredModule}>
                      <Page />
                    </ProtectedRoute>
                  )}
                />
              ))}
              <Route
                path="/pdv/residencial"
                element={(
                  <ProtectedRoute requiredArea="residencial" requiredModule={["caixa", "faturamento"]}>
                    <Navigate to="/pdv/domestico" replace />
                  </ProtectedRoute>
                )}
              />

              {/* Legacy and Redirects */}
              <Route path="/" element={<ProtectedRoute><WorkspaceRootRedirect /></ProtectedRoute>} />
              {LEGACY_ROUTE_REDIRECTS.map((redirect) => (
                <Route
                  key={redirect.from}
                  path={redirect.from}
                  element={(
                    <ProtectedRoute>
                      <LegacyRouteRedirect redirect={redirect} />
                    </ProtectedRoute>
                  )}
                />
              ))}

              {/* Portal do Cliente - Rota pública */}
              <Route path="/portal/:codigo" element={<PortalCliente />} />

              <Route path="*" element={<NotFound />} />
            </PdvRouteLayer>
            </Suspense>
              </SidebarProvider>
              </ThemeLoader>
              </OperationalProvider>
              </AdminProvider>
              </OfflineRuntimeProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeModeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
