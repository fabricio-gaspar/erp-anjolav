import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  FileText,
  Receipt,
  CreditCard,
  Send,
  Check,
  Lock,
  AlertCircle,
} from "lucide-react";
import { EtapaRelatorio } from "./EtapaRelatorio";
import { EtapaNF } from "./EtapaNF";
import { EtapaPagamento } from "./EtapaPagamento";
import { EtapaEnvio } from "./EtapaEnvio";
import type { Fatura } from "@/hooks/useFaturas";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

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
  // Estado para controlar quais etapas foram completadas
  const [stepsCompleted, setStepsCompleted] = useState<boolean[]>([false, false, false, false]);

  const markStepCompleted = (stepIndex: number) => {
    setStepsCompleted((prev) => {
      const newState = [...prev];
      newState[stepIndex] = true;
      return newState;
    });
  };

  const handleNext = () => {
    if (currentStep < 4) {
      markStepCompleted(currentStep - 1);
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

  // Reset estados internos quando o modal fecha
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setFaturaId(null);
      setNumeroNF(null);
      setPaymentData(null);
      setStepsCompleted([false, false, false, false]);
    }
  }, [open]);

  // Verifica se uma etapa está bloqueada
  const isStepLocked = (stepId: number): boolean => {
    if (stepId === 1) return false;
    // Etapa bloqueada se a anterior não foi completada
    return !stepsCompleted[stepId - 2];
  };

  // Fallback visual quando dados não estão disponíveis
  if (!dados) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Dados Indisponíveis
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Os dados do faturamento não estão disponíveis. Isso pode ocorrer se os lançamentos foram atualizados.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Feche este modal e selecione novamente os lançamentos para gerar a fatura.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Finalizar Faturamento</DialogTitle>
        </DialogHeader>

        {/* Stepper com bloqueio visual */}
        <TooltipProvider>
          <div className="flex items-center justify-between mb-6">
            {etapas.map((etapa, index) => {
              const isLocked = isStepLocked(etapa.id);
              const isCompleted = stepsCompleted[etapa.id - 1];
              const isCurrent = currentStep === etapa.id;

              return (
                <div key={etapa.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors relative",
                            isCompleted
                              ? "bg-success border-success text-white"
                              : isCurrent
                              ? "bg-primary border-primary text-white"
                              : isLocked
                              ? "bg-muted border-muted-foreground/20 text-muted-foreground/50"
                              : "bg-muted border-muted-foreground/30 text-muted-foreground"
                          )}
                        >
                          {isCompleted ? (
                            <Check className="w-5 h-5" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            <etapa.icon className="w-5 h-5" />
                          )}
                        </div>
                      </TooltipTrigger>
                      {isLocked && (
                        <TooltipContent>
                          <p>Complete a etapa anterior para continuar</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <span
                      className={cn(
                        "text-xs mt-2 font-medium",
                        isCurrent || isCompleted
                          ? "text-foreground"
                          : isLocked
                          ? "text-muted-foreground/50"
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
                        isCompleted ? "bg-success" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>

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
              onClose={() => onOpenChange(false)}
              onBack={handleBack}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
