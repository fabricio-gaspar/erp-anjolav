import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClientRow = { id: string; razao_social: string; nome_fantasia: string | null; cpf_cnpj: string | null; telefone: string | null; email: string | null; ativo: boolean | null; tipo_pessoa: string | null; classificacao: string | null; created_at: string };
type Filters = { search: string; status: string; type: string; start: string; end: string };

export function ConsultaClientes() {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const permission = usePermissaoModulo("clientes");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [type, setType] = useState("todos");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [filters, setFilters] = useState<Filters | null>(null);
  const query = useQuery({
    queryKey: ["central-report-clients", activeTenant?.id, session?.user.id, activeArea, filters],
    enabled: Boolean(filters && activeTenant?.id && session?.user.id && permission.allowed),
    queryFn: async () => {
      if (!filters || !activeTenant?.id) throw new Error("Selecione a empresa e os filtros.");
      const rows: ClientRow[] = [];
      for (let offset = 0; offset < 10000; offset += 500) {
        let q = supabase.from("clientes").select("id,razao_social,nome_fantasia,cpf_cnpj,telefone,email,ativo,tipo_pessoa,classificacao,created_at")
          .eq("tenant_id", activeTenant.id).order("razao_social").order("id").range(offset, offset + 499);
        if (activeArea !== "central") q = q.eq("classificacao", activeArea);
        if (filters.status !== "todos") q = q.eq("ativo", filters.status === "ativo");
        if (filters.type !== "todos") q = q.eq("tipo_pessoa", filters.type);
        if (filters.start) q = q.gte("created_at", new Date(`${filters.start}T00:00:00`).toISOString());
        if (filters.end) q = q.lt("created_at", addDays(new Date(`${filters.end}T00:00:00`), 1).toISOString());
        const { data, error } = await q;
        if (error) throw error;
        const page = (data ?? []) as ClientRow[];
        rows.push(...page);
        if (page.length < 500) return { rows, truncated: false };
      }
      return { rows, truncated: true };
    },
  });
  if (permission.isLoading || !permission.allowed) return null;
  const term = filters?.search.trim().toLocaleLowerCase("pt-BR") ?? "";
  const rows = (query.data?.rows ?? []).filter(row => !term || [row.razao_social, row.nome_fantasia, row.cpf_cnpj, row.telefone, row.email].some(value => value?.toLocaleLowerCase("pt-BR").includes(term)));
  const exportReport = () => downloadCsv("relatorio-clientes.csv", rows, [
    { header: "Cliente", value: row => row.nome_fantasia || row.razao_social },
    { header: "CPF/CNPJ", value: row => row.cpf_cnpj }, { header: "Telefone", value: row => row.telefone },
    { header: "E-mail", value: row => row.email }, { header: "Tipo", value: row => row.tipo_pessoa },
    { header: "Operação", value: row => row.classificacao }, { header: "Situação", value: row => row.ativo ? "Ativo" : "Inativo" },
    { header: "Cadastro", value: row => format(new Date(row.created_at), "dd/MM/yyyy") },
  ]);
  return <details open className="rounded-lg border bg-card text-card-foreground">
    <summary className="cursor-pointer px-5 py-4 font-semibold">Relatório de clientes</summary>
    <div className="space-y-4 border-t p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1"><Label htmlFor="report-client-search">Nome, documento ou contato</Label><Input id="report-client-search" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="report-client-status">Situação</Label><select id="report-client-status" value={status} onChange={e => setStatus(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="todos">Todos</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></div>
        <div className="space-y-1"><Label htmlFor="report-client-type">Tipo</Label><select id="report-client-type" value={type} onChange={e => setType(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="todos">Todos</option><option value="cpf">Pessoa física</option><option value="cnpj">Pessoa jurídica</option></select></div>
        <div className="space-y-1"><Label htmlFor="report-client-start">Cadastrado de</Label><Input id="report-client-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="report-client-end">Até</Label><Input id="report-client-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2"><Button disabled={Boolean(start && end && start > end)} onClick={() => setFilters({ search, status, type, start, end })}>Consultar clientes</Button>{query.data && !query.data.truncated && <Button variant="outline" disabled={!rows.length} onClick={exportReport}>Exportar CSV</Button>}</div>
      {start && end && start > end && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior à final.</p>}
      {query.isFetching && <p role="status" className="text-sm">Carregando clientes…</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os clientes. Tente novamente.</p>}
      {query.data && !query.isFetching && <><p className="text-sm">{rows.length} cliente(s)</p>{query.data.truncated && <p role="alert" className="text-sm text-destructive">A consulta atingiu 10.000 registros. Reduza o período para obter o resultado completo.</p>}<div className="max-h-96 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{["Cliente", "Documento", "Telefone", "E-mail", "Tipo", "Operação", "Situação", "Cadastro"].map(label => <th key={label} className="whitespace-nowrap px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="px-3 py-2">{row.nome_fantasia || row.razao_social}</td><td className="px-3 py-2">{row.cpf_cnpj || "—"}</td><td className="px-3 py-2">{row.telefone || "—"}</td><td className="px-3 py-2">{row.email || "—"}</td><td className="px-3 py-2">{row.tipo_pessoa?.toUpperCase() || "—"}</td><td className="px-3 py-2">{row.classificacao === "residencial" ? "Doméstico" : row.classificacao || "—"}</td><td className="px-3 py-2">{row.ativo ? "Ativo" : "Inativo"}</td><td className="px-3 py-2">{format(new Date(row.created_at), "dd/MM/yyyy")}</td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm">Nenhum cliente encontrado para os filtros selecionados.</p>}</div></>}
    </div>
  </details>;
}
