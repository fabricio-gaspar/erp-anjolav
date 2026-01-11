import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Filter,
  Calendar,
  TrendingUp,
  Clock,
  DollarSign,
  Eye,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Package,
  Receipt,
} from "lucide-react";
import { useFaturas } from "@/hooks/useFaturas";
import { useLancamentosPendentes, useLancamentosComItens, type Lancamento } from "@/hooks/useLancamentos";
import { FaturamentoModal, type DadosFaturamento } from "@/components/faturamento/FaturamentoModal";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const Faturamento = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedLancamentos, setSelectedLancamentos] = useState<string[]>([]);
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);

  const periodoInicio = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const { faturas, summary, isLoading: isLoadingFaturas } = useFaturas(periodoInicio, periodoFim);
  const { lancamentos, isLoading: isLoadingLancamentos } = useLancamentosPendentes();
  const { data: lancamentosComItens } = useLancamentosComItens(selectedLancamentos);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Group lancamentos by cliente
  const lancamentosPorCliente = useMemo(() => {
    const groups: Record<string, Lancamento[]> = {};
    lancamentos.forEach((l) => {
      const clienteId = l.cliente_id;
      if (!groups[clienteId]) {
        groups[clienteId] = [];
      }
      groups[clienteId].push(l);
    });
    return groups;
  }, [lancamentos]);

  const handleToggleLancamento = (id: string) => {
    setSelectedLancamentos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleAllFromCliente = (clienteId: string, lancamentosIds: string[]) => {
    const allSelected = lancamentosIds.every((id) => selectedLancamentos.includes(id));
    if (allSelected) {
      setSelectedLancamentos((prev) => prev.filter((id) => !lancamentosIds.includes(id)));
    } else {
      setSelectedLancamentos((prev) => [...new Set([...prev, ...lancamentosIds])]);
    }
  };

  const totalSelecionado = useMemo(() => {
    return lancamentos
      .filter((l) => selectedLancamentos.includes(l.id))
      .reduce((sum, l) => sum + Number(l.valor_total), 0);
  }, [lancamentos, selectedLancamentos]);

  const clienteSelecionado = useMemo(() => {
    if (selectedLancamentos.length === 0) return null;
    const firstLancamento = lancamentos.find((l) => selectedLancamentos.includes(l.id));
    if (!firstLancamento) return null;

    // Check if all selected are from same cliente
    const allSameCliente = lancamentos
      .filter((l) => selectedLancamentos.includes(l.id))
      .every((l) => l.cliente_id === firstLancamento.cliente_id);

    if (!allSameCliente) return null;
    return firstLancamento.cliente;
  }, [lancamentos, selectedLancamentos]);

  const handleGerarFatura = () => {
    if (!clienteSelecionado || selectedLancamentos.length === 0) return;
    setFaturamentoModalOpen(true);
  };

  const dadosFaturamento: DadosFaturamento | null = useMemo(() => {
    if (!clienteSelecionado || !lancamentosComItens || lancamentosComItens.length === 0) return null;

    const allItens = lancamentosComItens.flatMap((l) =>
      (l.itens || []).map((item) => ({
        id: item.id,
        produto: item.produto_nome,
        quantidade: Number(item.quantidade),
        unidade: item.unidade,
        valorUnitario: Number(item.preco_unitario),
        valorTotal: Number(item.subtotal),
      }))
    );

    const datas = lancamentosComItens.map((l) => new Date(l.data_lancamento));
    const periodoInicio = datas.length > 0 ? format(Math.min(...datas.map((d) => d.getTime())), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    const periodoFim = datas.length > 0 ? format(Math.max(...datas.map((d) => d.getTime())), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    return {
      clienteId: clienteSelecionado.id,
      clienteNome: clienteSelecionado.razao_social,
      clienteDocumento: clienteSelecionado.cpf_cnpj || "",
      clienteEmail: clienteSelecionado.email || null,
      clienteTelefone: clienteSelecionado.telefone || null,
      itens: allItens,
      valorTotal: totalSelecionado,
      periodoInicio,
      periodoFim,
      lancamentoIds: selectedLancamentos,
    };
  }, [clienteSelecionado, lancamentosComItens, totalSelecionado, selectedLancamentos]);

  const handleFaturamentoConcluido = () => {
    setSelectedLancamentos([]);
    setFaturamentoModalOpen(false);
  };

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  return (
    <AppLayout title="Faturamento">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
          <p className="text-sm text-muted-foreground">
            Selecione lançamentos para gerar faturas
          </p>
        </div>

        <Tabs defaultValue="lancamentos" className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            <TabsTrigger
              value="lancamentos"
              className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
            >
              <Package className="w-4 h-4" />
              Lançamentos Pendentes
              {lancamentos.length > 0 && (
                <span className="ml-1 bg-warning text-warning-foreground text-xs px-2 py-0.5 rounded-full">
                  {lancamentos.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="faturas"
              className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
            >
              <Receipt className="w-4 h-4" />
              Faturas Geradas
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lançamentos Pendentes */}
          <TabsContent value="lancamentos" className="mt-6">
            <div className="space-y-4">
              {/* Selection Summary */}
              {selectedLancamentos.length > 0 && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Selecionados</p>
                        <p className="font-semibold">{selectedLancamentos.length} lançamento(s)</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-bold text-primary">{formatCurrency(totalSelecionado)}</p>
                      </div>
                      {clienteSelecionado && (
                        <div>
                          <p className="text-sm text-muted-foreground">Cliente</p>
                          <p className="font-medium">{clienteSelecionado.razao_social}</p>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleGerarFatura}
                      disabled={!clienteSelecionado}
                      className="gap-2 bg-success hover:bg-success/90"
                    >
                      <Play className="w-4 h-4" />
                      Gerar Fatura
                    </Button>
                  </div>
                  {!clienteSelecionado && selectedLancamentos.length > 0 && (
                    <p className="text-sm text-destructive mt-2">
                      Selecione lançamentos de um único cliente para gerar a fatura
                    </p>
                  )}
                </Card>
              )}

              {/* Lancamentos List */}
              <div className="bg-card border rounded-lg overflow-hidden">
                {isLoadingLancamentos ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : lancamentos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mb-4 opacity-50" />
                    <p>Nenhum lançamento pendente</p>
                    <p className="text-sm">Os lançamentos finalizados aparecem aqui</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="font-semibold">CLIENTE</TableHead>
                        <TableHead className="font-semibold">DATA</TableHead>
                        <TableHead className="font-semibold">VALOR</TableHead>
                        <TableHead className="font-semibold">OBS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(lancamentosPorCliente).map(([clienteId, clienteLancamentos]) => {
                        const cliente = clienteLancamentos[0]?.cliente;
                        const clienteIds = clienteLancamentos.map((l) => l.id);
                        const allSelected = clienteIds.every((id) => selectedLancamentos.includes(id));
                        const someSelected = clienteIds.some((id) => selectedLancamentos.includes(id));

                        return (
                          <React.Fragment key={clienteId}>
                            {/* Cliente Header Row */}
                            <TableRow className="bg-muted/30 hover:bg-muted/40">
                              <TableCell className="py-2">
                                <Checkbox
                                  checked={allSelected}
                                  onCheckedChange={() => handleToggleAllFromCliente(clienteId, clienteIds)}
                                  className={someSelected && !allSelected ? "opacity-50" : ""}
                                />
                              </TableCell>
                              <TableCell colSpan={4} className="py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{cliente?.razao_social || "Cliente"}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({clienteLancamentos.length} lançamento{clienteLancamentos.length > 1 ? "s" : ""})
                                  </span>
                                  <span className="text-sm font-medium text-primary ml-auto">
                                    {formatCurrency(clienteLancamentos.reduce((sum, l) => sum + Number(l.valor_total), 0))}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Lancamentos Rows */}
                            {clienteLancamentos.map((lancamento) => (
                              <TableRow
                                key={lancamento.id}
                                className={`hover:bg-muted/20 ${selectedLancamentos.includes(lancamento.id) ? "bg-primary/5" : ""}`}
                              >
                                <TableCell className="pl-8">
                                  <Checkbox
                                    checked={selectedLancamentos.includes(lancamento.id)}
                                    onCheckedChange={() => handleToggleLancamento(lancamento.id)}
                                  />
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {cliente?.nome_fantasia || "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {format(new Date(lancamento.data_lancamento), "dd/MM/yyyy")}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(Number(lancamento.valor_total))}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                  {lancamento.observacao || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab: Faturas Geradas */}
          <TabsContent value="faturas" className="mt-6">
            <div className="space-y-6">
              {/* Period Navigation */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Período:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Total Previsto
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {formatCurrency(summary.totalPrevisto)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.totalClientes} cliente(s)
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                </div>

                <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Pendente
                    </p>
                    <p className="text-2xl font-bold text-warning mt-1">
                      {formatCurrency(summary.pendente)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                </div>

                <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Recebido
                    </p>
                    <p className="text-2xl font-bold text-success mt-1">
                      {formatCurrency(summary.pago)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Faturas pagas</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-success" />
                  </div>
                </div>
              </div>

              {/* Faturas Table */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">
                    Faturas - {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                  </h3>
                </div>

                {isLoadingFaturas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : faturas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Receipt className="w-12 h-12 mb-4 opacity-50" />
                    <p>Nenhuma fatura neste período</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">CLIENTE</TableHead>
                        <TableHead className="font-semibold">VALOR</TableHead>
                        <TableHead className="font-semibold">STATUS</TableHead>
                        <TableHead className="font-semibold">Nº NF</TableHead>
                        <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faturas.map((fatura) => (
                        <TableRow key={fatura.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">
                                {fatura.cliente?.razao_social || "Cliente"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(fatura.periodo_inicio), "dd/MM")} - {format(new Date(fatura.periodo_fim), "dd/MM/yyyy")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(Number(fatura.valor_total))}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={
                                fatura.status === "pago"
                                  ? "success"
                                  : fatura.status === "nota_emitida"
                                  ? "info"
                                  : "warning"
                              }
                            >
                              {fatura.status === "pago"
                                ? "Pago"
                                : fatura.status === "nota_emitida"
                                ? "Nota Emitida"
                                : "Pendente"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {fatura.numero_nf || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              {fatura.status === "pendente" && (
                                <Button size="sm" className="gap-1 bg-success hover:bg-success/90">
                                  <Play className="w-3 h-3" />
                                  Continuar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de Faturamento */}
        <FaturamentoModal
          open={faturamentoModalOpen}
          onOpenChange={setFaturamentoModalOpen}
          dados={dadosFaturamento}
          onComplete={handleFaturamentoConcluido}
        />
      </div>
    </AppLayout>
  );
};

// React import needed for Fragment
import React from "react";

export default Faturamento;
