import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Download } from "lucide-react";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { toast } from "sonner";
import { ProdutoFilters } from "@/components/produtos/ProdutoFilters";
import { ProdutoCard } from "@/components/produtos/ProdutoCard";
import { ProdutoForm, ProdutoFormData } from "@/components/produtos/ProdutoForm";
import { ProdutoStats } from "@/components/produtos/ProdutoStats";

const defaultFormData: ProdutoFormData = {
  codigo: "",
  nome: "",
  categoria: "",
  preco: 0,
  unidade: "peca",
  unidade_negocio: "ambos",
  status: "ativo",
  descricao: "",
  peso_medio_kg: 0,
  tempo_processo_min: 30,
  processo_lavagem: "normal",
  temperatura_maxima: 60,
  requer_secadora: true,
  cor: "branco",
  composicao: "algodao",
  instrucoes_especiais: "",
};

const Produtos = () => {
  const { produtos, isLoading, createProduto, updateProduto, deleteProduto } = useProdutos();
  
  // Filters state
  const [selectedLetter, setSelectedLetter] = useState("TODOS");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("todas");
  const [selectedUnidadeNegocio, setSelectedUnidadeNegocio] = useState("todas");
  const [selectedStatus, setSelectedStatus] = useState("todos");
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formData, setFormData] = useState<ProdutoFormData>(defaultFormData);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingProduto(null);
    setShowForm(false);
  };

  const handleFormChange = (data: Partial<ProdutoFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    const produtoData = {
      codigo: formData.codigo || null,
      nome: formData.nome,
      preco: formData.preco,
      unidade: formData.unidade,
      unidade_negocio: formData.unidade_negocio,
      status: formData.status,
      descricao: formData.descricao || null,
      categoria: formData.categoria || null,
      peso_medio_kg: formData.peso_medio_kg || null,
      tempo_processo_min: formData.tempo_processo_min || null,
      processo_lavagem: formData.processo_lavagem || null,
      temperatura_maxima: formData.temperatura_maxima || null,
      requer_secadora: formData.requer_secadora,
      cor: formData.cor || null,
      composicao: formData.composicao || null,
      instrucoes_especiais: formData.instrucoes_especiais || null,
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
      codigo: produto.codigo || "",
      nome: produto.nome,
      categoria: produto.categoria || "",
      preco: produto.preco,
      unidade: produto.unidade || "peca",
      unidade_negocio: produto.unidade_negocio || "ambos",
      status: produto.status || "ativo",
      descricao: produto.descricao || "",
      peso_medio_kg: produto.peso_medio_kg || 0,
      tempo_processo_min: produto.tempo_processo_min || 30,
      processo_lavagem: produto.processo_lavagem || "normal",
      temperatura_maxima: produto.temperatura_maxima || 60,
      requer_secadora: produto.requer_secadora ?? true,
      cor: produto.cor || "branco",
      composicao: produto.composicao || "algodao",
      instrucoes_especiais: produto.instrucoes_especiais || "",
    });
    setShowForm(true);
  };

  const handleDuplicate = (produto: Produto) => {
    setEditingProduto(null);
    setFormData({
      codigo: "",
      nome: `${produto.nome} (Cópia)`,
      categoria: produto.categoria || "",
      preco: produto.preco,
      unidade: produto.unidade || "peca",
      unidade_negocio: produto.unidade_negocio || "ambos",
      status: "ativo",
      descricao: produto.descricao || "",
      peso_medio_kg: produto.peso_medio_kg || 0,
      tempo_processo_min: produto.tempo_processo_min || 30,
      processo_lavagem: produto.processo_lavagem || "normal",
      temperatura_maxima: produto.temperatura_maxima || 60,
      requer_secadora: produto.requer_secadora ?? true,
      cor: produto.cor || "branco",
      composicao: produto.composicao || "algodao",
      instrucoes_especiais: produto.instrucoes_especiais || "",
    });
    setShowForm(true);
    toast.info("Produto duplicado! Ajuste os dados e salve.");
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente excluir este produto?")) {
      deleteProduto.mutate(id);
    }
  };

  const handleExportCSV = () => {
    if (produtos.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    const headers = ["Código", "Nome", "Categoria", "Preço", "Unidade", "Un. Negócio", "Status", "Peso Médio", "Processo", "Temperatura"];
    const rows = produtos.map(p => [
      p.codigo || "",
      p.nome,
      p.categoria || "",
      p.preco.toFixed(2),
      p.unidade || "",
      p.unidade_negocio || "",
      p.status,
      p.peso_medio_kg || "",
      p.processo_lavagem || "",
      p.temperatura_maxima || "",
    ]);

    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `produtos_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Exportação realizada com sucesso!");
  };

  // Filtered products
  const filteredProdutos = useMemo(() => {
    return (produtos || []).filter((produto) => {
      // Letter filter
      if (selectedLetter !== "TODOS") {
        if (!produto.nome.toUpperCase().startsWith(selectedLetter)) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = produto.nome.toLowerCase().includes(term);
        const matchCode = produto.codigo?.toLowerCase().includes(term);
        if (!matchName && !matchCode) return false;
      }

      // Category filter
      if (selectedCategoria !== "todas" && produto.categoria !== selectedCategoria) {
        return false;
      }

      // Business unit filter
      if (selectedUnidadeNegocio !== "todas" && produto.unidade_negocio !== selectedUnidadeNegocio) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "todos" && produto.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [produtos, selectedLetter, searchTerm, selectedCategoria, selectedUnidadeNegocio, selectedStatus]);

  const isSaving = createProduto.isPending || updateProduto.isPending;

  return (
    <AppLayout title="Produtos & Serviços" subtitle="Cadastro de produtos e serviços de lavanderia">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (showForm) {
                  resetForm();
                } else {
                  setShowForm(true);
                }
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Stats */}
        <ProdutoStats produtos={produtos} />

        {/* Form */}
        {showForm && (
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-2">
              {editingProduto ? "Editar Produto" : "Novo Produto"}
            </h3>
            <ProdutoForm
              formData={formData}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
              onCancel={resetForm}
              isEditing={!!editingProduto}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* Filters */}
        <ProdutoFilters
          selectedLetter={selectedLetter}
          onLetterChange={setSelectedLetter}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedCategoria={selectedCategoria}
          onCategoriaChange={setSelectedCategoria}
          selectedUnidadeNegocio={selectedUnidadeNegocio}
          onUnidadeNegocioChange={setSelectedUnidadeNegocio}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
        />

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
              <ProdutoCard
                key={produto.id}
                produto={produto}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Produtos;
