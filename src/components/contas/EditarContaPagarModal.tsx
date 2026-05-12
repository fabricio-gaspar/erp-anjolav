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
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { useContasPagar, ContaPagar } from "@/hooks/useContasPagar";
import { useFornecedores } from "@/hooks/useFornecedores";
import { formatCurrencyInput, parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";

interface EditarContaPagarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
}

const categorias = [
  "Utilidades",
  "Aluguel",
  "Insumos",
  "Salários",
  "Impostos",
  "Manutenção",
  "Transporte",
  "Energia / Água / Gás",
  "Químicos / Solventes",
  "Equipamentos / Máquinas",
  "Outros",
];

export function EditarContaPagarModal({ open, onOpenChange, conta }: EditarContaPagarModalProps) {
  const { updateConta } = useContasPagar();
  const { fornecedores } = useFornecedores();
  const [formData, setFormData] = useState({
    descricao: "",
    fornecedor: "",
    fornecedor_id: null as string | null,
    valor: "",
    vencimento: "",
    categoria: "",
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
        categoria: conta.categoria || "",
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
    if (selected) {
      setFormData({
        ...formData,
        fornecedor_id: selected.id,
        fornecedor: selected.nome,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conta) return;

    const valorNumerico = parseCurrencyToNumber(formData.valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) return;

    await updateConta.mutateAsync({
      id: conta.id,
      descricao: formData.descricao,
      fornecedor: formData.fornecedor || null,
      fornecedor_id: formData.fornecedor_id || null,
      valor: valorNumerico,
      vencimento: formData.vencimento,
      categoria: formData.categoria || null,
      observacoes: formData.observacoes || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Despesa</DialogTitle>
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
            <Select
              value={formData.fornecedor_id || "__manual__"}
              onValueChange={handleFornecedorChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual__">Digitar manualmente</SelectItem>
                {fornecedores.filter((f) => f.ativo).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.fornecedor_id && (
              <Input
                value={formData.fornecedor}
                onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                placeholder="Nome do fornecedor"
                className="mt-2"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <CurrencyInput
                id="valor"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
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
