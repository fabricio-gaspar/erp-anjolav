import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileText,
  Receipt,
  CreditCard,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EtapaRelatorio } from "./EtapaRelatorio";
import { EtapaNF } from "./EtapaNF";
import { EtapaPagamento } from "./EtapaPagamento";
import { EtapaEnvio } from "./EtapaEnvio";
import type { Fatura } from "@/hooks/useFaturas";

export interface LancamentoItem {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface DadosFaturamento {
  clienteId: string;
  clienteNome: string;
  clienteDocumento: string;
  clienteEmail: string | null;
  clienteTelefone: string | null;
  itens: LancamentoItem[];
  valorTotal: number;
  periodoInicio: string;
  periodoFim: string;
  observacao?: string;
  lancamentoIds?: string[]; // IDs dos lançamentos selecionados
}

interface FaturamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: DadosFaturamento | null;
  onComplete?: (fatura: Fatura) => void;
}

const etapas = [
  { id: 1, label: "Relatório", icon: FileText },
  { id: 2, label: "Nota Fiscal", icon: Receipt },
  { id: 3, label: "Pagamento", icon: CreditCard },
  { id: 4, label: "Envio", icon: Send },
];

export function FaturamentoModal({
  open,
  onOpenChange,
  dados,
  onComplete,
}: FaturamentoModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [faturaId, setFaturaId] = useState<string | null>(null);
  const [numeroNF, setNumeroNF] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{
    type: string;
    data: Record<string, unknown>;
  } | null>(null);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFaturaCreated = (id: string) => {
    setFaturaId(id);
  };

  const handleNFEmitida = (nf: string) => {
    setNumeroNF(nf);
  };

  const handlePaymentConfigured = (type: string, data: Record<string, unknown>) => {
    setPaymentData({ type, data });
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFaturaId(null);
    setNumeroNF(null);
    setPaymentData(null);
    onOpenChange(false);
  };

  if (!dados) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Finalizar Faturamento</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {etapas.map((etapa, index) => (
            <div key={etapa.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                    currentStep > etapa.id
                      ? "bg-success border-success text-white"
                      : currentStep === etapa.id
                      ? "bg-primary border-primary text-white"
                      : "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {currentStep > etapa.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <etapa.icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-2 font-medium",
                    currentStep >= etapa.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {etapa.label}
                </span>
              </div>
              {index < etapas.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2",
                    currentStep > etapa.id ? "bg-success" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          {currentStep === 1 && (
            <EtapaRelatorio
              dados={dados}
              onNext={handleNext}
              onFaturaCreated={handleFaturaCreated}
            />
          )}
          {currentStep === 2 && (
            <EtapaNF
              dados={dados}
              faturaId={faturaId}
              onNext={handleNext}
              onBack={handleBack}
              onNFEmitida={handleNFEmitida}
            />
          )}
          {currentStep === 3 && (
            <EtapaPagamento
              dados={dados}
              faturaId={faturaId}
              onNext={handleNext}
              onBack={handleBack}
              onPaymentConfigured={handlePaymentConfigured}
            />
          )}
          {currentStep === 4 && (
            <EtapaEnvio
              dados={dados}
              faturaId={faturaId}
              numeroNF={numeroNF}
              paymentData={paymentData}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
