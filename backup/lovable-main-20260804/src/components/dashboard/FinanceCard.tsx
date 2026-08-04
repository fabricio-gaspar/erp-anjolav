import { cn } from "@/lib/utils";
import { LucideIcon, Eye, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FinanceItem {
  id: string;
  status: "vencida" | "pendente" | "paga" | "a_vencer";
  clientName: string;
  value: number;
  dueDate: string;
}

interface FinanceCardProps {
  title: string;
  subtitle: string;
  total: number;
  icon: LucideIcon;
  variant: "receivable" | "payable";
  items?: FinanceItem[];
  onViewAll?: () => void;
}

export function FinanceCard({ title, subtitle, total, icon: Icon, variant, items = [], onViewAll }: FinanceCardProps) {
  const isReceivable = variant === "receivable";

  return (
    <div className="card-base p-4">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-slate-700">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] font-medium text-slate-400 mb-0.5">Total</p>
          <p className={cn(
            "text-lg font-bold",
            isReceivable ? "text-success" : "text-slate-800"
          )}>
            R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="mt-3 space-y-0 divide-y divide-slate-50">
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0">
              <div className="min-w-0">
                <p className={cn(
                  "text-[10px] font-medium",
                  item.status === "vencida" ? "text-destructive" : "text-warning"
                )}>
                  {item.status === "vencida" ? "Vencida" : "A Vencer"}
                </p>
                <p className="text-sm text-slate-600 truncate">{item.clientName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={cn(
                  "font-semibold text-sm",
                  item.status === "vencida" ? "text-destructive" : "text-slate-700"
                )}>
                  R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-400">{item.dueDate}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full text-slate-400 hover:text-slate-600 h-7 text-xs"
          onClick={onViewAll}
        >
          <Eye className="w-3 h-3 mr-1.5" />
          Ver Todas
          <ChevronRight className="w-3 h-3 ml-auto" />
        </Button>
      </div>
    </div>
  );
}
