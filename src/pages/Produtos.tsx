import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
  unidadeNegocio: "ID1" | "ID2";
  status: "ativo" | "inativo";
}

const mockProdutos: Produto[] = [
  { id: "1", nome: "CAPA DE ALMOFADA", preco: 5.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "2", nome: "COBERTOR", preco: 25.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "3", nome: "COBERTOR / EDREDON", preco: 25.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "4", nome: "EDREDON", preco: 25.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "5", nome: "FRONHA", preco: 3.5, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "6", nome: "FRONHA COM DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "7", nome: "LENÇOL", preco: 4.8, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "8", nome: "LENÇOL - DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "9", nome: "PISO - DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "10", nome: "ROUPÃO", preco: 4.5, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "11", nome: "ROUPÃO - DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "12", nome: "TAPETE", preco: 25.0, unidade: "Metro", unidadeNegocio: "ID2", status: "ativo" },
  { id: "13", nome: "TOALHA", preco: 10.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "14", nome: "TOALHA BANHO", preco: 4.5, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "15", nome: "TOALHA DE BANHO - DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "16", nome: "TOALHA DE PISCINA", preco: 4.5, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "17", nome: "TOALHA DE PISCINA - DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "18", nome: "TOALHA DE PISO", preco: 3.5, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "19", nome: "TOALHA DE ROSTO", preco: 3.5, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
  { id: "20", nome: "TOALHA DE ROSTO - DEFEITO", preco: 0.0, unidade: "Peça", unidadeNegocio: "ID2", status: "ativo" },
];

const alphabet = ["TODOS", "ALL", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const Produtos = () => {
  const [selectedLetter, setSelectedLetter] = useState("TODOS");
  const [showForm, setShowForm] = useState(false);

  const filteredProdutos = mockProdutos.filter((produto) => {
    if (selectedLetter === "TODOS" || selectedLetter === "ALL") return true;
    return produto.nome.startsWith(selectedLetter);
  });

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Produtos & Serviços</h1>
          <p className="text-sm text-muted-foreground">Cadastro de produtos e serviços oferecidos</p>
        </div>

        {/* New Product Form */}
        <div className="bg-card border rounded-lg p-4">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 text-primary font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>

          {showForm && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Unidade de Negócio</Label>
                <Select defaultValue="ambos">
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Ambos (ID1+ID2)</SelectItem>
                    <SelectItem value="id1">Industrial (ID1)</SelectItem>
                    <SelectItem value="id2">Residencial (ID2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nome do Serviço/Produto</Label>
                <Input className="mt-1" placeholder="EX: LAVAGEM DE TOALHAS" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Unidade de Cobrança</Label>
                <Select defaultValue="kg">
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Quilo (Kg)</SelectItem>
                    <SelectItem value="peca">Peça</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Preço Padrão (R$)</Label>
                <Input className="mt-1" type="number" defaultValue="0.00" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select defaultValue="ativo">
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-4">
                <Label className="text-xs text-muted-foreground">Descrição Detalhada</Label>
                <Textarea
                  className="mt-1"
                  placeholder="DESCREVA DETALHES TÉCNICOS, TIPO DE LAVAGEM, ETC..."
                />
              </div>

              <div className="flex items-end">
                <Button className="w-full gap-2">
                  <Check className="w-4 h-4" />
                  Cadastrar Produto
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Alphabet Filter */}
        <div className="flex gap-0.5 flex-wrap">
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => setSelectedLetter(letter)}
              className={cn(
                "min-w-[32px] h-7 px-1.5 rounded text-xs font-medium transition-colors",
                selectedLetter === letter
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProdutos.map((produto) => (
            <div
              key={produto.id}
              className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-foreground text-sm leading-tight">
                  {produto.nome}
                </h3>
                <StatusBadge variant="success" className="text-[10px] px-1.5 py-0">
                  {produto.unidadeNegocio}
                </StatusBadge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-primary currency">
                  R$ {produto.preco.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs text-muted-foreground">• {produto.unidade}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Produtos;
