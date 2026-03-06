import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { useContasPagar, ContaPagarInsert } from "@/hooks/useContasPagar";
import { useFornecedores } from "@/hooks/useFornecedores";

interface NovaContaPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categorias = [
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
  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor: "",
    fornecedor_id: "" as string,
    valor: "",
    vencimento: "",
    categoria: "",
    observacoes: "",
  });

  const handleFornecedorSelect = (fornecedorId: string) => {
    if (fornecedorId === "__outro__") {
      setFornecedorMode("outro");
      setFormData({ ...formData, fornecedor_id: "", fornecedor: "" });
      return;
    }
    const f = fornecedores.find((x) => x.id === fornecedorId);
    if (f) {
      setFornecedorMode("cadastrado");
      setFormData({
        ...formData,
        fornecedor_id: f.id,
        fornecedor: f.nome,
        valor: f.valor_recorrente ? String(f.valor_recorrente) : formData.valor,
        descricao: formData.descricao || `Pagamento ${f.nome}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const conta: ContaPagarInsert = {
      descricao: formData.descricao,
      fornecedor: formData.fornecedor || null,
      fornecedor_id: formData.fornecedor_id || null,
      valor: parseFloat(formData.valor),
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
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
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
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
