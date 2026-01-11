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
import { Plus, Check, Loader2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { toast } from "sonner";

const alphabet = ["TODOS", "ALL", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const Produtos = () => {
  const { produtos, isLoading, createProduto, updateProduto, deleteProduto } = useProdutos();
  const [selectedLetter, setSelectedLetter] = useState("TODOS");
  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    preco: 0,
    unidade: "peca" as "kg" | "peca" | "metro" | "unidade",
    unidade_negocio: "ambos" as "ID1" | "ID2" | "ambos",
    status: "ativo" as "ativo" | "inativo",
    descricao: "",
    categoria: "",
  });

  const resetForm = () => {
    setFormData({
      nome: "",
      preco: 0,
      unidade: "peca" as "kg" | "peca" | "metro" | "unidade",
      unidade_negocio: "ambos" as "ID1" | "ID2" | "ambos",
      status: "ativo" as "ativo" | "inativo",
      descricao: "",
      categoria: "",
    });
    setEditingProduto(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    const produtoData = {
      nome: formData.nome,
      preco: formData.preco,
      unidade: formData.unidade,
      unidade_negocio: formData.unidade_negocio === "ambos" ? "ambos" as const : formData.unidade_negocio,
      status: formData.status,
      descricao: formData.descricao || null,
      categoria: formData.categoria || null,
    };

    if (editingProduto) {
      updateProduto.mutate(
        { id: editingProduto.id, ...produtoData },
        { onSuccess: resetForm }
      );
    } else {
      createProduto.mutate(produtoData, { onSuccess: resetForm });
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome,
      preco: produto.preco,
      unidade: (produto.unidade as "kg" | "peca" | "metro" | "unidade") || "peca",
      unidade_negocio: (produto.unidade_negocio as "ID1" | "ID2" | "ambos") || "ambos",
      status: (produto.status as "ativo" | "inativo") || "ativo",
      descricao: produto.descricao || "",
      categoria: produto.categoria || "",
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente excluir este produto?")) {
      deleteProduto.mutate(id);
    }
  };

  const filteredProdutos = (produtos || []).filter((produto) => {
    if (selectedLetter === "TODOS" || selectedLetter === "ALL") return true;
    return produto.nome.toUpperCase().startsWith(selectedLetter);
  });

  const isSaving = createProduto.isPending || updateProduto.isPending;

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
            onClick={() => {
              if (showForm && editingProduto) {
                resetForm();
              } else {
                setShowForm(!showForm);
              }
            }}
            className="flex items-center gap-2 text-primary font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            {editingProduto ? "Editar Produto" : "Novo Produto"}
          </button>

          {showForm && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Unidade de Negócio</Label>
                <Select 
                  value={formData.unidade_negocio} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, unidade_negocio: v as "ID1" | "ID2" | "ambos" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">Ambos (ID1+ID2)</SelectItem>
                    <SelectItem value="ID1">Industrial (ID1)</SelectItem>
                    <SelectItem value="ID2">Residencial (ID2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nome do Serviço/Produto</Label>
                <Input 
                  className="mt-1" 
                  placeholder="EX: LAVAGEM DE TOALHAS" 
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Unidade de Cobrança</Label>
                <Select 
                  value={formData.unidade} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, unidade: v as "kg" | "peca" | "metro" | "unidade" }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Quilo (Kg)</SelectItem>
                    <SelectItem value="peca">Peça</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Preço Padrão (R$)</Label>
                <Input 
                  className="mt-1" 
                  type="number" 
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData(prev => ({ ...prev, preco: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as "ativo" | "inativo" }))}
                >
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
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                />
              </div>

              <div className="flex items-end gap-2">
                {editingProduto && (
                  <Button variant="outline" onClick={resetForm} className="flex-1">
                    Cancelar
                  </Button>
                )}
                <Button onClick={handleSubmit} disabled={isSaving} className="flex-1 gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingProduto ? "Atualizar" : "Cadastrar"}
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando produtos...</span>
          </div>
        ) : filteredProdutos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum produto encontrado
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProdutos.map((produto) => (
              <div
                key={produto.id}
                className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow group relative"
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEdit(produto)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(produto.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-start justify-between mb-2 pr-16 group-hover:pr-0">
                  <h3 className="font-semibold text-foreground text-sm leading-tight">
                    {produto.nome}
                  </h3>
                  <StatusBadge 
                    variant={produto.status === "ativo" ? "success" : "warning"} 
                    className="text-[10px] px-1.5 py-0"
                  >
                    {produto.unidade_negocio || "ID1+ID2"}
                  </StatusBadge>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-primary currency">
                    R$ {produto.preco.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs text-muted-foreground">• {produto.unidade || "Peça"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Produtos;
