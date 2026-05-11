import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User, Eye, Edit, Trash2, Package, Loader2, Play, X, ChevronDown, ChevronRight, Calendar, CalendarDays, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import {
  useLancamentosPendentes, useLancamentosComItens, useItensLancamento,
  type Lancamento as LancamentoType, type ItemLancamento,
} from "@/hooks/useLancamentos";
import { FaturamentoModal, type DadosFaturamento, type LancamentoItem as FaturaLancamentoItem } from "@/components/faturamento/FaturamentoModal";
import { VisualizarItensModal } from "@/components/faturamento/VisualizarItensModal";
import { EditarLancamentoModal } from "@/components/faturamento/EditarLancamentoModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDadosFaturamentoCompletos } from "@/hooks/useDadosFaturamento";
import { cn } from "@/lib/utils";

const etapaConfig: Record<string, { label: string; className: string }> = {
  em_processo: { label: "Em Processo", className: "bg-destructive/10 text-destructive border-destructive/30" },
  prateleira: { label: "Prateleira", className: "bg-warning/10 text-warning border-warning/30" },
  entregue: { label: "Entregue", className: "bg-success/10 text-success border-success/30" },
};

type CicloKey = "quinzenal" | "mensal" | "outro";

const cicloConfig: Record<CicloKey, { label: string; icon: React.ComponentType<{ className?: string }>; headerClass: string; iconClass: string }> = {
  quinzenal: { label: "Fechamento Quinzenal", icon: CalendarDays, headerClass: "bg-info/10 border-info/30", iconClass: "text-info" },
  mensal: { label: "Fechamento Mensal", icon: Calendar, headerClass: "bg-primary/10 border-primary/30", iconClass: "text-primary" },
  outro: { label: "Avulso / Outros", headerClass: "bg-muted border-border", icon: CalendarClock, iconClass: "text-muted-foreground" },
};

const getPaymentStatus = (lancamento: LancamentoType) => {
  if (lancamento.status === "faturado" && lancamento.fatura_id) {
    return { label: "Faturado", className: "text-warning" };
  }
  return { label: "Pendente", className: "text-destructive" };
};

export function PendentesTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteFiltroId = searchParams.get("cliente");

  const [selectedLancamentos, setSelectedLancamentos] = useState<string[]>([]);
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);
  const [wizardDados, setWizardDados] = useState<DadosFaturamento | null>(null);
  const [visualizarItensOpen, setVisualizarItensOpen] = useState(false);
  const [editarLancamentoOpen, setEditarLancamentoOpen] = useState(false);
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<LancamentoType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<LancamentoType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedBlocos, setCollapsedBlocos] = useState<Record<CicloKey, boolean>>({ quinzenal: false, mensal: false, outro: false });

  const { lancamentos: lancamentosPendentes, isLoading, updateLancamento, deleteLancamento } = useLancamentosPendentes();
  const { data: lancamentosComItens } = useLancamentosComItens(selectedLancamentos);
  const { data: itensLancamentoSelecionado = [], isLoading: isLoadingItensLancamento } = useItensLancamento(lancamentoSelecionado?.id || null);

  const handleEtapaChange = async (lancamentoId: string, novaEtapa: string) => {
    try {
      await supabase.from("lancamentos").update({ etapa: novaEtapa }).eq("id", lancamentoId);
      updateLancamento.mutate({ id: lancamentoId });
      toast.success(`Etapa atualizada para ${etapaConfig[novaEtapa]?.label || novaEtapa}`);
    } catch (error: any) {
      toast.error("Erro ao atualizar etapa");
    }
  };

  const lancamentosFiltrados = useMemo(() => {
    const industrialOnly = lancamentosPendentes.filter(l => l.cliente?.classificacao === "industrial");
    if (!clienteFiltroId) return industrialOnly;
    return industrialOnly.filter(l => l.cliente_id === clienteFiltroId);
  }, [lancamentosPendentes, clienteFiltroId]);

  // Buscar tipo_faturamento dos clientes envolvidos
  const clienteIds = useMemo(() => Array.from(new Set(lancamentosFiltrados.map(l => l.cliente_id))), [lancamentosFiltrados]);

  const { data: tipoFaturamentoMap = {} } = useQuery({
    queryKey: ["tipo_faturamento_clientes", clienteIds],
    queryFn: async () => {
      if (clienteIds.length === 0) return {};
      const { data, error } = await supabase
        .from("configuracoes_pagamento_cliente")
        .select("cliente_id, tipo_faturamento")
        .in("cliente_id", clienteIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => { map[row.cliente_id] = row.tipo_faturamento || "mensal"; });
      return map;
    },
    enabled: clienteIds.length > 0,
  });

  const getCiclo = (clienteId: string): CicloKey => {
    const tipo = tipoFaturamentoMap[clienteId] || "mensal";
    if (tipo === "quinzenal") return "quinzenal";
    return "outro";
  };

  const clienteFiltroInfo = useMemo(() => {
    if (!clienteFiltroId || lancamentosFiltrados.length === 0) return null;
    return lancamentosFiltrados[0]?.cliente;
  }, [clienteFiltroId, lancamentosFiltrados]);

  useEffect(() => {
    if (clienteFiltroId && lancamentosFiltrados.length > 0 && !isLoading) {
      setSelectedLancamentos(lancamentosFiltrados.map(l => l.id));
    }
  }, [clienteFiltroId, lancamentosFiltrados, isLoading]);

  const handleClearFilter = () => {
    const p = new URLSearchParams(searchParams);
    p.delete("cliente");
    setSearchParams(p);
    setSelectedLancamentos([]);
  };

  // Agrupa: ciclo -> clienteId -> lancamentos[]
  const lancamentosPorBloco = useMemo(() => {
    const blocos: Record<CicloKey, Record<string, LancamentoType[]>> = { quinzenal: {}, mensal: {}, outro: {} };
    lancamentosFiltrados.forEach(l => {
      const ciclo = getCiclo(l.cliente_id);
      if (!blocos[ciclo][l.cliente_id]) blocos[ciclo][l.cliente_id] = [];
      blocos[ciclo][l.cliente_id].push(l);
    });
    return blocos;
  }, [lancamentosFiltrados, tipoFaturamentoMap]);

  const handleToggleLancamento = (id: string) => {
    setSelectedLancamentos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleAllFromCliente = (clienteId: string, ids: string[]) => {
    const allSelected = ids.every(id => selectedLancamentos.includes(id));
    if (allSelected) setSelectedLancamentos(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedLancamentos(prev => [...new Set([...prev, ...ids])]);
  };

  const totalSelecionado = useMemo(() => {
    return lancamentosFiltrados.filter(l => selectedLancamentos.includes(l.id)).reduce((s, l) => s + Number(l.valor_total), 0);
  }, [lancamentosFiltrados, selectedLancamentos]);

  const clienteSelecionadoFaturamento = useMemo(() => {
    if (selectedLancamentos.length === 0) return null;
    const first = lancamentosFiltrados.find(l => selectedLancamentos.includes(l.id));
    if (!first) return null;
    const allSame = lancamentosFiltrados.filter(l => selectedLancamentos.includes(l.id)).every(l => l.cliente_id === first.cliente_id);
    if (!allSame) return null;
    return first.cliente;
  }, [lancamentosFiltrados, selectedLancamentos]);

  const { dados: dadosClienteCompletos } = useDadosFaturamentoCompletos(
    clienteSelecionadoFaturamento?.id || null
  );

  const dadosFaturamento: DadosFaturamento | null = useMemo(() => {
    if (!clienteSelecionadoFaturamento || !lancamentosComItens || lancamentosComItens.length === 0) return null;
    const allItens = lancamentosComItens.flatMap(l =>
      (l.itens || []).map(item => ({
        id: item.id, produto: item.produto_nome, quantidade: Number(item.quantidade),
        unidade: item.unidade, valorUnitario: Number(item.preco_unitario), valorTotal: Number(item.subtotal),
      }))
    );
    const datas = lancamentosComItens.map(l => new Date(l.data_lancamento));
    const pInicio = datas.length > 0 ? format(Math.min(...datas.map(d => d.getTime())), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    const pFim = datas.length > 0 ? format(Math.max(...datas.map(d => d.getTime())), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    const cli = dadosClienteCompletos.cliente;

    return {
      clienteId: clienteSelecionadoFaturamento.id,
      clienteNome: clienteSelecionadoFaturamento.razao_social,
      clienteDocumento: clienteSelecionadoFaturamento.cpf_cnpj || "",
      clienteEmail: cli?.email || clienteSelecionadoFaturamento.email || null,
      clienteTelefone: cli?.telefone || clienteSelecionadoFaturamento.telefone || null,
      clienteTipoPessoa: cli?.tipo_pessoa || "cnpj",
      clienteInscricaoMunicipal: cli?.inscricao_municipal || null,
      clienteInscricaoEstadual: cli?.inscricao_estadual || null,
      clienteRegimeTributario: cli?.regime_tributario || null,
      clienteClassificacao: cli?.classificacao || "industrial",
      clienteEndereco: dadosClienteCompletos.endereco || null,
      configPagamento: dadosClienteCompletos.configPagamento || null,
      configCliente: dadosClienteCompletos.configCliente || null,
      itens: allItens,
      valorTotal: totalSelecionado,
      periodoInicio: pInicio,
      periodoFim: pFim,
      lancamentoIds: selectedLancamentos,
    };
  }, [clienteSelecionadoFaturamento, lancamentosComItens, totalSelecionado, selectedLancamentos, dadosClienteCompletos]);

  const handleGerarFatura = () => {
    if (!clienteSelecionadoFaturamento || selectedLancamentos.length === 0) return;
    if (!dadosFaturamento || dadosFaturamento.itens.length === 0) {
      toast.error("Aguarde, carregando itens dos lançamentos...");
      return;
    }
    setWizardDados({ ...dadosFaturamento });
    setFaturamentoModalOpen(true);
  };

  const handleFaturamentoConcluido = () => {
    setSelectedLancamentos([]);
    setWizardDados(null);
    setFaturamentoModalOpen(false);
  };

  const handleSalvarLancamento = async (
    lancamentoId: string,
    data: { observacao: string | null; data_lancamento: string; valor_total: number },
    itensAtualizados: ItemLancamento[], itensRemovidos: string[],
    itensNovos: Omit<ItemLancamento, 'id' | 'created_at'>[]
  ) => {
    setIsSaving(true);
    try {
      updateLancamento.mutate({ id: lancamentoId, observacao: data.observacao, data_lancamento: data.data_lancamento, valor_total: data.valor_total });
      for (const id of itensRemovidos) await supabase.from("itens_lancamento").delete().eq("id", id);
      for (const item of itensAtualizados) await supabase.from("itens_lancamento").update({ quantidade: item.quantidade, preco_unitario: item.preco_unitario, subtotal: item.subtotal }).eq("id", item.id);
      for (const item of itensNovos) await supabase.from("itens_lancamento").insert({ lancamento_id: item.lancamento_id, produto_nome: item.produto_nome, quantidade: item.quantidade, unidade: item.unidade, preco_unitario: item.preco_unitario, subtotal: item.subtotal });
      toast.success("Lançamento atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
      throw error;
    } finally { setIsSaving(false); }
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const renderBloco = (ciclo: CicloKey) => {
    const grupo = lancamentosPorBloco[ciclo];
    const clientesNoBloco = Object.entries(grupo);
    if (clientesNoBloco.length === 0) return null;
    const cfg = cicloConfig[ciclo];
    const Icon = cfg.icon;
    const collapsed = collapsedBlocos[ciclo];
    const totalLancs = clientesNoBloco.reduce((s, [, ls]) => s + ls.length, 0);
    const totalValor = clientesNoBloco.reduce((s, [, ls]) => s + ls.reduce((a, l) => a + Number(l.valor_total), 0), 0);

    return (
      <Card key={ciclo} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setCollapsedBlocos(prev => ({ ...prev, [ciclo]: !prev[ciclo] }))}
          className={cn("w-full flex items-center gap-3 p-3 border-b transition-colors hover:opacity-90", cfg.headerClass)}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <Icon className={cn("w-5 h-5", cfg.iconClass)} />
          <span className="font-semibold uppercase text-sm tracking-wide">{cfg.label}</span>
          <Badge variant="secondary" className="ml-2">{clientesNoBloco.length} cliente{clientesNoBloco.length > 1 ? "s" : ""}</Badge>
          <Badge variant="secondary">{totalLancs} ROL{totalLancs > 1 ? "s" : ""}</Badge>
          <span className={cn("ml-auto font-bold", cfg.iconClass)}>{formatCurrency(totalValor)}</span>
        </button>
        {!collapsed && (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-semibold">ROL</TableHead>
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold">ENTRADA</TableHead>
                <TableHead className="font-semibold">ENTREGA</TableHead>
                <TableHead className="font-semibold">ETAPA</TableHead>
                <TableHead className="font-semibold">PAGAMENTO</TableHead>
                <TableHead className="font-semibold">VALOR</TableHead>
                <TableHead className="font-semibold w-24">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesNoBloco.map(([clienteId, clienteLancamentos]) => {
                const cliente = clienteLancamentos[0]?.cliente;
                const ids = clienteLancamentos.map(l => l.id);
                const allSelected = ids.every(id => selectedLancamentos.includes(id));
                const someSelected = ids.some(id => selectedLancamentos.includes(id));
                return (
                  <React.Fragment key={clienteId}>
                    <TableRow className="bg-muted/30 hover:bg-muted/40">
                      <TableCell className="py-2">
                        <Checkbox checked={allSelected} onCheckedChange={() => handleToggleAllFromCliente(clienteId, ids)} className={someSelected && !allSelected ? "opacity-50" : ""} />
                      </TableCell>
                      <TableCell colSpan={8} className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cliente?.razao_social || "Cliente"}</span>
                          <span className="text-xs text-muted-foreground">({clienteLancamentos.length} lançamento{clienteLancamentos.length > 1 ? "s" : ""})</span>
                          <span className="text-sm font-medium text-primary ml-auto">{formatCurrency(clienteLancamentos.reduce((s, l) => s + Number(l.valor_total), 0))}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {clienteLancamentos.map(lancamento => (
                      <TableRow key={lancamento.id} className={`hover:bg-muted/20 ${selectedLancamentos.includes(lancamento.id) ? "bg-primary/5" : ""}`}>
                        <TableCell className="pl-8"><Checkbox checked={selectedLancamentos.includes(lancamento.id)} onCheckedChange={() => handleToggleLancamento(lancamento.id)} /></TableCell>
                        <TableCell>
                          {(() => {
                            const etapa = lancamento.etapa || "em_processo";
                            const config = etapaConfig[etapa] || etapaConfig.em_processo;
                            return <Badge variant="outline" className={`font-mono text-xs border ${config.className}`}>{lancamento.numero_rol || "-"}</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{cliente?.nome_fantasia || "-"}</TableCell>
                        <TableCell className="text-sm">{format(new Date(lancamento.data_lancamento), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-sm">{lancamento.data_entrega ? format(new Date(lancamento.data_entrega), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Select value={lancamento.etapa || "em_processo"} onValueChange={(v) => handleEtapaChange(lancamento.id, v)}>
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="em_processo"><span className="text-destructive">🔴 Em Processo</span></SelectItem>
                              <SelectItem value="prateleira"><span className="text-warning">🟡 Prateleira</span></SelectItem>
                              <SelectItem value="entregue"><span className="text-success">🟢 Entregue</span></SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const payment = getPaymentStatus(lancamento);
                            return <span className={`text-xs font-medium ${payment.className}`}>{payment.label}</span>;
                          })()}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(Number(lancamento.valor_total))}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setLancamentoSelecionado(lancamento); setVisualizarItensOpen(true); }} title="Ver itens"><Eye className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setLancamentoSelecionado(lancamento); setEditarLancamentoOpen(true); }} title="Editar"><Edit className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setLancamentoParaExcluir(lancamento); setDeleteConfirmOpen(true); }} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
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
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {clienteFiltroId && (
        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Filtrando por cliente</p>
                <p className="font-semibold">{clienteFiltroInfo?.razao_social || "Cliente"}</p>
              </div>
              <Badge variant="secondary" className="ml-2">{lancamentosFiltrados.length} lançamento(s) pendente(s)</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearFilter} className="gap-2"><X className="w-4 h-4" />Limpar filtro</Button>
          </div>
        </Card>
      )}

      {selectedLancamentos.length > 0 && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div><p className="text-sm text-muted-foreground">Selecionados</p><p className="font-bold text-lg">{selectedLancamentos.length} lançamento(s)</p></div>
              <div><p className="text-sm text-muted-foreground">Valor Total</p><p className="font-bold text-primary">{formatCurrency(totalSelecionado)}</p></div>
              {clienteSelecionadoFaturamento && <div><p className="text-sm text-muted-foreground">Cliente</p><p className="font-medium">{clienteSelecionadoFaturamento.razao_social}</p></div>}
            </div>
            <Button onClick={handleGerarFatura} disabled={!clienteSelecionadoFaturamento} className="gap-2 bg-success hover:bg-success/90"><Play className="w-4 h-4" />Gerar Fatura</Button>
          </div>
          {!clienteSelecionadoFaturamento && selectedLancamentos.length > 0 && (
            <p className="text-sm text-destructive mt-2">Selecione lançamentos de um único cliente para gerar a fatura</p>
          )}
        </Card>
      )}

      {isLoading ? (
        <div className="bg-card border rounded-lg flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : lancamentosFiltrados.length === 0 ? (
        <div className="bg-card border rounded-lg flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mb-4 opacity-50" />
          <p>Nenhum lançamento pendente</p>
          <p className="text-sm">{clienteFiltroId ? "Este cliente não possui lançamentos pendentes" : "Os lançamentos finalizados aparecem aqui"}</p>
          {clienteFiltroId && <Button variant="link" onClick={handleClearFilter} className="mt-2">Ver todos os clientes</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {renderBloco("quinzenal")}
          {renderBloco("mensal")}
          {renderBloco("outro")}
        </div>
      )}

      {/* Modals */}
      <FaturamentoModal open={faturamentoModalOpen} onOpenChange={(open) => { if (!open) setWizardDados(null); setFaturamentoModalOpen(open); }} dados={wizardDados} onComplete={handleFaturamentoConcluido} faturaExistente={null} />
      <VisualizarItensModal open={visualizarItensOpen} onOpenChange={setVisualizarItensOpen} lancamento={lancamentoSelecionado} itens={itensLancamentoSelecionado} isLoading={isLoadingItensLancamento} />
      <EditarLancamentoModal open={editarLancamentoOpen} onOpenChange={setEditarLancamentoOpen} lancamento={lancamentoSelecionado} itens={itensLancamentoSelecionado} onSave={handleSalvarLancamento} isSaving={isSaving} />
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (lancamentoParaExcluir) { deleteLancamento.mutate(lancamentoParaExcluir.id); setDeleteConfirmOpen(false); setLancamentoParaExcluir(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
