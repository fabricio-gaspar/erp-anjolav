import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Send,
  FileText,
  Receipt,
  CreditCard,
  Download,
  Mail,
  MessageSquare,
  Check,
  Loader2,
  User,
  History,
  ChevronLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useFaturas } from "@/hooks/useFaturas";
import { useHistoricoEnvios } from "@/hooks/useHistoricoEnvios";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import {
  formatCurrency,
  substituirVariaveis,
  TEMPLATE_WHATSAPP_DEFAULT,
  TEMPLATE_EMAIL_DEFAULT,
  type TemplateVariables,
} from "@/lib/faturamentoUtils";
import type { DadosFaturamento } from "./FaturamentoModal";

interface EtapaEnvioProps {
  dados: DadosFaturamento;
  faturaId: string | null;
  numeroNF: string | null;
  paymentData: { type: string; data: Record<string, unknown> } | null;
  onClose: () => void;
  onBack?: () => void;
}

export function EtapaEnvio({
  dados,
  faturaId,
  numeroNF,
  paymentData,
  onClose,
  onBack,
}: EtapaEnvioProps) {
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { updateFatura } = useFaturas();
  const { createEnvio } = useHistoricoEnvios(faturaId);
  const { configuracao: configGeral } = useConfiguracoesGerais();

  // Preparar variáveis para templates
  const templateVars: TemplateVariables = {
    cliente: dados.clienteNome,
    valor: formatCurrency(dados.valorTotal),
    vencimento: paymentData?.data?.dataVencimento
      ? format(new Date(paymentData.data.dataVencimento as string), "dd/MM/yyyy", { locale: ptBR })
      : format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    numero_nf: numeroNF || undefined,
    link_boleto: paymentData?.data?.url as string || undefined,
    periodo: `${format(new Date(dados.periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dados.periodoFim), "dd/MM/yyyy", { locale: ptBR })}`,
  };

  // Usar templates configurados ou padrão
  const templateWhatsApp = configGeral?.template_pix || TEMPLATE_WHATSAPP_DEFAULT;
  const templateEmail = configGeral?.template_boleto || TEMPLATE_EMAIL_DEFAULT;

  const handleDownloadROL = () => {
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ROL - ${dados.clienteNome}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .total { font-weight: bold; text-align: right; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Romaneio de Lavanderia</h1>
        <p><strong>Cliente:</strong> ${dados.clienteNome}</p>
        <p><strong>Período:</strong> ${format(new Date(dados.periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dados.periodoFim), "dd/MM/yyyy", { locale: ptBR })}</p>
        <table>
          <thead>
            <tr><th>Item</th><th>Qtd</th><th>Unidade</th><th>Valor</th></tr>
          </thead>
          <tbody>
            ${dados.itens
              .map(
                (item) =>
                  `<tr><td>${item.produto}</td><td>${item.quantidade}</td><td>${item.unidade}</td><td>${formatCurrency(item.valorTotal)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
        <p class="total">TOTAL: ${formatCurrency(dados.valorTotal)}</p>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadNF = () => {
    if (!numeroNF) return;
    toast.info("Nota Fiscal: " + numeroNF);
  };

  const handleDownloadPayment = () => {
    if (!paymentData) return;

    if (paymentData.type === "boleto" && paymentData.data.url) {
      window.open(paymentData.data.url as string, "_blank");
    } else if (paymentData.data.copyPaste) {
      navigator.clipboard.writeText(paymentData.data.copyPaste as string);
      toast.success("Código PIX copiado!");
    } else {
      toast.info("Dados do pagamento exibidos no console");
      console.log("Payment data:", paymentData);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!dados.clienteTelefone) {
      toast.error("Cliente não possui telefone cadastrado");
      return false;
    }

    // Substituir variáveis no template
    const mensagem = substituirVariaveis(templateWhatsApp, templateVars);

    const phone = dados.clienteTelefone.replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(mensagem);

    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, "_blank");

    // Registrar envio no histórico
    if (faturaId) {
      await createEnvio.mutateAsync({
        fatura_id: faturaId,
        canal: "whatsapp",
        destinatario: dados.clienteTelefone,
        mensagem: mensagem,
        documentos_enviados: ["ROL", numeroNF ? "NF" : "", paymentData ? "Pagamento" : ""].filter(Boolean),
        status: "enviado",
      });
    }

    return true;
  };

  const handleSendEmail = async () => {
    if (!dados.clienteEmail) {
      toast.error("Cliente não possui e-mail cadastrado");
      return false;
    }

    // Substituir variáveis no template
    const mensagem = substituirVariaveis(templateEmail, templateVars);

    const subject = encodeURIComponent(
      `Faturamento - ${dados.clienteNome} - ${formatCurrency(dados.valorTotal)}`
    );
    const body = encodeURIComponent(mensagem);

    window.open(`mailto:${dados.clienteEmail}?subject=${subject}&body=${body}`);

    // Registrar envio no histórico
    if (faturaId) {
      await createEnvio.mutateAsync({
        fatura_id: faturaId,
        canal: "email",
        destinatario: dados.clienteEmail,
        mensagem: mensagem,
        documentos_enviados: ["ROL", numeroNF ? "NF" : "", paymentData ? "Pagamento" : ""].filter(Boolean),
        status: "enviado",
      });
    }

    return true;
  };

  const handleSend = async () => {
    setIsSending(true);

    try {
      const canaisEnviados: string[] = [];
      let destinatarioFinal = "";

      if (sendWhatsApp) {
        const success = await handleSendWhatsApp();
        if (success) {
          canaisEnviados.push("whatsapp");
          destinatarioFinal = dados.clienteTelefone || "";
        }
      }

      if (sendEmail) {
        const success = await handleSendEmail();
        if (success) {
          canaisEnviados.push("email");
          destinatarioFinal = dados.clienteEmail || destinatarioFinal;
        }
      }

      // Atualizar fatura com status "enviado"
      if (faturaId && canaisEnviados.length > 0) {
        await updateFatura.mutateAsync({
          id: faturaId,
          status: "enviado",
          data_envio: new Date().toISOString(),
          canais_envio: canaisEnviados,
          destinatario_envio: destinatarioFinal,
        });
      }

      toast.success("Faturamento finalizado com sucesso!");
      setTimeout(onClose, 1500);
    } catch (error) {
      console.error("Erro ao enviar:", error);
      toast.error("Erro ao enviar");
    } finally {
      setIsSending(false);
    }
  };

  const handleFinalizarSemEnvio = async () => {
    // Atualizar status para "pendente" ou manter o atual
    if (faturaId) {
      await updateFatura.mutateAsync({
        id: faturaId,
        data_envio: null,
        canais_envio: [],
      });
    }
    toast.success("Faturamento finalizado!");
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Send className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Envio ao Cliente</h3>
      </div>

      {/* Downloads */}
      <Card className="p-4">
        <h4 className="font-medium text-sm mb-4">Arquivos Gerados</h4>
        <div className="grid sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={handleDownloadROL}
          >
            <FileText className="w-6 h-6 text-primary" />
            <span className="text-sm">ROL</span>
            <Download className="w-4 h-4 text-muted-foreground" />
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={handleDownloadNF}
            disabled={!numeroNF}
          >
            <Receipt className="w-6 h-6 text-green-600" />
            <span className="text-sm">Nota Fiscal</span>
            {numeroNF ? (
              <Badge variant="secondary" className="text-xs">
                {numeroNF.slice(-8)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Não emitida
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-2"
            onClick={handleDownloadPayment}
            disabled={!paymentData}
          >
            <CreditCard className="w-6 h-6 text-blue-600" />
            <span className="text-sm">Pagamento</span>
            {paymentData ? (
              <Badge variant="secondary" className="text-xs capitalize">
                {paymentData.type}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Não configurado
              </Badge>
            )}
          </Button>
        </div>
      </Card>

      {/* Destinatário */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Destinatário</h4>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">E-mail</p>
                <p className="text-xs text-muted-foreground">
                  {dados.clienteEmail || "Não cadastrado"}
                </p>
              </div>
            </div>
            <Switch
              checked={sendEmail}
              onCheckedChange={setSendEmail}
              disabled={!dados.clienteEmail}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  {dados.clienteTelefone || "Não cadastrado"}
                </p>
              </div>
            </div>
            <Switch
              checked={sendWhatsApp}
              onCheckedChange={setSendWhatsApp}
              disabled={!dados.clienteTelefone}
            />
          </div>
        </div>
      </Card>

      {/* Preview da mensagem */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Preview da Mensagem</h4>
        </div>
        <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line max-h-32 overflow-y-auto">
          {sendWhatsApp
            ? substituirVariaveis(templateWhatsApp, templateVars)
            : sendEmail
            ? substituirVariaveis(templateEmail, templateVars)
            : "Selecione um canal de envio para ver o preview"}
        </div>
      </Card>

      <Separator />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            {sendEmail && sendWhatsApp
              ? "Será enviado por e-mail e WhatsApp"
              : sendEmail
              ? "Será enviado por e-mail"
              : sendWhatsApp
              ? "Será enviado por WhatsApp"
              : "Nenhum método de envio selecionado"}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={handleFinalizarSemEnvio}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Finalizar sem Enviar
          </Button>
          <Button
            onClick={handleSend}
            disabled={(!sendEmail && !sendWhatsApp) || isSending}
            className="gap-2"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Finalizar e Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
