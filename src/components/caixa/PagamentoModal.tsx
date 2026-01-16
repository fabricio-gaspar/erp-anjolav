import { useState, useMemo, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Loader2, 
  Banknote, 
  Smartphone, 
  CreditCard, 
  Clock,
  Zap,
  Percent,
  CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, format, isWeekend, nextMonday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogisticaSection } from "@/components/delivery/LogisticaSection";

interface CartItem {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
  quantidade: number;
  precoOriginal: number;
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
}

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj: string | null;
}

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cliente: Cliente | null;
  totalOriginal: number;
  totalItems: number;
  onConfirm: (dados: DadosPagamento) => Promise<void>;
  isLoading?: boolean;
}

export interface DadosPagamento {
  pagoAgora: boolean;
  formaPagamento: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | null;
  urgente: boolean;
  percentualUrgencia: number;
  valorDesconto: number;
  valorTotal: number;
  previsaoEntrega: Date;
  // Novos campos de logística
  tipoLogistica: "buscar" | "entregar";
  motoristaId?: string;
  veiculoId?: string;
}

type FormaPagamento = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO";

const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string; icon: React.ReactNode }[] = [
  { value: "DINHEIRO", label: "Dinheiro", icon: <Banknote className="w-5 h-5" /> },
  { value: "PIX", label: "PIX", icon: <Smartphone className="w-5 h-5" /> },
  { value: "CARTAO_CREDITO", label: "Crédito", icon: <CreditCard className="w-5 h-5" /> },
  { value: "CARTAO_DEBITO", label: "Débito", icon: <CreditCard className="w-5 h-5" /> },
];

const DIAS_ENTREGA_PADRAO = 3;
const PERCENTUAL_URGENCIA_PADRAO = 30;

export function PagamentoModal({
  open,
  onOpenChange,
  cart,
  cliente,
  totalOriginal,
  totalItems,
  onConfirm,
  isLoading = false,
}: PagamentoModalProps) {
  const [pagoAgora, setPagoAgora] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [urgente, setUrgente] = useState(false);
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "valor">("percentual");
  const [descontoInput, setDescontoInput] = useState("");
  const [previsaoEntrega, setPrevisaoEntrega] = useState<Date>(() => {
    const data = addDays(new Date(), DIAS_ENTREGA_PADRAO);
    return isWeekend(data) ? nextMonday(data) : data;
  });
  // Estados de logística
  const [tipoLogistica, setTipoLogistica] = useState<"buscar" | "entregar">("buscar");
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setPagoAgora(false);
      setFormaPagamento(null);
      setUrgente(false);
      setDescontoTipo("percentual");
      setDescontoInput("");
      setTipoLogistica("buscar");
      setMotoristaId("");
      setVeiculoId("");
      // Reset delivery date
      const data = addDays(new Date(), DIAS_ENTREGA_PADRAO);
      setPrevisaoEntrega(isWeekend(data) ? nextMonday(data) : data);
    }
  }, [open]);

  // Update delivery date when urgency changes
  useEffect(() => {
    const diasEntrega = urgente ? 1 : DIAS_ENTREGA_PADRAO;
    let data = addDays(new Date(), diasEntrega);
    if (isWeekend(data)) {
      data = nextMonday(data);
    }
    setPrevisaoEntrega(data);
  }, [urgente]);

  // Calculate values
  const calculos = useMemo(() => {
    let valorDesconto = 0;
    
    if (descontoInput) {
      const input = parseFloat(descontoInput.replace(",", "."));
      if (!isNaN(input) && input > 0) {
        if (descontoTipo === "percentual") {
          valorDesconto = (totalOriginal * input) / 100;
        } else {
          valorDesconto = input;
        }
      }
    }

    const subtotalComDesconto = totalOriginal - valorDesconto;
    const valorUrgencia = urgente ? (subtotalComDesconto * PERCENTUAL_URGENCIA_PADRAO) / 100 : 0;
    const valorTotal = subtotalComDesconto + valorUrgencia;

    return {
      subtotal: totalOriginal,
      valorDesconto,
      valorUrgencia,
      valorTotal: Math.max(0, valorTotal),
    };
  }, [totalOriginal, descontoInput, descontoTipo, urgente]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const canSubmit = useMemo(() => {
    if (pagoAgora && !formaPagamento) return false;
    return true;
  }, [pagoAgora, formaPagamento]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await onConfirm({
      pagoAgora,
      formaPagamento: pagoAgora ? formaPagamento : null,
      urgente,
      percentualUrgencia: urgente ? PERCENTUAL_URGENCIA_PADRAO : 0,
      valorDesconto: calculos.valorDesconto,
      valorTotal: calculos.valorTotal,
      previsaoEntrega,
      tipoLogistica,
      motoristaId: tipoLogistica === "entregar" ? motoristaId : undefined,
      veiculoId: tipoLogistica === "entregar" ? veiculoId : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Finalizar Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Cliente e resumo */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-semibold">
                  {cliente?.nome_fantasia || cliente?.razao_social || "Cliente não selecionado"}
                </p>
                {cliente?.cpf_cnpj && (
                  <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{totalItems} peças</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(totalOriginal)}</p>
              </div>
            </div>
          </div>

          {/* Urgência */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-warning/30 bg-warning/5">
            <div className="flex items-center gap-3">
              <Zap className={cn("w-5 h-5", urgente ? "text-warning" : "text-muted-foreground")} />
              <div>
                <p className="font-medium">Urgente (+{PERCENTUAL_URGENCIA_PADRAO}%)</p>
                <p className="text-xs text-muted-foreground">Entrega prioritária</p>
              </div>
            </div>
            <Switch checked={urgente} onCheckedChange={setUrgente} />
          </div>

          {/* Previsão de Entrega - Editável */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Previsão de Entrega
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-medium",
                    "border-primary/20 bg-primary/5 hover:bg-primary/10"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  <span className="text-primary">
                    {format(previsaoEntrega, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={previsaoEntrega}
                  onSelect={(date) => date && setPrevisaoEntrega(date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Desconto */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Desconto
            </Label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDescontoTipo("percentual")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors",
                    descontoTipo === "percentual" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDescontoTipo("valor")}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-colors",
                    descontoTipo === "valor" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  R$
                </button>
              </div>
              <Input
                type="text"
                value={descontoInput}
                onChange={(e) => setDescontoInput(e.target.value)}
                placeholder={descontoTipo === "percentual" ? "0" : "0,00"}
                className="flex-1"
              />
            </div>
          </div>

          <Separator />

          {/* Seção de Logística */}
          <LogisticaSection
            clienteId={cliente?.id || null}
            tipoLogistica={tipoLogistica}
            onTipoChange={setTipoLogistica}
            dataEntrega={previsaoEntrega}
            onDataEntregaChange={setPrevisaoEntrega}
            motoristaId={motoristaId}
            onMotoristaChange={setMotoristaId}
            veiculoId={veiculoId}
            onVeiculoChange={setVeiculoId}
          />

          <Separator />
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Momento do Pagamento
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPagoAgora(false)}
                className={cn(
                  "p-4 rounded-lg border-2 text-center transition-all",
                  !pagoAgora 
                    ? "border-primary bg-primary/5" 
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <p className="font-semibold">Pagar na Entrega</p>
                <p className="text-xs text-muted-foreground mt-1">Quando for buscar</p>
              </button>
              <button
                type="button"
                onClick={() => setPagoAgora(true)}
                className={cn(
                  "p-4 rounded-lg border-2 text-center transition-all",
                  pagoAgora 
                    ? "border-primary bg-primary/5" 
                    : "border-muted hover:border-muted-foreground/30"
                )}
              >
                <p className="font-semibold">Pagar Agora</p>
                <p className="text-xs text-muted-foreground mt-1">Na retirada</p>
              </button>
            </div>
          </div>

          {/* Forma de Pagamento (se pagar agora) */}
          {pagoAgora && (
            <div className="space-y-3">
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-4 gap-2">
                {FORMAS_PAGAMENTO.map((forma) => (
                  <button
                    key={forma.value}
                    type="button"
                    onClick={() => setFormaPagamento(forma.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                      formaPagamento === forma.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    {forma.icon}
                    <span className="text-xs font-medium">{forma.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Resumo de Valores */}
          <div className="space-y-2 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(calculos.subtotal)}</span>
            </div>
            {calculos.valorDesconto > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Desconto</span>
                <span>-{formatCurrency(calculos.valorDesconto)}</span>
              </div>
            )}
            {calculos.valorUrgencia > 0 && (
              <div className="flex justify-between text-sm text-warning">
                <span>Urgência (+{PERCENTUAL_URGENCIA_PADRAO}%)</span>
                <span>+{formatCurrency(calculos.valorUrgencia)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL</span>
              <span className="text-primary">{formatCurrency(calculos.valorTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isLoading}
            className="min-w-[150px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Finalizar Venda"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
