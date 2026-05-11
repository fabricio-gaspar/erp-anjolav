import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, Search, FileText } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/hooks/useClientes";
import { VisualizarItensModal } from "@/components/faturamento/VisualizarItensModal";
import { useItensLancamento, type Lancamento } from "@/hooks/useLancamentos";
import { formatNumberToCurrency } from "@/lib/currencyUtils";

const formatCurrencyBR = (v: number) => formatNumberToCurrency(v).replace("R$ ", "");

type StatusFiltro = "todos" | "pendente" | "faturado";

const statusBadge: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/30" },
  faturado: { label: "Faturado", className: "bg-success/10 text-success border-success/30" },
};

export const HistoricoROLsTab: React.FC = () => {
  const { clientes } = useClientes();
  const clientesIndustriais = useMemo(
    () => clientes.filter((c: any) => c.classificacao === "industrial"),
    [clientes]
  );

  const [clienteId, setClienteId] = useState<string>("todos");
  const [status, setStatus] = useState<StatusFiltro>("todos");
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [visualizarId, setVisualizarId] = useState<string | null>(null);

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["historico-rols", clienteId, status, dataInicio, dataFim],
    refetchOnMount: "always",
    queryFn: async () => {
      let q = supabase
        .from("lancamentos")
        .select("*, cliente:clientes(id, razao_social, nome_fantasia, classificacao)")
        .order("data_lancamento", { ascending: false });

      if (clienteId !== "todos") q = q.eq("cliente_id", clienteId);
      if (status !== "todos") q = q.eq("status", status);
      if (dataInicio) q = q.gte("data_lancamento", dataInicio);
      if (dataFim) q = q.lte("data_lancamento", dataFim);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).filter((l: any) => l.cliente?.classificacao === "industrial");
    },
  });

  const filtrados = useMemo(() => {
    if (!busca.trim()) return lancamentos;
    const t = busca.toLowerCase();
    return lancamentos.filter((l: any) =>
      l.numero_rol?.toLowerCase().includes(t) ||
      l.cliente?.razao_social?.toLowerCase().includes(t) ||
      l.cliente?.nome_fantasia?.toLowerCase().includes(t)
    );
  }, [lancamentos, busca]);

  const totais = useMemo(() => {
    const total = filtrados.reduce((s: number, l: any) => s + Number(l.valor_total || 0), 0);
    const pendentes = filtrados.filter((l: any) => l.status === "pendente").length;
    const faturados = filtrados.filter((l: any) => l.status === "faturado").length;
    return { total, pendentes, faturados, count: filtrados.length };
  }, [filtrados]);

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº ROL ou cliente..."
              className="pl-8 h-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientesIndustriais.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_fantasia || c.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v: StatusFiltro) => setStatus(v)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="faturado">Faturados</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input type="date" className="h-9" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            <Input type="date" className="h-9" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-2"><div className="text-xs text-muted-foreground">Total ROLs</div><div className="text-lg font-semibold">{totais.count}</div></Card>
        <Card className="p-2"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-lg font-semibold text-warning">{totais.pendentes}</div></Card>
        <Card className="p-2"><div className="text-xs text-muted-foreground">Faturados</div><div className="text-lg font-semibold text-success">{totais.faturados}</div></Card>
        <Card className="p-2"><div className="text-xs text-muted-foreground">Valor Total</div><div className="text-lg font-semibold">R$ {formatCurrencyBR(totais.total)}</div></Card>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº ROL</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data Lançamento</TableHead>
              <TableHead>Data Entrega</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nenhum ROL encontrado
              </TableCell></TableRow>
            ) : (
              filtrados.map((l: any) => {
                const sb = statusBadge[l.status] || { label: l.status, className: "bg-muted" };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.numero_rol || "-"}</TableCell>
                    <TableCell className="font-medium">{l.cliente?.nome_fantasia || l.cliente?.razao_social}</TableCell>
                    <TableCell>{l.data_lancamento ? format(new Date(l.data_lancamento + "T00:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>{l.data_entrega ? format(new Date(l.data_entrega + "T00:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell className="text-right font-medium">R$ {formatCurrencyBR(Number(l.valor_total || 0))}</TableCell>
                    <TableCell><Badge variant="outline" className={sb.className}>{sb.label}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVisualizarId(l.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <HistoricoVisualizarWrapper
        lancamento={filtrados.find((l: any) => l.id === visualizarId) || null}
        onClose={() => setVisualizarId(null)}
      />
    </div>
  );
};

const HistoricoVisualizarWrapper: React.FC<{ lancamento: any; onClose: () => void }> = ({ lancamento, onClose }) => {
  const { data: itens = [], isLoading } = useItensLancamento(lancamento?.id || null);
  return (
    <VisualizarItensModal
      open={!!lancamento}
      onOpenChange={(o) => { if (!o) onClose(); }}
      lancamento={lancamento as Lancamento | null}
      itens={itens}
      isLoading={isLoading}
    />
  );
};
