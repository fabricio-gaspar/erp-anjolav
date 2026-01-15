import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Faturamento from "./pages/Faturamento";
import Lancamentos from "./pages/Lancamentos";
import RelatoriosCliente from "./pages/RelatoriosCliente";
import RelatorioFinanceiro from "./pages/RelatorioFinanceiro";
import RelatorioProximidade from "./pages/RelatorioProximidade";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import HistoricoCaixas from "./pages/HistoricoCaixas";
import ContasReceber from "./pages/ContasReceber";
import ContasPagar from "./pages/ContasPagar";
import DashboardCobrancas from "./pages/DashboardCobrancas";
import Configuracoes from "./pages/Configuracoes";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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

              {/* Protected routes - Dashboard, Configurações, Financeiro */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <Configuracoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute>
                    <DashboardFinanceiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/caixa"
                element={
                  <ProtectedRoute>
                    <CaixaPDV />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faturamento"
                element={
                  <ProtectedRoute>
                    <Faturamento />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lancamentos"
                element={
                  <ProtectedRoute>
                    <Lancamentos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/receber"
                element={
                  <ProtectedRoute>
                    <ContasReceber />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pagar"
                element={
                  <ProtectedRoute>
                    <ContasPagar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asaas"
                element={
                  <ProtectedRoute>
                    <DashboardCobrancas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios/caixa"
                element={
                  <ProtectedRoute>
                    <HistoricoCaixas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios/financeiro"
                element={
                  <ProtectedRoute>
                    <RelatorioFinanceiro />
                  </ProtectedRoute>
                }
              />

              {/* Public routes - operacional */}
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/producao" element={<FluxoProducao />} />
              <Route path="/ordens" element={<OrdensServico />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/relatorios/clientes" element={<RelatoriosCliente />} />
              <Route path="/relatorios/proximidade" element={<RelatorioProximidade />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </SidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
