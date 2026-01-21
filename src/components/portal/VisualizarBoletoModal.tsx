import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Download, CreditCard, Check, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { FaturaPortal } from "@/hooks/usePortalData";

interface VisualizarBoletoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: FaturaPortal;
}

export function VisualizarBoletoModal({ open, onOpenChange, fatura }: VisualizarBoletoModalProps) {
  const [copiadoLinha, setCopiadoLinha] = useState(false);
  const [copiadoPix, setCopiadoPix] = useState(false);

  const handleCopiarLinha = async () => {
    if (fatura.boleto_linha_digitavel) {
      await navigator.clipboard.writeText(fatura.boleto_linha_digitavel);
      setCopiadoLinha(true);
      toast.success("Linha digitável copiada!");
      setTimeout(() => setCopiadoLinha(false), 2000);
    }
  };

  const handleCopiarPix = async () => {
    if (fatura.pix_copia_cola) {
      await navigator.clipboard.writeText(fatura.pix_copia_cola);
      setCopiadoPix(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopiadoPix(false), 2000);
    }
  };

  const handleDownload = () => {
    if (fatura.boleto_url) {
      window.open(fatura.boleto_url, "_blank");
    }
  };

  const getStatusBadge = () => {
    switch (fatura.status) {
      case "pago":
        return <Badge className="bg-green-600">Pago</Badge>;
      case "nota_emitida":
        return <Badge variant="secondary">Aguardando Pagamento</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-600" />
            Boleto - R$ {Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do Boleto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-medium text-lg">
                R$ {Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-medium">
                {fatura.data_vencimento
                  ? format(new Date(fatura.data_vencimento), "dd/MM/yyyy", { locale: ptBR })
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Período</p>
              <p className="font-medium">
                {format(new Date(fatura.periodo_inicio), "dd/MM", { locale: ptBR })} a{" "}
                {format(new Date(fatura.periodo_fim), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Boleto Viewer */}
          {fatura.boleto_url ? (
            <div className="border rounded-lg overflow-hidden bg-muted/30 h-[400px]">
              <iframe
                src={fatura.boleto_url}
                className="w-full h-full"
                title="Visualização do Boleto"
              />
            </div>
          ) : (
            <div className="border rounded-lg bg-muted/30 h-[200px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>PDF do boleto não disponível</p>
              </div>
            </div>
          )}

          {/* Linha Digitável */}
          {fatura.boleto_linha_digitavel && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Linha Digitável</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-background p-3 rounded border font-mono break-all">
                  {fatura.boleto_linha_digitavel}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopiarLinha}
                  className="shrink-0"
                >
                  {copiadoLinha ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* PIX */}
          {fatura.pix_copia_cola && (
            <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-800 dark:text-green-200">Pagar com PIX</p>
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-4">
                {/* QR Code */}
                <div className="bg-white p-3 rounded-lg border">
                  <QRCodeSVG
                    value={fatura.pix_copia_cola}
                    size={150}
                    level="M"
                  />
                </div>

                {/* Código Copia e Cola */}
                <div className="flex-1 w-full">
                  <p className="text-xs text-muted-foreground mb-2">Código PIX Copia e Cola</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded border font-mono break-all max-h-20 overflow-auto">
                      {fatura.pix_copia_cola}
                    </code>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700 shrink-0"
                      onClick={handleCopiarPix}
                    >
                      {copiadoPix ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {fatura.boleto_url && (
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Boleto
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
