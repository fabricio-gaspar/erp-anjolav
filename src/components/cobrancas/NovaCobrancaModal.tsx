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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAsaasCharge } from "@/hooks/useAsaas";
import { BOLETO_ENABLED } from "@/lib/featureFlags";
import { Loader2 } from "lucide-react";

interface NovaCobrancaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovaCobrancaModal({ open, onOpenChange }: NovaCobrancaModalProps) {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    customer_cpf_cnpj: "",
    description: "",
    value: "",
    due_date: "",
    billing_type: (BOLETO_ENABLED ? "BOLETO_PIX" : "PIX") as "BOLETO" | "PIX" | "BOLETO_PIX",
  });

  const createCharge = useCreateAsaasCharge();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createCharge.mutateAsync({
      customer_name: formData.customer_name,
      customer_email: formData.customer_email || undefined,
      customer_cpf_cnpj: formData.customer_cpf_cnpj,
      description: formData.description,
      value: parseFloat(formData.value),
      due_date: formData.due_date,
      billing_type: formData.billing_type,
    });

    setFormData({
      customer_name: "",
      customer_email: "",
      customer_cpf_cnpj: "",
      description: "",
      value: "",
      due_date: "",
      billing_type: BOLETO_ENABLED ? "BOLETO_PIX" : "PIX",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nova Cobrança Asaas</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="customer_name">Nome do Cliente *</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="customer_cpf_cnpj">CPF/CNPJ *</Label>
              <Input
                id="customer_cpf_cnpj"
                value={formData.customer_cpf_cnpj}
                onChange={(e) =>
                  setFormData({ ...formData, customer_cpf_cnpj: e.target.value })
                }
                placeholder="000.000.000-00"
                required
              />
            </div>

            <div>
              <Label htmlFor="customer_email">E-mail</Label>
              <Input
                id="customer_email"
                type="email"
                value={formData.customer_email}
                onChange={(e) =>
                  setFormData({ ...formData, customer_email: e.target.value })
                }
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="value">Valor (R$) *</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.value}
                onChange={(e) =>
                  setFormData({ ...formData, value: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="due_date">Vencimento *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                required
              />
            </div>

            <div className="col-span-2">
              <Label>Forma de Pagamento *</Label>
              <Select
                value={formData.billing_type}
                onValueChange={(value: "BOLETO" | "PIX" | "BOLETO_PIX") =>
                  setFormData({ ...formData, billing_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOLETO_ENABLED && <SelectItem value="BOLETO_PIX">Boleto + PIX</SelectItem>}
                  {BOLETO_ENABLED && <SelectItem value="BOLETO">Apenas Boleto</SelectItem>}
                  <SelectItem value="PIX">Apenas PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createCharge.isPending}>
              {createCharge.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Criar Cobrança
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
