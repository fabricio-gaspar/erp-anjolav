import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Package, Receipt, History } from "lucide-react";
import { useRolDirectory } from "@/hooks/useRolDirectory";
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
  const areaLabel = activeArea === "industrial" ? "Industrial" : "Doméstico";
  const pdvPath = "/" + activeArea + "/caixa";
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { canAccessRoute } = useNavigationAccess();
  const { allowed: canManageBilling } = usePermissaoModulo("faturamento");
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab && ["novo", "pendentes", "faturas", "historico"].includes(requestedTab) ? requestedTab : "pendentes";
  const setActiveTab = (tab: string) => setSearchParams(current => { const next = new URLSearchParams(current); next.set("tab", tab); return next; }, { replace: true });
  const { data: pendingDirectory } = useRolDirectory({
    page: 1,
    pageSize: 1,
    status: "pendente",
    enabled: canManageBilling,
  });
  const pendingCount = pendingDirectory?.summary.quantidade_pendente ?? 0;

  if (!canManageBilling) return <AppLayout title="Fechamento e histórico"><p>Sem permissão para faturamento.</p></AppLayout>;

  return (
    <AppLayout title="Fechamento e histórico" subtitle={"Fechamento de faturamento e histórico · " + areaLabel}>
      <div className="page-shell">
        <PageHeader
          eyebrow={`Faturamento ${areaLabel}`}
          title="Fechamento e histórico"
          description="ROLs pendentes, faturas e histórico de atendimento"
          actions={canAccessRoute(pdvPath) ? (
            <Button onClick={() => navigate(pdvPath)} className="w-full font-bold sm:w-auto">
              Novo ROL no PDV Atendimento
            </Button>
          ) : undefined}
        />
        <div className="content-panel">
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="tabs-scrollable">
            <TabsList className="page-tabs-list">
              <TabsTrigger value="novo" className="page-tab-trigger gap-2">
                <FileText className="w-4 h-4" />Novo Lançamento
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="page-tab-trigger gap-2">
                <Package className="w-4 h-4" />Pendentes
                {pendingCount > 0 && (
                  <span className="ml-1 bg-warning text-warning-foreground text-xs px-2 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="faturas" className="page-tab-trigger gap-2">
                <Receipt className="w-4 h-4" />Faturas Geradas
              </TabsTrigger>
              <TabsTrigger value="historico" className="page-tab-trigger gap-2">
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
