import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Loader2, Send } from "lucide-react";
import { useCreateLancamentoCliente } from "@/hooks/useLancamentoCliente";

interface Produto {
  id: string;
  nome: string;
  unidade: string | null;
}

interface ItemLancamento {
  id: string;
  produto_id: string;
  produto_nome: string;
  unidade: string;
  quantidade: number;
  observacoes: string;
}

interface LancarProdutosModalProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  produtos: Produto[];
}

export const LancarProdutosModal = ({
  open,
  onClose,
  clienteId,
  clienteNome,
  produtos,
}: LancarProdutosModalProps) => {
  const [itens, setItens] = useState<ItemLancamento[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [observacoesItem, setObservacoesItem] = useState<string>("");
  const [observacoesGerais, setObservacoesGerais] = useState<string>("");

  const createLancamento = useCreateLancamentoCliente();

  const handleAdicionarItem = () => {
    if (!produtoSelecionado || quantidade <= 0) return;

    const produto = produtos.find((p) => p.id === produtoSelecionado);
    if (!produto) return;

    const novoItem: ItemLancamento = {
      id: crypto.randomUUID(),
      produto_id: produto.id,
      produto_nome: produto.nome,
      unidade: produto.unidade || "un",
      quantidade,
      observacoes: observacoesItem,
    };

    setItens([...itens, novoItem]);
    setProdutoSelecionado("");
    setQuantidade(1);
    setObservacoesItem("");
  };

  const handleRemoverItem = (id: string) => {
    setItens(itens.filter((item) => item.id !== id));
  };

  const handleEnviarLancamento = async () => {
    if (itens.length === 0) return;

    await createLancamento.mutateAsync({
      cliente_id: clienteId,
      observacoes: observacoesGerais || undefined,
      itens: itens.map((item) => ({
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        observacoes: item.observacoes || undefined,
      })),
    });

    // Limpar e fechar
    setItens([]);
    setObservacoesGerais("");
    onClose();
  };

  const totalPecas = itens.reduce((acc, item) => acc + item.quantidade, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Lançar Produtos para Conferência
          </DialogTitle>
          <DialogDescription>
            Registre os produtos que você está enviando para a lavanderia.
            Nossa equipe fará a conferência na chegada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Formulário de adição */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
            <h4 className="font-medium text-sm">Adicionar Produto</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="produto">Produto</Label>
                <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                  <SelectTrigger id="produto">
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="obs-item">Observações do item (opcional)</Label>
              <Input
                id="obs-item"
                placeholder="Ex: manchas, avarias..."
                value={observacoesItem}
                onChange={(e) => setObservacoesItem(e.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleAdicionarItem}
              disabled={!produtoSelecionado || quantidade <= 0}
            >
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>

          {/* Lista de itens adicionados */}
          {itens.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Itens Adicionados</h4>
                <Badge variant="secondary">
                  {itens.length} {itens.length === 1 ? "item" : "itens"} • {totalPecas} peças
                </Badge>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-card border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.produto_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantidade} {item.unidade}
                        {item.observacoes && ` • ${item.observacoes}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoverItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observações gerais */}
          <div>
            <Label htmlFor="obs-gerais">Observações Gerais (opcional)</Label>
            <Textarea
              id="obs-gerais"
              placeholder="Informações adicionais sobre este lançamento..."
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarLancamento}
              disabled={itens.length === 0 || createLancamento.isPending}
              className="flex-1 gap-2"
            >
              {createLancamento.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar para Conferência
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
