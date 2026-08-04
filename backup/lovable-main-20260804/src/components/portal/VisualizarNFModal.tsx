import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Download, FileText, Check } from "lucide-react";
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

interface VisualizarNFModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: FaturaPortal;
}

export function VisualizarNFModal({ open, onOpenChange, fatura }: VisualizarNFModalProps) {
  const [copiado, setCopiado] = useState(false);

  const handleCopiarChave = async () => {
    if (fatura.chave_acesso) {
      await navigator.clipboard.writeText(fatura.chave_acesso);
      setCopiado(true);
      toast.success("Chave de acesso copiada!");
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const handleDownload = () => {
    if (fatura.link_pdf_nf) {
      window.open(fatura.link_pdf_nf, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Nota Fiscal {fatura.numero_nf ? `#${fatura.numero_nf}` : ""}
            <Badge variant="secondary" className="ml-2">
              {fatura.status === "pago" ? "Pago" : "Pendente"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {/* PDF Viewer */}
          {fatura.link_pdf_nf ? (
            <div className="border rounded-lg overflow-hidden bg-muted/30 h-[500px]">
              <iframe
                src={fatura.link_pdf_nf}
                className="w-full h-full"
                title="Visualização da Nota Fiscal"
              />
            </div>
          ) : (
            <div className="border rounded-lg bg-muted/30 h-[300px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>PDF da nota fiscal não disponível</p>
              </div>
            </div>
          )}

          {/* Informações da NF */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Número da NF</p>
              <p className="font-medium">{fatura.numero_nf || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data de Emissão</p>
              <p className="font-medium">
                {fatura.data_emissao_nf
                  ? format(new Date(fatura.data_emissao_nf), "dd/MM/yyyy", { locale: ptBR })
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-medium">
                R$ {Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Chave de Acesso */}
          {fatura.chave_acesso && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Chave de Acesso</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded border font-mono break-all">
                  {fatura.chave_acesso}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopiarChave}
                  className="shrink-0"
                >
                  {copiado ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {fatura.link_pdf_nf && (
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
