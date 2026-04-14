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
          <SidebarProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Auth routes - public */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/caixa" element={<ProtectedRoute><CaixaPDV /></ProtectedRoute>} />
              <Route path="/lancamentos" element={<ProtectedRoute><Lancamentos /></ProtectedRoute>} />
              <Route path="/contas" element={<ProtectedRoute><Contas /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
              <Route path="/produtos" element={<ProtectedRoute><Produtos /></ProtectedRoute>} />
              <Route path="/producao" element={<ProtectedRoute><FluxoProducao /></ProtectedRoute>} />
              <Route path="/ordens" element={<ProtectedRoute><OrdensServico /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
              <Route path="/fornecedores" element={<ProtectedRoute><Fornecedores /></ProtectedRoute>} />
              <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
              <Route path="/relatorios/clientes" element={<ProtectedRoute><RelatoriosCliente /></ProtectedRoute>} />
              <Route path="/relatorios/proximidade" element={<ProtectedRoute><RelatorioProximidade /></ProtectedRoute>} />
              <Route path="/relatorios/caixa" element={<ProtectedRoute><HistoricoCaixas /></ProtectedRoute>} />
              <Route path="/agenda-eventos" element={<ProtectedRoute><AgendaEventos /></ProtectedRoute>} />

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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeLoader>
  </QueryClientProvider>
);

export default App;
