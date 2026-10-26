import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Package, Receipt, History } from "lucide-react";
import { useLancamentosPendentes } from "@/hooks/useLancamentos";
import { Button } from "@/components/ui/button";
import { useNavigationAccess, usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { PendentesTab } from "@/components/lancamentos/PendentesTab";
import { FaturasTab } from "@/components/lancamentos/FaturasTab";
import { HistoricoROLsTab } from "@/components/lancamentos/HistoricoROLsTab";

const Lancamentos = () => {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const { pathname } = useLocation();
  if (!activeTenant || !user || !pathname.startsWith("/" + activeArea + "/")) {
    return <AppLayout title="Fechamento e histórico"><p>Carregando contexto...</p></AppLayout>;
  }
  return <FechamentoAtendimento key={[activeTenant?.id, user?.id, activeArea].join(":")} />;
};

const FechamentoAtendimento = () => {
  const { activeArea } = useWorkspace();
  const areaLabel = activeArea === "industrial" ? "Industrial" : "Residencial";
  const pdvPath = "/" + activeArea + "/caixa";
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { canAccessRoute } = useNavigationAccess();
  const { allowed: canManageBilling } = usePermissaoModulo("faturamento");
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab && ["novo", "pendentes", "faturas", "historico"].includes(requestedTab) ? requestedTab : "pendentes";
  const setActiveTab = (tab: string) => setSearchParams(current => { const next = new URLSearchParams(current); next.set("tab", tab); return next; }, { replace: true });
  const { lancamentos: todosLancamentosPendentes } = useLancamentosPendentes();
  const lancamentosPendentes = todosLancamentosPendentes.filter(l => l.cliente?.classificacao === activeArea);

  if (!canManageBilling) return <AppLayout title="Fechamento e histórico"><p>Sem permissão para faturamento.</p></AppLayout>;

  return (
    <AppLayout title="Fechamento e histórico" subtitle={"Fechamento de faturamento e histórico · " + areaLabel}>
      <div className="w-full space-y-8">
        {/* Visual Content Header mirroring high-fidelity layout */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500/90">FATURAMENTO {areaLabel.toUpperCase()}</span>
          </div>
          <h1 className="page-title">
            Fechamento e histórico
          </h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase tracking-wider">
            ROLs pendentes, faturas e histórico de atendimento
          </p>
        </div>

        {canAccessRoute(pdvPath) && <Button onClick={() => navigate(pdvPath)}>Novo ROL no PDV Atendimento</Button>}
        <div className="content-panel">
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="tabs-scrollable">
            <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-4 sm:gap-6 inline-flex min-w-max">
              <TabsTrigger value="novo" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <FileText className="w-4 h-4" />Novo Lançamento
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <Package className="w-4 h-4" />Pendentes
                {lancamentosPendentes.length > 0 && (
                  <span className="ml-1 bg-warning text-warning-foreground text-xs px-2 py-0.5 rounded-full">{lancamentosPendentes.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="faturas" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <Receipt className="w-4 h-4" />Faturas Geradas
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1">
                <History className="w-4 h-4" />Histórico de ROLs
              </TabsTrigger>
            </TabsList>
            </div>

            <TabsContent value="novo" className="mt-4">
              <p className="mb-4 text-muted-foreground">Novos ROLs são registrados no PDV Atendimento, com a tabela e a condição de pagamento do cliente.</p>
              {canAccessRoute(pdvPath) && <Button onClick={() => navigate(pdvPath)}>Abrir PDV Atendimento</Button>}
            </TabsContent>

            <TabsContent value="pendentes" className="mt-4">
              <PendentesTab />
            </TabsContent>

            <TabsContent value="faturas" className="mt-4">
              <FaturasTab />
            </TabsContent>

            <TabsContent value="historico" className="mt-4">
              <HistoricoROLsTab />
            </TabsContent>

          </Tabs>
        </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
