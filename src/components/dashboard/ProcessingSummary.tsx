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
  on_time: { 
    label: "No Prazo", 
    className: "bg-success/10 text-success border-success/30 font-bold" 
  },
  delayed: { 
    label: "Atrasado", 
    className: "bg-destructive/10 text-destructive border-destructive/30 font-bold" 
  },
  at_risk: { 
    label: "Em Risco", 
    className: "bg-warning/10 text-warning border-warning/30 font-bold" 
  },
};

export function ProcessingSummary({ items }: ProcessingSummaryProps) {
  const atrasados = items.filter((i) => i.status === "delayed").length;
  const emRisco = items.filter((i) => i.status === "at_risk").length;

  return (
    <div className="card-base p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-slate-600" />
          </div>
          <h3 className="font-bold text-slate-800">Resumo de Processamento</h3>
        </div>
        {(atrasados > 0 || emRisco > 0) && (
          <div className="flex items-center gap-2">
            {atrasados > 0 && (
              <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {atrasados} atrasado{atrasados > 1 ? "s" : ""}
              </Badge>
            )}
            {emRisco > 0 && (
              <Badge className="text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border-warning/30">
                {emRisco} em risco
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente / OS</th>
              <th>Etapa</th>
              <th>Peças / Peso</th>
              <th>Tempo</th>
              <th>Previsão</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr 
                key={index} 
                className={cn(
                  item.status === "delayed" && "bg-destructive/5",
                  item.status === "at_risk" && "bg-warning/5"
                )}
              >
                <td>
                  <div>
                    <p className="font-semibold text-slate-800">{item.clientName}</p>
                    {item.osNumero && (
                      <p className="text-xs text-slate-400 font-mono">{item.osNumero}</p>
                    )}
                  </div>
                </td>
                <td>
                  <Badge variant="secondary" className="font-medium text-xs bg-slate-100 text-slate-600">
                    {item.currentStage}
                  </Badge>
                </td>
                <td>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {item.quantidadePecas ? (
                      <span className="flex items-center gap-1">
                        <Shirt className="w-3.5 h-3.5" />
                        <span className="font-medium">{item.quantidadePecas}</span>
                      </span>
                    ) : null}
                    {item.pesoKg ? (
                      <span className="flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5" />
                        <span className="font-medium">{item.pesoKg}kg</span>
                      </span>
                    ) : null}
                    {!item.quantidadePecas && !item.pesoKg && "-"}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-medium">{item.timeInStage}</span>
                  </div>
                </td>
                <td className="text-sm font-medium text-slate-500">
                  {item.expectedDate || "-"}
                </td>
                <td>
                  <Badge 
                    variant="outline"
                    className={cn("text-[10px] uppercase tracking-wider", statusStyles[item.status].className)}
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
