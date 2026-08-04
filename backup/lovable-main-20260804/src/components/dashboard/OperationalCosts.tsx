import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface OperationalCostsProps {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

export function OperationalCosts({ month, revenue, expenses, profit, margin }: OperationalCostsProps) {
  return (
    <div className="card-base p-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-slate-600" />
        </div>
        <h3 className="font-bold text-slate-800">Custos Operacionais - {month}</h3>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {/* Revenue */}
        <div className="bg-gradient-to-br from-success/10 to-success/5 p-4 rounded-xl border border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-success">Receitas</p>
          </div>
          <p className="text-xl font-bold text-success">
            R$ {revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Expenses */}
        <div className="bg-gradient-to-br from-destructive/10 to-destructive/5 p-4 rounded-xl border border-destructive/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive">Despesas</p>
          </div>
          <p className="text-xl font-bold text-destructive">
            R$ {expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Profit */}
        <div className="bg-gradient-to-br from-slate-100 to-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-slate-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lucro</p>
          </div>
          <p className="text-xl font-bold text-slate-800">
            R$ {profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1">Margem: {margin}%</p>
        </div>
      </div>

      {expenses === 0 && (
        <p className="text-center text-sm text-slate-400 mt-4 py-2 bg-slate-50 rounded-lg">
          Nenhuma despesa registrada este mês
        </p>
      )}
    </div>
  );
}
