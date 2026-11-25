import { useState } from "react";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { useContasReceberUnificado } from "@/hooks/useContasReceberUnificado";
import { useContasPagarDirectory } from "@/hooks/useContasPagarDirectory";
import type { PayableStatusFilter, ReceivableStatusFilter } from "@/lib/financialAccountDirectory";
import { downloadCsv } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "receber" | "pagar";
type Filters = { search: string; start: string; end: string; status: string };
const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
const date = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";

function ContasReport({ canReceive, canPay }: {canReceive:boolean; canPay:boolean}) {
  const [mode, setMode] = useState<Mode>(canReceive ? "receber" : "pagar");
  const [search,setSearch] = useState("");
  const [start,setStart] = useState("");
  const [end,setEnd] = useState("");
  const [status,setStatus] = useState("todos");
  const [filters,setFilters] = useState<Filters | null>(null);
  const [page,setPage] = useState(1);
  const receiving = useContasReceberUnificado({ page, pageSize:25, search:filters?.search ?? "", dataInicio:filters?.start || undefined, dataFim:filters?.end || undefined, origem:"todos", status:(filters?.status || "todos") as ReceivableStatusFilter, enabled:Boolean(filters && mode === "receber" && canReceive) });
  const paying = useContasPagarDirectory({ page, pageSize:25, search:filters?.search ?? "", startDate:filters?.start || undefined, endDate:filters?.end || undefined, status:(filters?.status || "todos") as PayableStatusFilter, enabled:Boolean(filters && mode === "pagar" && canPay) });
  const query = mode === "receber" ? receiving : paying;
  const total = query.data?.total ?? 0;
  const items = mode === "receber" ? (receiving.data?.items ?? []).map(item => ({ id:item.id, name:item.cliente_nome || "—", description:item.descricao, due:item.data_vencimento, status:item.status, amount:Number(item.valor), settled:Number(item.valor_recebido) })) : (paying.data?.items ?? []).map(item => ({ id:item.id, name:item.fornecedor || "—", description:item.descricao, due:item.vencimento, status:item.status_exibicao, amount:Number(item.valor), settled:Number(item.valor_pago) }));
  const switchMode = (value:Mode) => { setMode(value); setStatus("todos"); setFilters(null); setPage(1); };
  return <div className="space-y-4 border-t p-5">
    <p className="text-sm text-muted-foreground">Consulta financeira da empresa. Os registros não identificam a operação em todos os casos; por isso, não são apresentados como exclusivos do PDV selecionado. As datas filtram o vencimento.</p>
    <div className="flex flex-wrap gap-2">{canReceive && <Button size="sm" variant={mode === "receber" ? "default" : "outline"} onClick={() => switchMode("receber")}>A receber</Button>}{canPay && <Button size="sm" variant={mode === "pagar" ? "default" : "outline"} onClick={() => switchMode("pagar")}>A pagar</Button>}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-1"><Label htmlFor="accounts-from">Vencimento de</Label><Input id="accounts-from" type="date" value={start} onChange={e=>setStart(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="accounts-to">Até</Label><Input id="accounts-to" type="date" value={end} onChange={e=>setEnd(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="accounts-search">Cliente, fornecedor ou descrição</Label><Input id="accounts-search" value={search} onChange={e=>setSearch(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="accounts-status">Situação</Label><select id="accounts-status" value={status} onChange={e=>setStatus(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="todos">Todas</option><option value="pendente">Pendente</option><option value="atrasado">Atrasado</option><option value="parcial">Parcial</option><option value={mode === "receber" ? "recebido" : "pago"}>{mode === "receber" ? "Recebido" : "Pago"}</option><option value="cancelado">Cancelado</option>{mode === "receber" && <option value="estornado">Estornado</option>}</select></div></div>
    <div className="flex flex-wrap gap-2"><Button disabled={Boolean(start && end && start > end)} onClick={()=>{setPage(1);setFilters({search,start,end,status});}}>Consultar contas</Button><Button variant="outline" disabled={!filters || !items.length || query.isFetching || query.isError} onClick={()=>downloadCsv(`contas-${mode}-pagina-${page}.csv`,items,[{header:mode === "receber" ? "Cliente" : "Fornecedor",value:r=>r.name},{header:"Descrição",value:r=>r.description},{header:"Vencimento",value:r=>r.due},{header:"Situação",value:r=>r.status},{header:"Valor",value:r=>r.amount},{header:"Pago ou recebido",value:r=>r.settled}])}>Exportar página CSV</Button></div>
    {start && end && start > end && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior à final.</p>}
    {filters && query.isFetching && <p role="status">Carregando contas…</p>}{filters && query.isError && <p role="alert" className="text-destructive">Não foi possível carregar as contas. Confira suas permissões e tente novamente.</p>}
    {filters && query.data && !query.isFetching && !query.isError && <><p className="text-sm">{total} conta(s) · Página {page} · O CSV contém apenas a página exibida.</p><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{[mode === "receber" ? "Cliente" : "Fornecedor","Descrição","Vencimento","Situação","Valor","Pago / recebido"].map(v=><th key={v} className="whitespace-nowrap px-3 py-2">{v}</th>)}</tr></thead><tbody>{items.map(row=><tr key={row.id} className="border-t"><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2">{date(row.due)}</td><td className="px-3 py-2">{row.status}</td><td className="px-3 py-2">{money(row.amount)}</td><td className="px-3 py-2">{money(row.settled)}</td></tr>)}</tbody></table>{!items.length && <p className="p-3 text-sm">Nenhuma conta encontrada.</p>}</div><div className="flex justify-end gap-2"><Button variant="outline" disabled={page <= 1} onClick={()=>setPage(page-1)}>Anterior</Button><Button variant="outline" disabled={page*25 >= total} onClick={()=>setPage(page+1)}>Próxima</Button></div></>}
  </div>;
}
export function ConsultaContas() {
  const receiving=usePermissaoModulo("contas_receber"), paying=usePermissaoModulo("contas_pagar");
  const [open,setOpen]=useState(true);
  if (receiving.isLoading || paying.isLoading || (!receiving.allowed && !paying.allowed)) return null;
  return <details open={open} className="rounded-lg border bg-card text-card-foreground" onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer px-5 py-4 font-semibold">Contas a pagar e receber</summary>{open && <ContasReport canReceive={receiving.allowed} canPay={paying.allowed} />}</details>;
}
