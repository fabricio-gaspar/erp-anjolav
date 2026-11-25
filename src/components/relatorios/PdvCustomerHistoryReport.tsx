import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import type { PdvArea } from "@/lib/authorization";
import { supabase } from "@/integrations/supabase/client";

type HistoryFilters = { search: string; from: string; to: string };
type HistoryOrder = {
  id: string;
  numero: string;
  created_at: string;
  data_retirada: string;
  data_previsao_entrega: string | null;
  status: string;
  status_pagamento: string | null;
  valor_total: number | null;
  valor_pago: number | null;
  atendente_id: string | null;
  cliente: { razao_social: string; nome_fantasia: string | null };
};
type HistoryRow = HistoryOrder & { atendenteNome: string | null; pago: number; saldo: number };
type HistoryResult = { rows: HistoryRow[]; truncated: boolean };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const dateLabel = (value: string | null) => value ? format(parseISO(value), "dd/MM/yyyy", { locale: ptBR }) : "—";
const paymentState = (row: Pick<HistoryRow, "pago" | "saldo">) => row.saldo <= 0.009 ? "Pago" : row.pago > 0.009 ? "Parcial" : "Pendente";

export function PdvCustomerHistoryReport({ area }: { area: PdvArea }) {
  const { activeTenant, session } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [filters, setFilters] = useState<HistoryFilters | null>(null);
  const invalidRange = Boolean(fromInput && toInput && fromInput > toInput);
  const query = useQuery({
    queryKey: ["pdv-customer-rol-history", activeTenant?.id, session?.user.id, area, filters],
    enabled: Boolean(filters && activeTenant?.id && session?.user.id),
    queryFn: async (): Promise<HistoryResult> => {
      if (!filters || !activeTenant?.id) throw new Error("Selecione uma empresa e informe os filtros.");
      const needle = filters.search.trim();
      if (needle.length < 2) throw new Error("Informe ao menos duas letras ou números para pesquisar.");

      const origins = getAllowedOrderOrigins(area);
      const isRolNumber = /^(?:rol[\s-]*)?\d[\d\s/-]*$/i.test(needle);
      let orderQuery = supabase.from("ordens_servico").select(
        "id,numero,created_at,data_retirada,data_previsao_entrega,status,status_pagamento,valor_total,valor_pago,atendente_id,cliente:clientes!ordens_servico_cliente_id_fkey!inner(razao_social,nome_fantasia,classificacao)",
      ).eq("tenant_id", activeTenant.id)
        .eq("cliente.classificacao", area)
        .order("created_at", { ascending: false });

      if (origins) orderQuery = orderQuery.in("origem", [...origins]);
      if (filters.from) orderQuery = orderQuery.gte("data_retirada", filters.from);
      if (filters.to) orderQuery = orderQuery.lte("data_retirada", filters.to);

      if (isRolNumber) {
        const rolTerm = needle.replace(/^rol[\s-]*/i, "").trim();
        orderQuery = orderQuery.ilike("numero", `%${rolTerm}%`);
      } else {
        const safeTerm = needle.replace(/[%_(),.\\"]/g, " ").trim();
        const { data: clients, error: clientError } = await supabase.from("clientes")
          .select("id").eq("tenant_id", activeTenant.id).eq("classificacao", area)
          .or(`razao_social.ilike.%${safeTerm}%,nome_fantasia.ilike.%${safeTerm}%`)
          .limit(200);
        if (clientError) throw clientError;
        const ids = (clients ?? []).map((client) => client.id);
        if (!ids.length) return { rows: [], truncated: false };
        orderQuery = orderQuery.in("cliente_id", ids);
      }

      const orders: HistoryOrder[] = [];
      let truncated = false;
      for (let offset = 0; offset < 10_000; offset += 1000) {
        const { data, error } = await orderQuery.range(offset, offset + 999);
        if (error) throw error;
        const page = (data ?? []) as unknown as HistoryOrder[];
        orders.push(...page);
        if (page.length < 1000) break;
        if (offset + page.length >= 10_000) truncated = true;
      }
      if (!orders.length) return { rows: [], truncated: false };

      const attendantIds = [...new Set(orders.map((order) => order.atendente_id).filter((id): id is string => Boolean(id)))];
      const attendantNames = new Map<string, string>();
      if (attendantIds.length) {
        const employeeTable = supabase.from("funcionarios") as unknown as {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              in: (column: string, values: string[]) => Promise<{ data: Array<{ id: string; nome: string }> | null; error: Error | null }>;
            };
          };
        };
        const { data: attendants, error: attendantError } = await employeeTable
          .select("id,nome").eq("tenant_id", activeTenant.id).in("id", attendantIds);
        if (attendantError) throw attendantError;
        (attendants ?? []).forEach((attendant) => attendantNames.set(attendant.id, attendant.nome));
      }

      const rows = orders.map((order) => {
        const total = Math.max(0, Number(order.valor_total ?? 0));
        const paid = Math.min(total, Math.max(0, Number(order.valor_pago ?? 0)));
        return {
          ...order,
          cliente: Array.isArray(order.cliente) ? order.cliente[0] : order.cliente,
          atendenteNome: order.atendente_id ? attendantNames.get(order.atendente_id) ?? null : null,
          pago: paid,
          saldo: Math.max(0, total - paid),
        };
      });
      return { rows, truncated };
    },
  });

  useEffect(() => {
    if (filters && invalidRange) setFilters(null);
  }, [filters, invalidRange]);

  const submit = () => {
    const search = searchInput.trim();
    if (search.length >= 2 && !invalidRange) setFilters({ search, from: fromInput, to: toInput });
  };
  const exportCsv = () => {
    const rows = query.data?.rows ?? [];
    const safe = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const content = [
      ["ROL", "Cliente", "Entrada", "Previsão", "Total", "Pago", "Pendente", "Situação do pagamento", "Atendente"],
      ...rows.map((row) => [row.numero, row.cliente?.nome_fantasia || row.cliente?.razao_social, dateLabel(row.data_retirada), dateLabel(row.data_previsao_entrega), row.valor_total, row.pago, row.saldo, paymentState(row), row.atendenteNome ?? "Não identificado"]),
    ].map((line) => line.map(safe).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico-rol-cliente-${area}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] sm:items-end">
      <div className="space-y-1.5"><Label htmlFor="customer-rol-search">Cliente ou número do ROL *</Label><Input id="customer-rol-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="Digite o nome do cliente ou ROL" /></div>
      <div className="space-y-1.5"><Label htmlFor="customer-rol-from">Entrada de</Label><Input id="customer-rol-from" type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="customer-rol-to">Entrada até</Label><Input id="customer-rol-to" type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} /></div>
      <Button onClick={submit} disabled={searchInput.trim().length < 2 || invalidRange || query.isFetching}><Search className="mr-2 h-4 w-4" />Consultar</Button>
    </div>
    {invalidRange && <p role="alert" className="text-sm text-destructive">A data inicial deve ser anterior ou igual à data final.</p>}
    {!filters && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Informe um cliente ou ROL e clique em Consultar para carregar o histórico.</p>}
    {query.isFetching && <p role="status" className="text-sm text-muted-foreground">Consultando histórico…</p>}
    {query.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"><span>{query.error instanceof Error ? query.error.message : "Não foi possível consultar o histórico."}</span><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
    {filters && query.data && !query.isFetching && <>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{query.data.rows.length} ROL(s) encontrados. Valores pagos refletem os recebimentos registrados no ROL.</p><Button variant="outline" size="sm" onClick={exportCsv} disabled={!query.data.rows.length}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button></div>
      {query.data.truncated && <p role="alert" className="text-sm text-destructive">A consulta ultrapassou o limite de 10.000 ROLs. Refine o período para completar o histórico.</p>}
      {query.data.rows.length === 0 ? <p className="rounded-lg border p-5 text-center text-sm text-muted-foreground">Nenhum ROL encontrado para essa pesquisa e período.</p> : <div className="max-h-[50vh] overflow-auto rounded-lg border">
        <Table><TableHeader><TableRow><TableHead>ROL</TableHead><TableHead>Cliente</TableHead><TableHead>Entrada</TableHead><TableHead>Previsão</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pago</TableHead><TableHead className="text-right">Pendente</TableHead><TableHead>Pagamento</TableHead><TableHead>Atendente</TableHead></TableRow></TableHeader><TableBody>{query.data.rows.map((row) => {
          const state = paymentState(row);
          return <TableRow key={row.id}><TableCell className="font-semibold">{row.numero}</TableCell><TableCell>{row.cliente?.nome_fantasia || row.cliente?.razao_social || "—"}</TableCell><TableCell>{dateLabel(row.data_retirada)}</TableCell><TableCell>{dateLabel(row.data_previsao_entrega)}</TableCell><TableCell className="text-right">{money(Number(row.valor_total ?? 0))}</TableCell><TableCell className="text-right">{money(row.pago)}</TableCell><TableCell className="text-right">{money(row.saldo)}</TableCell><TableCell><Badge variant={state === "Pago" ? "default" : state === "Parcial" ? "secondary" : "outline"}>{state}</Badge></TableCell><TableCell>{row.atendenteNome || "Não identificado"}</TableCell></TableRow>;
        })}</TableBody></Table>
      </div>}
    </>}
  </div>;
}
