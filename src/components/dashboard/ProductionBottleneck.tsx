import { Sparkles, Clock, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BottleneckItem {
  stage: string;
  osCount: number;
  piecesCount: number;
  avgTime: string;
  percentage: number;
}

interface ProductionBottleneckProps {
  items: BottleneckItem[];
  recommendation?: string;
}

export function ProductionBottleneck({ items, recommendation }: ProductionBottleneckProps) {
  return (
    <div className="card-base p-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <h3 className="font-semibold text-sm text-slate-800">Gargalos de Produção</h3>
      </div>

      <div className="mt-3 space-y-3">
        {items.map((item, index) => (
          <div key={index} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center">
                  <FileText className="w-3 h-3 text-slate-400" />
                </div>
                <span className="font-medium text-sm text-slate-700">{item.stage}</span>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="font-semibold text-sm text-slate-800">{item.osCount} OS</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {item.avgTime}
                </span>
              </div>
            </div>
            <Progress value={item.percentage} className="h-1.5" />
          </div>
        ))}
      </div>

      {recommendation && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-slate-500 leading-relaxed">{recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
