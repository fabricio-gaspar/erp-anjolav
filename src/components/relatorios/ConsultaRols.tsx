import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { Download, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import { supabase } from "@/integrations/supabase/client";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = (value: number | null) => value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "—";
function addressLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const address = value as Record<string, unknown>;
  return [address.logradouro, address.numero, address.bairro, address.cidade, address.uf].filter(part => typeof part === "string" && part.trim()).join(", ") || "—";
}
export type RolsReportKind = "rols" | "a_retirar" | "abertos" | "producao" | "delivery" | "taxas";
const REPORT_LABELS: Record<RolsReportKind, string> = {
  rols: "Todos os ROLs",
  a_retirar: "ROLs a retirar",
  abertos: "ROLs não entregues",
  producao: "Produção por prazo",
  delivery: "Entregas agendadas",
  taxas: "Taxas de delivery e KM cobrado",
};
type Order = {
  id: string; numero: string; data_retirada: string; data_previsao_entrega: string | null;
  status: string; status_pagamento: string | null; entrega_modalidade: string;
  taxa_entrega: number; valor_total: number | null; endereco_atendimento_snapshot: unknown;
  delivery_modelo_snapshot: string | null; delivery_distancia_km_snapshot: number | null;
  delivery_taxa_base_snapshot: number | null; delivery_taxa_km_snapshot: number | null;
  cliente: { razao_social: string; nome_fantasia: string | null } | null;
};
type Criteria = { kind: RolsReportKind; start: string; end: string; field: "data_retirada" | "data_previsao_entrega"; search: string; status: string; payment: string };

export function ConsultaRols({ selectedKind }: { selectedKind: RolsReportKind }) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const location = useLocation();
  const ordersPermission = usePermissaoModulo("ordens");
  const kind = selectedKind;
  const [start, setStart] = useState(selectedKind === "a_retirar" ? "" : format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [end, setEnd] = useState(selectedKind === "a_retirar" ? "" : format(new Date(), "yyyy-MM-dd"));
  const [field, setField] = useState<Criteria["field"]>(selectedKind === "delivery" || selectedKind === "producao" || selectedKind === "taxas" ? "data_previsao_entrega" : "data_retirada");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [payment, setPayment] = useState("todos");
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const query = useQuery({
    queryKey: ["central-report-orders", activeTenant?.id, session?.user.id, activeArea, criteria],
    enabled: Boolean(criteria && activeTenant?.id && session?.user.id && ordersPermission.allowed),
    queryFn: async () => {
      if (!criteria || !activeTenant?.id) throw new Error("Selecione uma empresa e os filtros.");
      const origins = getAllowedOrderOrigins(activeArea);
      const rows: Order[] = [];
      const pageSize = 500;
      for (let offset = 0; offset < 10000; offset += pageSize) {
        let q = supabase.from("ordens_servico").select("id,numero,data_retirada,data_previsao_entrega,status,status_pagamento,entrega_modalidade,taxa_entrega,valor_total,endereco_atendimento_snapshot,delivery_modelo_snapshot,delivery_distancia_km_snapshot,delivery_taxa_base_snapshot,delivery_taxa_km_snapshot,cliente:clientes!ordens_servico_cliente_id_fkey(razao_social,nome_fantasia)")
          .eq("tenant_id", activeTenant.id)
          .order(criteria.field, { ascending: true }).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
        if (criteria.start) q = q.gte(criteria.field, criteria.start);
        if (criteria.end) q = q.lte(criteria.field, criteria.end);
        if (origins) q = q.in("origem", [...origins]);
        if (criteria.kind === "a_retirar") q = q.eq("status", "expedicao");
        if (criteria.kind === "abertos" || criteria.kind === "producao") q = q.not("status", "in", '("entregue","cancelada","cancelado")');
        if (criteria.kind === "delivery" || criteria.kind === "taxas") q = q.eq("entrega_modalidade", "entrega").not("status", "in", '("cancelada","cancelado")');
        if (criteria.status !== "todos") q = q.eq("status", criteria.status);
        if (criteria.payment !== "todos") q = q.eq("status_pagamento", criteria.payment);
        const { data, error } = await q;
        if (error) throw error;
        const page = (data ?? []) as unknown as Order[];
        rows.push(...page);
        if (page.length < pageSize) return { rows, truncated: false };
      }
      return { rows, truncated: true };
    },
  });
  const needle = criteria?.search.trim().toLocaleLowerCase("pt-BR") ?? "";
  const rows = (query.data?.rows ?? []).filter((row) => !needle || [row.numero, row.cliente?.razao_social, row.cliente?.nome_fantasia].some(v => v?.toLocaleLowerCase("pt-BR").includes(needle)));
  const feeTotal = rows.reduce((sum, row) => sum + Number(row.taxa_entrega || 0), 0);
  const kmRows = rows.filter(row => row.delivery_modelo_snapshot === "km" && row.delivery_distancia_km_snapshot != null && row.delivery_taxa_base_snapshot != null);
  const recordedKm = kmRows.reduce((sum, row) => sum + Number(row.delivery_distancia_km_snapshot), 0);
  const kmAmount = kmRows.reduce((sum, row) => sum + Math.max(0, Number(row.taxa_entrega) - Number(row.delivery_taxa_base_snapshot)), 0);
  const historicalWithoutModel = rows.filter(row => row.delivery_modelo_snapshot == null).length;
  const orderLink = (id: string) => {
    const params = new URLSearchParams({ id });
    if (location.pathname.startsWith("/admin")) {
      const operation = new URLSearchParams(location.search).get("operacao");
      if (operation) params.set("operacao", operation);
      return `/admin/operacoes/ordens?${params}`;
    }
    return `/pdv/${activeArea === "industrial" ? "industrial" : "domestico"}/ordens?${params}`;
  };
  const exportCsv = () => {
    const safe = (value: unknown) => { const raw = String(value ?? "").replace(/^[\t\r\n ]*([=+@-])/, "'$1"); return `"${raw.replace(/"/g, '""')}"`; };
    const lines = [["ROL", "Cliente", "Entrada", "Prazo", "Situação", "Pagamento", "Valor do ROL", "Taxa delivery", "Modelo", "Distância km", "Base", "Preço por km", "Endereço"], ...rows.map(row => [row.numero, row.cliente?.nome_fantasia || row.cliente?.razao_social, dateLabel(row.data_retirada), dateLabel(row.data_previsao_entrega), row.status, row.status_pagamento, row.valor_total, row.taxa_entrega, row.delivery_modelo_snapshot, row.delivery_distancia_km_snapshot, row.delivery_taxa_base_snapshot, row.delivery_taxa_km_snapshot, addressLabel(row.endereco_atendimento_snapshot)])];
    const blob = new Blob(["\uFEFF" + lines.map(line => line.map(safe).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "relatorio-rols.csv"; link.click(); URL.revokeObjectURL(url);
  };
  if (ordersPermission.isLoading) return <p>Verificando permissões…</p>;
  if (!ordersPermission.allowed) return null;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-semibold">{REPORT_LABELS[kind]}</h2><p className="text-sm text-muted-foreground">{kind === "a_retirar" ? "Defina os filtros que desejar." : "Defina período e filtros para esta consulta."}</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1"><Label htmlFor="cr-field">Considerar data de</Label><select id="cr-field" value={field} onChange={e => setField(e.target.value as Criteria["field"])} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="data_retirada">Entrada</option><option value="data_previsao_entrega">Previsão de entrega</option></select></div>
      <div className="space-y-1"><Label htmlFor="cr-start">De</Label><Input id="cr-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="cr-end">Até</Label><Input id="cr-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="cr-search">Cliente ou ROL</Label><Input id="cr-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou número" /></div>
      {kind !== "a_retirar" && <div className="space-y-1"><Label htmlFor="cr-status">Etapa do ROL</Label><select id="cr-status" value={status} onChange={e => setStatus(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="todos">Todas as etapas</option><option value="retirada">Recebido</option><option value="separacao">Separação</option><option value="lavagem">Lavagem</option><option value="secagem">Secagem</option><option value="passadoria">Passadoria</option><option value="embalagem">Embalagem</option><option value="expedicao">Expedição</option><option value="entregue">Entregue</option><option value="cancelada">Cancelado</option></select></div>}
      <div className="space-y-1"><Label htmlFor="cr-payment">Pagamento</Label><select id="cr-payment" value={payment} onChange={e => setPayment(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="todos">Todos</option><option value="pendente">Pendente</option><option value="parcial">Parcial</option><option value="pago">Pago</option></select></div>
    </div>
    {kind === "a_retirar" && <p className="text-sm text-muted-foreground">Mostra ROLs em expedição, incluindo retirada no balcão e delivery. O período é opcional; abra o ROL para continuar o atendimento.</p>}
    <div className="flex flex-wrap items-center gap-3"><Button disabled={(kind !== "a_retirar" && (!start || !end)) || Boolean(start && end && start > end)} onClick={() => setCriteria({kind,start,end,field,search,status,payment})}><Search className="mr-2 h-4 w-4" />Consultar</Button>{query.data && !query.data.truncated && <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>}</div>
    {start && end && start > end && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior à data final.</p>}
    {criteria?.kind === "taxas" && <p className="text-sm text-muted-foreground">Taxas lançadas em ROLs de delivery; o total não corresponde necessariamente ao valor recebido. A distância cobrada é calculada em linha reta e é diferente dos quilômetros rodados pelo veículo. Pedidos anteriores podem não conter os dados da tarifa por KM.</p>}
    {criteria?.kind === "taxas" && query.data && !query.data.truncated && !query.isFetching && <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Distância registrada</p><p className="font-semibold">{kmRows.length ? `${recordedKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km` : "Não registrada"}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Parcela cobrada por KM</p><p className="font-semibold">{kmRows.length ? money(kmAmount) : "Não registrada"}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Sem dados históricos do modelo</p><p className="font-semibold">{historicalWithoutModel} ROL(s)</p></div></div>}
    {query.isFetching && <p role="status">Carregando relatório…</p>}
    {query.isError && <p role="alert" className="text-destructive">Não foi possível carregar os dados. Confira suas permissões e tente novamente.</p>}
    {query.data && !query.isFetching && <><p className="text-sm">{rows.length} ROL(s){criteria?.kind === "taxas" && !query.data.truncated ? ` · Taxas lançadas: ${money(feeTotal)}` : ""}</p>{query.data.truncated && <p role="alert" className="text-destructive">A consulta atingiu o limite de 10.000 registros. Reduza o período para obter o resultado completo.</p>}<div className="max-h-[36rem] overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["ROL", "Cliente", "Entrada", "Previsão", "Situação", "Pagamento", "Total", "Taxa delivery", "Modelo", "Distância", "Base", "Valor por km", "Endereço"].map(h => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="px-3 py-2"><Link className="font-semibold text-primary underline-offset-4 hover:underline" to={orderLink(row.id)} aria-label={`Abrir ROL ${row.numero}`}>{row.numero}</Link></td><td className="px-3 py-2">{row.cliente?.nome_fantasia || row.cliente?.razao_social || "—"}</td><td className="px-3 py-2">{dateLabel(row.data_retirada)}</td><td className="px-3 py-2">{dateLabel(row.data_previsao_entrega)}</td><td className="px-3 py-2">{row.status}</td><td className="px-3 py-2">{row.status_pagamento || "—"}</td><td className="px-3 py-2">{money(row.valor_total)}</td><td className="px-3 py-2">{money(row.taxa_entrega)}</td><td className="px-3 py-2">{row.delivery_modelo_snapshot || "Não registrada"}</td><td className="px-3 py-2">{row.delivery_distancia_km_snapshot == null ? "—" : `${Number(row.delivery_distancia_km_snapshot).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`}</td><td className="px-3 py-2">{money(row.delivery_taxa_base_snapshot)}</td><td className="px-3 py-2">{money(row.delivery_taxa_km_snapshot)}</td><td className="px-3 py-2">{addressLabel(row.endereco_atendimento_snapshot)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm">Nenhum ROL encontrado para os filtros selecionados.</p>}</div></>}
  </div>;
}
