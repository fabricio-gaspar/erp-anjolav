import { format, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { useLocation, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileCheck2, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { FaturamentoPeriodoTab } from "@/components/lancamentos/FaturamentoPeriodoTab";
import { FaturasPeriodoTab } from "@/components/lancamentos/FaturasPeriodoTab";

const today = new Date();
const DEFAULT_START = format(startOfMonth(today), "yyyy-MM-dd");
const DEFAULT_END = format(endOfMonth(today), "yyyy-MM-dd");
const TITLE = "Faturamento por período";

export default function Lancamentos() {
  const { activeArea } = useWorkspace();
  const { activeTenant, user, loading } = useAuth();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { allowed: canManageBilling } = usePermissaoModulo("faturamento");
  const routeMatches = pathname.startsWith(`/${activeArea}/`)
    || (activeArea === "central" && pathname === "/admin/financeiro/lancamentos")
    || (activeArea === "industrial" && pathname.startsWith("/pdv/industrial/"))
    || (activeArea === "residencial" && pathname.startsWith("/pdv/domestico/"));
  const start = searchParams.get("inicio") || DEFAULT_START;
  const end = searchParams.get("fim") || DEFAULT_END;
  const requestedTab = searchParams.get("tab");
  const activeTab = requestedTab === "faturas" || requestedTab === "historico" ? "faturas" : "periodo";
  const setField = (key: string, value: string) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    next.set(key, value);
    return next;
  }, { replace: true });
  const setMonth = (month: Date) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    next.set("inicio", format(startOfMonth(month), "yyyy-MM-dd"));
    next.set("fim", format(endOfMonth(month), "yyyy-MM-dd"));
    return next;
  }, { replace: true });

  if (loading) return <AppLayout title={TITLE}><p role="status">Carregando sessão...</p></AppLayout>;
  if (!activeTenant || !user) return <AppLayout title={TITLE}><p role="alert">Não foi possível identificar sua sessão ou empresa ativa. Atualize a página ou entre novamente.</p></AppLayout>;
  if (!routeMatches) return <AppLayout title={TITLE}><p role="alert">Esta tela não corresponde ao painel ativo.</p></AppLayout>;
  if (!canManageBilling) return <AppLayout title={TITLE}><p role="alert">Sem permissão para faturamento.</p></AppLayout>;

  return <AppLayout title={TITLE} subtitle="Conferência e fechamento dos ROLs criados no PDV">
    <div className="page-shell space-y-5">
      <PageHeader eyebrow="Financeiro" title={TITLE}
        description="Consulte os ROLs pela data de abertura, confira o relatório e acompanhe as faturas." />
      <div className="content-panel space-y-5">
        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1"><Label htmlFor="billing-start">Data inicial</Label><Input id="billing-start" type="date" value={start} onChange={event => setField("inicio", event.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="billing-end">Data final</Label><Input id="billing-end" type="date" value={end} onChange={event => setField("fim", event.target.value)} /></div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(new Date())}>Mês atual</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(subMonths(new Date(), 1))}>Mês anterior</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={value => setField("tab", value)} className="w-full">
          <TabsList className="page-tabs-list">
            <TabsTrigger value="periodo" className="page-tab-trigger gap-2"><FileCheck2 className="h-4 w-4" />Conferir e fechar</TabsTrigger>
            <TabsTrigger value="faturas" className="page-tab-trigger gap-2"><Receipt className="h-4 w-4" />Faturas e documentos</TabsTrigger>
          </TabsList>
          <TabsContent value="periodo" className="mt-5">
            <FaturamentoPeriodoTab start={start} end={end} onClosed={() => setField("tab", "faturas")} />
          </TabsContent>
          <TabsContent value="faturas" className="mt-5">
            <FaturasPeriodoTab start={start} end={end} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </AppLayout>;
}
