import { useState, useEffect } from "react";
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
import { useContasPagar, ContaPagar } from "@/hooks/useContasPagar";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";

interface EditarContaPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
}

export function EditarContaPagarModal({ open, onOpenChange, conta }: EditarContaPagarModalProps) {
  const { updateConta } = useContasPagar();
  const { fornecedores } = useFornecedores();
  const { categorias } = useCategoriasFinanceiras("despesa");
  const { centros } = useCentrosCusto();

  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor: "",
    fornecedor_id: null as string | null,
    valor: "",
    valor_pago: "",
    vencimento: "",
    categoria_id: "",
    centro_custo_id: "",
    status: "pendente" as ContaPagar["status"],
    data_pagamento: "",
    observacoes: "",
  });

  useEffect(() => {
    if (conta) {
      setFormData({
        descricao: conta.descricao,
        fornecedor: conta.fornecedor || "",
        fornecedor_id: conta.fornecedor_id || null,
        valor: formatNumberToCurrency(conta.valor),
        valor_pago: formatNumberToCurrency(conta.valor_pago || 0),
        vencimento: conta.vencimento,
        categoria_id: conta.categoria_id || "",
        centro_custo_id: conta.centro_custo_id || "",
        status: conta.status,
        data_pagamento: conta.data_pagamento || "",
        observacoes: conta.observacoes || "",
      });
    }
  }, [conta]);

  const handleFornecedorChange = (value: string) => {
    if (value === "__manual__") {
      setFormData({ ...formData, fornecedor_id: null, fornecedor: "" });
      return;
    }
    const selected = fornecedores.find((f) => f.id === value);
    if (selected) setFormData({ ...formData, fornecedor_id: selected.id, fornecedor: selected.nome });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conta) return;
    const valorNumerico = parseCurrencyToNumber(formData.valor);
    const valorPagoNumerico = parseCurrencyToNumber(formData.valor_pago) || 0;
    if (isNaN(valorNumerico) || valorNumerico <= 0) return;

    await updateConta.mutateAsync({
      id: conta.id,
      descricao: formData.descricao,
      fornecedor: formData.fornecedor || null,
      fornecedor_id: formData.fornecedor_id || null,
      valor: valorNumerico,
      valor_pago: valorPagoNumerico,
      vencimento: formData.vencimento,
      categoria_id: formData.categoria_id || null,
      centro_custo_id: formData.centro_custo_id || null,
      status: formData.status,
      data_pagamento: formData.data_pagamento || null,
      observacoes: formData.observacoes || null,
    } as any);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader><DialogTitle>Editar Despesa</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input id="descricao" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} required />
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Select value={formData.fornecedor_id || "__manual__"} onValueChange={handleFornecedorChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Digitar manualmente</SelectItem>
                {fornecedores.filter((f) => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {!formData.fornecedor_id && (
              <Input value={formData.fornecedor} onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })} placeholder="Nome do fornecedor" className="mt-2" />
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <CurrencyInput value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Valor Pago</Label>
              <CurrencyInput value={formData.valor_pago} onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input type="date" value={formData.vencimento} onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input type="date" value={formData.data_pagamento} onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={updateConta.isPending}>
              {updateConta.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
