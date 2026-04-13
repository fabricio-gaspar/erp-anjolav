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
}

export function FinanceCard({ title, subtitle, total, icon: Icon, variant, items = [] }: FinanceCardProps) {
  const isReceivable = variant === "receivable";

  return (
    <div className="finance-card">
      {/* Header */}
      <div className="finance-card-header">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isReceivable ? "bg-success/10" : "bg-slate-100"
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4",
                isReceivable ? "text-success" : "text-slate-500"
              )}
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 truncate">{title}</h3>
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="text-left sm:text-right flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Total</p>
          <p
            className={cn(
              "text-lg font-bold",
              isReceivable ? "text-success" : "text-slate-800"
            )}
          >
            R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="mt-2 space-y-0 divide-y divide-slate-100">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 first:pt-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    item.status === "vencida" ? "bg-destructive/10" : "bg-warning/10"
                  )}
                >
                  <Clock
                    className={cn(
                      "w-4 h-4",
                      item.status === "vencida" ? "text-destructive" : "text-warning"
                    )}
                  />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      item.status === "vencida" ? "text-destructive" : "text-warning"
                    )}
                  >
                    {item.status === "vencida" ? "Vencida" : "A Vencer"}
                  </p>
                  <p className="text-sm font-medium text-slate-700">{item.clientName}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "font-bold",
                    item.status === "vencida" ? "text-destructive" : "text-warning"
                  )}
                >
                  R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-slate-400">{item.dueDate}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-slate-100">
        <Button 
          variant="outline" 
          size="sm"
          className="w-full text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800 h-7 text-xs"
        >
          <Eye className="w-3 h-3 mr-1.5" />
          Ver Todas
          <ChevronRight className="w-3 h-3 ml-auto" />
        </Button>
      </div>
    </div>
  );
}
