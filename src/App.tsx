import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { aplicarTema, getTemaIdFromCorPrimaria } from "@/lib/themeUtils";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: "always",
    },
  },
});

function ThemeLoader({ children }: { children: React.ReactNode }) {
  const { configuracao } = useConfiguracoesGerais();
  useEffect(() => {
    const temaId = getTemaIdFromCorPrimaria(configuracao?.cor_primaria ?? null);
    aplicarTema(temaId);
  }, [configuracao?.cor_primaria]);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeLoader>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
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

              {/* Central Panel Routes */}
              <Route path="/central" element={<ProtectedRoute requiredArea="central" requiredModule="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/central/financeiro" element={<ProtectedRoute requiredArea="central" requiredModule="faturamento"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/central/contas" element={<ProtectedRoute requiredArea="central" requiredModule={["contas_receber", "contas_pagar"]}><Contas /></ProtectedRoute>} />
              <Route path="/central/agenda-eventos" element={<ProtectedRoute requiredArea="central" requiredModule="agenda"><AgendaEventos /></ProtectedRoute>} />
              <Route path="/central/relatorios/quilometragem" element={<ProtectedRoute requiredArea="central" requiredModule="relatorios"><RelatorioKilometragem /></ProtectedRoute>} />
              <Route path="/central/relatorios/mensal" element={<ProtectedRoute requiredArea="central" requiredModule="relatorios"><RelatorioMensal /></ProtectedRoute>} />
              <Route path="/central/configuracoes" element={<ProtectedRoute requiredArea="central" requiredModule="configuracoes" adminOnly><Configuracoes /></ProtectedRoute>} />

              {/* Industrial Panel Routes */}
              <Route path="/industrial" element={<ProtectedRoute requiredArea="industrial" requiredModule="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/industrial/clientes" element={<ProtectedRoute requiredArea="industrial" requiredModule="clientes"><Clientes /></ProtectedRoute>} />
              <Route path="/industrial/produtos" element={<ProtectedRoute requiredArea="industrial" requiredModule="produtos"><Produtos /></ProtectedRoute>} />
              <Route path="/industrial/fornecedores" element={<ProtectedRoute requiredArea="industrial" requiredModule="clientes"><Fornecedores /></ProtectedRoute>} />
              <Route path="/industrial/agenda" element={<ProtectedRoute requiredArea="industrial" requiredModule="agenda"><Agenda /></ProtectedRoute>} />
              <Route path="/industrial/ordens" element={<ProtectedRoute requiredArea="industrial" requiredModule="ordens"><OrdensServico /></ProtectedRoute>} />
              <Route path="/industrial/producao" element={<ProtectedRoute requiredArea="industrial" requiredModule="producao"><FluxoProducao /></ProtectedRoute>} />
              <Route path="/industrial/lancamentos" element={<ProtectedRoute requiredArea="industrial" requiredModule="faturamento"><Lancamentos /></ProtectedRoute>} />
              <Route path="/industrial/financeiro" element={<ProtectedRoute requiredArea="industrial" requiredModule="faturamento"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/industrial/estoque" element={<ProtectedRoute requiredArea="industrial" requiredModule="produtos"><Estoque /></ProtectedRoute>} />
              <Route path="/industrial/relatorios/clientes" element={<ProtectedRoute requiredArea="industrial" requiredModule="relatorios"><RelatoriosCliente /></ProtectedRoute>} />
              <Route path="/industrial/relatorios/proximidade" element={<ProtectedRoute requiredArea="industrial" requiredModule="relatorios"><RelatorioProximidade /></ProtectedRoute>} />

              {/* Residencial Panel Routes */}
              <Route path="/residencial" element={<ProtectedRoute requiredArea="residencial" requiredModule="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/residencial/caixa" element={<ProtectedRoute requiredArea="residencial" requiredModule="caixa"><CaixaPDV /></ProtectedRoute>} />
              <Route path="/residencial/clientes" element={<ProtectedRoute requiredArea="residencial" requiredModule="clientes"><Clientes /></ProtectedRoute>} />
              <Route path="/residencial/agenda" element={<ProtectedRoute requiredArea="residencial" requiredModule="agenda"><Agenda /></ProtectedRoute>} />
              <Route path="/residencial/ordens" element={<ProtectedRoute requiredArea="residencial" requiredModule="ordens"><OrdensServico /></ProtectedRoute>} />
              <Route path="/residencial/producao" element={<ProtectedRoute requiredArea="residencial" requiredModule="producao"><FluxoProducao /></ProtectedRoute>} />
              <Route path="/residencial/financeiro" element={<ProtectedRoute requiredArea="residencial" requiredModule="faturamento"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/residencial/produtos" element={<ProtectedRoute requiredArea="residencial" requiredModule="produtos"><Produtos /></ProtectedRoute>} />
              <Route path="/residencial/relatorios/caixa" element={<ProtectedRoute requiredArea="residencial" requiredModule="relatorios"><HistoricoCaixas /></ProtectedRoute>} />

              {/* Legacy and Redirects */}
              <Route path="/" element={<ProtectedRoute><Navigate to="/central" replace /></ProtectedRoute>} />
              <Route path="/dashboard" element={<Navigate to="/central" replace />} />
              <Route path="/configuracoes" element={<Navigate to="/central/configuracoes" replace />} />
              <Route path="/financeiro" element={<Navigate to="/central/financeiro" replace />} />
              <Route path="/caixa" element={<Navigate to="/residencial/caixa" replace />} />
              <Route path="/lancamentos" element={<Navigate to="/industrial/lancamentos" replace />} />
              <Route path="/contas" element={<Navigate to="/central/contas" replace />} />
              <Route path="/clientes" element={<Navigate to="/industrial/clientes" replace />} />
              <Route path="/produtos" element={<Navigate to="/industrial/produtos" replace />} />
              <Route path="/producao" element={<Navigate to="/industrial/producao" replace />} />
              <Route path="/ordens" element={<Navigate to="/industrial/ordens" replace />} />
              <Route path="/agenda" element={<Navigate to="/industrial/agenda" replace />} />
              <Route path="/fornecedores" element={<Navigate to="/industrial/fornecedores" replace />} />
              <Route path="/estoque" element={<Navigate to="/industrial/estoque" replace />} />
              <Route path="/relatorios/clientes" element={<Navigate to="/industrial/relatorios/clientes" replace />} />
              <Route path="/relatorios/proximidade" element={<Navigate to="/industrial/relatorios/proximidade" replace />} />
              <Route path="/relatorios/caixa" element={<Navigate to="/residencial/relatorios/caixa" replace />} />
              <Route path="/agenda-eventos" element={<Navigate to="/central/agenda-eventos" replace />} />
              <Route path="/relatorios/quilometragem" element={<Navigate to="/central/relatorios/quilometragem" replace />} />
              <Route path="/relatorios/mensal" element={<Navigate to="/central/relatorios/mensal" replace />} />

              {/* Redirects for old routes */}
              <Route path="/faturamento" element={<Navigate to="/lancamentos?tab=faturas" replace />} />
              <Route path="/receber" element={<Navigate to="/contas?tab=receber" replace />} />
              <Route path="/pagar" element={<Navigate to="/contas?tab=pagar" replace />} />
              <Route path="/asaas" element={<Navigate to="/contas?tab=receber" replace />} />
              <Route path="/relatorios/financeiro" element={<Navigate to="/financeiro" replace />} />

              {/* Portal do Cliente - Rota pública */}
              <Route path="/portal/:codigo" element={<PortalCliente />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </SidebarProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeLoader>
  </QueryClientProvider>
);

export default App;
