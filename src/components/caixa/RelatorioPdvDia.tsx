import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, CalendarDays, Download, Printer, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CashReportError } from "@/components/caixa/CashReportError";
import { useRelatorioPdvDia } from "@/hooks/useRelatorioPdvDia";

const currency = (value: number | null) => value == null
  ? "—"
  : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export function RelatorioPdvDia() {
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const report = useRelatorioPdvDia(selectedDay);
  const data = report.data;

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Data/hora", "Tipo", "Descrição", "Operador", "Origem", "Valor"],
      ...data.financialEvents.map((event) => [event.occurredAt, event.type, event.description, event.operator, event.source, event.amount?.toFixed(2) ?? ""]),
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-pdv-${format(selectedDay, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Relatório diário do PDV</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Abertura, vendas, sangrias, reforços, pagamentos e alterações com o operador responsável.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Dia do relatório</span>
            <Input type="date" value={format(selectedDay, "yyyy-MM-dd")} onChange={(event) => {
              const [year, month, day] = event.target.value.split("-").map(Number);
              if (year && month && day) setSelectedDay(new Date(year, month - 1, day));
            }} className="h-8 w-[150px] border-0 p-0 shadow-none" />
          </label>
          <Button variant="outline" className="min-h-11 gap-2" onClick={() => void report.refetch()} disabled={report.isFetching}>
            <RefreshCw className={report.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Atualizar
          </Button>
          <Button variant="outline" className="min-h-11 gap-2" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" className="min-h-11 gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </Card>

      {report.isLoading ? (
        <Card className="flex min-h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></Card>
      ) : report.isError ? (
        <CashReportError onRetry={() => void report.refetch()} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Vendas</p><p className="mt-1 text-xl font-bold">{currency(data.totals.sales)}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Sangrias</p><p className="mt-1 text-xl font-bold text-red-600">{currency(data.totals.withdrawals)}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Reforços</p><p className="mt-1 text-xl font-bold text-blue-600">{currency(data.totals.reinforcements)}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-muted-foreground">Eventos financeiros</p><p className="mt-1 text-xl font-bold">{data.totals.financialEvents}</p></Card>
          </div>

          <Card>
            <div className="flex items-center justify-between border-b p-4">
              <div><h3 className="font-semibold">Movimentações do dia</h3><p className="text-sm text-muted-foreground">{format(selectedDay, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p></div>
              <Badge variant="outline">{data.financialEvents.length} registros</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data/hora</TableHead><TableHead>Evento</TableHead><TableHead>Descrição</TableHead><TableHead>Operador</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.financialEvents.length === 0 ? <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nenhuma movimentação encontrada neste dia.</TableCell></TableRow> : data.financialEvents.map((event) => (
                    <TableRow key={event.id}><TableCell className="whitespace-nowrap text-sm">{dateTime(event.occurredAt)}</TableCell><TableCell><Badge variant={event.type === "SANGRIA" ? "destructive" : "secondary"}>{event.type}</Badge></TableCell><TableCell>{event.description}</TableCell><TableCell><span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4 text-muted-foreground" />{event.operator}</span></TableCell><TableCell>{event.source}</TableCell><TableCell className="text-right font-medium">{currency(event.amount)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between border-b p-4"><div><h3 className="font-semibold">Registro de alterações</h3><p className="text-sm text-muted-foreground">Inserções, edições e exclusões relacionadas ao PDV.</p></div><ShieldCheck className="h-5 w-5 text-primary" /></div>
            {!data.auditIsAvailable ? <p className="p-5 text-sm text-muted-foreground">O registro detalhado de auditoria fica disponível somente para administradores. As movimentações financeiras acima continuam consolidadas.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Data/hora</TableHead><TableHead>Ação</TableHead><TableHead>Registro</TableHead><TableHead>Operador</TableHead></TableRow></TableHeader><TableBody>{data.auditEvents.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhuma alteração registrada neste dia.</TableCell></TableRow> : data.auditEvents.map((event) => <TableRow key={event.id}><TableCell className="whitespace-nowrap text-sm">{dateTime(event.occurredAt)}</TableCell><TableCell>{event.action}</TableCell><TableCell>{event.entity}</TableCell><TableCell>{event.operator}</TableCell></TableRow>)}</TableBody></Table></div>}
          </Card>
        </>
      ) : null}
    </div>
  );
}
