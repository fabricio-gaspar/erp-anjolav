import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useContasPagar, ContaPagarInsert } from "@/hooks/useContasPagar";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";

interface NovaContaPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaContaPagarModal({ open, onOpenChange }: NovaContaPagarModalProps) {
  const { createConta } = useContasPagar();
  const { fornecedores } = useFornecedores();
  const { categorias } = useCategoriasFinanceiras("despesa");
  const { centros } = useCentrosCusto();

  const [fornecedorMode, setFornecedorMode] = useState<"cadastrado" | "outro">("cadastrado");
  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor: "",
    fornecedor_id: "",
    valor: "",
    vencimento: "",
    categoria_id: "",
    centro_custo_id: "",
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
      let vencimento = formData.vencimento;
      if (f.dia_vencimento) {
        const hoje = new Date();
        let mes = hoje.getMonth();
        let ano = hoje.getFullYear();
        if (hoje.getDate() > f.dia_vencimento) {
          mes += 1; if (mes > 11) { mes = 0; ano += 1; }
        }
        const dia = String(Math.min(f.dia_vencimento, new Date(ano, mes + 1, 0).getDate())).padStart(2, '0');
        vencimento = `${ano}-${String(mes + 1).padStart(2, '0')}-${dia}`;
      }
      setFornecedorMode("cadastrado");
      setFormData({
        ...formData,
        fornecedor_id: f.id,
        fornecedor: f.nome,
        valor: f.valor_recorrente ? formatNumberToCurrency(Number(f.valor_recorrente)) : formData.valor,
        descricao: formData.descricao || `Pagamento ${f.nome}`,
        vencimento,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNumerico = parseCurrencyToNumber(formData.valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) return;

    const conta: any = {
      descricao: formData.descricao,
      fornecedor: formData.fornecedor || null,
      fornecedor_id: formData.fornecedor_id || null,
      valor: valorNumerico,
      vencimento: formData.vencimento,
      categoria_id: formData.categoria_id || null,
      centro_custo_id: formData.centro_custo_id || null,
      observacoes: formData.observacoes || null,
      status: "pendente",
      data_pagamento: null,
    };

    await createConta.mutateAsync(conta as ContaPagarInsert);

    setFormData({ descricao: "", fornecedor: "", fornecedor_id: "", valor: "", vencimento: "", categoria_id: "", centro_custo_id: "", observacoes: "" });
    setFornecedorMode("cadastrado");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} placeholder="Ex: Conta de Energia - Janeiro/2026" required />
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            {fornecedorMode === "cadastrado" ? (
              <Select value={formData.fornecedor_id || undefined} onValueChange={handleFornecedorSelect}>
                <SelectTrigger><SelectValue placeholder="Selecione um fornecedor" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}{f.valor_recorrente ? ` — R$ ${Number(f.valor_recorrente).toFixed(2)}` : ""}</SelectItem>
                  ))}
                  <SelectItem value="__outro__">✏️ Digitar manualmente</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input value={formData.fornecedor} onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })} placeholder="Nome do fornecedor" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => setFornecedorMode("cadastrado")}>Voltar</Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <CurrencyInput id="valor" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimento">Vencimento *</Label>
              <Input id="vencimento" type="date" value={formData.vencimento} onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.filter(c => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={formData.centro_custo_id} onValueChange={(v) => setFormData({ ...formData, centro_custo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {centros.filter(c => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Observações adicionais..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
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
