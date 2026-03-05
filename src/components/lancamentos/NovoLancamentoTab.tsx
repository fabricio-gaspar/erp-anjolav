import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ShoppingCart,
  Check,
  User,
  Trash2,
  FileText,
  Printer,
  Loader2,
  ChevronsUpDown,
  AlertCircle,
  Scale,
} from "lucide-react";
import { format } from "date-fns";
import { usePrintLancamento, type LancamentosPrintData } from "@/hooks/usePrintOS";
import { useClientes } from "@/hooks/useClientes";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useLancamentos, useCreateItemLancamento } from "@/hooks/useLancamentos";
import { toast } from "sonner";

interface LancamentoItem {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

interface NovoLancamentoTabProps {
  onNavigateTab: (tab: string) => void;
}

export function NovoLancamentoTab({ onNavigateTab }: NovoLancamentoTabProps) {
  const [items, setItems] = useState<LancamentoItem[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(null);
  const [produtoSearchOpen, setProdutoSearchOpen] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [modoMetragem, setModoMetragem] = useState<"direto" | "dimensoes">("direto");
  const [metragemDireta, setMetragemDireta] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [largura, setLargura] = useState("");
  const [dataEmissao, setDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataEntrega, setDataEntrega] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observacao, setObservacao] = useState("");
  const [isFinalizando, setIsFinalizando] = useState(false);

  const { clientes, isLoading: isLoadingClientes } = useClientes();
  const { precos: precosEspeciais } = usePrecosEspeciais(selectedClienteId);
  const { printROLFromData, printEtiquetaFromData, isLoading: isPrinting } = usePrintLancamento();
  const { createLancamento } = useLancamentos();
  const createItemLancamento = useCreateItemLancamento();

  const totalValue = items.reduce((sum, item) => sum + item.valorTotal, 0);

  const clienteSelecionado = useMemo(() => {
    if (!selectedClienteId) return null;
    const cliente = clientes.find(c => c.id === selectedClienteId);
    if (!cliente) return null;
    return { nome: cliente.razao_social, documento: cliente.cpf_cnpj || "", telefone: cliente.telefone || "" };
  }, [selectedClienteId, clientes]);

  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch) return clientes.slice(0, 20);
    const s = clienteSearch.toLowerCase();
    return clientes.filter(c =>
      c.razao_social.toLowerCase().includes(s) ||
      c.nome_fantasia?.toLowerCase().includes(s) ||
      c.cpf_cnpj?.includes(clienteSearch) ||
      c.telefone?.includes(clienteSearch)
    ).slice(0, 20);
  }, [clientes, clienteSearch]);

  const produtosDoCliente = useMemo(() => {
    return precosEspeciais.map((pe: any) => ({
      id: pe.produto_id,
      nome: pe.produto?.nome || "Produto",
      unidade: pe.produto?.unidade || "un",
      precoEspecial: pe.preco_especial,
      precoPadrao: pe.produto?.preco || 0,
      tipo: pe.tipo,
    }));
  }, [precosEspeciais]);

  const produtoSelecionado = useMemo(() => {
    if (!selectedProdutoId) return null;
    return produtosDoCliente.find(p => p.id === selectedProdutoId) || null;
  }, [selectedProdutoId, produtosDoCliente]);

  const resetMetragem = () => { setModoMetragem("direto"); setMetragemDireta(""); setComprimento(""); setLargura(""); };

  useEffect(() => { setItems([]); setSelectedProdutoId(null); setQuantidade(1); resetMetragem(); }, [selectedClienteId]);

  const isUnidadeMetro = (unidade: string | null | undefined): boolean => {
    if (!unidade) return false;
    const u = unidade.toLowerCase();
    return u === "m" || u === "m²" || u === "m2" || u === "metro" || u === "metros" || u.includes("metro");
  };

  const metragemCalculada = useMemo(() => {
    if (modoMetragem === "direto") return parseFloat(metragemDireta) || 0;
    return (parseFloat(comprimento) || 0) * (parseFloat(largura) || 0);
  }, [modoMetragem, metragemDireta, comprimento, largura]);

  const handleAdicionarItem = () => {
    if (!produtoSelecionado) return;
    const usaMetro = isUnidadeMetro(produtoSelecionado.unidade);
    const qtd = usaMetro ? metragemCalculada : quantidade;
    if (qtd <= 0) return;
    let descricao = produtoSelecionado.nome;
    if (usaMetro && modoMetragem === "dimensoes" && comprimento && largura) {
      descricao = `${produtoSelecionado.nome} (${comprimento}m × ${largura}m)`;
    }
    setItems([...items, {
      id: crypto.randomUUID(), produto: descricao, quantidade: qtd,
      unidade: produtoSelecionado.unidade, valorUnitario: produtoSelecionado.precoEspecial,
      valorTotal: produtoSelecionado.precoEspecial * qtd,
    }]);
    setSelectedProdutoId(null); setQuantidade(1); resetMetragem();
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };

  const handlePrint = async (type: "rol" | "etiqueta") => {
    if (!clienteSelecionado || items.length === 0) return;
    const data: LancamentosPrintData = {
      clienteNome: clienteSelecionado.nome, clienteTelefone: clienteSelecionado.telefone,
      itens: items.map(i => ({ nome: i.produto, quantidade: i.quantidade, precoUnitario: i.valorUnitario, subtotal: i.valorTotal })),
      valorTotal: totalValue, dataEmissao: new Date(dataEmissao),
      previsaoEntrega: dataEntrega ? new Date(dataEntrega) : undefined,
      observacoes: observacao || undefined,
    };
    if (type === "rol") await printROLFromData(data);
    else await printEtiquetaFromData(data, items.length);
  };

  const handleFinalizar = async () => {
    if (!clienteSelecionado || items.length === 0 || !selectedClienteId) return;
    setIsFinalizando(true);
    try {
      const lancamento = await createLancamento.mutateAsync({
        cliente_id: selectedClienteId, data_lancamento: dataEmissao,
        data_entrega: dataEntrega || null, observacao: observacao || null,
        valor_total: totalValue, status: "pendente",
      });
      for (const item of items) {
        await createItemLancamento.mutateAsync({
          lancamento_id: lancamento.id, produto_nome: item.produto,
          quantidade: item.quantidade, unidade: item.unidade,
          preco_unitario: item.valorUnitario, subtotal: item.valorTotal,
        });
      }
      setItems([]); setSelectedClienteId(null); setObservacao("");
      toast.success("Lançamento registrado com sucesso!", {
        description: "Veja na aba 'Pendentes' para processar a cobrança.",
        action: { label: "Ver Pendentes", onClick: () => onNavigateTab("pendentes") },
      });
    } catch (error) {
      console.error("Erro ao finalizar lançamento:", error);
      toast.error("Erro ao finalizar lançamento");
    } finally { setIsFinalizando(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel - Form */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Novo Lançamento</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground">Data de Emissão</Label>
            <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm font-medium text-foreground">Data de Entrega</Label>
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label className="text-sm font-medium text-foreground">Observação / Informação</Label>
            <Input placeholder="Ex: Entregar até sexta, Roupa de cama extra..." className="mt-1.5" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          {/* Cliente */}
          <div>
            <Label className="text-sm font-medium text-foreground">Cliente</Label>
            <Popover open={clienteSearchOpen} onOpenChange={setClienteSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={clienteSearchOpen} className="w-full justify-between mt-1.5 h-auto min-h-[42px] py-2">
                  {clienteSelecionado ? (
                    <div className="text-left">
                      <p className="font-medium text-foreground">{clienteSelecionado.nome}</p>
                      <p className="text-xs text-muted-foreground">{clienteSelecionado.documento && `${clienteSelecionado.documento} • `}{clienteSelecionado.telefone}</p>
                    </div>
                  ) : (<span className="text-muted-foreground">Buscar por nome, CNPJ, telefone...</span>)}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." value={clienteSearch} onValueChange={setClienteSearch} />
                  <CommandList>
                    {isLoadingClientes ? (
                      <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : (
                      <>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clientesFiltrados.map((cliente) => (
                            <CommandItem key={cliente.id} value={cliente.id} onSelect={() => { setSelectedClienteId(cliente.id); setClienteSearchOpen(false); setClienteSearch(""); }}>
                              <div className="flex flex-col">
                                <span className="font-medium">{cliente.razao_social}</span>
                                <span className="text-xs text-muted-foreground">{cliente.cpf_cnpj && `${cliente.cpf_cnpj} • `}{cliente.telefone || "Sem telefone"}</span>
                              </div>
                              {selectedClienteId === cliente.id && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {/* Produto/Serviço */}
          <div>
            <Label className="text-sm font-medium text-foreground">Produto/Serviço</Label>
            {!selectedClienteId ? (
              <div className="flex items-center gap-2 mt-1.5 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />Selecione um cliente primeiro
              </div>
            ) : produtosDoCliente.length === 0 ? (
              <div className="flex items-center gap-2 mt-1.5 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />Nenhum produto cadastrado para este cliente
              </div>
            ) : (
              <Popover open={produtoSearchOpen} onOpenChange={setProdutoSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between mt-1.5 h-auto min-h-[42px] py-2">
                    {produtoSelecionado ? (
                      <div className="text-left">
                        <p className="font-medium text-foreground">{produtoSelecionado.nome}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(produtoSelecionado.precoEspecial)} / {produtoSelecionado.unidade}</p>
                      </div>
                    ) : (<span className="text-muted-foreground">Selecione um produto...</span>)}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar produto..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {produtosDoCliente.map((produto) => (
                          <CommandItem key={produto.id} value={produto.id} onSelect={() => { setSelectedProdutoId(produto.id); setProdutoSearchOpen(false); }}>
                            <div className="flex flex-col flex-1">
                              <span className="font-medium">{produto.nome}</span>
                              <span className="text-xs text-muted-foreground">{formatCurrency(produto.precoEspecial)} / {produto.unidade}</span>
                            </div>
                            {selectedProdutoId === produto.id && <Check className="ml-auto h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {/* Quantidade / Metragem */}
          {produtoSelecionado && isUnidadeMetro(produtoSelecionado.unidade) ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary" />Metragem ({produtoSelecionado.unidade})
                </Label>
                <div className="flex rounded-md border bg-muted/30">
                  <button type="button" onClick={() => setModoMetragem("direto")} className={`px-3 py-1 text-xs font-medium rounded-l-md transition-colors ${modoMetragem === "direto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Direto</button>
                  <button type="button" onClick={() => setModoMetragem("dimensoes")} className={`px-3 py-1 text-xs font-medium rounded-r-md transition-colors ${modoMetragem === "dimensoes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Dimensões</button>
                </div>
              </div>
              {modoMetragem === "direto" ? (
                <div>
                  <Input type="number" step="0.01" placeholder="Ex: 12.50" value={metragemDireta} onChange={(e) => setMetragemDireta(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Informe a metragem total em {produtoSelecionado.unidade}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Comprimento (m)</Label><Input type="number" step="0.01" placeholder="Ex: 2.50" value={comprimento} onChange={(e) => setComprimento(e.target.value)} className="mt-1" /></div>
                  <div><Label className="text-xs text-muted-foreground">Largura (m)</Label><Input type="number" step="0.01" placeholder="Ex: 1.80" value={largura} onChange={(e) => setLargura(e.target.value)} className="mt-1" /></div>
                </div>
              )}
              {metragemCalculada > 0 && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {modoMetragem === "dimensoes" ? `${comprimento}m × ${largura}m = ` : "Total: "}
                      <span className="font-medium text-foreground">{metragemCalculada.toFixed(2)} {produtoSelecionado.unidade}</span>
                    </span>
                    <span className="font-semibold text-primary">{formatCurrency(produtoSelecionado.precoEspecial * metragemCalculada)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <Label className="text-sm font-medium text-foreground">Quantidade ({produtoSelecionado?.unidade || "un"})</Label>
              <Input type="number" placeholder="0" className="mt-1.5" min={1} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} disabled={!produtoSelecionado} />
              {produtoSelecionado && quantidade > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Subtotal: <span className="font-medium text-foreground">{formatCurrency(produtoSelecionado.precoEspecial * quantidade)}</span></p>
              )}
            </div>
          )}
          <Button className="w-full gap-2 mt-2" onClick={handleAdicionarItem} disabled={!produtoSelecionado || (isUnidadeMetro(produtoSelecionado?.unidade) ? metragemCalculada <= 0 : quantidade <= 0)}>
            <Plus className="w-4 h-4" />Adicionar Item
          </Button>
        </div>
      </Card>

      {/* Right Panel - Items */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /><h2 className="font-semibold text-lg">Itens do Lançamento</h2></div>
          {items.length > 0 && <Badge variant="secondary" className="bg-primary/10 text-primary">{items.length} item</Badge>}
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-50" /><p className="text-sm">Selecione um cliente para começar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clienteSelecionado && (
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{clienteSelecionado.nome}</span></div>
                <span className="text-sm text-muted-foreground">{formatDate(dataEmissao)}</span>
              </div>
            )}
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-semibold text-foreground">{item.produto}</p>
                    <p className="text-sm text-muted-foreground">{item.quantidade} {item.unidade} × {formatCurrency(item.valorUnitario)} = <span className="font-medium text-foreground">{formatCurrency(item.valorTotal)}</span></p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setItems(items.filter(i => i.id !== item.id))}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="font-medium">Total:</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(totalValue)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-4">
              <Button variant="outline" className="gap-2" onClick={() => handlePrint("rol")} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}Imprimir ROL
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => handlePrint("etiqueta")} disabled={isPrinting}>
                {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}Imprimir Etiqueta
              </Button>
            </div>
            <Button className="w-full gap-2 bg-success hover:bg-success/90" onClick={handleFinalizar} disabled={isFinalizando}>
              {isFinalizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Finalizar Lançamento
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
