import { useWorkspace } from "@/contexts/WorkspaceContext";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye, FileText, Loader2, Play, Receipt, Clock, DollarSign, TrendingUp,
  ChevronLeft, ChevronRight, Calendar, Filter, MoreHorizontal, CircleDollarSign, Ban, RotateCcw,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFaturas, type Fatura } from "@/hooks/useFaturas";
import { FaturamentoModal, type DadosFaturamento, type LancamentoItem as FaturaLancamentoItem } from "@/components/faturamento/FaturamentoModal";
import { DetalhesFaturaModal } from "@/components/faturamento/DetalhesFaturaModal";
import { cn } from "@/lib/utils";
import { useDadosFaturamentoCompletos } from "@/hooks/useDadosFaturamento";
import { RegistrarRecebimentoFaturaModal } from "@/components/faturamento/RegistrarRecebimentoFaturaModal";
import { CancelarFaturaModal } from "@/components/faturamento/CancelarFaturaModal";
import { RefaturarFaturaModal } from "@/components/faturamento/RefaturarFaturaModal";

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

const getEffectivePaymentStatus = (
  status: Fatura["status_pagamento"] | undefined,
  workflowStatus: string,
): Fatura["status_pagamento"] => status
  ?? (workflowStatus === "pago" ? "pago" : workflowStatus === "cancelado" ? "cancelado" : "pendente");

const getPaymentStatusConfig = (status: Fatura["status_pagamento"] | undefined, workflowStatus: string) => {
  const effectiveStatus = getEffectivePaymentStatus(status, workflowStatus);
  switch (effectiveStatus) {
    case "pago": return { label: "Quitada", variant: "success" as const };
    case "parcial": return { label: "Recebimento parcial", variant: "info" as const };
    case "cancelado": return { label: "Cancelada", variant: "danger" as const };
    default: return { label: "A receber", variant: "warning" as const };
  }
};

export function FaturasTab() {
  const { activeArea } = useWorkspace();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);
  const [wizardDados, setWizardDados] = useState<DadosFaturamento | null>(null);
  const [faturaParaContinuar, setFaturaParaContinuar] = useState<Fatura | null>(null);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [faturaDetalhes, setFaturaDetalhes] = useState<Fatura | null>(null);
  const [clienteIdParaContinuar, setClienteIdParaContinuar] = useState<string | null>(null);
  const [faturaRecebimento, setFaturaRecebimento] = useState<Fatura | null>(null);
  const [recebimentoOpen, setRecebimentoOpen] = useState(false);
  const [faturaCancelamento, setFaturaCancelamento] = useState<Fatura | null>(null);
  const [cancelamentoOpen, setCancelamentoOpen] = useState(false);
  const [faturaRefaturamento, setFaturaRefaturamento] = useState<Fatura | null>(null);
  const [refaturamentoOpen, setRefaturamentoOpen] = useState(false);

  const periodoInicio = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(currentDate), "yyyy-MM-dd");
  const { faturas, summary, isLoading } = useFaturas(periodoInicio, periodoFim);
  
  // Fetch complete client data when continuing a fatura
  const { dados: dadosClienteCompletos } = useDadosFaturamentoCompletos(clienteIdParaContinuar);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const reconstruirDadosFaturamento = useCallback((fatura: Fatura): DadosFaturamento => {
    const itensSnapshot = (fatura.itens_snapshot as Array<{ id: string; produto: string; quantidade: number; unidade: string; valor_unitario: number; valor_total: number }>) || [];
    const itens: FaturaLancamentoItem[] = itensSnapshot.map(item => ({
      id: item.id, produto: item.produto, quantidade: item.quantidade, unidade: item.unidade,
      valorUnitario: item.valor_unitario, valorTotal: item.valor_total,
    }));
    const cli = dadosClienteCompletos.cliente;
    return {
      clienteId: fatura.cliente_id,
      clienteNome: fatura.cliente?.razao_social || "Cliente",
      clienteDocumento: fatura.cliente?.cpf_cnpj || "",
      clienteEmail: cli?.email || fatura.cliente?.email || null,
      clienteTelefone: cli?.telefone || fatura.cliente?.telefone || null,
      clienteTipoPessoa: cli?.tipo_pessoa || "cnpj",
      clienteInscricaoMunicipal: cli?.inscricao_municipal || null,
      clienteInscricaoEstadual: cli?.inscricao_estadual || null,
      clienteRegimeTributario: cli?.regime_tributario || null,
      clienteClassificacao: fatura.cliente?.classificacao || activeArea,
      clienteEndereco: dadosClienteCompletos.endereco || null,
      configPagamento: dadosClienteCompletos.configPagamento || null,
      configCliente: dadosClienteCompletos.configCliente || null,
      itens,
      valorTotal: Number(fatura.valor_total),
      periodoInicio: fatura.periodo_inicio,
      periodoFim: fatura.periodo_fim,
      observacao: fatura.observacao_fatura || undefined,
    };
  }, [dadosClienteCompletos, activeArea]);

  const handleContinuarFatura = (fatura: Fatura) => {
    if (fatura.cliente?.classificacao !== activeArea) return;
    setClienteIdParaContinuar(fatura.cliente_id);
    setFaturaParaContinuar(fatura);
  };

  useEffect(() => {
    if (!faturaParaContinuar || faturamentoModalOpen || dadosClienteCompletos.cliente?.id !== faturaParaContinuar.cliente_id || dadosClienteCompletos.cliente.classificacao !== activeArea) return;
    setWizardDados(reconstruirDadosFaturamento(faturaParaContinuar));
    setFaturamentoModalOpen(true);
  }, [faturaParaContinuar, faturamentoModalOpen, dadosClienteCompletos.cliente, activeArea, reconstruirDadosFaturamento]);

  return (
    <div className="space-y-4">
      {/* Period Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Período:</span></div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Mês anterior" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3 sm:flex-none"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-sm capitalize">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span></div>
          <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Próximo mês" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Previsto</p><p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(summary.totalPrevisto)}</p><p className="text-xs text-muted-foreground mt-1">{summary.totalClientes} cliente(s)</p></div>
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-primary" /></div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Saldo a receber</p><p className="text-2xl font-bold text-warning mt-1">{formatCurrency(summary.pendente)}</p><p className="text-xs text-muted-foreground mt-1">Inclui recebimentos parciais</p></div>
          <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center"><Clock className="w-6 h-6 text-warning" /></div>
        </div>
        <div className="bg-card border rounded-xl p-4 flex items-center justify-between">
          <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recebido</p><p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.pago)}</p><p className="text-xs text-muted-foreground mt-1">Eventos confirmados</p></div>
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center"><DollarSign className="w-6 h-6 text-success" /></div>
        </div>
      </div>

      {/* Faturas Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="p-4 border-b flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /><div><h3 className="font-semibold">Faturas de {format(currentDate, "MMMM yyyy", { locale: ptBR })}</h3><p className="text-xs text-muted-foreground">Recebimentos são conciliados com os pedidos de origem.</p></div></div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : faturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Receipt className="w-12 h-12 mb-4 opacity-50" /><p>Nenhuma fatura neste período</p></div>
        ) : (
          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold">FINANCEIRO</TableHead>
                <TableHead className="font-semibold">PROGRESSO</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold">Nº NF</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faturas.map(fatura => {
                const statusConfig = getStatusConfig(fatura.status);
                const paymentStatus = getEffectivePaymentStatus(fatura.status_pagamento, fatura.status);
                const paymentStatusConfig = getPaymentStatusConfig(fatura.status_pagamento, fatura.status);
                const received = Number(fatura.valor_pago || 0);
                const balance = Math.max(Number(fatura.valor_total) - received, 0);
                const isPaidOrCancelled = paymentStatus === "pago" || paymentStatus === "cancelado";
                const canCancel = !isPaidOrCancelled && received <= 0;
                const canContinue = !isPaidOrCancelled && !fatura.data_envio;
                const canRebill = paymentStatus === "cancelado"
                  && fatura.status === "cancelado"
                  && fatura.cliente?.classificacao === "industrial";
                return (
                  <TableRow key={fatura.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div><p className="font-medium text-foreground">{fatura.cliente?.razao_social || "Cliente"}</p><p className="text-xs text-muted-foreground">{format(parseISO(fatura.periodo_inicio), "dd/MM")} - {format(parseISO(fatura.periodo_fim), "dd/MM/yyyy")}</p></div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{formatCurrency(Number(fatura.valor_total))}</p>
                      <p className="text-xs text-muted-foreground">Recebido {formatCurrency(received)}</p>
                      {balance > 0 && <p className="text-xs font-medium text-warning">Saldo {formatCurrency(balance)}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.relatorio_gerado ? "bg-success" : "bg-muted-foreground/30")} title="Relatório" />
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.numero_nf ? "bg-success" : "bg-muted-foreground/30")} title="Nota Fiscal" />
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.forma_pagamento ? "bg-success" : "bg-muted-foreground/30")} title="Pagamento" />
                        <div className={cn("w-2.5 h-2.5 rounded-full", fatura.data_envio ? "bg-success" : "bg-muted-foreground/30")} title="Envio" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge variant={paymentStatusConfig.variant}>{paymentStatusConfig.label}</StatusBadge>
                        <span className="text-[10px] text-muted-foreground">Fluxo: {statusConfig.label}</span>
                        {fatura.forma_pagamento && (
                          <span className="text-[10px] text-muted-foreground capitalize">{fatura.forma_pagamento.replace(/_/g, " ")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{fatura.numero_nf || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isPaidOrCancelled && (
                          <Button size="sm" onClick={() => { setFaturaRecebimento(fatura); setRecebimentoOpen(true); }} className="min-h-9 gap-1"><CircleDollarSign className="w-3.5 h-3.5" />Receber</Button>
                        )}
                        {canContinue && (
                          <Button size="sm" variant="outline" onClick={() => handleContinuarFatura(fatura)} className="gap-1"><Play className="w-3 h-3" />Continuar</Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Ações da fatura de ${fatura.cliente?.razao_social || "cliente"}`}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setFaturaDetalhes(fatura); setDetalhesModalOpen(true); }}><Eye className="w-4 h-4 mr-2" />Ver Detalhes</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!isPaidOrCancelled && (
                              <>
                                <DropdownMenuItem onClick={() => { setFaturaRecebimento(fatura); setRecebimentoOpen(true); }}><CircleDollarSign className="w-4 h-4 mr-2" />Registrar recebimento</DropdownMenuItem>
                                {canCancel && <DropdownMenuItem onClick={() => { setFaturaCancelamento(fatura); setCancelamentoOpen(true); }} className="text-destructive focus:text-destructive"><Ban className="w-4 h-4 mr-2" />Cancelar fatura</DropdownMenuItem>}
                              </>
                            )}
                            {canRebill && (
                              <DropdownMenuItem onClick={() => { setFaturaRefaturamento(fatura); setRefaturamentoOpen(true); }}>
                                <RotateCcw className="mr-2 h-4 w-4" />Refaturar
                              </DropdownMenuItem>
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
          </div>
        )}

        {!isLoading && faturas.length > 0 && (
          <div className="divide-y md:hidden">
            {faturas.map((fatura) => {
              const paymentStatus = getEffectivePaymentStatus(fatura.status_pagamento, fatura.status);
              const paymentStatusConfig = getPaymentStatusConfig(fatura.status_pagamento, fatura.status);
              const received = Number(fatura.valor_pago || 0);
              const balance = Math.max(Number(fatura.valor_total) - received, 0);
              const isPaidOrCancelled = paymentStatus === "pago" || paymentStatus === "cancelado";
              const canCancel = !isPaidOrCancelled && received <= 0;
              const canContinue = !isPaidOrCancelled && !fatura.data_envio;
              const canRebill = paymentStatus === "cancelado"
                && fatura.status === "cancelado"
                && fatura.cliente?.classificacao === "industrial";
              return (
                <article key={fatura.id} className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{fatura.cliente?.razao_social || "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(fatura.periodo_inicio), "dd/MM")} a {format(parseISO(fatura.periodo_fim), "dd/MM/yyyy")}</p>
                    </div>
                    <StatusBadge variant={paymentStatusConfig.variant}>{paymentStatusConfig.label}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-xs">
                    <div><span className="block text-muted-foreground">Total</span><strong>{formatCurrency(Number(fatura.valor_total))}</strong></div>
                    <div><span className="block text-muted-foreground">Recebido</span><strong className="text-success">{formatCurrency(received)}</strong></div>
                    <div><span className="block text-muted-foreground">Saldo</span><strong className="text-warning">{formatCurrency(balance)}</strong></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="min-h-11" onClick={() => { setFaturaDetalhes(fatura); setDetalhesModalOpen(true); }}><Eye className="mr-2 h-4 w-4" />Detalhes</Button>
                    {!isPaidOrCancelled ? (
                      <Button className="min-h-11" onClick={() => { setFaturaRecebimento(fatura); setRecebimentoOpen(true); }}><CircleDollarSign className="mr-2 h-4 w-4" />Receber</Button>
                    ) : (
                      <Button variant="outline" className="min-h-11" disabled>Sem saldo</Button>
                    )}
                    {canContinue && (
                      <Button variant="outline" className="col-span-2 min-h-11" onClick={() => handleContinuarFatura(fatura)}><Play className="mr-2 h-4 w-4" />Continuar faturamento</Button>
                    )}
                    {canCancel && (
                      <Button variant="ghost" className="col-span-2 min-h-11 text-destructive hover:text-destructive" onClick={() => { setFaturaCancelamento(fatura); setCancelamentoOpen(true); }}><Ban className="mr-2 h-4 w-4" />Cancelar fatura</Button>
                    )}
                    {canRebill && (
                      <Button variant="outline" className="col-span-2 min-h-11" onClick={() => { setFaturaRefaturamento(fatura); setRefaturamentoOpen(true); }}><RotateCcw className="mr-2 h-4 w-4" />Refaturar com rastreabilidade</Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <FaturamentoModal open={faturamentoModalOpen} onOpenChange={(open) => { if (!open) { setWizardDados(null); setFaturaParaContinuar(null); } setFaturamentoModalOpen(open); }} dados={wizardDados} onComplete={() => { setWizardDados(null); setFaturaParaContinuar(null); setFaturamentoModalOpen(false); }} faturaExistente={faturaParaContinuar} />
      <DetalhesFaturaModal open={detalhesModalOpen} onOpenChange={setDetalhesModalOpen} fatura={faturaDetalhes} />
      <RegistrarRecebimentoFaturaModal open={recebimentoOpen} onOpenChange={setRecebimentoOpen} fatura={faturaRecebimento} />
      <CancelarFaturaModal open={cancelamentoOpen} onOpenChange={setCancelamentoOpen} fatura={faturaCancelamento} />
      <RefaturarFaturaModal open={refaturamentoOpen} onOpenChange={setRefaturamentoOpen} fatura={faturaRefaturamento} />
    </div>
  );
}
