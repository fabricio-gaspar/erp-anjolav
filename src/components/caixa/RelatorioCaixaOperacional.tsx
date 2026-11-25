import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CashReportError } from "@/components/caixa/CashReportError";
import { useRelatorioCaixaOperacional, type CashReportOperationalData } from "@/hooks/useRelatorioCaixaOperacional";
import { escapeCsvCell } from "@/lib/csvExport";

export type RelatorioCaixaView = "geral" | "movimentos" | "rols" | "baixas";

interface RelatorioCaixaOperacionalProps {
  view: RelatorioCaixaView;
  selectedDay: Date;
  onSelectedDayChange: (date: Date) => void;
  endDay?: Date;
  onEndDayChange?: (date: Date) => void;
}

const formatCurrency = (value: number | null | undefined) => value == null
  ? "—"
  : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const compactHead = "h-8 whitespace-nowrap bg-muted/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary";
const compactCell = "whitespace-nowrap px-2 py-1.5 text-xs";

const exportRows = (view: RelatorioCaixaView, data: CashReportOperationalData) => {
  if (view === "geral") return [
    ["Forma de recebimento", "Entrada apurada", "Saída apurada", data.cashBalancesAvailable ? "Saldo apurado" : "Movimentação líquida", "Saldo contado", "Diferença"],
    ...data.general.map((row) => [row.forma, row.entrada.toFixed(2), row.saida.toFixed(2), row.saldoApurado.toFixed(2), row.saldoContado?.toFixed(2) ?? "", row.diferenca?.toFixed(2) ?? ""]),
  ];
  if (view === "movimentos") return [
    ["Data", "Histórico", "Tipo", "Forma de recebimento", "Valor", "Documento", "Tipo documento", "Usuário"],
    ...data.movements.map((row) => [row.data, row.historico, row.tipo, row.forma, row.valor.toFixed(2), row.documento, row.tipoDocumento, row.usuario]),
  ];
  if (view === "rols") return [
    ["Código", "Nome do cliente", "Vlr. desconto", "Vlr. total", "Vlr. adiantamento", "Tipo solicitação", "Vlr. sobra"],
    ...data.orders.map((row) => [row.codigo, row.cliente, row.desconto.toFixed(2), row.total.toFixed(2), row.adiantamento.toFixed(2), row.tipoSolicitacao, row.sobra.toFixed(2)]),
  ];
  return [
    ["ROL", "Nome do cliente", "Vlr. aberto", "Vlr. desconto", "Vlr. recebido"],
    ...data.receipts.map((row) => [row.codigo, row.cliente, row.aberto.toFixed(2), row.desconto.toFixed(2), row.recebido.toFixed(2)]),
  ];
};

export function RelatorioCaixaOperacional({ view, selectedDay, onSelectedDayChange, endDay, onEndDayChange }: RelatorioCaixaOperacionalProps) {
  const report = useRelatorioCaixaOperacional(selectedDay, endDay ?? selectedDay);
  const data = report.data;

  const exportCsv = () => {
    if (!data) return;
    const rows = exportRows(view, data);
    const csv = rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `relatorio-caixa-${view}-${format(selectedDay, "yyyy-MM-dd")}${endDay ? `-a-${format(endDay, "yyyy-MM-dd")}` : ""}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderEmpty = (message: string) => (
    <TableRow><TableCell colSpan={view === "geral" ? 6 : view === "movimentos" ? 8 : view === "rols" ? 7 : 5} className="py-12 text-center text-sm text-muted-foreground">{message}</TableCell></TableRow>
  );

  return (
    <div className="space-y-3" data-testid={`cash-report-${view}`}>
      <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Relatório de Caixa</p>
          <p className="text-sm text-muted-foreground">Movimentações reais do PDV {endDay ? "de" : "em"} {format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}{endDay && ` até ${format(endDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-2" htmlFor="cash-report-date">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">{endDay ? "Data inicial" : "Data do relatório"}</span>
            <Input
              id="cash-report-date"
              type="date"
              value={format(selectedDay, "yyyy-MM-dd")}
              onChange={(event) => {
                const [year, month, day] = event.target.value.split("-").map(Number);
                if (year && month && day) onSelectedDayChange(new Date(year, month - 1, day));
              }}
              className="h-8 w-[142px] border-0 p-0 text-sm shadow-none"
            />
          </label>
          {endDay && onEndDayChange && <label className="flex h-10 items-center gap-2 rounded-md border bg-background px-2" htmlFor="cash-report-end-date">
            <span className="text-sm text-muted-foreground">até</span>
            <Input id="cash-report-end-date" type="date" aria-label="Data final" min={format(selectedDay, "yyyy-MM-dd")} value={format(endDay, "yyyy-MM-dd")} onChange={(event) => {
              const [year, month, day] = event.target.value.split("-").map(Number);
              if (year && month && day) onEndDayChange(new Date(year, month - 1, day));
            }} className="h-8 w-[142px] border-0 p-0 text-sm shadow-none" />
          </label>}
          <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => void report.refetch()} disabled={report.isFetching}>
            <RefreshCw className={report.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-2" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {data?.operationScoped && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground" role="note">
          Exibindo os movimentos identificados desta operação. A abertura e a conferência pertencem ao caixa compartilhado e não são divididas entre operações; movimentos sem operação ficam no relatório consolidado.
        </p>
      )}
      {data && !data.operationScoped && !data.cashBalancesAvailable && view === "geral" && <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground" role="note">O período não abrange integralmente a abertura e o fechamento de todos os caixas. A tabela mostra a movimentação líquida, sem apresentar saldos ou diferenças de fechamento incompletos.</p>}

      {report.isLoading ? (
        <Card className="flex min-h-48 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" /></Card>
      ) : report.isError ? (
        report.error instanceof Error && report.error.message.startsWith("O período contém mais de 10.000")
          ? <Card role="alert" className="p-4 text-destructive">{report.error.message}</Card>
          : <CashReportError onRetry={() => void report.refetch()} />
      ) : data ? (
        <div className="overflow-x-auto rounded-md border bg-background">
          {view === "geral" && (
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead className={compactHead}>Forma de recebimento</TableHead><TableHead className={compactHead}>Vlr. ent. apur.</TableHead><TableHead className={compactHead}>Vlr. sai. apur.</TableHead><TableHead className={compactHead}>{data.cashBalancesAvailable ? "Saldo apur." : "Mov. líquida"}</TableHead><TableHead className={compactHead}>Saldo contado</TableHead><TableHead className={compactHead}>Diferença</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.general.map((row) => <TableRow key={row.forma} className="hover:bg-primary/5"><TableCell className={`${compactCell} font-medium text-primary`}>{row.forma.replace("_", " ")}</TableCell><TableCell className={compactCell}>{formatCurrency(row.entrada)}</TableCell><TableCell className={compactCell}>{formatCurrency(row.saida)}</TableCell><TableCell className={compactCell}>{formatCurrency(row.saldoApurado)}</TableCell><TableCell className={compactCell}>{formatCurrency(row.saldoContado)}</TableCell><TableCell className={`${compactCell} font-semibold ${row.diferenca != null && row.diferenca < 0 ? "text-destructive" : "text-primary"}`}>{formatCurrency(row.diferenca)}</TableCell></TableRow>)}
                <TableRow className="bg-muted/60 font-semibold"><TableCell className={compactCell}>TOTAL</TableCell><TableCell className={compactCell}>{formatCurrency(data.totals.entrada)}</TableCell><TableCell className={compactCell}>{formatCurrency(data.totals.saida)}</TableCell><TableCell className={compactCell}>{formatCurrency(data.general.reduce((sum, row) => sum + row.saldoApurado, 0))}</TableCell><TableCell className={compactCell}>—</TableCell><TableCell className={compactCell}>—</TableCell></TableRow>
              </TableBody>
            </Table>
          )}

          {view === "movimentos" && (
            <Table className="min-w-[1050px]">
              <TableHeader><TableRow><TableHead className={compactHead}>Data</TableHead><TableHead className={compactHead}>Histórico</TableHead><TableHead className={compactHead}>T.</TableHead><TableHead className={compactHead}>Forma de recebimento</TableHead><TableHead className={compactHead}>Valor</TableHead><TableHead className={compactHead}>Doc. origem</TableHead><TableHead className={compactHead}>T. doc.</TableHead><TableHead className={compactHead}>Usuário</TableHead></TableRow></TableHeader>
              <TableBody>{data.movements.length === 0 ? renderEmpty("Nenhuma movimentação registrada nesta data.") : data.movements.map((row) => <TableRow key={row.id} className="hover:bg-primary/5"><TableCell className={compactCell}>{format(new Date(row.data), "dd/MM/yyyy HH:mm")}</TableCell><TableCell className={`${compactCell} max-w-[360px] text-primary`}>{row.historico}</TableCell><TableCell className={`${compactCell} font-semibold ${row.tipo === "S" ? "text-destructive" : "text-primary"}`}>{row.tipo}</TableCell><TableCell className={compactCell}>{row.forma}</TableCell><TableCell className={`${compactCell} font-medium`}>{formatCurrency(row.valor)}</TableCell><TableCell className={compactCell}>{row.documento}</TableCell><TableCell className={compactCell}>{row.tipoDocumento}</TableCell><TableCell className={compactCell}>{row.usuario}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}

          {view === "rols" && (
            <Table className="min-w-[920px]">
              <TableHeader><TableRow><TableHead className={compactHead}>Código</TableHead><TableHead className={compactHead}>Nome do cliente</TableHead><TableHead className={compactHead}>Vlr. desc.</TableHead><TableHead className={compactHead}>Vlr. total</TableHead><TableHead className={compactHead}>Vlr. adiant.</TableHead><TableHead className={compactHead}>Tipo solicitação</TableHead><TableHead className={compactHead}>Vlr. sobra</TableHead></TableRow></TableHeader>
              <TableBody>{data.orders.length === 0 ? renderEmpty("Nenhum ROL lançado nesta data.") : data.orders.map((row) => <TableRow key={row.id} className="hover:bg-primary/5"><TableCell className={`${compactCell} font-semibold text-primary`}>{row.codigo}</TableCell><TableCell className={`${compactCell} text-primary`}>{row.cliente}</TableCell><TableCell className={compactCell}>{formatCurrency(row.desconto)}</TableCell><TableCell className={compactCell}>{formatCurrency(row.total)}</TableCell><TableCell className={compactCell}>{formatCurrency(row.adiantamento)}</TableCell><TableCell className={compactCell}>{row.tipoSolicitacao}</TableCell><TableCell className={compactCell}>{formatCurrency(row.sobra)}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}

          {view === "baixas" && (
            <Table className="min-w-[720px]">
              <TableHeader><TableRow><TableHead className={compactHead}>ROL</TableHead><TableHead className={compactHead}>Nome do cliente</TableHead><TableHead className={compactHead}>Vlr. aberto</TableHead><TableHead className={compactHead}>Vlr. desconto</TableHead><TableHead className={compactHead}>Vlr. recebido</TableHead></TableRow></TableHeader>
              <TableBody>{data.receipts.length === 0 ? renderEmpty("Nenhum recebimento identificado nesta data.") : data.receipts.map((row) => <TableRow key={row.id} className="hover:bg-primary/5"><TableCell className={`${compactCell} font-semibold text-primary`}>{row.codigo}</TableCell><TableCell className={`${compactCell} text-primary`}>{row.cliente}</TableCell><TableCell className={compactCell}>{formatCurrency(row.aberto)}</TableCell><TableCell className={compactCell}>{formatCurrency(row.desconto)}</TableCell><TableCell className={`${compactCell} font-semibold text-primary`}>{formatCurrency(row.recebido)}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </div>
      ) : null}
    </div>
  );
}
