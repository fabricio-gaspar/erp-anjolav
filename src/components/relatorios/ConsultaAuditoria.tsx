import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditEvents, type AuditEventAction } from "@/hooks/useAuditEvents";
import { downloadCsv } from "@/lib/csvExport";
import { canSeeCompanyReport } from "@/lib/companyReportAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const actions:Record<string,string> = {INSERT:"Criação",UPDATE:"Alteração",DELETE:"Exclusão"};
const entities:Record<string,string> = {asaas_charges:"Cobranças",configuracoes_fiscais:"Configurações fiscais",contas_pagar:"Contas a pagar",contas_pagar_pagamentos:"Pagamentos de contas",pdv_capacidades_diarias:"Capacidade diária",faturas:"Faturas",ordens_servico:"ROLs",itens_ordem_servico:"Itens do ROL",pdv_pagamentos:"Pagamentos PDV",caixa_movimentacoes:"Movimentos de caixa",tenant_memberships:"Vínculos de empresa",user_roles:"Perfis de acesso",whatsapp_instancias:"WhatsApp"};
const datetime = (value:string) => { const d=new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR"); };
type Filters={action:AuditEventAction|"";entity:string;from:string;to:string};
function AuditReport() {
  const [filters,setFilters]=useState<Filters>({action:"",entity:"",from:"",to:""});
  const [cursor,setCursor]=useState<string|null>(null);
  const [history,setHistory]=useState<(string|null)[]>([]);
  const query=useAuditEvents({cursor,limit:25,filters});
  const events=query.data?.events ?? [];
  const update=(next:Partial<Filters>)=>{setFilters(old=>({...old,...next}));setCursor(null);setHistory([]);};
  return <div className="space-y-4 border-t p-5"><p className="text-sm text-muted-foreground">Eventos da empresa disponíveis ao administrador. Nem todos os registros identificam a operação; dados sensíveis e detalhes das alterações não são exibidos.</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-1"><Label htmlFor="central-audit-action">Ação</Label><select id="central-audit-action" value={filters.action} onChange={e=>update({action:e.target.value as Filters["action"]})} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Todas</option>{Object.entries(actions).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><div className="space-y-1"><Label htmlFor="central-audit-entity">Módulo</Label><select id="central-audit-entity" value={filters.entity} onChange={e=>update({entity:e.target.value})} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Todos</option>{Object.entries(entities).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><div className="space-y-1"><Label htmlFor="central-audit-from">De</Label><Input id="central-audit-from" type="date" max={filters.to||undefined} value={filters.from} onChange={e=>update({from:e.target.value})}/></div><div className="space-y-1"><Label htmlFor="central-audit-to">Até</Label><Input id="central-audit-to" type="date" min={filters.from||undefined} value={filters.to} onChange={e=>update({to:e.target.value})}/></div></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>update({action:"",entity:"",from:"",to:""})}>Limpar filtros</Button><Button variant="outline" disabled={!events.length || query.isFetching || query.isError} onClick={()=>downloadCsv(`auditoria-pagina-${history.length+1}.csv`,events,[{header:"Data e hora",value:e=>datetime(e.occurred_at)},{header:"Ação",value:e=>actions[e.action]||e.action},{header:"Módulo",value:e=>entities[e.entity_table]||"Registro do sistema"},{header:"Operador",value:e=>e.actor_name}])}>Exportar página CSV</Button></div>
    {query.isFetching && <p role="status">Carregando auditoria…</p>}{query.isError && <p role="alert" className="text-destructive">Não foi possível carregar a auditoria. Confira suas permissões e tente novamente.</p>}
    {query.data && !query.isFetching && !query.isError && <><p className="text-sm">Página {history.length+1} · O CSV contém apenas os eventos desta página.</p><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Data e hora","Ação","Módulo","Operador"].map(label=><th key={label} className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr></thead><tbody>{events.map(event=><tr key={event.id} className="border-t"><td className="px-3 py-2">{datetime(event.occurred_at)}</td><td className="px-3 py-2">{actions[event.action]||event.action}</td><td className="px-3 py-2">{entities[event.entity_table]||"Registro do sistema"}</td><td className="px-3 py-2">{event.actor_name}</td></tr>)}</tbody></table>{!events.length && <p className="p-3 text-sm">Nenhum evento encontrado.</p>}</div><div className="flex justify-end gap-2"><Button variant="outline" disabled={!history.length} onClick={()=>{setCursor(history[history.length-1]??null);setHistory(history.slice(0,-1));}}>Anterior</Button><Button variant="outline" disabled={!query.data.nextCursor} onClick={()=>{setHistory([...history,cursor]);setCursor(query.data!.nextCursor);}}>Próxima</Button></div></>}
  </div>;
}
export function ConsultaAuditoria() {
  const {activeTenant,security}=useAuth();
  if(!canSeeCompanyReport(activeTenant,security)) return null;
  return <details open className="rounded-lg border bg-card text-card-foreground"><summary className="cursor-pointer px-5 py-4 font-semibold">Auditoria da empresa</summary><AuditReport /></details>;
}
