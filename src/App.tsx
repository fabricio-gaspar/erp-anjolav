import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { dashboardQueryDefaults } from "@/lib/queryDefaults";
import { aplicarTema, getTemaIdFromCorPrimaria } from "@/lib/themeUtils";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAccessibleWorkspaces } from "@/hooks/useAccessibleWorkspaces";
import { APP_ROUTES, LEGACY_ROUTE_REDIRECTS, type AppRoutePath } from "@/lib/appRoutes";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Produtos = lazy(() => import("./pages/Produtos"));
const FluxoProducao = lazy(() => import("./pages/FluxoProducao"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const Agenda = lazy(() => import("./pages/Agenda"));
const CaixaPDV = lazy(() => import("./pages/CaixaPDV"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const DashboardFinanceiro = lazy(() => import("./pages/DashboardFinanceiro"));
const Contas = lazy(() => import("./pages/Contas"));
const RelatoriosCliente = lazy(() => import("./pages/RelatoriosCliente"));
const RelatorioProximidade = lazy(() => import("./pages/RelatorioProximidade"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Login = lazy(() => import("./pages/Login"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: dashboardQueryDefaults,
  },
});

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
  "/central/agenda-eventos": AgendaEventos,
  "/central/relatorios/quilometragem": RelatorioKilometragem,
  "/central/relatorios/mensal": RelatorioMensal,
  "/central/configuracoes": Configuracoes,
  "/central/auditoria": Auditoria,
  "/industrial": Dashboard,
  "/industrial/clientes": Clientes,
  "/industrial/produtos": Produtos,
  "/industrial/fornecedores": Fornecedores,
  "/industrial/agenda": Agenda,
  "/industrial/ordens": OrdensServico,
  "/industrial/producao": FluxoProducao,
  "/industrial/lancamentos": Lancamentos,
  "/industrial/financeiro": DashboardFinanceiro,
  "/industrial/estoque": Estoque,
  "/industrial/relatorios/clientes": RelatoriosCliente,
  "/industrial/relatorios/proximidade": RelatorioProximidade,
  "/residencial": Dashboard,
  "/residencial/caixa": CaixaPDV,
  "/residencial/clientes": Clientes,
  "/residencial/agenda": Agenda,
  "/residencial/ordens": OrdensServico,
  "/residencial/producao": FluxoProducao,
  "/residencial/financeiro": DashboardFinanceiro,
  "/residencial/produtos": Produtos,
  "/residencial/relatorios/caixa": HistoricoCaixas,
} as const satisfies Record<AppRoutePath, LazyExoticComponent<ComponentType>>;

function WorkspaceRootRedirect() {
  const { defaultWorkspace, isError, isLoading } = useAccessibleWorkspaces();

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

  if (!defaultWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" role="alert">
        Sua conta não possui acesso a um ambiente de trabalho.
      </div>
    );
  }

  return <Navigate to={`/${defaultWorkspace}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
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
            <Routes>
              {/* Auth routes - public */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {APP_ROUTES.map((route) => {
                const Page = ROUTE_COMPONENTS[route.path];
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={(
                      <ProtectedRoute
                        requiredArea={route.area}
                        requiredModule={route.requiredModules}
                        adminOnly={route.adminOnly}
                      >
                        <Page />
                      </ProtectedRoute>
                    )}
                  />
                );
              })}

              {/* Legacy and Redirects */}
              <Route path="/" element={<ProtectedRoute><WorkspaceRootRedirect /></ProtectedRoute>} />
              {LEGACY_ROUTE_REDIRECTS.map((redirect) => (
                <Route
                  key={redirect.from}
                  path={redirect.from}
                  element={<Navigate to={redirect.to} replace />}
                />
              ))}

              {/* Portal do Cliente - Rota pública */}
              <Route path="/portal/:codigo" element={<PortalCliente />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </SidebarProvider>
            </ThemeLoader>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
