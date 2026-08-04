import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
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
  Gauge, Download, ChevronDown, ChevronRight, Truck, Route, Calendar,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function RelatorioKilometragem() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedMotorista, setExpandedMotorista] = useState<string | null>(null);

  const range = getRange(periodo, customStart, customEnd);

  const { data: rotas, isLoading } = useQuery({
    queryKey: ["relatorio_km", range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotas_entrega")
        .select("id, data, km_inicial, km_final, motorista_id, motorista:motoristas(id, nome), veiculo:veiculos(id, placa, modelo)")
        .eq("status", "concluida")
        .gte("data", range.start)
        .lte("data", range.end)
        .not("km_inicial", "is", null)
        .not("km_final", "is", null)
        .order("data", { ascending: true });
      if (error) throw error;
      return data as unknown as RotaRow[];
    },
  });

  const motoristas = useMemo(() => {
    if (!rotas) return [];
    const map = new Map<string, MotoristaResumo>();
    for (const r of rotas) {
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
  }, [rotas]);

  const totalKm = motoristas.reduce((s, m) => s + m.kmTotal, 0);
  const totalRotas = motoristas.reduce((s, m) => s + m.totalRotas, 0);

  const diasNoPeriodo = useMemo(() => {
    const start = new Date(range.start);
    const end = new Date(range.end);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  }, [range]);

  const exportCSV = () => {
    const lines = ["Motorista,Total Rotas,KM Total,KM Média/Rota"];
    motoristas.forEach((m) => {
      lines.push(`"${m.nome}",${m.totalRotas},${m.kmTotal.toFixed(1)},${m.totalRotas > 0 ? (m.kmTotal / m.totalRotas).toFixed(1) : "0"}`);
    });
    lines.push("");
    lines.push(`Total,${totalRotas},${totalKm.toFixed(1)},${totalRotas > 0 ? (totalKm / totalRotas).toFixed(1) : "0"}`);
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quilometragem_${range.start}_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3">
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
          <Button variant="outline" size="sm" onClick={exportCSV} className="ml-auto">
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Gauge className="h-4 w-4" /> KM Total Rodados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalKm.toFixed(1)} km</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Route className="h-4 w-4" /> Rotas Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalRotas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Média KM/Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{(totalKm / diasNoPeriodo).toFixed(1)} km</p>
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
      </div>
    </AppLayout>
  );
}
