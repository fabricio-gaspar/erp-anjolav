import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { toast } from "sonner";
import type { DadosFaturamento } from "./FaturamentoModal";

interface EtapaEnvioProps {
  dados: DadosFaturamento;
  faturaId: string | null;
  numeroNF: string | null;
  paymentData: { type: string; data: Record<string, unknown> } | null;
  onClose: () => void;
}

export function EtapaEnvio({
  dados,
  faturaId,
  numeroNF,
  paymentData,
  onClose,
}: EtapaEnvioProps) {
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const handleDownloadROL = () => {
    // Generate ROL PDF (reuse existing print logic)
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
        <table>
          <thead>
            <tr><th>Item</th><th>Qtd</th><th>Valor</th></tr>
          </thead>
          <tbody>
            ${dados.itens
              .map(
                (item) =>
                  `<tr><td>${item.produto}</td><td>${item.quantidade}</td><td>${formatCurrency(item.valorTotal)}</td></tr>`
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
    // In production, would download the actual NF PDF
  };

  const handleDownloadPayment = () => {
    if (!paymentData) return;

    if (paymentData.type === "boleto" && paymentData.data.url) {
      window.open(paymentData.data.url as string, "_blank");
    } else {
      toast.info("Dados do pagamento exibidos no console");
      console.log("Payment data:", paymentData);
    }
  };

  const handleSendWhatsApp = () => {
    if (!dados.clienteTelefone) {
      toast.error("Cliente não possui telefone cadastrado");
      return;
    }

    const phone = dados.clienteTelefone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá ${dados.clienteNome}!\n\nSegue o resumo do seu faturamento:\n\n` +
        `Valor Total: ${formatCurrency(dados.valorTotal)}\n` +
        (numeroNF ? `Nota Fiscal: ${numeroNF}\n` : "") +
        `\nObrigado pela preferência!`
    );

    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const handleSendEmail = () => {
    if (!dados.clienteEmail) {
      toast.error("Cliente não possui e-mail cadastrado");
      return;
    }

    const subject = encodeURIComponent(
      `Faturamento - ${dados.clienteNome} - ${formatCurrency(dados.valorTotal)}`
    );
    const body = encodeURIComponent(
      `Prezado(a) ${dados.clienteNome},\n\n` +
        `Segue o resumo do seu faturamento:\n\n` +
        `Valor Total: ${formatCurrency(dados.valorTotal)}\n` +
        (numeroNF ? `Nota Fiscal: ${numeroNF}\n` : "") +
        `\nAtenciosamente`
    );

    window.open(`mailto:${dados.clienteEmail}?subject=${subject}&body=${body}`);
  };

  const handleSend = async () => {
    setIsSending(true);
    
    try {
      if (sendWhatsApp) {
        handleSendWhatsApp();
      }
      
      if (sendEmail) {
        handleSendEmail();
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

      <Separator />

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {sendEmail && sendWhatsApp
            ? "Será enviado por e-mail e WhatsApp"
            : sendEmail
            ? "Será enviado por e-mail"
            : sendWhatsApp
            ? "Será enviado por WhatsApp"
            : "Nenhum método de envio selecionado"}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
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
                <Check className="w-4 h-4" />
                Finalizar e Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
