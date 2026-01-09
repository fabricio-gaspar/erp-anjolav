import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Copy, Plus, Save, Trash2 } from "lucide-react";

interface PrecoEspecial {
  id: string;
  produto: string;
  unidade: string;
  precoPadrao: number;
  precoEspecial: number;
  tipo: "acrescido" | "desconto" | "normal";
}

const mockPrecos: PrecoEspecial[] = [
  {
    id: "1",
    produto: "CAPA DE ALMOFADA",
    unidade: "peça",
    precoPadrao: 5.0,
    precoEspecial: 5,
    tipo: "acrescido",
  },
  {
    id: "2",
    produto: "TOALHA DE PISO",
    unidade: "peça",
    precoPadrao: 3.5,
    precoEspecial: 3.5,
    tipo: "acrescido",
  },
  {
    id: "3",
    produto: "FRONHA",
    unidade: "peça",
    precoPadrao: 3.5,
    precoEspecial: 3.5,
    tipo: "acrescido",
  },
];

const mockProdutosDisponiveis = [
  { id: "4", nome: "LENÇOL SOLTEIRO", unidade: "peça", preco: 8.0 },
  { id: "5", nome: "LENÇOL CASAL", unidade: "peça", preco: 12.0 },
  { id: "6", nome: "EDREDOM", unidade: "peça", preco: 25.0 },
  { id: "7", nome: "TOALHA DE BANHO", unidade: "peça", preco: 4.5 },
];

const mockClientes = [
  { id: "1", nome: "HOTEL FAZENDA SOL" },
  { id: "2", nome: "POUSADA RECANTO" },
  { id: "3", nome: "RESTAURANTE SABOR" },
];

export const ClienteTabelaPrecos = () => {
  const [precos, setPrecos] = useState<PrecoEspecial[]>(mockPrecos);
  const [clienteImportar, setClienteImportar] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [novoPreco, setNovoPreco] = useState("");

  const handleImportar = () => {
    // Lógica de importação
    console.log("Importar de:", clienteImportar);
  };

  const handleAdicionarProduto = () => {
    if (!produtoSelecionado || !novoPreco) return;
    
    const produto = mockProdutosDisponiveis.find(p => p.id === produtoSelecionado);
    if (!produto) return;

    const precoNum = parseFloat(novoPreco);
    const novoItem: PrecoEspecial = {
      id: Date.now().toString(),
      produto: produto.nome,
      unidade: produto.unidade,
      precoPadrao: produto.preco,
      precoEspecial: precoNum,
      tipo: precoNum > produto.preco ? "acrescido" : precoNum < produto.preco ? "desconto" : "normal",
    };

    setPrecos([...precos, novoItem]);
    setProdutoSelecionado("");
    setNovoPreco("");
  };

  const handleUpdatePreco = (id: string, valor: string) => {
    setPrecos(prev => prev.map(p => {
      if (p.id === id) {
        const precoNum = parseFloat(valor) || 0;
        return {
          ...p,
          precoEspecial: precoNum,
          tipo: precoNum > p.precoPadrao ? "acrescido" : precoNum < p.precoPadrao ? "desconto" : "normal",
        };
      }
      return p;
    }));
  };

  const handleRemover = (id: string) => {
    setPrecos(prev => prev.filter(p => p.id !== id));
  };

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
              {mockClientes.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nome}
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
          <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
            <SelectTrigger className="w-[250px] bg-background">
              <SelectValue placeholder="Selecione um produto..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {mockProdutosDisponiveis.map((produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Preço"
            className="w-24"
            value={novoPreco}
            onChange={(e) => setNovoPreco(e.target.value)}
          />
          <Button size="icon" onClick={handleAdicionarProduto} disabled={!produtoSelecionado}>
            <Plus className="w-4 h-4" />
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
            {precos.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-medium">{item.produto}</span>
                  <span className="text-muted-foreground ml-2">({item.unidade})</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  R$ {item.precoPadrao.toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Input
                      value={item.precoEspecial}
                      onChange={(e) => handleUpdatePreco(item.id, e.target.value)}
                      className="w-24"
                    />
                    <StatusBadge
                      variant={
                        item.tipo === "acrescido"
                          ? "success"
                          : item.tipo === "desconto"
                          ? "danger"
                          : "default"
                      }
                    >
                      {item.tipo === "acrescido" && "Acrescido"}
                      {item.tipo === "desconto" && "Desconto"}
                      {item.tipo === "normal" && "Normal"}
                    </StatusBadge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Save className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRemover(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
