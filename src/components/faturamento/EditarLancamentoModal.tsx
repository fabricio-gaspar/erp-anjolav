import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Save, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";
import { useProdutos } from "@/hooks/useProdutos";
import type { Lancamento, ItemLancamento } from "@/hooks/useLancamentos";

interface EditarLancamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  itens: ItemLancamento[];
  onSave: (lancamentoId: string, data: {
    observacao: string | null;
    data_lancamento: string;
    valor_total: number;
  }, itensAtualizados: ItemLancamento[], itensRemovidos: string[], itensNovos: Omit<ItemLancamento, 'id' | 'created_at'>[]) => Promise<void>;
  isSaving?: boolean;
}

interface ItemEditavel extends ItemLancamento {
  isNew?: boolean;
  isDeleted?: boolean;
}

export function EditarLancamentoModal({
  open,
  onOpenChange,
  lancamento,
  itens,
  onSave,
  isSaving,
}: EditarLancamentoModalProps) {
  const { produtos } = useProdutos();
  const [dataLancamento, setDataLancamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itensEditaveis, setItensEditaveis] = useState<ItemEditavel[]>([]);
  const [novoProdutoId, setNovoProdutoId] = useState<string>("");
  const [novaQuantidade, setNovaQuantidade] = useState<string>("1");

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  // Reset state when lancamento changes
  useEffect(() => {
    if (lancamento) {
      setDataLancamento(lancamento.data_lancamento);
      setObservacao(lancamento.observacao || "");
      setItensEditaveis(itens.map(item => ({ ...item, isNew: false, isDeleted: false })));
    }
  }, [lancamento, itens]);

  // Calculate total
  const valorTotal = useMemo(() => {
    return itensEditaveis
      .filter(item => !item.isDeleted)
      .reduce((sum, item) => sum + Number(item.subtotal), 0);
  }, [itensEditaveis]);

  const handleQuantidadeChange = (itemId: string, novaQtd: string) => {
    const qtd = parseFloat(novaQtd) || 0;
    setItensEditaveis(prev => prev.map(item => {
      if (item.id === itemId) {
        const subtotal = qtd * Number(item.preco_unitario);
        return { ...item, quantidade: qtd, subtotal };
      }
      return item;
    }));
  };

  const handlePrecoChange = (itemId: string, novoPreco: string) => {
    const preco = parseFloat(novoPreco) || 0;
    setItensEditaveis(prev => prev.map(item => {
      if (item.id === itemId) {
        const subtotal = Number(item.quantidade) * preco;
        return { ...item, preco_unitario: preco, subtotal };
      }
      return item;
    }));
  };

  const handleRemoverItem = (itemId: string) => {
    setItensEditaveis(prev => prev.map(item => {
      if (item.id === itemId) {
        if (item.isNew) {
          // Remove completely if it's a new item
          return null as unknown as ItemEditavel;
        }
        return { ...item, isDeleted: true };
      }
      return item;
    }).filter(Boolean));
  };

  const handleAdicionarItem = () => {
    if (!novoProdutoId) return;
    
    const produto = produtos.find(p => p.id === novoProdutoId);
    if (!produto) return;

    const quantidade = parseFloat(novaQuantidade) || 1;
    const preco = Number(produto.preco);
    const subtotal = quantidade * preco;

    const novoItem: ItemEditavel = {
      id: crypto.randomUUID(),
      lancamento_id: lancamento?.id || "",
      produto_nome: produto.nome,
      quantidade,
      unidade: produto.unidade || "un",
      preco_unitario: preco,
      subtotal,
      created_at: new Date().toISOString(),
      isNew: true,
      isDeleted: false,
    };

    setItensEditaveis(prev => [...prev, novoItem]);
    setNovoProdutoId("");
    setNovaQuantidade("1");
  };

  const handleSave = async () => {
    if (!lancamento) return;

    const itensParaAtualizar = itensEditaveis.filter(item => !item.isNew && !item.isDeleted);
    const itensParaRemover = itensEditaveis.filter(item => item.isDeleted && !item.isNew).map(item => item.id);
    const itensParaCriar = itensEditaveis
      .filter(item => item.isNew && !item.isDeleted)
      .map(({ id, created_at, isNew, isDeleted, ...rest }) => rest);

    try {
      await onSave(
        lancamento.id,
        {
          observacao: observacao || null,
          data_lancamento: dataLancamento,
          valor_total: valorTotal,
        },
        itensParaAtualizar,
        itensParaRemover,
        itensParaCriar
      );
      onOpenChange(false);
    } catch (error) {
      // Error handled in parent
    }
  };

  if (!lancamento) return null;

  const itensVisiveis = itensEditaveis.filter(item => !item.isDeleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-primary" />
            Editar Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cliente</Label>
              <Input 
                value={lancamento.cliente?.razao_social || "Cliente"} 
                disabled 
                className="mt-1.5 bg-muted/50"
              />
            </div>
            <div>
              <Label>Data do Lançamento</Label>
              <Input
                type="date"
                value={dataLancamento}
                onChange={(e) => setDataLancamento(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações do lançamento..."
              className="mt-1.5"
              rows={2}
            />
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <Label>Itens do Lançamento</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">PRODUTO</TableHead>
                    <TableHead className="font-semibold text-center w-24">QTD</TableHead>
                    <TableHead className="font-semibold text-center w-20">UNID</TableHead>
                    <TableHead className="font-semibold text-right w-32">UNIT.</TableHead>
                    <TableHead className="font-semibold text-right w-32">TOTAL</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensVisiveis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum item. Adicione produtos abaixo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itensVisiveis.map((item) => (
                      <TableRow key={item.id} className={item.isNew ? "bg-success/5" : ""}>
                        <TableCell className="font-medium">
                          {item.produto_nome}
                          {item.isNew && (
                            <Badge variant="outline" className="ml-2 text-xs text-success border-success">
                              Novo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={item.quantidade}
                            onChange={(e) => handleQuantidadeChange(item.id, e.target.value)}
                            className="h-8 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {item.unidade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.preco_unitario}
                            onChange={(e) => handlePrecoChange(item.id, e.target.value)}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.subtotal))}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoverItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Add Item Row */}
            <div className="flex gap-3 items-end p-3 bg-muted/30 rounded-lg">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Adicionar Produto</Label>
                <Select value={novoProdutoId} onValueChange={setNovoProdutoId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.filter(p => p.status === "ativo").map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.nome} - {formatCurrency(Number(produto.preco))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-xs text-muted-foreground">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={novaQuantidade}
                  onChange={(e) => setNovaQuantidade(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdicionarItem}
                disabled={!novoProdutoId}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="font-medium">Total do Lançamento</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(valorTotal)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || itensVisiveis.length === 0} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
