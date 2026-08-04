import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedDocs, setSelectedDocs] = useState<string[]>(["ROL"]);

  const { updateFatura } = useFaturas();
  const { createEnvio } = useHistoricoEnvios(faturaId);
  const { configuracao: configGeral } = useConfiguracoesGerais();

  // Use centralized data from dados.configCliente
  const configCliente = dados.configCliente;

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
    link_portal: configCliente?.link_acesso || undefined,
    codigo_portal: configCliente?.codigo_acesso || undefined,
  };

  // Usar templates configurados ou padrão
  const templateWhatsApp = configGeral?.template_pix || TEMPLATE_WHATSAPP_DEFAULT;
  const templateEmail = configGeral?.template_boleto || TEMPLATE_EMAIL_DEFAULT;

  const handleDownloadROL = () => {
    const tipoRelatorio = configCliente?.tipo_relatorio || "detalhado";
    const nomeEmpresa = configGeral?.nome_empresa || "Lavanderia";
    
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>ROL - ${dados.clienteNome}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { margin: 0; font-size: 18px; }
          .header p { margin: 2px 0; font-size: 12px; color: #666; }
          .info { margin: 15px 0; display: flex; justify-content: space-between; }
          .info-item { font-size: 12px; }
          .info-item strong { display: block; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .total { font-weight: bold; text-align: right; margin-top: 15px; font-size: 16px; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
          .tipo-badge { display: inline-block; background: #e8e8e8; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${nomeEmpresa}</h1>
          <p>Romaneio de Lavanderia - <span class="tipo-badge">${tipoRelatorio === "mapa" ? "Mapa de Peças" : "Relatório Detalhado"}</span></p>
        </div>
        <div class="info">
          <div class="info-item">
            <strong>${dados.clienteNome}</strong>
            ${dados.clienteDocumento ? `<span>${dados.clienteDocumento}</span>` : ""}
            ${dados.clienteEndereco?.cidade ? `<br/><span>${dados.clienteEndereco.cidade}/${dados.clienteEndereco.uf}</span>` : ""}
          </div>
          <div class="info-item" style="text-align: right;">
            <strong>Período</strong>
            <span>${format(new Date(dados.periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dados.periodoFim), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center">Qtd</th>
              <th>Unidade</th>
              <th style="text-align:right">Valor Unit.</th>
              <th style="text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${dados.itens
              .map(
                (item) =>
                  `<tr>
                    <td>${item.produto}</td>
                    <td style="text-align:center">${item.quantidade}</td>
                    <td>${item.unidade}</td>
                    <td style="text-align:right">${formatCurrency(item.valorUnitario)}</td>
                    <td style="text-align:right">${formatCurrency(item.valorTotal)}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <p class="total">TOTAL: ${formatCurrency(dados.valorTotal)}</p>
        <div class="footer">
          <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
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

    const mensagem = substituirVariaveis(templateWhatsApp, templateVars);

    const phone = dados.clienteTelefone.replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(mensagem);

    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, "_blank");

    if (faturaId) {
      await createEnvio.mutateAsync({
        fatura_id: faturaId,
        canal: "whatsapp",
        destinatario: dados.clienteTelefone,
        mensagem: mensagem,
        documentos_enviados: selectedDocs,
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

    const mensagem = substituirVariaveis(templateEmail, templateVars);

    const subject = encodeURIComponent(
      `Faturamento - ${dados.clienteNome} - ${formatCurrency(dados.valorTotal)}`
    );
    const body = encodeURIComponent(mensagem);

    window.open(`mailto:${dados.clienteEmail}?subject=${subject}&body=${body}`);

    if (faturaId) {
      await createEnvio.mutateAsync({
        fatura_id: faturaId,
        canal: "email",
        destinatario: dados.clienteEmail,
        mensagem: mensagem,
        documentos_enviados: selectedDocs,
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
        <h4 className="font-medium text-sm mb-4">Arquivos Gerados — Selecione para enviar</h4>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="relative">
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={selectedDocs.includes("ROL")}
                onCheckedChange={(checked) => {
                  setSelectedDocs(prev =>
                    checked ? [...prev, "ROL"] : prev.filter(d => d !== "ROL")
                  );
                }}
              />
            </div>
            <Button
              variant="outline"
              className={`h-auto py-4 flex flex-col gap-2 w-full ${selectedDocs.includes("ROL") ? "border-primary bg-primary/5" : ""}`}
              onClick={handleDownloadROL}
            >
              <FileText className="w-6 h-6 text-primary" />
              <span className="text-sm">ROL</span>
              <Download className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="relative">
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={selectedDocs.includes("NF")}
                onCheckedChange={(checked) => {
                  setSelectedDocs(prev =>
                    checked ? [...prev, "NF"] : prev.filter(d => d !== "NF")
                  );
                }}
                disabled={!numeroNF}
              />
            </div>
            <Button
              variant="outline"
              className={`h-auto py-4 flex flex-col gap-2 w-full ${selectedDocs.includes("NF") ? "border-primary bg-primary/5" : ""}`}
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
          </div>

          <div className="relative">
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={selectedDocs.includes("Pagamento")}
                onCheckedChange={(checked) => {
                  setSelectedDocs(prev =>
                    checked ? [...prev, "Pagamento"] : prev.filter(d => d !== "Pagamento")
                  );
                }}
                disabled={!paymentData}
              />
            </div>
            <Button
              variant="outline"
              className={`h-auto py-4 flex flex-col gap-2 w-full ${selectedDocs.includes("Pagamento") ? "border-primary bg-primary/5" : ""}`}
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
