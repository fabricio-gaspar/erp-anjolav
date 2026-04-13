import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Plus, Trash2, Loader2, ChevronsUpDown, Check, Search } from "lucide-react";
import { useProdutos, usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes } from "@/hooks/useClientes";
import { toast } from "sonner";

interface ClienteTabelaPrecosProps {
  clienteId: string | null;
}

interface PrecoEspecialLocal {
  id: string;
  produto_id: string;
  produto_nome: string;
  unidade: string;
  preco_padrao: number;
  preco_especial: number;
  tipo: "acrescido" | "desconto" | "normal";
  isNew?: boolean;
}

export const ClienteTabelaPrecos = ({ clienteId }: ClienteTabelaPrecosProps) => {
  const { produtos, isLoading: isLoadingProdutos } = useProdutos();
  const { clientes } = useClientes();
  const { precos: precosEspeciais, isLoading: isLoadingPrecos, upsertPrecoEspecial, deletePrecoEspecial } = usePrecosEspeciais(clienteId);

  const [precosLocais, setPrecosLocais] = useState<PrecoEspecialLocal[]>([]);
  const [clienteImportar, setClienteImportar] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [novoPreco, setNovoPreco] = useState("");

  // Sincronizar preços do banco com estado local
  useEffect(() => {
    if (precosEspeciais && produtos) {
      const precosFormatados: PrecoEspecialLocal[] = precosEspeciais.map((pe) => {
        const produto = produtos.find((p) => p.id === pe.produto_id);
        const precoNum = pe.preco_especial;
        const precoPadrao = produto?.preco || 0;
        return {
          id: pe.id,
          produto_id: pe.produto_id,
          produto_nome: produto?.nome || "Produto não encontrado",
          unidade: produto?.unidade || "un",
          preco_padrao: precoPadrao,
          preco_especial: precoNum,
          tipo: precoNum > precoPadrao ? "acrescido" : precoNum < precoPadrao ? "desconto" : "normal",
        };
      });
      setPrecosLocais(precosFormatados);
    }
  }, [precosEspeciais, produtos]);

  // Reset when clienteId changes
  useEffect(() => {
    if (!clienteId) {
      setPrecosLocais([]);
    }
  }, [clienteId]);

  // Buscar dados do cliente atual para filtrar por classificação
  const clienteAtual = clientes.find((c) => c.id === clienteId);

  // Produtos disponíveis (não cadastrados ainda e compatíveis com a classificação do cliente)
  const produtosDisponiveis = produtos.filter((p) => {
    // Já está na tabela de preços? Ignora
    if (precosLocais.some((pl) => pl.produto_id === p.id)) return false;
    
    // Produto deve estar ativo
    if (p.status !== "ativo") return false;
    
    // Verificar compatibilidade de unidade de negócio com classificação do cliente
    // ID1 = Industrial, ID2 = Residencial, ambos = todos
    if (p.unidade_negocio === "ambos") return true;
    
    if (clienteAtual?.classificacao === "industrial" && p.unidade_negocio === "ID1") return true;
    if (clienteAtual?.classificacao === "residencial" && p.unidade_negocio === "ID2") return true;
    
    return false;
  });

  // Outros clientes para importação
  const outrosClientes = clientes.filter((c) => c.id !== clienteId);

  const handleImportar = async () => {
    if (!clienteImportar || !clienteId) return;
    
    // Buscar preços do cliente selecionado (isso precisaria de uma query adicional)
    toast.info("Funcionalidade de importação será implementada em breve.");
    setClienteImportar("");
  };

  const handleAdicionarProduto = () => {
    if (!produtoSelecionado || !clienteId) return;

    const produto = produtos.find((p) => p.id === produtoSelecionado);
    if (!produto) return;

    // Usar preço padrão se o campo estiver vazio
    const precoNum = novoPreco ? parseFloat(novoPreco) : produto.preco;
    if (isNaN(precoNum) || precoNum < 0) {
      toast.error("Digite um preço válido.");
      return;
    }

    upsertPrecoEspecial.mutate(
      {
        cliente_id: clienteId,
        produto_id: produto.id,
        preco_especial: precoNum,
        tipo: precoNum > produto.preco ? "acrescido" : precoNum < produto.preco ? "desconto" : "normal",
      },
      {
        onSuccess: () => {
          setProdutoSelecionado("");
          setNovoPreco("");
        },
      }
    );
  };

  const handleUpdatePreco = (id: string, produtoId: string, valor: string) => {
    const precoNum = parseFloat(valor);
    if (isNaN(precoNum)) return;

    const produto = produtos.find((p) => p.id === produtoId);
    if (!produto || !clienteId) return;

    upsertPrecoEspecial.mutate({
      cliente_id: clienteId,
      produto_id: produtoId,
      preco_especial: precoNum,
      tipo: precoNum > produto.preco ? "acrescido" : precoNum < produto.preco ? "desconto" : "normal",
    });
  };

  const handleRemover = (id: string) => {
    deletePrecoEspecial.mutate(id);
  };

  const getTipoFromPrecos = (precoEspecial: number, precoPadrao: number): "acrescido" | "desconto" | "normal" => {
    if (precoEspecial > precoPadrao) return "acrescido";
    if (precoEspecial < precoPadrao) return "desconto";
    return "normal";
  };

  const isLoading = isLoadingProdutos || isLoadingPrecos;

  if (!clienteId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Salve os dados básicos do cliente primeiro para continuar.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando produtos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Barra de ações */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Importar de outro cliente */}
        <div className="flex-1 flex gap-2 items-center p-3 border rounded-lg bg-muted/20">
          <Copy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select value={clienteImportar} onValueChange={setClienteImportar}>
            <SelectTrigger className="flex-1 bg-background">
              <SelectValue placeholder="Copiar de outro cliente..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {outrosClientes.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleImportar} disabled={!clienteImportar}>
            Importar
          </Button>
        </div>

        {/* Adicionar produto */}
        <div className="flex gap-2 items-center p-3 border rounded-lg bg-muted/20">
          <Select 
            value={produtoSelecionado} 
            onValueChange={(value) => {
              setProdutoSelecionado(value);
              // Preencher automaticamente com o preço padrão do produto
              const produto = produtos.find((p) => p.id === value);
              if (produto) {
                setNovoPreco(produto.preco.toFixed(2));
              }
            }}
          >
            <SelectTrigger className="w-[250px] bg-background">
              <SelectValue placeholder="Selecione um produto..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {produtosDisponiveis.map((produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.nome} (R$ {produto.preco.toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Preço"
            className="w-24"
            value={novoPreco}
            onChange={(e) => setNovoPreco(e.target.value)}
            type="number"
            step="0.01"
            min="0"
          />
          <Button 
            size="icon" 
            onClick={handleAdicionarProduto} 
            disabled={!produtoSelecionado || upsertPrecoEspecial.isPending}
          >
            {upsertPrecoEspecial.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Tabela de Preços */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold text-primary">Produto</TableHead>
              <TableHead className="font-semibold">Preço Padrão</TableHead>
              <TableHead className="font-semibold">Preço Especial (R$)</TableHead>
              <TableHead className="font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {precosLocais.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum preço especial cadastrado para este cliente.
                </TableCell>
              </TableRow>
            ) : (
              precosLocais.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.produto_nome}</span>
                    <span className="text-muted-foreground ml-2">({item.unidade})</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    R$ {item.preco_padrao.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Input
                        value={item.preco_especial}
                        onChange={(e) => handleUpdatePreco(item.id, item.produto_id, e.target.value)}
                        onBlur={(e) => handleUpdatePreco(item.id, item.produto_id, e.target.value)}
                        className="w-24"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                      <StatusBadge
                        variant={
                          getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "acrescido"
                            ? "success"
                            : getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "desconto"
                            ? "danger"
                            : "default"
                        }
                      >
                        {getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "acrescido" && "Acrescido"}
                        {getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "desconto" && "Desconto"}
                        {getTipoFromPrecos(item.preco_especial, item.preco_padrao) === "normal" && "Normal"}
                      </StatusBadge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRemover(item.id)}
                        disabled={deletePrecoEspecial.isPending}
                      >
                        {deletePrecoEspecial.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
