import { useState } from "react";
import { Printer, FileText, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePrintOS } from "@/hooks/usePrintOS";

interface ImprimirOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServicoId: string;
  osNumero: string;
  clienteNome: string;
}

export function ImprimirOSModal({
  open,
  onOpenChange,
  ordemServicoId,
  osNumero,
  clienteNome,
}: ImprimirOSModalProps) {
  const [tipoImpressao, setTipoImpressao] = useState<"rol" | "etiqueta" | "ambos">("rol");
  const [quantidadeEtiquetas, setQuantidadeEtiquetas] = useState(1);
  
  const { printROL, printEtiqueta, printEtiquetas, isLoading } = usePrintOS(ordemServicoId);

  const handlePrint = async () => {
    if (tipoImpressao === "rol") {
      await printROL();
    } else if (tipoImpressao === "etiqueta") {
      if (quantidadeEtiquetas > 1) {
        await printEtiquetas(quantidadeEtiquetas);
      } else {
        await printEtiqueta();
      }
    } else if (tipoImpressao === "ambos") {
      await printROL();
      setTimeout(async () => {
        if (quantidadeEtiquetas > 1) {
          await printEtiquetas(quantidadeEtiquetas);
        } else {
          await printEtiqueta();
        }
      }, 500);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Imprimir OS
          </DialogTitle>
          <DialogDescription>
            OS {osNumero} - {clienteNome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Tipo de Impressão</Label>
            <RadioGroup
              value={tipoImpressao}
              onValueChange={(value) => setTipoImpressao(value as "rol" | "etiqueta" | "ambos")}
              className="grid grid-cols-1 gap-3"
            >
              <label
                htmlFor="rol"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  tipoImpressao === "rol" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="rol" id="rol" />
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Recibo (ROL)</p>
                  <p className="text-xs text-muted-foreground">Recibo completo com itens e valores</p>
                </div>
              </label>

              <label
                htmlFor="etiqueta"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  tipoImpressao === "etiqueta" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="etiqueta" id="etiqueta" />
                <Tag className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Etiqueta</p>
                  <p className="text-xs text-muted-foreground">Etiqueta com código de barras</p>
                </div>
              </label>

              <label
                htmlFor="ambos"
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  tipoImpressao === "ambos" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value="ambos" id="ambos" />
                <div className="flex gap-1">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <Tag className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Ambos</p>
                  <p className="text-xs text-muted-foreground">Imprimir ROL e etiquetas</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {(tipoImpressao === "etiqueta" || tipoImpressao === "ambos") && (
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade de Etiquetas</Label>
              <Input
                id="quantidade"
                type="number"
                min={1}
                max={100}
                value={quantidadeEtiquetas}
                onChange={(e) => setQuantidadeEtiquetas(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Máximo de 100 etiquetas por impressão
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Imprimindo...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
