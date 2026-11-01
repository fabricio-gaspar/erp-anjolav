import { useState, useEffect, useRef } from "react";
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
import {
  criarChaveOperacaoFinanceira,
  useContasPagar,
  type ContaPagar,
} from "@/hooks/useContasPagar";
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
  const { updateConta } = useContasPagar(false);
  const { fornecedores } = useFornecedores({ enabled: open });
  const { categorias } = useCategoriasFinanceiras("despesa", { enabled: open });
  const { centros } = useCentrosCusto({ enabled: open });
  const idempotencyKey = useRef(criarChaveOperacaoFinanceira("payable-update"));

  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor: "",
    fornecedor_id: null as string | null,
    valor: "",
    vencimento: "",
    categoria_id: "",
    centro_custo_id: "",
    observacoes: "",
  });

  useEffect(() => {
    if (conta) {
      setFormData({
        descricao: conta.descricao,
        fornecedor: conta.fornecedor || "",
        fornecedor_id: conta.fornecedor_id || null,
        valor: formatNumberToCurrency(conta.valor),
        vencimento: conta.vencimento,
        categoria_id: conta.categoria_id || "",
        centro_custo_id: conta.centro_custo_id || "",
        observacoes: conta.observacoes || "",
      });
      idempotencyKey.current = criarChaveOperacaoFinanceira("payable-update");
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
    if (isNaN(valorNumerico) || valorNumerico <= 0) return;

    try {
      await updateConta.mutateAsync({
        id: conta.id,
        versao: conta.versao,
        descricao: formData.descricao,
        fornecedor: formData.fornecedor || null,
        fornecedor_id: formData.fornecedor_id || null,
        valor: valorNumerico,
        vencimento: formData.vencimento,
        categoria_id: formData.categoria_id || null,
        centro_custo_id: formData.centro_custo_id || null,
        observacoes: formData.observacoes || null,
        idempotencyKey: idempotencyKey.current,
      });
      onOpenChange(false);
    } catch {
      // The mutation displays the error and the form remains open with its values.
    }
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
            <Label htmlFor="edit-payable-supplier">Fornecedor</Label>
            <Select value={formData.fornecedor_id || "__manual__"} onValueChange={handleFornecedorChange}>
              <SelectTrigger id="edit-payable-supplier"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Digitar manualmente</SelectItem>
                {fornecedores.filter((f) => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {!formData.fornecedor_id && (
              <Input value={formData.fornecedor} onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })} placeholder="Nome do fornecedor" className="mt-2" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-payable-value">Valor *</Label>
              <CurrencyInput id="edit-payable-value" value={formData.valor} onChange={(e) => setFormData({ ...formData, valor: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payable-due-date">Vencimento *</Label>
              <Input id="edit-payable-due-date" type="date" value={formData.vencimento} onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-payable-category">Categoria</Label>
              <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                <SelectTrigger id="edit-payable-category"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categorias.filter(c => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payable-cost-center">Centro de Custo</Label>
              <Select value={formData.centro_custo_id} onValueChange={(v) => setFormData({ ...formData, centro_custo_id: v })}>
                <SelectTrigger id="edit-payable-cost-center"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {centros.filter(c => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
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
