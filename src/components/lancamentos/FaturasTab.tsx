import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye, FileText, Loader2, Play, Receipt, Clock, DollarSign, TrendingUp,
  ChevronLeft, ChevronRight, Calendar, Filter, MoreHorizontal, Check, Ban,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFaturas, type Fatura } from "@/hooks/useFaturas";
import { FaturamentoModal, type DadosFaturamento, type LancamentoItem as FaturaLancamentoItem } from "@/components/faturamento/FaturamentoModal";
import { DetalhesFaturaModal } from "@/components/faturamento/DetalhesFaturaModal";
import { cn } from "@/lib/utils";
import { useDadosFaturamentoCompletos } from "@/hooks/useDadosFaturamento";

const getStatusConfig = (status: string) => {
  switch (status) {
    case "pendente": return { label: "Pendente", variant: "warning" as const };
    case "relatorio_gerado": return { label: "Relatório Gerado", variant: "info" as const };
    case "nota_emitida": return { label: "Nota Emitida", variant: "info" as const };
    case "pagamento_configurado": return { label: "Aguardando Envio", variant: "info" as const };
    case "enviada": case "enviado": return { label: "Enviada", variant: "default" as const };
    case "pago": return { label: "Pago", variant: "success" as const };
    case "cancelado": return { label: "Cancelado", variant: "danger" as const };
    default: return { label: status, variant: "default" as const };
  }
};

export function FaturasTab() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);
  const [wizardDados, setWizardDados] = useState<DadosFaturamento | null>(null);
  const [faturaParaContinuar, setFaturaParaContinuar] = useState<Fatura | null>(null);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [faturaDetalhes, setFaturaDetalhes] = useState<Fatura | null>(null);

  const periodoInicio = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(currentDate), "yyyy-MM-dd");
  const { faturas, summary, isLoading, updateFatura } = useFaturas(periodoInicio, periodoFim);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const handleContinuarFatura = (fatura: Fatura) => {
    setWizardDados(reconstruirDadosFaturamento(fatura));
    setFaturaParaContinuar(fatura);
    setFaturamentoModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Period Navigation */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Período:</span></div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-sm">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span></div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Previsto</p><p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(summary.totalPrevisto)}</p><p className="text-xs text-muted-foreground mt-1">{summary.totalClientes} cliente(s)</p></div>
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-primary" /></div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendente</p><p className="text-2xl font-bold text-warning mt-1">{formatCurrency(summary.pendente)}</p><p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p></div>
          <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center"><Clock className="w-6 h-6 text-warning" /></div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recebido</p><p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.pago)}</p><p className="text-xs text-muted-foreground mt-1">Faturas pagas</p></div>
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center"><DollarSign className="w-6 h-6 text-success" /></div>
        </div>
      </div>

      {/* Faturas Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /><h3 className="font-semibold">Faturas - {format(currentDate, "MMMM yyyy", { locale: ptBR })}</h3></div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : faturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Receipt className="w-12 h-12 mb-4 opacity-50" /><p>Nenhuma fatura neste período</p></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold">VALOR</TableHead>
                <TableHead className="font-semibold">PROGRESSO</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold">Nº NF</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.map(fatura => {
                const statusConfig = getStatusConfig(fatura.status);
                const isPaidOrCancelled = fatura.status === "pago" || (fatura.status as string) === "cancelado";
                const canContinue = !isPaidOrCancelled && !fatura.data_envio;
                return (
                  <TableRow key={fatura.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div><p className="font-medium text-foreground">{fatura.cliente?.razao_social || "Cliente"}</p><p className="text-xs text-muted-foreground">{format(new Date(fatura.periodo_inicio), "dd/MM")} - {format(new Date(fatura.periodo_fim), "dd/MM/yyyy")}</p></div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(Number(fatura.valor_total))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.relatorio_gerado ? "bg-success" : "bg-muted-foreground/30")} title="Relatório" />
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.numero_nf ? "bg-success" : "bg-muted-foreground/30")} title="Nota Fiscal" />
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.forma_pagamento ? "bg-success" : "bg-muted-foreground/30")} title="Pagamento" />
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.data_envio ? "bg-success" : "bg-muted-foreground/30")} title="Envio" />
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge variant={statusConfig.variant}>{statusConfig.label}</StatusBadge></TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{fatura.numero_nf || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canContinue && (
                          <Button size="sm" variant="outline" onClick={() => handleContinuarFatura(fatura)} className="gap-1"><Play className="w-3 h-3" />Continuar</Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setFaturaDetalhes(fatura); setDetalhesModalOpen(true); }}><Eye className="w-4 h-4 mr-2" />Ver Detalhes</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isPaidOrCancelled && (
                              <>
                                <DropdownMenuItem onClick={() => updateFatura.mutate({ id: fatura.id, status: "pago" })}><Check className="w-4 h-4 mr-2" />Marcar como Pago</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateFatura.mutate({ id: fatura.id, status: "cancelado" })} className="text-destructive focus:text-destructive"><Ban className="w-4 h-4 mr-2" />Cancelar Fatura</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modals */}
      <FaturamentoModal open={faturamentoModalOpen} onOpenChange={(open) => { if (!open) { setWizardDados(null); setFaturaParaContinuar(null); } setFaturamentoModalOpen(open); }} dados={wizardDados} onComplete={() => { setWizardDados(null); setFaturaParaContinuar(null); setFaturamentoModalOpen(false); }} faturaExistente={faturaParaContinuar} />
      <DetalhesFaturaModal open={detalhesModalOpen} onOpenChange={setDetalhesModalOpen} fatura={faturaDetalhes} />
    </div>
  );
}
