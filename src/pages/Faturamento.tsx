import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  X,
  User,
  MoreHorizontal,
  Check,
  Ban,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import { useFaturas, type Fatura } from "@/hooks/useFaturas";
import { 
  useLancamentosPendentes, 
  useLancamentosComItens, 
  useItensLancamento,
  useCreateItemLancamento,
  useUpdateItemLancamento,
  useDeleteItemLancamento,
  type Lancamento,
  type ItemLancamento,
} from "@/hooks/useLancamentos";
import { FaturamentoModal, type DadosFaturamento, type LancamentoItem } from "@/components/faturamento/FaturamentoModal";
import { DetalhesFaturaModal } from "@/components/faturamento/DetalhesFaturaModal";
import { VisualizarItensModal } from "@/components/faturamento/VisualizarItensModal";
import { EditarLancamentoModal } from "@/components/faturamento/EditarLancamentoModal";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Helper para mapear status para config visual
const getStatusConfig = (status: string) => {
  switch (status) {
    case "pendente":
      return { label: "Pendente", variant: "warning" as const };
    case "relatorio_gerado":
      return { label: "Relatório Gerado", variant: "info" as const };
    case "nota_emitida":
      return { label: "Nota Emitida", variant: "info" as const };
    case "pagamento_configurado":
      return { label: "Aguardando Envio", variant: "info" as const };
    case "enviada":
    case "enviado":
      return { label: "Enviada", variant: "default" as const };
    case "pago":
      return { label: "Pago", variant: "success" as const };
    case "cancelado":
      return { label: "Cancelado", variant: "danger" as const };
    default:
      return { label: status, variant: "default" as const };
  }
};

// Helper para reconstruir DadosFaturamento de uma fatura existente
const reconstruirDadosFaturamento = (fatura: Fatura): DadosFaturamento => {
  const itensSnapshot = (fatura.itens_snapshot as Array<{
    id: string;
    produto: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    valor_total: number;
  }>) || [];

  const itens: LancamentoItem[] = itensSnapshot.map((item) => ({
    id: item.id,
    produto: item.produto,
    quantidade: item.quantidade,
    unidade: item.unidade,
    valorUnitario: item.valor_unitario,
    valorTotal: item.valor_total,
  }));

  return {
    clienteId: fatura.cliente_id,
    clienteNome: fatura.cliente?.razao_social || "Cliente",
    clienteDocumento: fatura.cliente?.cpf_cnpj || "",
    clienteEmail: fatura.cliente?.email || null,
    clienteTelefone: fatura.cliente?.telefone || null,
    itens,
    valorTotal: Number(fatura.valor_total),
    periodoInicio: fatura.periodo_inicio,
    periodoFim: fatura.periodo_fim,
    observacao: fatura.observacao_fatura || undefined,
  };
};

const Faturamento = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const clienteFiltroId = searchParams.get("cliente");
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedLancamentos, setSelectedLancamentos] = useState<string[]>([]);
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);
  // Estado "congelado" para o wizard - não muda enquanto o modal está aberto
  const [wizardDados, setWizardDados] = useState<DadosFaturamento | null>(null);
  // Estado para continuar fatura existente
  const [faturaParaContinuar, setFaturaParaContinuar] = useState<Fatura | null>(null);
  // Estado para modal de detalhes
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [faturaDetalhes, setFaturaDetalhes] = useState<Fatura | null>(null);

  // Estados para gestão de lançamentos
  const [visualizarItensOpen, setVisualizarItensOpen] = useState(false);
  const [editarLancamentoOpen, setEditarLancamentoOpen] = useState(false);
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<Lancamento | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<Lancamento | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const periodoInicio = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const { faturas, summary, isLoading: isLoadingFaturas, updateFatura } = useFaturas(periodoInicio, periodoFim);
  const { lancamentos, isLoading: isLoadingLancamentos, updateLancamento, deleteLancamento } = useLancamentosPendentes();
  const { data: lancamentosComItens, isLoading: isLoadingItens } = useLancamentosComItens(selectedLancamentos);
  
  // Itens do lançamento selecionado para visualização/edição
  const { data: itensLancamentoSelecionado = [], isLoading: isLoadingItensLancamento } = useItensLancamento(lancamentoSelecionado?.id || null);
  const createItemLancamento = useCreateItemLancamento();

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Filter lancamentos by cliente when URL param is present AND only show industrial clients
  const lancamentosFiltrados = useMemo(() => {
    // First filter to only industrial clients
    const industrialOnly = lancamentos.filter(l => l.cliente?.classificacao === "industrial");
    
    // Then apply URL filter if present
    if (!clienteFiltroId) return industrialOnly;
    return industrialOnly.filter((l) => l.cliente_id === clienteFiltroId);
  }, [lancamentos, clienteFiltroId]);

  // Get filtered client info
  const clienteFiltroInfo = useMemo(() => {
    if (!clienteFiltroId || lancamentosFiltrados.length === 0) return null;
    return lancamentosFiltrados[0]?.cliente;
  }, [clienteFiltroId, lancamentosFiltrados]);

  // Pre-select all lancamentos when filtering by cliente
  useEffect(() => {
    if (clienteFiltroId && lancamentosFiltrados.length > 0 && !isLoadingLancamentos) {
      const ids = lancamentosFiltrados.map((l) => l.id);
      setSelectedLancamentos(ids);
    }
  }, [clienteFiltroId, lancamentosFiltrados, isLoadingLancamentos]);

  // Clear filter handler
  const handleClearFilter = () => {
    setSearchParams({});
    setSelectedLancamentos([]);
  };

  // Group lancamentos by cliente (use filtered list)
  const lancamentosPorCliente = useMemo(() => {
    const groups: Record<string, Lancamento[]> = {};
    lancamentosFiltrados.forEach((l) => {
      const clienteId = l.cliente_id;
      if (!groups[clienteId]) {
        groups[clienteId] = [];
      }
      groups[clienteId].push(l);
    });
    return groups;
  }, [lancamentosFiltrados]);

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
    return lancamentosFiltrados
      .filter((l) => selectedLancamentos.includes(l.id))
      .reduce((sum, l) => sum + Number(l.valor_total), 0);
  }, [lancamentosFiltrados, selectedLancamentos]);

  const clienteSelecionado = useMemo(() => {
    if (selectedLancamentos.length === 0) return null;
    const firstLancamento = lancamentosFiltrados.find((l) => selectedLancamentos.includes(l.id));
    if (!firstLancamento) return null;

    // Check if all selected are from same cliente
    const allSameCliente = lancamentosFiltrados
      .filter((l) => selectedLancamentos.includes(l.id))
      .every((l) => l.cliente_id === firstLancamento.cliente_id);

    if (!allSameCliente) return null;
    return firstLancamento.cliente;
  }, [lancamentosFiltrados, selectedLancamentos]);

  const handleGerarFatura = () => {
    if (!clienteSelecionado || selectedLancamentos.length === 0) return;
    if (isLoadingItens) {
      toast.info("Carregando dados dos lançamentos...");
      return;
    }
    if (!dadosFaturamento || dadosFaturamento.itens.length === 0) {
      toast.error("Aguarde, carregando itens dos lançamentos...");
      return;
    }
    // Congela os dados para o wizard (snapshot)
    setWizardDados({ ...dadosFaturamento });
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
    setWizardDados(null);
    setFaturaParaContinuar(null);
    setFaturamentoModalOpen(false);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      // Limpa o wizard ao fechar
      setWizardDados(null);
      setFaturaParaContinuar(null);
    }
    setFaturamentoModalOpen(open);
  };

  // Handler para continuar fatura existente
  const handleContinuarFatura = (fatura: Fatura) => {
    const dados = reconstruirDadosFaturamento(fatura);
    setWizardDados(dados);
    setFaturaParaContinuar(fatura);
    setFaturamentoModalOpen(true);
  };

  // Handler para ver detalhes
  const handleVerDetalhes = (fatura: Fatura) => {
    setFaturaDetalhes(fatura);
    setDetalhesModalOpen(true);
  };

  // Handler para marcar como pago
  const handleMarcarPago = (fatura: Fatura) => {
    updateFatura.mutate({
      id: fatura.id,
      status: "pago",
    });
  };

  // Handler para cancelar fatura
  const handleCancelarFatura = (fatura: Fatura) => {
    updateFatura.mutate({
      id: fatura.id,
      status: "cancelado",
    });
  };

  // Handlers para gestão de lançamentos
  const handleVisualizarItens = (lancamento: Lancamento) => {
    setLancamentoSelecionado(lancamento);
    setVisualizarItensOpen(true);
  };

  const handleEditarLancamento = (lancamento: Lancamento) => {
    setLancamentoSelecionado(lancamento);
    setEditarLancamentoOpen(true);
  };

  const handleConfirmarExclusao = (lancamento: Lancamento) => {
    setLancamentoParaExcluir(lancamento);
    setDeleteConfirmOpen(true);
  };

  const handleExcluirLancamento = async () => {
    if (!lancamentoParaExcluir) return;
    deleteLancamento.mutate(lancamentoParaExcluir.id);
    setDeleteConfirmOpen(false);
    setLancamentoParaExcluir(null);
  };

  const handleSalvarLancamento = async (
    lancamentoId: string,
    data: { observacao: string | null; data_lancamento: string; valor_total: number },
    itensAtualizados: ItemLancamento[],
    itensRemovidos: string[],
    itensNovos: Omit<ItemLancamento, 'id' | 'created_at'>[]
  ) => {
    setIsSaving(true);
    try {
      // Update lancamento
      updateLancamento.mutate({
        id: lancamentoId,
        observacao: data.observacao,
        data_lancamento: data.data_lancamento,
        valor_total: data.valor_total,
      });

      // Delete removed items
      for (const itemId of itensRemovidos) {
        await supabase.from("itens_lancamento").delete().eq("id", itemId);
      }

      // Update existing items
      for (const item of itensAtualizados) {
        await supabase
          .from("itens_lancamento")
          .update({
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            subtotal: item.subtotal,
          })
          .eq("id", item.id);
      }

      // Create new items
      for (const item of itensNovos) {
        await supabase.from("itens_lancamento").insert({
          lancamento_id: item.lancamento_id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          unidade: item.unidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
        });
      }

      toast.success("Lançamento atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNovoLancamento = () => {
    navigate("/lancamentos?retorno=faturamento");
  };

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  return (
    <AppLayout title="Faturamento" subtitle="Selecione lançamentos para gerar faturas">
      <div className="content-panel">
        <Tabs defaultValue="lancamentos" className="w-full">
          <div className="tabs-scrollable">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-4 sm:gap-6 inline-flex min-w-max">
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
          </div>

          {/* Tab: Lançamentos Pendentes */}
          <TabsContent value="lancamentos" className="mt-4">
            <div className="space-y-4">
              {/* Client Filter Banner */}
              {clienteFiltroId && (
                <Card className="p-4 bg-primary/10 border-primary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Filtrando por cliente</p>
                        <p className="font-semibold">
                          {clienteFiltroInfo?.razao_social || "Cliente"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {lancamentosFiltrados.length} lançamento(s) pendente(s)
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilter}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Limpar filtro
                    </Button>
                  </div>
                </Card>
              )}

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
                ) : lancamentosFiltrados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mb-4 opacity-50" />
                    <p>Nenhum lançamento pendente</p>
                    <p className="text-sm">
                      {clienteFiltroId 
                        ? "Este cliente não possui lançamentos pendentes" 
                        : "Os lançamentos finalizados aparecem aqui"}
                    </p>
                    {clienteFiltroId && (
                      <Button variant="link" onClick={handleClearFilter} className="mt-2">
                        Ver todos os clientes
                      </Button>
                    )}
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
                        <TableHead className="font-semibold w-24">AÇÕES</TableHead>
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
                              <TableCell colSpan={5} className="py-2">
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
                                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                  {lancamento.observacao || "-"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleVisualizarItens(lancamento)}
                                      title="Ver itens"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleEditarLancamento(lancamento)}
                                      title="Editar"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => handleConfirmarExclusao(lancamento)}
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
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

              {/* Botão Novo Lançamento */}
              <div className="flex justify-end">
                <Button onClick={handleNovoLancamento} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Novo Lançamento
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Faturas Geradas */}
          <TabsContent value="faturas" className="mt-4">
            <div className="space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Total Previsto
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground mt-1 truncate">
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
                    <p className="text-xl sm:text-2xl font-bold text-warning mt-1 truncate">
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
                    <p className="text-xl sm:text-2xl font-bold text-success mt-1 truncate">
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
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">CLIENTE</TableHead>
                        <TableHead className="font-semibold">VALOR</TableHead>
                        <TableHead className="font-semibold hidden md:table-cell">PROGRESSO</TableHead>
                        <TableHead className="font-semibold">STATUS</TableHead>
                        <TableHead className="font-semibold hidden lg:table-cell">Nº NF</TableHead>
                        <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faturas.map((fatura) => {
                        const statusConfig = getStatusConfig(fatura.status);
                        const isPaidOrCancelled = fatura.status === "pago" || (fatura.status as string) === "cancelado";
                        const canContinue = !isPaidOrCancelled && !fatura.data_envio;
                        
                        return (
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
                              {/* Indicador de progresso com 4 bolinhas */}
                              <div className="flex items-center gap-1">
                                <div 
                                  className={cn(
                                    "w-2.5 h-2.5 rounded-full",
                                    fatura.relatorio_gerado ? "bg-success" : "bg-muted-foreground/30"
                                  )} 
                                  title="Relatório"
                                />
                                <div 
                                  className={cn(
                                    "w-2.5 h-2.5 rounded-full",
                                    fatura.numero_nf ? "bg-success" : "bg-muted-foreground/30"
                                  )} 
                                  title="Nota Fiscal"
                                />
                                <div 
                                  className={cn(
                                    "w-2.5 h-2.5 rounded-full",
                                    fatura.forma_pagamento ? "bg-success" : "bg-muted-foreground/30"
                                  )} 
                                  title="Pagamento"
                                />
                                <div 
                                  className={cn(
                                    "w-2.5 h-2.5 rounded-full",
                                    fatura.data_envio ? "bg-success" : "bg-muted-foreground/30"
                                  )} 
                                  title="Envio"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge variant={statusConfig.variant}>
                                {statusConfig.label}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {fatura.numero_nf || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {canContinue && (
                                  <Button 
                                    size="sm" 
                                    className="gap-1 bg-success hover:bg-success/90"
                                    onClick={() => handleContinuarFatura(fatura)}
                                  >
                                    <Play className="w-3 h-3" />
                                    Continuar
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleVerDetalhes(fatura)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      Ver Detalhes
                                    </DropdownMenuItem>
                                    {!isPaidOrCancelled && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleMarcarPago(fatura)}>
                                          <Check className="w-4 h-4 mr-2" />
                                          Marcar como Pago
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => handleCancelarFatura(fatura)}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Ban className="w-4 h-4 mr-2" />
                                          Cancelar Fatura
                                        </DropdownMenuItem>
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
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal de Faturamento */}
        <FaturamentoModal
          open={faturamentoModalOpen}
          onOpenChange={handleModalClose}
          dados={wizardDados}
          faturaExistente={faturaParaContinuar}
          onComplete={handleFaturamentoConcluido}
        />

        {/* Modal de Detalhes */}
        <DetalhesFaturaModal
          open={detalhesModalOpen}
          onOpenChange={setDetalhesModalOpen}
          fatura={faturaDetalhes}
        />

        {/* Modal de Visualização de Itens */}
        <VisualizarItensModal
          open={visualizarItensOpen}
          onOpenChange={setVisualizarItensOpen}
          lancamento={lancamentoSelecionado}
          itens={itensLancamentoSelecionado}
          isLoading={isLoadingItensLancamento}
        />

        {/* Modal de Edição de Lançamento */}
        <EditarLancamentoModal
          open={editarLancamentoOpen}
          onOpenChange={setEditarLancamentoOpen}
          lancamento={lancamentoSelecionado}
          itens={itensLancamentoSelecionado}
          onSave={handleSalvarLancamento}
          isSaving={isSaving}
        />

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
                {lancamentoParaExcluir && (
                  <span className="block mt-2 font-medium">
                    Cliente: {lancamentoParaExcluir.cliente?.razao_social} - {formatCurrency(Number(lancamentoParaExcluir.valor_total))}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleExcluirLancamento}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

// React import needed for Fragment
import React from "react";

export default Faturamento;
