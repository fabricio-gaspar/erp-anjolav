import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Check, X } from "lucide-react";
import { useContasPagar, ContaPagarInsert } from "@/hooks/useContasPagar";
import { useFornecedores } from "@/hooks/useFornecedores";
import { formatCurrencyInput, parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";

interface NovaContaPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoriasBase = [
  "Utilidades",
  "Aluguel",
  "Insumos",
  "Salários",
  "Impostos",
  "Manutenção",
  "Transporte",
  "Outros",
];

export function NovaContaPagarModal({ open, onOpenChange }: NovaContaPagarModalProps) {
  const { createConta } = useContasPagar();
  const { fornecedores } = useFornecedores();
  const [fornecedorMode, setFornecedorMode] = useState<"cadastrado" | "outro">("cadastrado");
  const [categoriasCustom, setCategoriasCustom] = useState<string[]>([]);
  const [addingCategoria, setAddingCategoria] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor: "",
    fornecedor_id: "",
    valor: "",
    vencimento: "",
    categoria: "",
    observacoes: "",
  });

  const todasCategorias = [...categoriasBase, ...categoriasCustom];

  const handleAddCategoria = () => {
    const cat = novaCategoria.trim();
    if (cat && !todasCategorias.includes(cat)) {
      setCategoriasCustom((prev) => [...prev, cat]);
      setFormData({ ...formData, categoria: cat });
    }
    setNovaCategoria("");
    setAddingCategoria(false);
  };

  const formatValorForDisplay = (val: number) => {
    return formatNumberToCurrency(val);
  };

  const handleFornecedorSelect = (fornecedorId: string) => {
    if (fornecedorId === "__outro__") {
      setFornecedorMode("outro");
      setFormData({ ...formData, fornecedor_id: "", fornecedor: "" });
      return;
    }
    const f = fornecedores.find((x) => x.id === fornecedorId);
    if (f) {
      let vencimento = formData.vencimento;
      if (f.dia_vencimento) {
        const hoje = new Date();
        let mes = hoje.getMonth();
        let ano = hoje.getFullYear();
        if (hoje.getDate() > f.dia_vencimento) {
          mes += 1;
          if (mes > 11) { mes = 0; ano += 1; }
        }
        const dia = String(Math.min(f.dia_vencimento, new Date(ano, mes + 1, 0).getDate())).padStart(2, '0');
        vencimento = `${ano}-${String(mes + 1).padStart(2, '0')}-${dia}`;
      }
      setFornecedorMode("cadastrado");
      setFormData({
        ...formData,
        fornecedor_id: f.id,
        fornecedor: f.nome,
        valor: f.valor_recorrente ? formatValorForDisplay(Number(f.valor_recorrente)) : formData.valor,
        descricao: formData.descricao || `Pagamento ${f.nome}`,
        categoria: f.categoria || formData.categoria,
        vencimento,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const valorNumerico = parseFloat(formData.valor.replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) return;

    const conta: ContaPagarInsert = {
      descricao: formData.descricao,
      fornecedor: formData.fornecedor || null,
      fornecedor_id: formData.fornecedor_id || null,
      valor: valorNumerico,
      vencimento: formData.vencimento,
      categoria: formData.categoria || null,
      observacoes: formData.observacoes || null,
      status: "pendente",
      data_pagamento: null,
    };

    await createConta.mutateAsync(conta);

    setFormData({
      descricao: "",
      fornecedor: "",
      fornecedor_id: "",
      valor: "",
      vencimento: "",
      categoria: "",
      observacoes: "",
    });
    setFornecedorMode("cadastrado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Despesa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Conta de Energia - Janeiro/2026"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            {fornecedorMode === "cadastrado" ? (
              <Select
                value={formData.fornecedor_id || undefined}
                onValueChange={handleFornecedorSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                      {f.valor_recorrente ? ` — R$ ${Number(f.valor_recorrente).toFixed(2)}` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="__outro__">✏️ Digitar manualmente</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFornecedorMode("cadastrado")}
                >
                  Voltar
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                skipUppercase
                value={formData.valor}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9.,]/g, "");
                  setFormData({ ...formData, valor: v });
                }}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vencimento">Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              {!addingCategoria && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setAddingCategoria(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {addingCategoria ? (
              <div className="flex gap-2">
                <Input
                  skipUppercase
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  placeholder="Nova categoria..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCategoria())}
                  autoFocus
                />
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={handleAddCategoria}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setAddingCategoria(false); setNovaCategoria(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {todasCategorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createConta.isPending}>
              {createConta.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Despesa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
