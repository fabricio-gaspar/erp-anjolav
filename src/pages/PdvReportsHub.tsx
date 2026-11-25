import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  History,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFilteredOrdensServico } from "@/hooks/useFilteredOrdensServico";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { type PdvArea } from "@/lib/authorization";
import { CentralReportSelector } from "@/components/relatorios/CentralReportSelector";
import { PdvCustomerHistoryReport } from "@/components/relatorios/PdvCustomerHistoryReport";

const productionStages: Record<string, string> = {
  retirada: "Recebida",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Expedição",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

function rolLabel(value: string | null | undefined) {
  if (!value) return "ROL sem número";
  return /^rol[\s-]/i.test(value) ? value : `ROL ${value}`;
}

export default function PdvReportsHub() {
  const { pathname } = useLocation();
  const { canAccessRoute, isLoading: isLoadingAccess, isError: accessError } = useNavigationAccess();
  const area: PdvArea = pathname.includes("/industrial/") ? "industrial" : "residencial";
  const canSeeDaily = canAccessRoute(`/${area}/ordens`) || canAccessRoute(`/${area}/producao`);
  const canSeeOrders = canAccessRoute(`/${area}/ordens`);
  const today = format(new Date(), "yyyy-MM-dd");
  const [showDaily, setShowDaily] = useState(false);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [periodMode, setPeriodMode] = useState<"dia" | "intervalo" | "mes">("dia");
  const [selectedDay, setSelectedDay] = useState(today);
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const requestedRange = useMemo(() => {
    if (periodMode === "dia") return { start: selectedDay, end: selectedDay };
    if (periodMode === "intervalo") return { start: rangeStart, end: rangeEnd };
    const monthDate = new Date(`${selectedMonth}-01T12:00:00`);
    return {
      start: format(startOfMonth(monthDate), "yyyy-MM-dd"),
      end: format(endOfMonth(monthDate), "yyyy-MM-dd"),
    };
  }, [periodMode, rangeStart, rangeEnd, selectedDay, selectedMonth]);
  const validRange = requestedRange.start <= requestedRange.end;
  const reportRange = useMemo(() => validRange
    ? requestedRange
    : { start: rangeStart, end: rangeStart }, [validRange, requestedRange, rangeStart]);
  const periodLabel = reportRange.start === reportRange.end
    ? format(new Date(`${reportRange.start}T12:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : `${format(new Date(`${reportRange.start}T12:00:00`), "dd/MM/yyyy")} a ${format(new Date(`${reportRange.end}T12:00:00`), "dd/MM/yyyy")}`;
  const { data: orders = [], isLoading: isLoadingOrders, isError: ordersError, refetch: refetchOrders } = useFilteredOrdensServico(showDaily && canSeeDaily && !canSeeOrders);
  const dailyProduction = useMemo(() => orders
    .filter((order) => Boolean(order.data_previsao_entrega)
      && order.data_previsao_entrega! >= reportRange.start
      && order.data_previsao_entrega! <= reportRange.end
      && order.status !== "entregue" && order.status !== "cancelada"), [orders, reportRange]);

  const reports = [
    {
      id: "lista-do-dia",
      title: "Produção por período",
      description: "ROLs previstos no intervalo escolhido, por etapa.",
      icon: History,
      count: canSeeDaily && !isLoadingOrders ? dailyProduction.length : null,
      available: canSeeDaily && !canSeeOrders,
      category: "operacao",
      action: () => setShowDaily(true),
    },
    {
      id: "historico-cliente",
      title: "Histórico do cliente",
      description: "Consulte ROLs, valores pagos e pendentes, datas e atendente que registrou cada atendimento.",
      icon: CalendarDays,
      count: null,
      available: canSeeOrders,
      category: "atendimento",
      action: () => setShowCustomerHistory(true),
    },
  ];

  const visibleReports = reports.filter((report) => report.available);
  const periodControls = <div className="grid gap-3 sm:grid-cols-3">
    <div className="space-y-2"><Label htmlFor="reports-period-mode">Período</Label><Select value={periodMode} onValueChange={(value) => setPeriodMode(value as typeof periodMode)}><SelectTrigger id="reports-period-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dia">Escolher dia</SelectItem><SelectItem value="intervalo">Intervalo de datas</SelectItem><SelectItem value="mes">Escolher mês</SelectItem></SelectContent></Select></div>
    {periodMode === "dia" && <div className="space-y-2"><Label htmlFor="reports-selected-day">Dia</Label><Input id="reports-selected-day" type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value || today)} /></div>}
    {periodMode === "intervalo" && <><div className="space-y-2"><Label htmlFor="reports-range-start">De</Label><Input id="reports-range-start" type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value || today)} /></div><div className="space-y-2"><Label htmlFor="reports-range-end">Até</Label><Input id="reports-range-end" type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value || today)} /></div></>}
    {periodMode === "mes" && <div className="space-y-2"><Label htmlFor="reports-selected-month">Mês</Label><Input id="reports-selected-month" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value || today.slice(0,7))} /></div>}
    {!validRange && <p role="alert" className="text-sm text-destructive sm:col-span-3">A data inicial precisa ser anterior ou igual à data final.</p>}
  </div>;

  return (
    <AppLayout title="Relatórios e indicadores" subtitle="Consultas operacionais do PDV">
      <div className="page-shell" data-testid="pdv-reports-hub">
        <PageHeader
          eyebrow="Consulta operacional"
          title="Relatórios e indicadores"
          description="Acesse listas e conferências do atendimento, da produção e das rotas."
        />

        <CentralReportSelector />

        <h2 className="text-lg font-semibold">Outras consultas</h2>

        {isLoadingAccess ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Verificando os relatórios autorizados…</CardContent></Card>
        ) : accessError ? (
          <Card role="alert"><CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-destructive"><AlertCircle className="h-4 w-4" />Não foi possível verificar suas permissões.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleReports.map((report) => {
              const Icon = report.icon;
              const card = (
                <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/20">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                    </div>
                    {report.count != null && <Badge variant="secondary">{report.count}</Badge>}
                  </CardHeader>
                  <CardContent className="flex min-h-24 flex-col justify-between gap-4">
                    <p className="text-sm text-muted-foreground">{report.description}</p>
                    <span className="text-sm font-semibold text-primary">{report.action ? "Abrir lista" : "Abrir relatório"} →</span>
                  </CardContent>
                </Card>
              );

              return (
                <button key={report.id} type="button" className="block h-full w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60" onClick={report.action} aria-label={`Abrir relatório: ${report.title}`}>
                  {card}
                </button>
              );
            })}
            {visibleReports.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum relatório disponível para seu perfil nesta operação.</CardContent></Card>
            )}
          </div>
        )}
      </div>

      <Dialog open={showDaily} onOpenChange={setShowDaily}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Produção · período selecionado</DialogTitle>
            <DialogDescription>{periodLabel}. ROLs com previsão dentro do período e ainda não concluídos.</DialogDescription>
          </DialogHeader>
          {periodControls}
          {!validRange ? null : isLoadingOrders ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando a produção do dia…</p>
          ) : ordersError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-destructive" role="alert">
              <p>Não foi possível carregar a lista de produção.</p>
              <Button variant="outline" onClick={() => void refetchOrders()}>Tentar novamente</Button>
            </div>
          ) : dailyProduction.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ROL aberto tem prazo previsto neste período.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>ROL</TableHead><TableHead>Cliente</TableHead><TableHead>Etapa</TableHead><TableHead>Prazo</TableHead></TableRow></TableHeader>
                <TableBody>
                  {dailyProduction.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">{rolLabel(order.numero)}</TableCell>
                      <TableCell>{order.cliente?.razao_social || "Cliente sem nome"}</TableCell>
                      <TableCell><Badge variant="secondary">{productionStages[order.status] ?? order.status}</Badge></TableCell>
                      <TableCell>{order.data_previsao_entrega ? format(new Date(`${order.data_previsao_entrega}T12:00:00`), "dd/MM/yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showCustomerHistory && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowCustomerHistory(false); }}>
          <DialogContent className="max-h-[88dvh] w-[min(1180px,calc(100vw-24px))] max-w-none overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Histórico do cliente · {area === "industrial" ? "Industrial" : "Doméstico"}</DialogTitle>
              <DialogDescription>Pesquise por nome do cliente ou número do ROL. Os dados só são consultados após selecionar Consultar.</DialogDescription>
            </DialogHeader>
            <PdvCustomerHistoryReport area={area} />
          </DialogContent>
        </Dialog>
      )}

    </AppLayout>
  );
}
