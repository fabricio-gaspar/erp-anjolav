import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  // Dados completos do cliente
  clienteTipoPessoa?: string;
  clienteInscricaoMunicipal?: string | null;
  clienteInscricaoEstadual?: string | null;
  clienteRegimeTributario?: string | null;
  clienteClassificacao?: string;
  // Endereço completo do cliente
  clienteEndereco?: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
  // Configurações de pagamento do cliente
  configPagamento?: {
    forma_pagamento: string | null;
    dia_fechamento: number | null;
    dia_vencimento: number | null;
    condicao_pagamento: string | null;
    tipo_faturamento: string | null;
    cnpj_emissor_id: string | null;
    descricao_nf_id: string | null;
    listar_itens_detalhados: boolean | null;
  } | null;
  // Configurações gerais do cliente
  configCliente?: {
    tipo_relatorio: string | null;
    codigo_acesso: string | null;
    link_acesso: string | null;
    frequencia: string | null;
  } | null;
  itens: LancamentoItem[];
  valorTotal: number;
  periodoInicio: string;
  periodoFim: string;
  observacao?: string;
  lancamentoIds?: string[];
}

interface FaturamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: DadosFaturamento | null;
  faturaExistente?: Fatura | null;
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
  faturaExistente,
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
  // Estado para confirmação de saída
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  const markStepCompleted = (stepIndex: number) => {
    setStepsCompleted((prev) => {
      const newState = [...prev];
      newState[stepIndex] = true;
      return newState;
    });
  };

  const handleCloseAttempt = () => {
    setShowExitConfirmation(true);
  };

  const handleConfirmExit = () => {
    setShowExitConfirmation(false);
    onOpenChange(false);
  };

  const handleCancelExit = () => {
    setShowExitConfirmation(false);
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

  // Inicializar com fatura existente quando disponível
  useEffect(() => {
    if (open && faturaExistente) {
      setFaturaId(faturaExistente.id);
      setNumeroNF(faturaExistente.numero_nf || null);
      
      if (faturaExistente.forma_pagamento) {
        setPaymentData({
          type: faturaExistente.forma_pagamento,
          data: {
            boleto_url: faturaExistente.boleto_url,
            boleto_linha_digitavel: faturaExistente.boleto_linha_digitavel,
            pix_qr_code: faturaExistente.pix_qr_code,
            pix_copia_cola: faturaExistente.pix_copia_cola,
          },
        });
      }

      // Determinar etapa inicial baseado no status
      if (faturaExistente.data_envio) {
        // Já foi enviada - vai para etapa 4 (completa)
        setCurrentStep(4);
        setStepsCompleted([true, true, true, true]);
      } else if (faturaExistente.forma_pagamento) {
        // Pagamento configurado - vai para etapa 4 (envio)
        setCurrentStep(4);
        setStepsCompleted([true, true, true, false]);
      } else if (faturaExistente.numero_nf) {
        // Nota emitida - vai para etapa 3 (pagamento)
        setCurrentStep(3);
        setStepsCompleted([true, true, false, false]);
      } else if (faturaExistente.relatorio_gerado) {
        // Relatório gerado - vai para etapa 2 (NF)
        setCurrentStep(2);
        setStepsCompleted([true, false, false, false]);
      } else {
        // Pendente - começa da etapa 1 mas já tem a fatura
        setCurrentStep(1);
        setStepsCompleted([false, false, false, false]);
      }
    }
  }, [open, faturaExistente]);

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
    <>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          preventClose={true}
          onCloseAttempt={handleCloseAttempt}
        >
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

      {/* AlertDialog de confirmação de saída */}
      <AlertDialog open={showExitConfirmation} onOpenChange={setShowExitConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja sair do faturamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O progresso atual será perdido. Você precisará recomeçar o processo de faturamento desde o início.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelExit}>
              Continuar Editando
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sair e Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
