import { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  Scale,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientes } from "@/hooks/useClientes";
import { useFaturas } from "@/hooks/useFaturas";
import {
  type DemonstrativoIndustrial,
  type DemonstrativoOrigem,
  useRelatorioCliente,
} from "@/hooks/useRelatorioCliente";
import { openPrintClone } from "@/lib/safePrint";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  faturado: "Faturado",
  parcial: "Parcial",
  pago: "Pago",
  enviada: "Enviada",
  nota_emitida: "Nota emitida",
  cancelado: "Cancelado",
  entregue: "Entregue",
  prateleira: "Em expedição",
  em_processo: "Em produção",
};

function statusLabel(value: string) {
  return statusLabels[value] ?? value.replace(/_/g, " ");
}

function exportStatement(statement: DemonstrativoIndustrial) {
  const invoiceNumberById = new Map(statement.faturas.map((invoice) => [invoice.id, invoice.numero]));
  const rows = [
    ["Demonstrativo industrial", statement.cliente.razaoSocial],
    ["Período inicial", format(parseISO(statement.periodo.inicio), "dd/MM/yyyy")],
    ["Período final", format(parseISO(statement.periodo.fim), "dd/MM/yyyy")],
    ["Escopo", statement.escopo === "fatura" ? (statement.fatura?.numero ?? "Fatura") : "Operações do período"],
    [],
    ["Resumo", "Valor"],
    ["Origens operacionais", String(statement.totais.quantidadeOrigens)],
    ["Volume medido", quantity.format(statement.totais.quantidadeItens)],
    ["Valor das origens", statement.totais.valorOrigens.toFixed(2).replace(".", ",")],
    ["Ajustes/descontos", statement.totais.valorAjustes.toFixed(2).replace(".", ",")],
    ["Faturado", statement.totais.valorFaturado.toFixed(2).replace(".", ",")],
    ["Recebido", statement.totais.valorPago.toFixed(2).replace(".", ",")],
    ["Saldo faturado", statement.totais.saldoFaturado.toFixed(2).replace(".", ",")],
    ...statement.contratos.map((contract, index) => [
      `Referência contratual ${index + 1} (não somada)`,
      contract.descricao,
      contract.valorFixoReferencia.toFixed(2).replace(".", ","),
      `${format(parseISO(contract.vigenciaInicio), "dd/MM/yyyy")} a ${contract.vigenciaFim ? format(parseISO(contract.vigenciaFim), "dd/MM/yyyy") : "sem término"}`,
    ]),
    [],
    ["Origem", "Data", "Serviço", "Quantidade", "Unidade", "Valor unitário", "Valor total", "Situação", "Fatura"],
    ...statement.origens.flatMap((origin) => [
      ...origin.itens.map((item) => [
        origin.numero,
        format(parseISO(origin.data), "dd/MM/yyyy"),
        item.descricao,
        quantity.format(item.quantidade),
        item.unidade,
        item.valorUnitario.toFixed(2).replace(".", ","),
        item.valorTotal.toFixed(2).replace(".", ","),
        statusLabel(origin.status),
        origin.faturaId ? (invoiceNumberById.get(origin.faturaId) ?? `Fatura ${origin.faturaId.slice(0, 8).toUpperCase()}`) : "Não faturado",
      ]),
      ...(Math.abs(origin.ajuste) > 0.009 ? [[
        origin.numero,
        format(parseISO(origin.data), "dd/MM/yyyy"),
        "Ajuste/desconto da origem",
        "",
        "",
        "",
        origin.ajuste.toFixed(2).replace(".", ","),
        statusLabel(origin.status),
        origin.faturaId ? (invoiceNumberById.get(origin.faturaId) ?? `Fatura ${origin.faturaId.slice(0, 8).toUpperCase()}`) : "Não faturado",
      ]] : []),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `demonstrativo-${statement.cliente.razaoSocial.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${statement.periodo.inicio}-${statement.periodo.fim}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function OriginCard({ origin }: { origin: DemonstrativoOrigem }) {
  return (
    <details className="group rounded-xl border bg-card" open>
      <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{origin.numero}</span>
            <Badge variant="outline">{statusLabel(origin.status)}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(parseISO(origin.data), "dd/MM/yyyy")} · {origin.itens.length} serviço{origin.itens.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="font-bold text-primary">{currency.format(origin.valor)}</span>
      </summary>
      <div className="border-t px-4 py-3">
        <div className="statement-mobile space-y-3 md:hidden">
          {origin.itens.map((item) => (
            <div key={item.id} className="rounded-lg bg-muted/35 p-3 text-sm">
              <p className="font-medium">{item.descricao}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">{quantity.format(item.quantidade)} {item.unidade}</span>
                <span className="text-right font-semibold">{currency.format(item.valorTotal)}</span>
              </div>
            </div>
          ))}
          {Math.abs(origin.ajuste) > 0.009 && (
            <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-sm">
              <span>Ajuste/desconto da origem</span>
              <span className="font-semibold">{currency.format(origin.ajuste)}</span>
            </div>
          )}
        </div>
        <div className="statement-desktop hidden overflow-x-auto md:block">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Serviço</TableHead><TableHead>Unidade</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Unitário</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>{origin.itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.descricao}</TableCell>
                <TableCell>{item.unidade}</TableCell>
                <TableCell className="text-right">{quantity.format(item.quantidade)}</TableCell>
                <TableCell className="text-right">{currency.format(item.valorUnitario)}</TableCell>
                <TableCell className="text-right font-semibold">{currency.format(item.valorTotal)}</TableCell>
              </TableRow>
            ))}
              {Math.abs(origin.ajuste) > 0.009 && (
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">Ajuste/desconto da origem</TableCell>
                  <TableCell className="text-right font-semibold">{currency.format(origin.ajuste)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </details>
  );
}

export default function RelatoriosCliente() {
  const today = new Date();
  const [selectedClient, setSelectedClient] = useState("");
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [invoiceScope, setInvoiceScope] = useState("periodo");
  const { clientes: allClients, isLoading: clientsLoading, error: clientsError } = useClientes();
  const clients = useMemo(
    () => allClients.filter((client) => client.classificacao === "industrial" && client.ativo),
    [allClients],
  );
  const {
    faturas,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useFaturas(periodStart, periodEnd, Boolean(selectedClient), true, selectedClient || undefined);
  const clientInvoices = useMemo(
    () => faturas.filter((invoice) => invoice.cliente_id === selectedClient),
    [faturas, selectedClient],
  );
  const statementQuery = useRelatorioCliente(
    selectedClient || null,
    periodStart,
    periodEnd,
    invoiceScope === "periodo" ? null : invoiceScope,
  );
  const statement = statementQuery.data;

  useEffect(() => setInvoiceScope("periodo"), [selectedClient, periodStart, periodEnd]);

  const handlePrint = () => {
    const content = document.getElementById("industrial-statement-print");
    if (!content || !statement) return;
    const printWindow = openPrintClone(content, `Demonstrativo - ${statement.cliente.razaoSocial}`, `
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; color: #172E35; margin: 0; }
      #industrial-statement-print > * { margin-bottom: 12px; }
      .statement-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
      .statement-summary > * { border: 1px solid #d8e0e3; padding: 8px; }
      .statement-mobile { display: none !important; }
      .statement-desktop { display: block !important; overflow: visible !important; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #d8e0e3; padding: 6px; }
      details { break-inside: avoid; }
    `);
    if (printWindow) setTimeout(() => printWindow.print(), 250);
  };

  const invalidPeriod = !periodStart || !periodEnd || periodEnd < periodStart;

  return (
    <AppLayout title="Demonstrativos industriais" subtitle="Volumes, serviços, faturamento e saldo pela mesma regra">
      <div className="page-shell">
        <PageHeader
          eyebrow="Financeiro industrial"
          title="Demonstrativos industriais"
          description="Confira origens, serviços, quantidades, faturas e recebimentos sem somas paralelas na interface."
          actions={statement ? <>
            <Button variant="outline" onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
            <Button variant="outline" onClick={() => exportStatement(statement)} className="gap-2"><Download className="h-4 w-4" /> Exportar CSV</Button>
          </> : undefined}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarRange className="h-4 w-4 text-primary" /> Escopo do demonstrativo</CardTitle>
            <CardDescription>Escolha um cliente e período; uma fatura selecionada usa automaticamente o período gravado nela.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 md:col-span-2 xl:col-span-1">
              <Label>Cliente industrial</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient} disabled={clientsLoading}>
                <SelectTrigger aria-label="Cliente do demonstrativo"><SelectValue placeholder={clientsLoading ? "Carregando clientes..." : "Selecione um cliente"} /></SelectTrigger>
                <SelectContent>{clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.nome_fantasia || client.razao_social}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statement-start">Início</Label>
              <Input id="statement-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statement-end">Fim</Label>
              <Input id="statement-end" type="date" min={periodStart} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Conciliação</Label>
              <Select value={invoiceScope} onValueChange={setInvoiceScope} disabled={!selectedClient || invoicesLoading}>
                <SelectTrigger aria-label="Escopo financeiro do demonstrativo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="periodo">Todo o período</SelectItem>
                  {clientInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.numero_nf || `Fatura ${invoice.id.slice(0, 8).toUpperCase()}`} · {currency.format(Number(invoice.valor_total))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {clientsError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Não foi possível carregar os clientes</AlertTitle><AlertDescription>A consulta falhou; nenhum saldo foi presumido.</AlertDescription></Alert>}
        {invoicesError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Não foi possível carregar as faturas para conciliação</AlertTitle><AlertDescription>O demonstrativo do período continua disponível, mas a seleção de uma fatura específica foi suspensa.</AlertDescription></Alert>}
        {invalidPeriod && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Informe um período válido.</AlertDescription></Alert>}
        {statementQuery.isError && <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" /><AlertTitle>Falha ao calcular o demonstrativo</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{statementQuery.error instanceof Error ? statementQuery.error.message : "Tente novamente."}</span>
            <Button size="sm" variant="outline" onClick={() => void statementQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button>
          </AlertDescription>
        </Alert>}

        {!selectedClient && !clientsError && (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="font-medium">Selecione um cliente industrial</p>
            <p className="mt-1 text-sm text-muted-foreground">O demonstrativo será calculado no servidor para o período escolhido.</p>
          </CardContent></Card>
        )}

        {selectedClient && statementQuery.isLoading && (
          <Card><CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Calculando demonstrativo...</CardContent></Card>
        )}

        {statement && !invalidPeriod && (
          <div id="industrial-statement-print" data-testid="industrial-statement-workspace" className="space-y-5">
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.035]">
              <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> {statement.cliente.nomeFantasia || statement.cliente.razaoSocial}</CardTitle>
                  <CardDescription className="mt-1">{format(parseISO(statement.periodo.inicio), "dd/MM/yyyy")} a {format(parseISO(statement.periodo.fim), "dd/MM/yyyy")} · {statement.escopo === "fatura" ? "fatura conciliada" : "operações do período"}</CardDescription>
                </div>
                <Badge variant="outline" className="w-fit">Fonte canônica do banco</Badge>
              </CardHeader>
            </Card>

            <div className="statement-summary grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Origens operacionais</p><p className="mt-1 text-2xl font-bold">{statement.totais.quantidadeOrigens}</p><p className="mt-1 text-xs text-muted-foreground">{currency.format(statement.totais.valorOrigens)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Volume medido</p><p className="mt-1 text-2xl font-bold">{quantity.format(statement.totais.quantidadeItens)}</p><p className="mt-1 text-xs text-muted-foreground">{statement.totais.quantidadeServicos} composição{statement.totais.quantidadeServicos === 1 ? "" : "ões"}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ajustes/descontos</p><p className="mt-1 text-2xl font-bold">{currency.format(statement.totais.valorAjustes)}</p><p className="mt-1 text-xs text-muted-foreground">Origens − itens medidos</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faturado</p><p className="mt-1 text-2xl font-bold">{currency.format(statement.totais.valorFaturado)}</p><p className="mt-1 text-xs text-muted-foreground">Recebido: {currency.format(statement.totais.valorPago)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Saldo faturado</p><p className="mt-1 text-2xl font-bold text-primary">{currency.format(statement.totais.saldoFaturado)}</p><p className="mt-1 text-xs text-muted-foreground">Somente faturas emitidas</p></CardContent></Card>
            </div>

            {statement.fatura && (
              <Alert data-testid="invoice-reconciliation" className="border-primary/20 bg-primary/[0.035]"><CheckCircle2 className="h-4 w-4 text-primary" /><AlertTitle>{statement.fatura.numero} · {statusLabel(statement.fatura.statusPagamento)}</AlertTitle><AlertDescription>Total {currency.format(statement.fatura.valor)}, recebido {currency.format(statement.fatura.valorPago)} e saldo {currency.format(statement.fatura.saldo)}.</AlertDescription></Alert>
            )}

            {statement.contratos.length > 0 && (
              <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4" /> Referências contratuais do período</CardTitle><CardDescription>Condições comerciais informativas; nenhuma referência é somada sem origem ou fatura.</CardDescription></CardHeader><CardContent className="space-y-3">{statement.contratos.map((contract) => (
                <Alert key={contract.id}><AlertTitle>{contract.descricao}</AlertTitle><AlertDescription>Vigência de {format(parseISO(contract.vigenciaInicio), "dd/MM/yyyy")} a {contract.vigenciaFim ? format(parseISO(contract.vigenciaFim), "dd/MM/yyyy") : "sem término"}; referência fixa por ciclo: {currency.format(contract.valorFixoReferencia)}. Este valor é informativo e só integra a cobrança quando existir numa origem/fatura; não é somado artificialmente ao demonstrativo.</AlertDescription></Alert>
              ))}</CardContent></Card>
            )}

            {statement.origens.length === 0 ? (
              <Card className="border-dashed"><CardContent className="flex flex-col items-center py-14 text-center"><Scale className="mb-3 h-9 w-9 text-muted-foreground/60" /><p className="font-medium">Nenhuma origem encontrada</p><p className="mt-1 text-sm text-muted-foreground">Não há operações conciliáveis neste escopo.</p></CardContent></Card>
            ) : <>
              <Card>
                <CardHeader><CardTitle className="text-base">Consolidado por serviço e preço</CardTitle><CardDescription>Preços diferentes permanecem em linhas distintas para preservar a composição comercial.</CardDescription></CardHeader>
                <CardContent>
                  <div className="statement-mobile space-y-3 md:hidden">{statement.servicos.map((service) => (
                    <article key={`${service.descricao}-${service.unidade}-${service.valorUnitario}`} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{service.descricao}</p><p className="text-xs text-muted-foreground">{quantity.format(service.quantidade)} {service.unidade} · {service.quantidadeOrigens} origem{service.quantidadeOrigens === 1 ? "" : "s"}</p></div><p className="font-bold">{currency.format(service.valorTotal)}</p></div>
                      <p className="mt-3 text-xs text-muted-foreground">Preço unitário: {currency.format(service.valorUnitario)}</p>
                    </article>
                  ))}</div>
                  <div className="statement-desktop hidden overflow-x-auto rounded-xl border md:block"><Table><TableHeader><TableRow>
                    <TableHead>Serviço</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Origens</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Unitário</TableHead><TableHead className="text-right">Total</TableHead>
                  </TableRow></TableHeader><TableBody>{statement.servicos.map((service) => (
                    <TableRow key={`${service.descricao}-${service.unidade}-${service.valorUnitario}`}><TableCell className="font-medium">{service.descricao}</TableCell><TableCell>{service.unidade}</TableCell><TableCell className="text-right">{service.quantidadeOrigens}</TableCell><TableCell className="text-right">{quantity.format(service.quantidade)}</TableCell><TableCell className="text-right">{currency.format(service.valorUnitario)}</TableCell><TableCell className="text-right font-semibold">{currency.format(service.valorTotal)}</TableCell></TableRow>
                  ))}</TableBody></Table></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Origens rastreáveis</CardTitle><CardDescription>ROL real, data, situação, composição e vínculo financeiro.</CardDescription></CardHeader>
                <CardContent className="space-y-3">{statement.origens.map((origin) => <OriginCard key={origin.id} origin={origin} />)}</CardContent>
              </Card>
            </>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
