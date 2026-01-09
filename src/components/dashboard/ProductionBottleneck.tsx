import { AlertTriangle, Sparkles, Clock } from "lucide-react";
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
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="font-semibold text-foreground">Gargalos de Produção</h3>
        </div>
        <Badge variant="outline" className="text-warning border-warning">
          Atenção Necessária
        </Badge>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-muted rounded flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">📋</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">{item.stage}</span>
                  <p className="text-xs text-muted-foreground">{item.piecesCount} peças</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-medium text-foreground">{item.osCount} OS</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {item.avgTime}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={item.percentage} className="flex-1 h-2" />
              <span className="text-xs text-muted-foreground w-16 text-right">
                {item.percentage}% do total
              </span>
            </div>
          </div>
        ))}
      </div>

      {recommendation && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Recomendação:</p>
              <p className="text-xs text-muted-foreground">{recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
