import { AlertTriangle, Sparkles, Clock, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

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
    <div className="card-bordered-warning p-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <h3 className="font-bold text-slate-800">Gargalos de Produção</h3>
        </div>
        <Badge className="bg-warning/10 text-warning border-warning/30 font-bold text-[10px] uppercase tracking-wider">
          Atenção Necessária
        </Badge>
      </div>

      {/* Items */}
      <div className="mt-4 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <span className="font-semibold text-slate-800">{item.stage}</span>
                  <p className="text-xs text-slate-400">{item.piecesCount} peças</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-800">{item.osCount} OS</span>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {item.avgTime}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={item.percentage} className="flex-1 h-2.5" />
              <span className="text-xs font-medium text-slate-500 w-16 text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Recomendação</p>
              <p className="text-sm text-slate-600">{recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
