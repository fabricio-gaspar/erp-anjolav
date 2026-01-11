import { cn } from "@/lib/utils";
import { LucideIcon, Eye, Clock } from "lucide-react";
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
    <div
      className={cn(
        "rounded-lg p-4",
        isReceivable ? "bg-success-light" : "bg-muted"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              isReceivable ? "bg-success/20" : "bg-muted-foreground/10"
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5",
                isReceivable ? "text-success" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p
            className={cn(
              "text-xl font-bold currency",
              isReceivable ? "text-success" : "text-foreground"
            )}
          >
            R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-2 mb-3">
          {items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-t border-border/50"
            >
              <div className="flex items-center gap-2">
                <Clock
                  className={cn(
                    "w-4 h-4",
                    item.status === "vencida" ? "text-destructive" : "text-warning"
                  )}
                />
                <div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      item.status === "vencida" ? "text-destructive" : "text-warning"
                    )}
                  >
                    {item.status === "vencida" ? "Vencida" : "1 Vencida"}
                  </p>
                  <p className="text-sm font-medium text-foreground">{item.clientName}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "font-semibold currency",
                    item.status === "vencida" ? "text-destructive" : "text-warning"
                  )}
                >
                  R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">{item.dueDate}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
        <Eye className="w-4 h-4 mr-2" />
        Ver Todas
      </Button>
    </div>
  );
}
