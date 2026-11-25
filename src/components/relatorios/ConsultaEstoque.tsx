import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StockRow = { id: string; nome: string; categoria: string | null; unidade: string | null; quantidade_atual: number; quantidade_minima: number; localizacao: string | null; ativo: boolean | null };
type Filters = { search: string; status: string };
export function ConsultaEstoque() {
  const permission = usePermissaoModulo("produtos");
  const { activeTenant, session } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ativos");
  const [filters, setFilters] = useState<Filters | null>(null);
  const query = useQuery({
    queryKey: ["central-report-stock", activeTenant?.id, session?.user.id, filters],
    enabled: Boolean(filters && activeTenant?.id && session?.user.id && permission.allowed),
    queryFn: async () => {
      if (!activeTenant?.id || !filters) throw new Error("Selecione a empresa e os filtros.");
      const rows: StockRow[] = [];
      for (let offset = 0; offset < 10000; offset += 500) {
        let q = supabase.from("estoque_produtos").select("id,nome,categoria,unidade,quantidade_atual,quantidade_minima,localizacao,ativo")
          .eq("tenant_id", activeTenant.id).order("nome").order("id").range(offset, offset + 499);
        if (filters.status === "ativos" || filters.status === "baixo") q = q.eq("ativo", true);
        if (filters.status === "inativos") q = q.eq("ativo", false);
        const { data, error } = await q;
        if (error) throw error;
        const page = (data ?? []) as StockRow[];
        rows.push(...page);
        if (page.length < 500) return { rows, truncated: false };
      }
      return { rows, truncated: true };
    },
  });
  if (permission.isLoading || !permission.allowed) return null;
  const term = filters?.search.trim().toLocaleLowerCase("pt-BR") ?? "";
  const rows = (query.data?.rows ?? []).filter(row => (!term || [row.nome,row.categoria,row.localizacao].some(value => value?.toLocaleLowerCase("pt-BR").includes(term)))
    && (filters?.status !== "baixo" || (Number(row.quantidade_minima) > 0 && Number(row.quantidade_atual) <= Number(row.quantidade_minima))));
  const exportReport = () => downloadCsv("relatorio-estoque.csv", rows, [
    { header: "Insumo", value: row => row.nome }, { header: "Categoria", value: row => row.categoria },
    { header: "Saldo atual", value: row => row.quantidade_atual }, { header: "Unidade", value: row => row.unidade },
    { header: "Mínimo", value: row => row.quantidade_minima }, { header: "Localização", value: row => row.localizacao },
    { header: "Situação", value: row => row.ativo ? "Ativo" : "Inativo" },
  ]);
  return <details open className="rounded-lg border bg-card text-card-foreground">
    <summary className="cursor-pointer px-5 py-4 font-semibold">Relatório de estoque</summary>
    <div className="space-y-4 border-t p-5">
      <p className="text-sm text-muted-foreground">O estoque é compartilhado pela empresa; os saldos não são separados por operação.</p>
      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="report-stock-search">Insumo, categoria ou local</Label><Input id="report-stock-search" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="report-stock-status">Situação</Label><select id="report-stock-status" value={status} onChange={e => setStatus(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="ativos">Ativos</option><option value="baixo">No mínimo ou abaixo</option><option value="inativos">Inativos</option><option value="todos">Todos</option></select></div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => setFilters({search,status})}>Consultar estoque</Button>{query.data && !query.data.truncated && <Button variant="outline" disabled={!rows.length} onClick={exportReport}>Exportar CSV</Button>}</div>
      {query.isFetching && <p role="status" className="text-sm">Carregando estoque…</p>}{query.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o estoque. Tente novamente.</p>}
      {query.data && !query.isFetching && <><p className="text-sm">{rows.length} insumo(s)</p>{query.data.truncated && <p role="alert" className="text-sm text-destructive">A consulta atingiu 10.000 registros. O resultado completo não pode ser exibido com esta seleção.</p>}<div className="max-h-96 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Insumo","Categoria","Saldo","Mínimo","Local","Situação"].map(label => <th key={label} className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="px-3 py-2">{row.nome}</td><td className="px-3 py-2">{row.categoria || "—"}</td><td className="px-3 py-2">{row.quantidade_atual} {row.unidade || ""}</td><td className="px-3 py-2">{row.quantidade_minima} {row.unidade || ""}</td><td className="px-3 py-2">{row.localizacao || "—"}</td><td className="px-3 py-2">{row.ativo ? "Ativo" : "Inativo"}</td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm">Nenhum insumo encontrado para os filtros selecionados.</p>}</div></>}
    </div>
  </details>;
}
