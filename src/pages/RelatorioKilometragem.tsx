import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Gauge, Download, ChevronDown, ChevronRight, Truck, Route, Calendar, RefreshCw,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { downloadCsv } from "@/lib/csvExport";

type Periodo = "hoje" | "semana" | "mes" | "personalizado";

function getRange(periodo: Periodo, customStart: string, customEnd: string) {
  const today = new Date();
  switch (periodo) {
    case "hoje":
      return { start: format(today, "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    case "semana":
      return {
        start: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        end: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    case "mes":
      return {
        start: format(startOfMonth(today), "yyyy-MM-dd"),
        end: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    case "personalizado":
      return { start: customStart || format(today, "yyyy-MM-dd"), end: customEnd || format(today, "yyyy-MM-dd") };
  }
}

interface RotaRow {
  id: string;
  data: string;
  km_inicial: number | null;
  km_final: number | null;
  motorista_id: string | null;
  motorista: { id: string; nome: string } | null;
  veiculo: { id: string; placa: string; modelo: string } | null;
}

interface MotoristaResumo {
  id: string;
  nome: string;
  totalRotas: number;
  kmTotal: number;
  rotas: { data: string; veiculo: string; kmInicial: number; kmFinal: number; kmRodado: number }[];
}

export default function RelatorioKilometragem({ embedded = false }: { embedded?: boolean }) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedMotorista, setExpandedMotorista] = useState<string | null>(null);
  const [filterMotorista, setFilterMotorista] = useState("todos");
  const [filterVeiculo, setFilterVeiculo] = useState("todos");

  const range = getRange(periodo, customStart, customEnd);

  const { data: rotas, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["relatorio_km", activeTenant?.id, session?.user.id, activeArea, range.start, range.end],
    enabled: Boolean(activeTenant?.id && session?.user.id),
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar quilometragem");
      }
      let query = supabase
        .from("rotas_entrega")
        .select("id, data, km_inicial, km_final, motorista_id, motorista:motoristas!tenant_fk_35d0beac479f358933c8(id, nome), veiculo:veiculos!tenant_fk_6109a005af5afb9bef53(id, placa, modelo)")
        .eq("tenant_id", activeTenant.id)
        .eq("status", "concluida")
        .gte("data", range.start)
        .lte("data", range.end)
        .not("km_inicial", "is", null)
        .not("km_final", "is", null);
      if (activeArea !== "central") query = query.eq("operation_type", activeArea === "industrial" ? "industrial" : "domestico");
      const rows: RotaRow[] = [];
      const ordered = query.order("data", { ascending: true }).order("id", { ascending: true });
      for (let offset = 0; offset < 10000; offset += 500) {
        const { data, error } = await ordered.range(offset, offset + 499);
        if (error) throw error;
        const page = (data ?? []) as unknown as RotaRow[];
        rows.push(...page);
        if (page.length < 500) return rows;
      }
      throw new Error("O relatório atingiu 10.000 rotas. Reduza o período para obter o resultado completo.");
    },
  });

  const motoristas = useMemo(() => {
    if (!rotas) return [];
    const map = new Map<string, MotoristaResumo>();
    for (const r of rotas) {
      if (filterMotorista !== "todos" && (r.motorista_id || "sem_motorista") !== filterMotorista) continue;
      if (filterVeiculo !== "todos" && (r.veiculo?.id || "sem_veiculo") !== filterVeiculo) continue;
      const mid = r.motorista_id || "sem_motorista";
      const nome = r.motorista?.nome || "Sem motorista";
      if (!map.has(mid)) {
        map.set(mid, { id: mid, nome, totalRotas: 0, kmTotal: 0, rotas: [] });
      }
      const m = map.get(mid)!;
      const kmRodado = (r.km_final || 0) - (r.km_inicial || 0);
      m.totalRotas++;
      m.kmTotal += kmRodado;
      m.rotas.push({
        data: r.data,
        veiculo: r.veiculo ? `${r.veiculo.modelo} (${r.veiculo.placa})` : "—",
        kmInicial: r.km_inicial || 0,
        kmFinal: r.km_final || 0,
        kmRodado,
      });
    }
    return Array.from(map.values()).sort((a, b) => b.kmTotal - a.kmTotal);
  }, [rotas, filterMotorista, filterVeiculo]);

  const motoristaOptions = Array.from(new Map((rotas ?? []).map(r => [r.motorista_id || "sem_motorista", r.motorista?.nome || "Sem motorista"])).entries());
  const veiculoOptions = Array.from(new Map((rotas ?? []).map(r => [r.veiculo?.id || "sem_veiculo", r.veiculo ? `${r.veiculo.modelo} (${r.veiculo.placa})` : "Sem veículo"])).entries());

  const totalKm = motoristas.reduce((s, m) => s + m.kmTotal, 0);
  const totalRotas = motoristas.reduce((s, m) => s + m.totalRotas, 0);

  const diasNoPeriodo = useMemo(() => {
    const start = new Date(range.start);
    const end = new Date(range.end);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  }, [range]);

  const exportCSV = () => {
    const rows = motoristas.flatMap(m => m.rotas.map(r => ({ motorista: m.nome, ...r })));
    downloadCsv(`quilometragem_${range.start}_${range.end}.csv`, rows, [
      { header: "Data", value: r => r.data }, { header: "Motorista", value: r => r.motorista },
      { header: "Veículo", value: r => r.veiculo }, { header: "KM inicial", value: r => r.kmInicial },
      { header: "KM final", value: r => r.kmFinal }, { header: "KM rodado", value: r => r.kmRodado },
    ]);
  };

  const content = (
      <div className="page-shell">
        <PageHeader
          eyebrow="Logística e frota"
          title="Relatório de quilometragem"
          description="Consulte rotas concluídas e quilômetros percorridos por motorista no período"
          actions={(
            <Button variant="outline" onClick={exportCSV} disabled={isLoading || isError || !rotas?.length} className="w-full gap-2 sm:w-auto">
              <Download className="h-4 w-4" />Exportar CSV
            </Button>
          )}
        />
        {activeArea !== "central" && <p className="text-sm text-muted-foreground">Rotas sem operação identificada aparecem somente no consolidado administrativo.</p>}
        {/* Filtros */}
        <div className="page-toolbar flex-wrap items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Esta Semana</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodo === "personalizado" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[160px]" />
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="km-motorista">Motorista</label>
            <select id="km-motorista" value={filterMotorista} onChange={e => setFilterMotorista(e.target.value)} className="h-10 w-[190px] rounded-md border bg-background px-3 text-sm"><option value="todos">Todos</option>{motoristaOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block" htmlFor="km-veiculo">Veículo</label>
            <select id="km-veiculo" value={filterVeiculo} onChange={e => setFilterVeiculo(e.target.value)} className="h-10 w-[190px] rounded-md border bg-background px-3 text-sm"><option value="todos">Todos</option>{veiculoOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </div>
        </div>

        {isError ? (
          <Card className="p-6 text-center" role="alert">
            <p className="font-semibold">Não foi possível carregar as rotas</p>
            <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error && error.message.startsWith("O relatório atingiu") ? error.message : "Tente novamente para consultar o período."}</p>
            <Button type="button" variant="outline" className="mt-4 gap-2" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4" />Tentar novamente
            </Button>
          </Card>
        ) : (
        <>
        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Gauge className="h-4 w-4" /> KM Total Rodados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black">{totalKm.toFixed(1)} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Route className="h-4 w-4" /> Rotas Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black">{totalRotas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Média KM/Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-black">{(totalKm / diasNoPeriodo).toFixed(1)} km</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : motoristas.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Nenhuma rota concluída no período selecionado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead className="text-center">Total Rotas</TableHead>
                    <TableHead className="text-right">KM Total</TableHead>
                    <TableHead className="text-right">KM Média/Rota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {motoristas.map((m) => (
                    <>
                      <TableRow
                        key={m.id}
                        className="cursor-pointer"
                        onClick={() => setExpandedMotorista(expandedMotorista === m.id ? null : m.id)}
                      >
                        <TableCell>
                          {expandedMotorista === m.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          {m.nome}
                        </TableCell>
                        <TableCell className="text-center">{m.totalRotas}</TableCell>
                        <TableCell className="text-right font-semibold">{m.kmTotal.toFixed(1)} km</TableCell>
                        <TableCell className="text-right">
                          {m.totalRotas > 0 ? (m.kmTotal / m.totalRotas).toFixed(1) : "0"} km
                        </TableCell>
                      </TableRow>
                      {expandedMotorista === m.id && (
                        <TableRow key={`${m.id}-detail`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Data</TableHead>
                                  <TableHead className="text-xs">Veículo</TableHead>
                                  <TableHead className="text-xs text-right">KM Inicial</TableHead>
                                  <TableHead className="text-xs text-right">KM Final</TableHead>
                                  <TableHead className="text-xs text-right">KM Rodado</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {m.rotas.map((r, i) => (
                                  <TableRow key={i}>
                                    <TableCell className="text-xs">
                                      {format(new Date(r.data + "T12:00:00"), "dd/MM/yyyy")}
                                    </TableCell>
                                    <TableCell className="text-xs">{r.veiculo}</TableCell>
                                    <TableCell className="text-xs text-right">{r.kmInicial.toLocaleString("pt-BR")}</TableCell>
                                    <TableCell className="text-xs text-right">{r.kmFinal.toLocaleString("pt-BR")}</TableCell>
                                    <TableCell className="text-xs text-right font-semibold">
                                      <Badge variant="secondary">{r.kmRodado.toFixed(1)} km</Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </>
        )}
      </div>
  );
  return embedded ? content : <AppLayout title="Relatório de quilometragem" subtitle="Distâncias e rotas concluídas por motorista">{content}</AppLayout>;
}
