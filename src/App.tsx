import { useEffect } from "react";
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
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import FluxoProducao from "./pages/FluxoProducao";
import OrdensServico from "./pages/OrdensServico";
import Agenda from "./pages/Agenda";
import CaixaPDV from "./pages/CaixaPDV";
import Lancamentos from "./pages/Lancamentos";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import Contas from "./pages/Contas";
import RelatoriosCliente from "./pages/RelatoriosCliente";
import RelatorioProximidade from "./pages/RelatorioProximidade";
import Configuracoes from "./pages/Configuracoes";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import PortalCliente from "./pages/PortalCliente";
import Fornecedores from "./pages/Fornecedores";
import Estoque from "./pages/Estoque";
import HistoricoCaixas from "./pages/HistoricoCaixas";
import AgendaEventos from "./pages/AgendaEventos";
import RelatorioKilometragem from "./pages/RelatorioKilometragem";
import RelatorioMensal from "./pages/RelatorioMensal";

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
            <Routes>
              {/* Auth routes - public */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Navigate to="/login" replace />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Central Panel Routes */}
              <Route path="/central" element={<ProtectedRoute requiredArea="central"><Dashboard /></ProtectedRoute>} />
              <Route path="/central/financeiro" element={<ProtectedRoute requiredArea="central"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/central/contas" element={<ProtectedRoute requiredArea="central"><Contas /></ProtectedRoute>} />
              <Route path="/central/agenda-eventos" element={<ProtectedRoute requiredArea="central"><AgendaEventos /></ProtectedRoute>} />
              <Route path="/central/relatorios/quilometragem" element={<ProtectedRoute requiredArea="central"><RelatorioKilometragem /></ProtectedRoute>} />
              <Route path="/central/relatorios/mensal" element={<ProtectedRoute requiredArea="central"><RelatorioMensal /></ProtectedRoute>} />
              <Route path="/central/configuracoes" element={<ProtectedRoute requiredArea="central"><Configuracoes /></ProtectedRoute>} />

              {/* Industrial Panel Routes */}
              <Route path="/industrial" element={<ProtectedRoute requiredArea="industrial"><Dashboard /></ProtectedRoute>} />
              <Route path="/industrial/clientes" element={<ProtectedRoute requiredArea="industrial"><Clientes /></ProtectedRoute>} />
              <Route path="/industrial/produtos" element={<ProtectedRoute requiredArea="industrial"><Produtos /></ProtectedRoute>} />
              <Route path="/industrial/fornecedores" element={<ProtectedRoute requiredArea="industrial"><Fornecedores /></ProtectedRoute>} />
              <Route path="/industrial/agenda" element={<ProtectedRoute requiredArea="industrial"><Agenda /></ProtectedRoute>} />
              <Route path="/industrial/ordens" element={<ProtectedRoute requiredArea="industrial"><OrdensServico /></ProtectedRoute>} />
              <Route path="/industrial/producao" element={<ProtectedRoute requiredArea="industrial"><FluxoProducao /></ProtectedRoute>} />
              <Route path="/industrial/lancamentos" element={<ProtectedRoute requiredArea="industrial"><Lancamentos /></ProtectedRoute>} />
              <Route path="/industrial/financeiro" element={<ProtectedRoute requiredArea="industrial"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/industrial/estoque" element={<ProtectedRoute requiredArea="industrial"><Estoque /></ProtectedRoute>} />
              <Route path="/industrial/relatorios/clientes" element={<ProtectedRoute requiredArea="industrial"><RelatoriosCliente /></ProtectedRoute>} />
              <Route path="/industrial/relatorios/proximidade" element={<ProtectedRoute requiredArea="industrial"><RelatorioProximidade /></ProtectedRoute>} />

              {/* Residencial Panel Routes */}
              <Route path="/residencial" element={<ProtectedRoute requiredArea="residencial"><Dashboard /></ProtectedRoute>} />
              <Route path="/residencial/caixa" element={<ProtectedRoute requiredArea="residencial"><CaixaPDV /></ProtectedRoute>} />
              <Route path="/residencial/clientes" element={<ProtectedRoute requiredArea="residencial"><Clientes /></ProtectedRoute>} />
              <Route path="/residencial/agenda" element={<ProtectedRoute requiredArea="residencial"><Agenda /></ProtectedRoute>} />
              <Route path="/residencial/ordens" element={<ProtectedRoute requiredArea="residencial"><OrdensServico /></ProtectedRoute>} />
              <Route path="/residencial/producao" element={<ProtectedRoute requiredArea="residencial"><FluxoProducao /></ProtectedRoute>} />
              <Route path="/residencial/financeiro" element={<ProtectedRoute requiredArea="residencial"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/residencial/produtos" element={<ProtectedRoute requiredArea="residencial"><Produtos /></ProtectedRoute>} />
              <Route path="/residencial/relatorios/caixa" element={<ProtectedRoute requiredArea="residencial"><HistoricoCaixas /></ProtectedRoute>} />

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
            </SidebarProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeLoader>
  </QueryClientProvider>
);

export default App;
