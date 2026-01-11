import { FileText, Clock, Shirt, Scale, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ProcessingItem {
  clientName: string;
  osNumero?: string;
  currentStage: string;
  timeInStage: string;
  expectedDate?: string;
  status: "on_time" | "delayed" | "at_risk";
  quantidadePecas?: number;
  pesoKg?: number;
}

interface ProcessingSummaryProps {
  items: ProcessingItem[];
}

const statusStyles = {
  on_time: { label: "No Prazo", className: "bg-success/10 text-success border-success/30" },
  delayed: { label: "Atrasado", className: "bg-destructive/10 text-destructive border-destructive/30" },
  at_risk: { label: "Em Risco", className: "bg-warning/10 text-warning border-warning/30" },
};

export function ProcessingSummary({ items }: ProcessingSummaryProps) {
  const atrasados = items.filter((i) => i.status === "delayed").length;
  const emRisco = items.filter((i) => i.status === "at_risk").length;

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Resumo de Processamento</h3>
        </div>
        {(atrasados > 0 || emRisco > 0) && (
          <div className="flex items-center gap-2">
            {atrasados > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {atrasados} atrasado{atrasados > 1 ? "s" : ""}
              </Badge>
            )}
            {emRisco > 0 && (
              <Badge className="text-[10px] bg-warning/10 text-warning border-warning/30">
                {emRisco} em risco
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase text-muted-foreground">
              <th className="text-left font-medium py-2">Cliente / OS</th>
              <th className="text-left font-medium py-2">Etapa</th>
              <th className="text-left font-medium py-2">Peças / Peso</th>
              <th className="text-left font-medium py-2">Tempo</th>
              <th className="text-left font-medium py-2">Previsão</th>
              <th className="text-left font-medium py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr 
                key={index} 
                className={cn(
                  "border-t border-border transition-colors",
                  item.status === "delayed" && "bg-destructive/5",
                  item.status === "at_risk" && "bg-warning/5"
                )}
              >
                <td className="py-3">
                  <div>
                    <p className="font-medium text-foreground text-sm">{item.clientName}</p>
                    {item.osNumero && (
                      <p className="text-xs text-muted-foreground font-mono">{item.osNumero}</p>
                    )}
                  </div>
                </td>
                <td className="py-3">
                  <Badge variant="secondary" className="font-normal text-xs">
                    {item.currentStage}
                  </Badge>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {item.quantidadePecas ? (
                      <span className="flex items-center gap-1">
                        <Shirt className="w-3 h-3" />
                        {item.quantidadePecas}
                      </span>
                    ) : null}
                    {item.pesoKg ? (
                      <span className="flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        {item.pesoKg}kg
                      </span>
                    ) : null}
                    {!item.quantidadePecas && !item.pesoKg && "-"}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {item.timeInStage}
                  </div>
                </td>
                <td className="py-3 text-sm text-muted-foreground">
                  {item.expectedDate || "-"}
                </td>
                <td className="py-3">
                  <Badge 
                    variant="outline"
                    className={cn("text-[10px]", statusStyles[item.status].className)}
                  >
                    {statusStyles[item.status].label}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
