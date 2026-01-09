import { FileText, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProcessingItem {
  clientName: string;
  currentStage: string;
  timeInStage: string;
  expectedDate?: string;
  status: "on_time" | "delayed" | "at_risk";
}

interface ProcessingSummaryProps {
  items: ProcessingItem[];
}

const statusStyles = {
  on_time: { label: "No Prazo", className: "bg-success-light text-success" },
  delayed: { label: "Atrasado", className: "bg-destructive-light text-destructive" },
  at_risk: { label: "Em Risco", className: "bg-warning-light text-warning" },
};

export function ProcessingSummary({ items }: ProcessingSummaryProps) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Resumo de Processamento</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase text-muted-foreground">
              <th className="text-left font-medium py-2">Cliente</th>
              <th className="text-left font-medium py-2">Etapa Atual</th>
              <th className="text-left font-medium py-2">Tempo na Etapa</th>
              <th className="text-left font-medium py-2">Previsão</th>
              <th className="text-left font-medium py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t border-border">
                <td className="py-3 font-medium text-foreground">{item.clientName}</td>
                <td className="py-3">
                  <Badge variant="secondary" className="font-normal">
                    {item.currentStage}
                  </Badge>
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
                  <Badge className={statusStyles[item.status].className}>
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
