import { Clock, Shirt, Scale } from "lucide-react";
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
  on_time: { label: "No Prazo", className: "bg-success/8 text-success border-success/20" },
  delayed: { label: "Atrasado", className: "bg-destructive/8 text-destructive border-destructive/20" },
  at_risk: { label: "Em Risco", className: "bg-warning/8 text-warning border-warning/20" },
};

export function ProcessingSummary({ items }: ProcessingSummaryProps) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <h3 className="font-semibold text-sm text-slate-800">OS em Processamento</h3>
        <span className="text-xs text-slate-400 ml-auto">{items.length} itens</span>
      </div>

      <div className="overflow-x-auto mt-3">
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
              <tr key={index}>
                <td>
                  <div>
                    <p className="font-medium text-sm text-slate-700">{item.clientName}</p>
                    {item.osNumero && (
                      <p className="text-xs text-slate-400 font-mono">{item.osNumero}</p>
                    )}
                  </div>
                </td>
                <td>
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded">
                    {item.currentStage}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {item.quantidadePecas ? (
                      <span className="flex items-center gap-1">
                        <Shirt className="w-3 h-3" />
                        <span className="font-medium">{item.quantidadePecas}</span>
                      </span>
                    ) : null}
                    {item.pesoKg ? (
                      <span className="flex items-center gap-1">
                        <Scale className="w-3 h-3" />
                        <span className="font-medium">{item.pesoKg}kg</span>
                      </span>
                    ) : null}
                    {!item.quantidadePecas && !item.pesoKg && "-"}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{item.timeInStage}</span>
                  </div>
                </td>
                <td className="text-xs text-slate-400">
                  {item.expectedDate || "-"}
                </td>
                <td>
                  <Badge 
                    variant="outline"
                    className={cn("text-[10px] font-medium", statusStyles[item.status].className)}
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
