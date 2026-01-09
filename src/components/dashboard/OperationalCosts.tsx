import { DollarSign } from "lucide-react";

interface OperationalCostsProps {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

export function OperationalCosts({ month, revenue, expenses, profit, margin }: OperationalCostsProps) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Custos Operacionais - {month}</h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-success p-3 rounded-lg">
          <p className="text-xs text-success-foreground/80 uppercase tracking-wider mb-1">Receitas</p>
          <p className="text-lg font-bold text-success-foreground currency">
            R$ {revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-destructive p-3 rounded-lg">
          <p className="text-xs text-destructive-foreground/80 uppercase tracking-wider mb-1">Despesas</p>
          <p className="text-lg font-bold text-destructive-foreground currency">
            R$ {expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-muted p-3 rounded-lg">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Lucro</p>
          <p className="text-lg font-bold text-foreground currency">
            R$ {profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">Margem: {margin}%</p>
        </div>
      </div>

      {expenses === 0 && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          Nenhuma despesa registrada este mês
        </p>
      )}
    </div>
  );
}
