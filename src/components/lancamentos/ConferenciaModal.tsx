import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Scale,
  Boxes,
  Calendar,
  User,
  Printer,
  Tag,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  ArrowRight,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useGerarLancamento, type OSConferencia, type ItemOS } from "@/hooks/useConferenciaProducao";
import { usePrintOS } from "@/hooks/usePrintOS";

interface ConferenciaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  os: OSConferencia | null;
  onUsarParaLancamento?: (clienteId: string, itens: ItemOS[]) => void;
}

interface ItemLancamento {
  id: string;
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

const etapaLabels: Record<string, string> = {
  retirada: "Retirada",
  em_lavagem: "Em Lavagem",
  finalizado: "Finalizado",
  pronto_entrega: "Pronto Entrega",
  entregue: "Entregue",
};

export function ConferenciaModal({ open, onOpenChange, os, onUsarParaLancamento }: ConferenciaModalProps) {
  const [itensLancamento, setItensLancamento] = useState<ItemLancamento[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [showLancamentoForm, setShowLancamentoForm] = useState(false);
  
  // Estado para edição de quantidades dos itens da OS
  const [quantidadesEditadas, setQuantidadesEditadas] = useState<Record<string, number>>({});

  const { precos: precosEspeciais, isLoading: isLoadingPrecos } = usePrecosEspeciais(os?.cliente?.id || null);
  const { mutate: gerarLancamento, isPending: isGerando } = useGerarLancamento();
  const { printROL, printEtiquetas, isLoading: isPrinting } = usePrintOS(os?.id);

  const produtosDoCliente = useMemo(() => {
    if (!precosEspeciais) return [];
    return precosEspeciais.map((pe) => ({
      id: pe.produto_id,
      nome: pe.produto?.nome || "Produto",
      unidade: pe.produto?.unidade || "un",
      precoEspecial: pe.preco_especial,
    }));
  }, [precosEspeciais]);

  const valorTotal = useMemo(() => {
    return itensLancamento.reduce((sum, item) => sum + item.subtotal, 0);
  }, [itensLancamento]);

  const handleAdicionarItem = () => {
    if (!produtoSelecionado || quantidade <= 0) return;

    const produto = produtosDoCliente.find((p) => p.id === produtoSelecionado);
    if (!produto) return;

    const novoItem: ItemLancamento = {
      id: crypto.randomUUID(),
      produto_id: produto.id,
      nome: produto.nome,
      quantidade: quantidade,
      preco_unitario: produto.precoEspecial,
      subtotal: produto.precoEspecial * quantidade,
    };

    setItensLancamento((prev) => [...prev, novoItem]);
    setProdutoSelecionado("");
    setQuantidade(1);
  };

  const handleRemoverItem = (id: string) => {
    setItensLancamento((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGerarLancamento = () => {
    if (!os || itensLancamento.length === 0) return;

    gerarLancamento(
      {
        ordemServicoId: os.id,
        itens: itensLancamento.map((item) => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
        })),
      },
      {
        onSuccess: () => {
          setShowLancamentoForm(false);
          setItensLancamento([]);
        },
      }
    );
  };

  const handlePrintROL = () => {
    if (os?.id) printROL(os.id);
  };

  const handlePrintEtiquetas = () => {
    if (os?.id) printEtiquetas(os.dadosProducao.quantidadeVolumes || 1, os.id);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!os) return null;

  const statusColors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    fluxo_completo: "bg-green-100 text-green-800",
    divergencia: "bg-red-100 text-red-800",
    lancado: "bg-blue-100 text-blue-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            Conferência OS {os.numero}
            <Badge className={statusColors[os.statusConferencia] || "bg-gray-100 text-gray-800"}>
              {os.statusConferencia === "pendente" && "Em Produção"}
              {os.statusConferencia === "fluxo_completo" && "Fluxo Completo"}
              {os.statusConferencia === "divergencia" && "Divergência"}
              {os.statusConferencia === "lancado" && "Lançado"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {/* Dados do Cliente e OS */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{os.cliente.razao_social}</span>
              </div>
              {os.cliente.cpf_cnpj && (
                <div className="text-sm text-muted-foreground pl-6">
                  {os.cliente.cpf_cnpj}
                </div>
              )}
              {os.cliente.telefone && (
                <div className="text-sm text-muted-foreground pl-6">
                  {os.cliente.telefone}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Retirada: {format(new Date(os.dataRetirada), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
              {os.dataPrevisaoEntrega && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Previsão: {format(new Date(os.dataPrevisaoEntrega), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Dados da Produção */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Dados Coletados na Produção
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Peças</div>
                <div className="text-xl font-bold">{os.dadosProducao.quantidadePecas || "-"}</div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Scale className="h-3 w-3" /> Peso Inicial
                </div>
                <div className="text-xl font-bold">
                  {os.dadosProducao.pesoTotal ? `${os.dadosProducao.pesoTotal} kg` : "-"}
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Scale className="h-3 w-3" /> Peso Final
                </div>
                <div className="text-xl font-bold">
                  {os.dadosProducao.pesoFinal ? `${os.dadosProducao.pesoFinal} kg` : "-"}
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Boxes className="h-3 w-3" /> Volumes
                </div>
                <div className="text-xl font-bold">{os.dadosProducao.quantidadeVolumes || "-"}</div>
              </div>
            </div>

            {/* Indicadores */}
            <div className="flex gap-4 mt-3">
              {os.dadosProducao.etiquetaAplicada && (
                <Badge variant="outline" className="gap-1">
                  <Tag className="h-3 w-3" /> Etiqueta Aplicada
                </Badge>
              )}
              {os.dadosProducao.conferenciaFinal && (
                <Badge variant="outline" className="gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" /> Conferência OK
                </Badge>
              )}
              {os.dadosProducao.itensDanificados && (
                <Badge variant="outline" className="gap-1 text-yellow-600">
                  <AlertTriangle className="h-3 w-3" /> Itens Danificados
                </Badge>
              )}
            </div>

            {/* Observações */}
            {(os.dadosProducao.observacoesSeparacao || os.dadosProducao.observacoesEmbalagem || os.observacoes) && (
              <div className="mt-4 space-y-2">
                {os.dadosProducao.observacoesSeparacao && (
                  <div className="text-sm">
                    <span className="font-medium">Obs. Separação:</span> {os.dadosProducao.observacoesSeparacao}
                  </div>
                )}
                {os.dadosProducao.observacoesEmbalagem && (
                  <div className="text-sm">
                    <span className="font-medium">Obs. Embalagem:</span> {os.dadosProducao.observacoesEmbalagem}
                  </div>
                )}
                {os.observacoes && (
                  <div className="text-sm">
                    <span className="font-medium">Obs. Gerais:</span> {os.observacoes}
                  </div>
                )}
              </div>
          )}
          </div>

          {/* Alerta quando não há itens detalhados mas tem quantidade de peças */}
          {(!os.itensOS || os.itensOS.length === 0) && os.dadosProducao.quantidadePecas > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Itens não detalhados na Separação</span>
              </div>
              <p className="text-sm text-amber-600 mt-1">
                Esta OS possui {os.dadosProducao.quantidadePecas} peças registradas, mas os itens 
                individuais não foram especificados na etapa de Separação. Use o formulário abaixo 
                para lançar os itens manualmente.
              </p>
            </div>
          )}

          {/* Itens Registrados na Separação */}
          {os.itensOS && os.itensOS.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Itens Registrados na Separação
                  </h3>
                  {os.statusConferencia !== "lancado" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Pencil className="h-3 w-3" />
                      Clique na quantidade para editar
                    </span>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {os.itensOS.map((item) => {
                      const qtdEditada = quantidadesEditadas[item.id] ?? item.quantidade;
                      const subtotalEditado = qtdEditada * item.preco_unitario;
                      const foiEditado = quantidadesEditadas[item.id] !== undefined && quantidadesEditadas[item.id] !== item.quantidade;
                      
                      return (
                        <TableRow key={item.id} className={foiEditado ? "bg-primary/5" : ""}>
                          <TableCell>{item.produto?.nome || "Produto"}</TableCell>
                          <TableCell className="text-center">
                            {os.statusConferencia !== "lancado" ? (
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={qtdEditada}
                                  onChange={(e) => {
                                    const novaQtd = Number(e.target.value);
                                    setQuantidadesEditadas(prev => ({
                                      ...prev,
                                      [item.id]: novaQtd
                                    }));
                                  }}
                                  className="w-20 h-8 text-center"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {item.produto?.unidade || "un"}
                                </span>
                              </div>
                            ) : (
                              <span>{item.quantidade} {item.produto?.unidade || "un"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.preco_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(subtotalEditado)}
                            {foiEditado && (
                              <span className="text-xs text-muted-foreground ml-1">
                                (era {formatCurrency(item.subtotal)})
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold">
                        Total:
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(
                          os.itensOS.reduce((sum, item) => {
                            const qtd = quantidadesEditadas[item.id] ?? item.quantidade;
                            return sum + (qtd * item.preco_unitario);
                          }, 0)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Botão para usar no lançamento - Apenas para Fluxo Completo */}
                {onUsarParaLancamento && os.statusConferencia === "fluxo_completo" && (
                  <Button 
                    variant="secondary" 
                    className="w-full mt-4 gap-2"
                    onClick={() => {
                      // Criar cópia dos itens com quantidades editadas
                      const itensAtualizados = os.itensOS.map(item => {
                        const qtdEditada = quantidadesEditadas[item.id] ?? item.quantidade;
                        return {
                          ...item,
                          quantidade: qtdEditada,
                          subtotal: qtdEditada * item.preco_unitario,
                        };
                      }).filter(item => item.quantidade > 0); // Remove itens zerados
                      
                      onUsarParaLancamento(os.cliente.id, itensAtualizados);
                      setQuantidadesEditadas({}); // Limpar edições
                      onOpenChange(false);
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Usar para Novo Lançamento
                  </Button>
                )}
              </div>
            </>
          )}

          <Separator className="my-4" />

          {/* Timeline do Histórico */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Timeline de Produção</h3>
            <div className="space-y-2">
              {os.historicoProducao.map((h, index) => (
                <div key={h.id} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-medium">{etapaLabels[h.etapa_nova] || h.etapa_nova}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(h.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  {h.observacoes && (
                    <span className="text-muted-foreground italic">- {h.observacoes}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Formulário de Lançamento */}
          {os.statusConferencia !== "lancado" && (
            <>
              <Separator className="my-4" />

              {!showLancamentoForm ? (
                <div className="text-center py-4">
                  <Button onClick={() => setShowLancamentoForm(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Gerar Lançamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold">Lançar Itens</h3>

                  {produtosDoCliente.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      <p>Este cliente não possui produtos na tabela de preços especiais.</p>
                      <p className="text-sm">Configure a tabela de preços no cadastro do cliente.</p>
                    </div>
                  ) : (
                    <>
                      {/* Adicionar Item */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Produto</Label>
                          <select
                            className="w-full h-10 px-3 border rounded-md bg-background"
                            value={produtoSelecionado}
                            onChange={(e) => setProdutoSelecionado(e.target.value)}
                          >
                            <option value="">Selecione um produto</option>
                            {produtosDoCliente.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome} - {formatCurrency(p.precoEspecial)}/{p.unidade}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            min={1}
                            value={quantidade}
                            onChange={(e) => setQuantidade(Number(e.target.value))}
                          />
                        </div>
                        <Button onClick={handleAdicionarItem} size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Lista de Itens */}
                      {itensLancamento.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-center">Qtd</TableHead>
                              <TableHead className="text-right">Unit.</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                              <TableHead className="w-10" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {itensLancamento.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.nome}</TableCell>
                                <TableCell className="text-center">{item.quantidade}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(item.preco_unitario)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(item.subtotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoverItem(item.id)}
                                    className="h-8 w-8 text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell colSpan={3} className="text-right font-bold">
                                Total:
                              </TableCell>
                              <TableCell className="text-right font-bold text-lg">
                                {formatCurrency(valorTotal)}
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Botões de Impressão (se já lançado) */}
          {os.statusConferencia === "lancado" && (
            <>
              <Separator className="my-4" />
              <div className="flex gap-3 justify-center py-4">
                <Button variant="outline" className="gap-2" onClick={handlePrintROL} disabled={isPrinting}>
                  <Printer className="h-4 w-4" />
                  Imprimir ROL
                </Button>
                <Button variant="outline" className="gap-2" onClick={handlePrintEtiquetas} disabled={isPrinting}>
                  <Tag className="h-4 w-4" />
                  Imprimir Etiquetas
                </Button>
              </div>
            </>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          {showLancamentoForm && itensLancamento.length > 0 && (
            <Button onClick={handleGerarLancamento} disabled={isGerando} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              {isGerando ? "Gerando..." : "Confirmar Lançamento"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
