import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ClipboardList, Eye, Printer, AlertTriangle, CheckCircle, Clock,
  Loader2, Package, FileText, Scale, Boxes,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useConferenciaProducao, type OSConferencia, type ItemOS } from "@/hooks/useConferenciaProducao";
import { ConferenciaModal } from "@/components/lancamentos/ConferenciaModal";

interface ConferenciaTabProps {
  onUsarParaLancamento: (clienteId: string, itens: ItemOS[]) => void;
}

export function ConferenciaTab({ onUsarParaLancamento }: ConferenciaTabProps) {
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOS, setSelectedOS] = useState<OSConferencia | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: osConferencias, isLoading } = useConferenciaProducao(
    undefined, statusFilter !== "todos" ? statusFilter : undefined
  );

  const industrialConferencias = useMemo(() => {
    if (!osConferencias) return [];
    return osConferencias.filter(os => os.cliente.classificacao === "industrial");
  }, [osConferencias]);

  const filteredConferencias = useMemo(() => {
    if (!searchQuery) return industrialConferencias;
    return industrialConferencias.filter(os =>
      os.cliente.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) || os.numero.includes(searchQuery)
    );
  }, [industrialConferencias, searchQuery]);

  const counts = useMemo(() => {
    if (!osConferencias) return { pendente: 0, fluxo_completo: 0, divergencia: 0, lancado: 0 };
    return {
      pendente: osConferencias.filter(os => os.statusConferencia === "pendente").length,
      fluxo_completo: osConferencias.filter(os => os.statusConferencia === "fluxo_completo").length,
      divergencia: osConferencias.filter(os => os.statusConferencia === "divergencia").length,
      lancado: osConferencias.filter(os => os.statusConferencia === "lancado").length,
    };
  }, [osConferencias]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="pendente">Em Produção</SelectItem>
            <SelectItem value="fluxo_completo">Fluxo Completo</SelectItem>
            <SelectItem value="lancado">Lançados</SelectItem>
            <SelectItem value="divergencia">Divergências</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente ou OS..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Clock className="w-5 h-5 text-warning" /></div><div><p className="text-2xl font-bold text-foreground">{counts.pendente}</p><p className="text-xs text-muted-foreground">Em Produção</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-success" /></div><div><p className="text-2xl font-bold text-foreground">{counts.fluxo_completo}</p><p className="text-xs text-muted-foreground">Fluxo Completo</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center"><FileText className="w-5 h-5 text-info" /></div><div><p className="text-2xl font-bold text-foreground">{counts.lancado}</p><p className="text-xs text-muted-foreground">Lançados</p></div></div></Card>
        <Card className="p-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div><div><p className="text-2xl font-bold text-foreground">{counts.divergencia}</p><p className="text-xs text-muted-foreground">Divergências</p></div></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /><h3 className="font-semibold">OS para Conferência</h3><Badge variant="secondary" className="ml-auto">{filteredConferencias.length} registros</Badge></div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">OS</TableHead>
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold">RETIRADA</TableHead>
                <TableHead className="font-semibold text-center">PEÇAS</TableHead>
                <TableHead className="font-semibold text-center">PESO</TableHead>
                <TableHead className="font-semibold text-center">VOLUMES</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConferencias.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma OS encontrada para conferência</TableCell></TableRow>
              ) : (
                filteredConferencias.map(os => (
                  <TableRow key={os.id} className="hover:bg-muted/30">
                    <TableCell><Badge variant="outline" className="font-mono">{os.numero}</Badge></TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{os.cliente.razao_social}</p>
                      {os.dadosProducao.itensDanificados && <p className="text-xs text-destructive mt-0.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Itens danificados</p>}
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(os.dataRetirada), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell className="text-center"><div className="flex items-center justify-center gap-1"><Package className="h-3 w-3 text-muted-foreground" /><span className="font-medium">{os.itensOS?.reduce((s, i) => s + i.quantidade, 0) || os.dadosProducao.quantidadePecas || "-"}</span></div></TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1"><Scale className="h-3 w-3 text-muted-foreground" /><span className="font-medium">{(() => {
                        const pesoItens = os.itensOS?.reduce((s, i) => { const peso = (i.produto as any)?.peso_medio_kg || 0; return s + (i.quantidade * peso); }, 0) || 0;
                        const pesoFinal = pesoItens || os.dadosProducao.pesoFinal || os.dadosProducao.pesoTotal;
                        return pesoFinal ? `${Math.round(pesoFinal * 10) / 10} kg` : "-";
                      })()}</span></div>
                    </TableCell>
                    <TableCell className="text-center"><div className="flex items-center justify-center gap-1"><Boxes className="h-3 w-3 text-muted-foreground" /><span className="font-medium">{os.dadosProducao.quantidadeVolumes || "-"}</span></div></TableCell>
                    <TableCell>
                      <StatusBadge variant={os.statusConferencia === "lancado" ? "info" : os.statusConferencia === "fluxo_completo" ? "success" : os.statusConferencia === "divergencia" ? "danger" : "warning"}>
                        {os.statusConferencia === "lancado" ? "Lançado" : os.statusConferencia === "fluxo_completo" ? "Fluxo Completo" : os.statusConferencia === "divergencia" ? "Divergência" : "Em Produção"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedOS(os); setModalOpen(true); }} title="Ver Detalhes"><Eye className="w-4 h-4 text-muted-foreground" /></Button>
                        {os.statusConferencia === "fluxo_completo" && os.itensOS && os.itensOS.length > 0 && (
                          <Button variant="default" size="sm" className="h-7 px-3 bg-success hover:bg-success/90" onClick={() => onUsarParaLancamento(os.cliente.id, os.itensOS)}>Lançar</Button>
                        )}
                        {os.statusConferencia === "lancado" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => { setSelectedOS(os); setModalOpen(true); }} title="Imprimir"><Printer className="w-4 h-4" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConferenciaModal open={modalOpen} onOpenChange={setModalOpen} os={selectedOS} onUsarParaLancamento={onUsarParaLancamento} />
    </div>
  );
}
