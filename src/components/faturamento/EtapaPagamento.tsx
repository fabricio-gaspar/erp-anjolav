import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  QrCode,
  Landmark,
  Copy,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useConfiguracaoPagamentoCliente } from "@/hooks/useClientes";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { useCreateAsaasCharge } from "@/hooks/useAsaas";
import { useFaturas, calcularVencimento } from "@/hooks/useFaturas";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/faturamentoUtils";
import type { DadosFaturamento } from "./FaturamentoModal";

interface EtapaPagamentoProps {
  dados: DadosFaturamento;
  faturaId: string | null;
  onNext: () => void;
  onBack: () => void;
  onPaymentConfigured: (type: string, data: Record<string, unknown>) => void;
}

export function EtapaPagamento({
  dados,
  faturaId,
  onNext,
  onBack,
  onPaymentConfigured,
}: EtapaPagamentoProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [boletoData, setBoletoData] = useState<{
    url: string;
    linhaDigitavel: string;
  } | null>(null);
  const [pixData, setPixData] = useState<{
    qrCode: string | null;
    copyPaste: string | null;
  } | null>(null);

  const { configuracao: configPagamento, isLoading: isLoadingPagamento } =
    useConfiguracaoPagamentoCliente(dados.clienteId);
  const { configuracao: configGeral, isLoading: isLoadingGeral } =
    useConfiguracoesGerais();
  const { mutateAsync: createCharge } = useCreateAsaasCharge();
  const { updateFatura } = useFaturas();

  const formaPagamento = configPagamento?.forma_pagamento || "boleto";
  const diaVencimento = configPagamento?.dia_vencimento || 10;
  const isLoading = isLoadingPagamento || isLoadingGeral;

  // Calcular data de vencimento inteligente
  const dataVencimento = calcularVencimento(diaVencimento);

  const handleGenerateBoleto = async () => {
    if (!faturaId) return;

    setIsGenerating(true);
    try {
      const result = await createCharge({
        customer_name: dados.clienteNome,
        customer_cpf_cnpj: dados.clienteDocumento,
        customer_email: dados.clienteEmail || undefined,
        value: dados.valorTotal,
        due_date: format(dataVencimento, "yyyy-MM-dd"),
        description: `Faturamento - ${dados.clienteNome}`,
        billing_type: "BOLETO",
      });

      if (result?.bankSlipUrl) {
        setBoletoData({
          url: result.bankSlipUrl,
          linhaDigitavel: result.nossoNumero || "",
        });

        // Atualizar fatura com todos os dados de pagamento
        await updateFatura.mutateAsync({
          id: faturaId,
          asaas_charge_id: result.id,
          forma_pagamento: "boleto",
          data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
          boleto_url: result.bankSlipUrl,
          boleto_linha_digitavel: result.nossoNumero || null,
        });

        onPaymentConfigured("boleto", {
          url: result.bankSlipUrl,
          linhaDigitavel: result.nossoNumero,
          asaasId: result.asaasId,
          dataVencimento: format(dataVencimento, "yyyy-MM-dd"),
        });
      }
    } catch (error) {
      console.error("Erro ao gerar boleto:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePix = async () => {
    if (!faturaId) return;

    setIsGenerating(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const result = await createCharge({
        customer_name: dados.clienteNome,
        customer_cpf_cnpj: dados.clienteDocumento,
        customer_email: dados.clienteEmail || undefined,
        value: dados.valorTotal,
        due_date: format(dueDate, "yyyy-MM-dd"),
        description: `Faturamento - ${dados.clienteNome}`,
        billing_type: "PIX",
      });

      if (result?.pixQrCode || result?.pixCopyPaste) {
        setPixData({
          qrCode: result.pixQrCode || null,
          copyPaste: result.pixCopyPaste || null,
        });

        // Atualizar fatura com dados de PIX
        await updateFatura.mutateAsync({
          id: faturaId,
          asaas_charge_id: result.id,
          forma_pagamento: "pix",
          data_vencimento: format(dueDate, "yyyy-MM-dd"),
          pix_qr_code: result.pixQrCode || null,
          pix_copia_cola: result.pixCopyPaste || null,
        });

        onPaymentConfigured("pix", {
          qrCode: result.pixQrCode,
          copyPaste: result.pixCopyPaste,
          asaasId: result.asaasId,
        });
      }
    } catch (error) {
      console.error("Erro ao gerar PIX:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPix = () => {
    const textToCopy = pixData?.copyPaste || configGeral?.pix_chave;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setPixCopied(true);
      toast.success(pixData?.copyPaste ? "Código PIX copiado!" : "Chave PIX copiada!");
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  const handleUseTransferencia = async () => {
    if (!faturaId) return;

    // Salvar dados de transferência na fatura
    await updateFatura.mutateAsync({
      id: faturaId,
      forma_pagamento: "transferencia",
      data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
      dados_transferencia: {
        banco: configGeral?.banco_nome,
        agencia: configGeral?.banco_agencia,
        conta: configGeral?.banco_conta,
        titular: configGeral?.banco_titular,
      },
    });

    onPaymentConfigured("transferencia", {
      banco: configGeral?.banco_nome,
      agencia: configGeral?.banco_agencia,
      conta: configGeral?.banco_conta,
      titular: configGeral?.banco_titular,
      dataVencimento: format(dataVencimento, "yyyy-MM-dd"),
    });
    onNext();
  };

  const handleNext = async () => {
    if (formaPagamento === "boleto" && boletoData) {
      onNext();
    } else if (formaPagamento === "pix") {
      if (pixData) {
        onNext();
      } else if (configGeral?.pix_chave && faturaId) {
        // Usar chave PIX manual
        await updateFatura.mutateAsync({
          id: faturaId,
          forma_pagamento: "pix_manual",
          data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
          pix_copia_cola: configGeral.pix_chave,
        });
        onPaymentConfigured("pix_manual", {
          tipoChave: configGeral.pix_tipo_chave,
          chave: configGeral.pix_chave,
        });
        onNext();
      }
    } else if (formaPagamento === "transferencia") {
      handleUseTransferencia();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Configurar Pagamento</h3>
        <Badge variant="secondary" className="ml-auto capitalize">
          {formaPagamento}
        </Badge>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-muted-foreground">Valor a Cobrar</span>
          <span className="text-2xl font-bold text-primary">
            {formatCurrency(dados.valorTotal)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Calendar className="w-4 h-4" />
          <span>
            Vencimento: {format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })}
            <span className="text-xs ml-2">(Dia {diaVencimento} do cliente)</span>
          </span>
        </div>

        <Separator className="mb-6" />

        {/* PIX */}
        {formaPagamento === "pix" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-green-600" />
              <span className="font-medium">Pagamento via PIX</span>
            </div>

            {pixData?.qrCode ? (
              <div className="flex flex-col items-center gap-4 p-4 bg-muted rounded-lg">
                <img
                  src={`data:image/png;base64,${pixData.qrCode}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleCopyPix}
                >
                  {pixCopied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Copiar Código PIX
                </Button>
              </div>
            ) : configGeral?.pix_chave ? (
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Tipo: {configGeral.pix_tipo_chave}
                  </p>
                  <p className="font-mono text-lg">{configGeral.pix_chave}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleCopyPix}
                  >
                    {pixCopied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copiar Chave
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={handleGeneratePix}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4" />
                    )}
                    Gerar QR Code
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Chave PIX não configurada
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    Configure em Configurações &gt; Dados Gerais
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Boleto */}
        {formaPagamento === "boleto" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Pagamento via Boleto</span>
            </div>

            {boletoData ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 dark:text-green-400">
                    Boleto gerado com sucesso!
                  </span>
                </div>
                {boletoData.linhaDigitavel && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Linha Digitável:</p>
                    <p className="font-mono text-sm break-all">{boletoData.linhaDigitavel}</p>
                  </div>
                )}
                <Button asChild variant="outline" className="w-full gap-2">
                  <a href={boletoData.url} target="_blank" rel="noopener noreferrer">
                    Visualizar Boleto
                  </a>
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={handleGenerateBoleto}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                Gerar Boleto
              </Button>
            )}
          </div>
        )}

        {/* Transferência */}
        {formaPagamento === "transferencia" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Transferência Bancária</span>
            </div>

            {configGeral?.banco_nome ? (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Banco</span>
                    <p className="font-medium">{configGeral.banco_nome}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Agência</span>
                    <p className="font-medium">{configGeral.banco_agencia}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Conta</span>
                    <p className="font-medium">{configGeral.banco_conta}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Titular</span>
                    <p className="font-medium">{configGeral.banco_titular}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Dados bancários não configurados
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    Configure em Configurações &gt; Dados Gerais
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onPaymentConfigured("sem_cobranca", {});
              onNext();
            }}
            className="gap-2 text-muted-foreground"
          >
            Pular
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            onClick={handleNext}
            disabled={
              (formaPagamento === "boleto" && !boletoData) ||
              (formaPagamento === "pix" && !pixData && !configGeral?.pix_chave)
            }
            className="gap-2"
          >
            Próxima Etapa
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
