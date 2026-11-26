import { useState } from "react";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { RelatorioCaixaOperacional, type RelatorioCaixaView } from "@/components/caixa/RelatorioCaixaOperacional";
import { Label } from "@/components/ui/label";

export function ConsultaCaixa() {
  const permission = usePermissaoModulo(["caixa", "faturamento"]);
  const [open, setOpen] = useState(true);
  const [day, setDay] = useState(new Date());
  const [endDay, setEndDay] = useState(new Date());
  const [view, setView] = useState<RelatorioCaixaView>("geral");
  if (permission.isLoading || !permission.allowed) return null;
  return <details open={open} className="rounded-lg border bg-card text-card-foreground" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer px-5 py-4 font-semibold">Relatório de caixa e recebimentos</summary>
    {open && <div className="space-y-3 border-t p-5">
      <div className="max-w-xs space-y-1"><Label htmlFor="central-cash-view">Consultar</Label><select id="central-cash-view" value={view} onChange={e => setView(e.target.value as RelatorioCaixaView)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="geral">Resumo por forma de pagamento</option><option value="movimentos">Movimentações</option><option value="rols">ROLs lançados</option><option value="baixas">Recebimentos</option></select></div>
      <RelatorioCaixaOperacional view={view} selectedDay={day} endDay={endDay} onSelectedDayChange={date => { setDay(date); if (date > endDay) setEndDay(date); }} onEndDayChange={date => { if (date >= day) setEndDay(date); }} />
    </div>}
  </details>;
}
