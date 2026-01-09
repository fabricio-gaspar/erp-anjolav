import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import ContasReceber from "./pages/ContasReceber";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/producao" element={<FluxoProducao />} />
          <Route path="/caixa" element={<CaixaPDV />} />
          <Route path="/faturamento" element={<Faturamento />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/relatorios/clientes" element={<RelatoriosCliente />} />
          {/* Placeholder routes */}
          <Route path="/ordens" element={<OrdensServico />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/financeiro" element={<DashboardFinanceiro />} />
          <Route path="/receber" element={<ContasReceber />} />
          <Route path="/pagar" element={<Dashboard />} />
          <Route path="/asaas" element={<Dashboard />} />
          <Route path="/relatorios/caixa" element={<Dashboard />} />
          <Route path="/relatorios/financeiro" element={<Dashboard />} />
          <Route path="/configuracoes" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
