import { lazy, Suspense, useState } from "react";
import { format } from "date-fns";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RelatorioItens = lazy(() => import("@/components/caixa/RelatorioItens").then(module => ({ default: module.RelatorioItens })));

export function ConsultaProdutos() {
  const permission = usePermissaoModulo(["relatorios", "caixa", "faturamento"]);
  const [open, setOpen] = useState(true);
  const [start, setStart] = useState(() => format(new Date(), "yyyy-MM-01"));
  const [end, setEnd] = useState(() => format(new Date(), "yyyy-MM-dd"));
  if (permission.isLoading || !permission.allowed) return null;
  return <details open={open} className="rounded-lg border bg-card text-card-foreground" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer px-5 py-4 font-semibold">Relatório de produtos e serviços</summary>
    {open && <div className="space-y-4 border-t p-5">
      <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="central-items-start">Entrada de</Label><Input id="central-items-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="central-items-end">Até</Label><Input id="central-items-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div></div>
      {start && end && start <= end ? <Suspense fallback={<p className="text-sm">Carregando relatório…</p>}><RelatorioItens startDate={new Date(`${start}T00:00:00`)} endDate={new Date(`${end}T23:59:59`)} /></Suspense> : <p role="alert" className="text-sm text-destructive">Informe um período válido.</p>}
    </div>}
  </details>;
}
