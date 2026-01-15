import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Banknote, Smartphone, Receipt } from "lucide-react";
import { useState } from "react";
import { useAddMovimentacao, useCaixaAberto } from "@/hooks/useCaixa";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { toast } from "sonner";

const FORMAS_PAGAMENTO = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote },
  { id: "pix", label: "PIX", icon: Smartphone },
  { id: "cartao_debito", label: "Débito", icon: CreditCard },
  { id: "cartao_credito", label: "Crédito", icon: CreditCard },
];

interface ReceberPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osNumero: string;
  osId: string;
  clienteNome: string;
  valorTotal: number;
  valorPago: number;
  onSuccess?: () => void;
}

export function ReceberPagamentoModal({
  open,
  onOpenChange,
  osNumero,
  osId,
  clienteNome,
  valorTotal,
  valorPago,
  onSuccess,
}: ReceberPagamentoModalProps) {
  const valorPendente = valorTotal - (valorPago || 0);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [valorRecebido, setValorRecebido] = useState(valorPendente.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: caixaAberto } = useCaixaAberto();
  const { mutateAsync: addMovimentacao } = useAddMovimentacao();
  const { updateOrdemServico } = useOrdensServico();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = async () => {
    const valor = parseFloat(valorRecebido.replace(",", "."));
    
    if (isNaN(valor) || valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (valor > valorPendente) {
      toast.error("O valor recebido não pode ser maior que o valor pendente");
      return;
    }

    if (!caixaAberto) {
      toast.error("Não há caixa aberto. Abra o caixa para registrar o pagamento.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Registrar movimentação no caixa
      await addMovimentacao({
        caixa_id: caixaAberto.id,
        tipo: "VENDA" as const,
        valor: valor,
        forma_pagamento: formaPagamento.toUpperCase() as "DINHEIRO" | "PIX" | "CARTAO_DEBITO" | "CARTAO_CREDITO",
        descricao: `Recebimento OS ${osNumero} - ${clienteNome}`,
      });

      // Atualizar a OS
      const novoValorPago = (valorPago || 0) + valor;
      const novoStatus = novoValorPago >= valorTotal ? "pago" : "parcial";

      await updateOrdemServico.mutateAsync({
        id: osId,
        valor_pago: novoValorPago,
        status_pagamento: novoStatus,
      });

      toast.success(`Pagamento de ${formatCurrency(valor)} registrado com sucesso!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      toast.error("Erro ao registrar pagamento. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Receber Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da OS */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">OS:</span>
              <span className="font-semibold">{osNumero}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cliente:</span>
              <span className="font-medium">{clienteNome}</span>
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="font-semibold">{formatCurrency(valorTotal)}</p>
            </div>
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Pendente</p>
              <p className="font-bold text-destructive">{formatCurrency(valorPendente)}</p>
            </div>
          </div>

          {valorPago > 0 && (
            <div className="text-center">
              <Badge variant="secondary">
                Já pago: {formatCurrency(valorPago)}
              </Badge>
            </div>
          )}

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS_PAGAMENTO.map((forma) => {
                const Icon = forma.icon;
                return (
                  <Button
                    key={forma.id}
                    type="button"
                    variant={formaPagamento === forma.id ? "default" : "outline"}
                    className="h-12 flex items-center gap-2"
                    onClick={() => setFormaPagamento(forma.id)}
                  >
                    <Icon className="w-4 h-4" />
                    {forma.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Valor Recebido */}
          <div className="space-y-2">
            <Label>Valor Recebido</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                type="text"
                value={valorRecebido}
                onChange={(e) => setValorRecebido(e.target.value)}
                className="pl-10 text-lg font-semibold"
                placeholder="0,00"
              />
            </div>
          </div>

          {!caixaAberto && (
            <div className="bg-warning/10 border border-warning rounded-lg p-3 text-center">
              <p className="text-sm text-warning font-medium">
                ⚠️ Não há caixa aberto. Abra o caixa para registrar pagamentos.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !caixaAberto}
          >
            {isSubmitting ? "Processando..." : "Confirmar Recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
