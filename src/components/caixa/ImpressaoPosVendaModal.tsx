import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle, Printer, Tag, FileText } from "lucide-react";
import { usePrintOS } from "@/hooks/usePrintOS";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ImpressaoPosVendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osId: string;
  osNumero: string;
  clienteNome: string;
  valorTotal: number;
  totalPecas: number;
  previsaoEntrega: Date;
  onComplete: () => void;
}

export function ImpressaoPosVendaModal({
  open,
  onOpenChange,
  osId,
  osNumero,
  clienteNome,
  valorTotal,
  totalPecas,
  previsaoEntrega,
  onComplete,
}: ImpressaoPosVendaModalProps) {
  const [imprimirROL, setImprimirROL] = useState(true);
  const [imprimirEtiquetas, setImprimirEtiquetas] = useState(true);
  const [quantidadeEtiquetas, setQuantidadeEtiquetas] = useState(totalPecas.toString());
  const [isLoading, setIsLoading] = useState(false);

  const { printROL, printEtiquetas } = usePrintOS(osId);

  // Update quantity when modal opens or totalPecas changes
  useEffect(() => {
    if (open) {
      setQuantidadeEtiquetas(totalPecas.toString());
      setImprimirROL(true);
      setImprimirEtiquetas(true);
    }
  }, [open, totalPecas]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handlePrint = async () => {
    setIsLoading(true);

    try {
      if (imprimirROL) {
        await printROL(osId);
      }

      if (imprimirEtiquetas) {
        const qty = parseInt(quantidadeEtiquetas) || 1;
        await printEtiquetas(qty, osId);
      }
    } catch (error) {
      console.error("Erro ao imprimir:", error);
    } finally {
      setIsLoading(false);
      onComplete();
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-3">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <DialogTitle className="text-2xl text-center">
            OS {osNumero} Criada!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo da OS */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="font-semibold text-lg">{clienteNome}</p>
            <div className="flex justify-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>{totalPecas} peças</span>
              <span>•</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(valorTotal)}
              </span>
            </div>
            <p className="text-sm text-primary mt-2">
              Previsão: {format(previsaoEntrega, "dd/MM/yyyy (EEEE)", { locale: ptBR })}
            </p>
          </div>

          {/* Opções de Impressão */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Printer className="w-4 h-4" />
              O que deseja imprimir?
            </Label>

            {/* ROL */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="imprimir-rol"
                  checked={imprimirROL}
                  onCheckedChange={(checked) => setImprimirROL(checked as boolean)}
                />
                <label
                  htmlFor="imprimir-rol"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Imprimir ROL (Recibo)</span>
                </label>
              </div>
            </div>

            {/* Etiquetas */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="imprimir-etiquetas"
                  checked={imprimirEtiquetas}
                  onCheckedChange={(checked) => setImprimirEtiquetas(checked as boolean)}
                />
                <label
                  htmlFor="imprimir-etiquetas"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Imprimir Etiquetas</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="qtd-etiquetas" className="text-sm text-muted-foreground">
                  Qtd:
                </Label>
                <Input
                  id="qtd-etiquetas"
                  type="number"
                  value={quantidadeEtiquetas}
                  onChange={(e) => setQuantidadeEtiquetas(e.target.value)}
                  className="w-16 h-8 text-center"
                  min="1"
                  disabled={!imprimirEtiquetas}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              💡 Sugestão: 1 etiqueta por peça para identificação no processo
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isLoading}
            className="flex-1"
          >
            Pular
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isLoading || (!imprimirROL && !imprimirEtiquetas)}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Imprimindo...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
