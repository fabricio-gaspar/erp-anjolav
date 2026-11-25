import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, ClipboardList, DollarSign, Lock, LockOpen, Package, Plus, RefreshCw } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { RelatorioCaixaOperacional, type RelatorioCaixaView } from "@/components/caixa/RelatorioCaixaOperacional";
import { RelatorioItens } from "@/components/caixa/RelatorioItens";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReportTab = RelatorioCaixaView | "itens";
const reportTabs: RelatorioCaixaView[] = ["geral", "movimentos", "rols", "baixas"];

const HistoricoCaixas = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as ReportTab | null;
  const activeReportTab = tabParam && (tabParam === "itens" || reportTabs.includes(tabParam)) ? tabParam : "geral";
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [selectedReportDay, setSelectedReportDay] = useState<Date>(new Date());
  const [itemStart, setItemStart] = useState(() => format(new Date(), "yyyy-MM-01"));
  const [itemEnd, setItemEnd] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const cashPermission = usePermissaoModulo("caixa");
  const canOperateCash = cashPermission.allowed;
  const {
    data: caixaAberto,
    isLoading: isLoadingAberto,
    isError: isOpenCashError,
    refetch: refetchOpenCash,
  } = useCaixaAberto(canOperateCash);

  const handleReportTabChange = (value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === "geral") next.delete("tab");
      else next.set("tab", value);
      return next;
    }, { replace: true });
  };

  return (
    <AppLayout title="Relatórios de caixa">
      <div className="page-shell">
        <PageHeader
          eyebrow="Financeiro e conferência"
          title="Relatórios de caixa"
          description="Consulte movimentações, ROLs, baixas e fechamentos do PDV."
        />

        {cashPermission.isLoading || (canOperateCash && isLoadingAberto) ? (
          <Card className="h-28 animate-pulse bg-muted/30" aria-label="Carregando situação do caixa" />
        ) : cashPermission.isError ? (
          <Card className="border-amber-200 bg-amber-50/60 p-4">
            <p className="font-semibold text-amber-900">Não foi possível verificar sua permissão de caixa</p>
            <p className="mt-1 text-sm text-amber-800">Os relatórios continuam disponíveis, mas as ações operacionais ficaram bloqueadas.</p>
          </Card>
        ) : !canOperateCash ? (
          <Card className="border-l-4 border-l-blue-500 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Modo de consulta</p>
                <p className="text-sm text-muted-foreground">Seu perfil pode consultar os relatórios, mas não abrir ou fechar o caixa.</p>
              </div>
            </div>
          </Card>
        ) : isOpenCashError ? (
          <Card className="border-red-200 bg-red-50/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-red-900">Não foi possível consultar o caixa atual</p>
                <p className="text-sm text-red-700">Tente novamente antes de iniciar uma operação.</p>
              </div>
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => void refetchOpenCash()}>
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          </Card>
        ) : caixaAberto ? (
          <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <LockOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">Caixa atualmente aberto</p>
                  <p className="break-words text-sm text-muted-foreground">
                    {caixaAberto.operador} • Aberto em {format(new Date(caixaAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-100 px-3">
                  <LockOpen className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">ABERTO</span>
                </div>
                <Button onClick={() => setShowFecharCaixa(true)} className="min-h-11 bg-red-600 hover:bg-red-700">
                  <Lock className="mr-2 h-4 w-4" /> Fechar caixa
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-muted p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nenhum caixa aberto</p>
                  <p className="text-sm text-muted-foreground">Abra um caixa para começar a registrar vendas.</p>
                </div>
              </div>
              <Button onClick={() => setShowAbrirCaixa(true)} className="min-h-11 gap-2">
                <Plus className="h-4 w-4" /> Abrir caixa
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-3 sm:p-6">
          <Tabs value={activeReportTab} onValueChange={handleReportTabChange} className="space-y-6">
            <div className="max-w-full overflow-x-auto pb-1">
              <TabsList className="page-tabs-list min-w-max justify-start">
                <TabsTrigger value="geral" className="page-tab-trigger gap-2"><BarChart3 className="h-4 w-4" /><span>Geral</span></TabsTrigger>
                <TabsTrigger value="movimentos" className="page-tab-trigger gap-2"><BarChart3 className="h-4 w-4" /><span>Movimentos</span></TabsTrigger>
                <TabsTrigger value="rols" className="page-tab-trigger gap-2"><ClipboardList className="h-4 w-4" /><span>Lista de ROLs</span></TabsTrigger>
                <TabsTrigger value="baixas" className="page-tab-trigger gap-2"><DollarSign className="h-4 w-4" /><span>Baixas/Recebimentos</span></TabsTrigger>
                <TabsTrigger value="itens" className="page-tab-trigger gap-2"><Package className="h-4 w-4" /><span>Produtos e serviços</span></TabsTrigger>
              </TabsList>
            </div>

            {reportTabs.map((view) => (
              <TabsContent key={view} value={view}>
                <RelatorioCaixaOperacional view={view} selectedDay={selectedReportDay} onSelectedDayChange={setSelectedReportDay} />
              </TabsContent>
            ))}
            <TabsContent value="itens" className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1"><Label htmlFor="report-items-start">Data inicial</Label><Input id="report-items-start" type="date" value={itemStart} onChange={(event) => setItemStart(event.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="report-items-end">Data final</Label><Input id="report-items-end" type="date" value={itemEnd} onChange={(event) => setItemEnd(event.target.value)} /></div>
              </div>
              {itemStart && itemEnd && itemStart <= itemEnd ? <RelatorioItens startDate={new Date(`${itemStart}T00:00:00`)} endDate={new Date(`${itemEnd}T23:59:59`)} /> : <p role="alert" className="text-sm text-destructive">Informe um período válido.</p>}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {caixaAberto && (
        <FecharCaixaModal open={showFecharCaixa} onOpenChange={setShowFecharCaixa} caixa={caixaAberto} />
      )}
      <AbrirCaixaModal open={showAbrirCaixa} onOpenChange={setShowAbrirCaixa} />
    </AppLayout>
  );
};

export default HistoricoCaixas;
