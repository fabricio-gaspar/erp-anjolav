import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Purchase = { id:string; numero:number; fornecedor_nome:string; status:string; data_pedido:string; previsao_entrega:string|null; valor_total:number; valor_pendente:number };
type Filters = { search:string; status:string; start:string; end:string };
const money = (value:number) => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date = (value:string|null) => value ? value.split("-").reverse().join("/") : "—";
const labels:Record<string,string> = { rascunho:"Rascunho",aprovado:"Aguardando recebimento",parcial:"Parcial",recebido:"Recebido",cancelado:"Cancelado" };
function ComprasReport() {
  const { activeTenant,session }=useAuth();
  const [start,setStart]=useState(()=>format(new Date(),"yyyy-MM-01"));
  const [end,setEnd]=useState(()=>format(new Date(),"yyyy-MM-dd"));
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [filters,setFilters]=useState<Filters|null>(null);
  const query=useQuery({queryKey:["central-report-purchases",activeTenant?.id,session?.user.id,filters],enabled:Boolean(filters && activeTenant?.id && session?.user.id),queryFn:async()=>{
    if (!filters) throw new Error("Informe os filtros.");
    const rows:Purchase[]=[];
    for(let page=1;page<=100;page++) {
      const {data,error}=await supabase.rpc("consultar_diretorio_pedidos_compra",{_busca:filters.search.trim().slice(0,80)||null,_situacao:filters.status,_pagina:page,_tamanho:100});
      if(error) throw error;
      if(!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Resposta de compras inválida.");
      const result=data as {items?:unknown;total?:unknown};
      if(!Array.isArray(result.items) || !Number.isFinite(Number(result.total))) throw new Error("Resposta de compras incompleta.");
      rows.push(...result.items as Purchase[]);
      if(rows.length >= Number(result.total)) return rows.filter(row=>(!filters.start || row.data_pedido >= filters.start) && (!filters.end || row.data_pedido <= filters.end));
      if(!result.items.length) throw new Error("A paginação de compras está incompleta.");
    }
    throw new Error("Muitos pedidos para consultar com segurança. Refine fornecedor ou situação.");
  }});
  const rows=query.data ?? [];
  return <div className="space-y-4 border-t p-5"><p className="text-sm text-muted-foreground">Compras são compartilhadas pela empresa. O período considera a data do pedido; o valor pendente segue o saldo informado nos pedidos e pode incluir rascunhos.</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-1"><Label htmlFor="purchase-from">Pedido de</Label><Input id="purchase-from" type="date" value={start} onChange={e=>setStart(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="purchase-to">Até</Label><Input id="purchase-to" type="date" value={end} onChange={e=>setEnd(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="purchase-search">Fornecedor ou número</Label><Input id="purchase-search" value={search} onChange={e=>setSearch(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="purchase-status">Situação</Label><select id="purchase-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todas</option><option value="open">Em aberto</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div>
    <div className="flex flex-wrap gap-2"><Button disabled={Boolean(start && end && start>end)} onClick={()=>setFilters({start,end,search,status})}>Consultar compras</Button><Button variant="outline" disabled={!rows.length || query.isFetching || query.isError} onClick={()=>downloadCsv("relatorio-compras.csv",rows,[{header:"Pedido",value:r=>r.numero},{header:"Fornecedor",value:r=>r.fornecedor_nome},{header:"Data",value:r=>r.data_pedido},{header:"Previsão",value:r=>r.previsao_entrega},{header:"Situação",value:r=>labels[r.status] || r.status},{header:"Valor",value:r=>r.valor_total},{header:"Valor pendente",value:r=>r.valor_pendente}])}>Exportar CSV</Button></div>
    {start && end && start>end && <p role="alert" className="text-destructive">A data inicial deve ser anterior à final.</p>}{query.isFetching && <p role="status">Carregando compras…</p>}{query.isError && <p role="alert" className="text-destructive">Não foi possível obter todas as compras com segurança. Refine a busca e tente novamente.</p>}
    {query.data && !query.isFetching && !query.isError && <><p className="text-sm">{rows.length} pedido(s) · Total dos pedidos não cancelados: {money(rows.filter(row=>row.status!=="cancelado").reduce((sum,row)=>sum+Number(row.valor_total||0),0))} · Pendente em pedidos não cancelados (inclui rascunhos): {money(rows.filter(row=>row.status!=="cancelado").reduce((sum,row)=>sum+Number(row.valor_pendente||0),0))}</p><div className="max-h-96 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Pedido","Fornecedor","Data","Previsão","Situação","Valor","Pendente"].map(label=><th className="whitespace-nowrap px-3 py-2" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr className="border-t" key={row.id}><td className="px-3 py-2">{row.numero}</td><td className="px-3 py-2">{row.fornecedor_nome}</td><td className="px-3 py-2">{date(row.data_pedido)}</td><td className="px-3 py-2">{date(row.previsao_entrega)}</td><td className="px-3 py-2">{labels[row.status]||row.status}</td><td className="px-3 py-2">{money(row.valor_total)}</td><td className="px-3 py-2">{money(row.valor_pendente)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-3 text-sm">Nenhuma compra encontrada no período.</p>}</div></>}
  </div>;
}
export function ConsultaCompras() {
  const permission=usePermissaoModulo("produtos"); const [open,setOpen]=useState(true);
  if(permission.isLoading || !permission.allowed) return null;
  return <details open={open} className="rounded-lg border bg-card text-card-foreground" onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer px-5 py-4 font-semibold">Compras da empresa</summary>{open && <ComprasReport />}</details>;
}
