import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csvExport";
import { clientClassificationLabel } from "@/lib/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BillingClient = { cliente_id: string; razao_social: string; cpf_cnpj: string | null; classificacao: string; movimentos: number; faturaveis: number; nao_faturaveis: number; valor_faturavel: number };
type Filters = { start: string; end: string; search: string; eligibleOnly: boolean };
const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ConsultaFaturamento() {
  const permission = usePermissaoModulo("faturamento");
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const [start, setStart] = useState(() => format(new Date(), "yyyy-MM-01"));
  const [end, setEnd] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [filters, setFilters] = useState<Filters | null>(null);
  const query = useQuery({
    queryKey: ["central-report-billing", activeTenant?.id, session?.user.id, activeArea, filters],
    enabled: Boolean(filters && activeTenant?.id && session?.user.id && permission.allowed),
    queryFn: async () => {
      if (!filters) throw new Error("Informe os filtros.");
      const rows: BillingClient[] = [];
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await supabase.rpc("consultar_clientes_faturamento_periodo", { _area: activeArea, _inicio: filters.start, _fim: filters.end, _pagina: page, _tamanho: 100 });
        if (error) throw error;
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Resposta de faturamento inválida.");
        const payload = data as { total?: unknown; items?: unknown };
        if (!Array.isArray(payload.items) || !Number.isFinite(Number(payload.total))) throw new Error("Resposta de faturamento incompleta.");
        rows.push(...payload.items as BillingClient[]);
        if (rows.length >= Number(payload.total)) return { rows, truncated: false };
        if (payload.items.length === 0) throw new Error("A paginação do faturamento está incompleta.");
      }
      return { rows, truncated: true };
    },
  });
  if (permission.isLoading || !permission.allowed) return null;
  const term = filters?.search.trim().toLocaleLowerCase("pt-BR") ?? "";
  const rows = (query.data?.rows ?? []).filter(row => (!term || [row.razao_social,row.cpf_cnpj].some(value => value?.toLocaleLowerCase("pt-BR").includes(term))) && (!filters?.eligibleOnly || Number(row.faturaveis) > 0));
  const exportReport = () => downloadCsv("relatorio-clientes-a-faturar.csv", rows, [
    { header: "Cliente", value: row => row.razao_social }, { header: "CPF/CNPJ", value: row => row.cpf_cnpj },
    { header: "Operação", value: row => clientClassificationLabel(row.classificacao) }, { header: "ROLs faturáveis", value: row => row.faturaveis },
    { header: "ROLs não faturáveis", value: row => row.nao_faturaveis }, { header: "Valor faturável", value: row => row.valor_faturavel },
  ]);
  return <details open className="rounded-lg border bg-card text-card-foreground">
    <summary className="cursor-pointer px-5 py-4 font-semibold">Clientes a faturar</summary>
    <div className="space-y-4 border-t p-5">
      <p className="text-sm text-muted-foreground">Valores elegíveis para faturamento no período; não representam pagamentos recebidos.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-1"><Label htmlFor="report-billing-start">De</Label><Input id="report-billing-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="report-billing-end">Até</Label><Input id="report-billing-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="report-billing-search">Cliente ou documento</Label><Input id="report-billing-search" value={search} onChange={e => setSearch(e.target.value)} /></div><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={eligibleOnly} onChange={e => setEligibleOnly(e.target.checked)} />Somente com ROL faturável</label></div>
      <div className="flex flex-wrap gap-2"><Button disabled={!start || !end || start > end} onClick={() => setFilters({start,end,search,eligibleOnly})}>Consultar faturamento</Button>{query.data && !query.data.truncated && <Button variant="outline" disabled={!rows.length} onClick={exportReport}>Exportar CSV</Button>}</div>
      {start > end && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior à final.</p>}{query.isFetching && <p role="status" className="text-sm">Carregando faturamento…</p>}{query.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o faturamento. Tente novamente.</p>}
      {query.data && !query.isFetching && <><p className="text-sm">{rows.length} cliente(s){!query.data.truncated && ` · Valor faturável: ${money(rows.reduce((sum,row) => sum + Number(row.valor_faturavel || 0), 0))}`}</p>{query.data.truncated && <p role="alert" className="text-sm text-destructive">O período contém mais de 10.000 clientes. Reduza o intervalo.</p>}<div className="max-h-96 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Cliente","Documento","Operação","ROLs faturáveis","Não faturáveis","Valor faturável"].map(label => <th key={label} className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.cliente_id} className="border-t"><td className="px-3 py-2">{row.razao_social}</td><td className="px-3 py-2">{row.cpf_cnpj || "—"}</td><td className="px-3 py-2">{clientClassificationLabel(row.classificacao)}</td><td className="px-3 py-2">{row.faturaveis}</td><td className="px-3 py-2">{row.nao_faturaveis}</td><td className="px-3 py-2">{money(row.valor_faturavel)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm">Nenhum cliente encontrado no período.</p>}</div></>}
    </div>
  </details>;
}
