import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DollarSign, CheckCircle, TrendingUp, Plus, Search, Loader2, Receipt, Store, CreditCard, FileText, ScrollText,
} from "lucide-react";
import { useContasReceberUnificado, OrigemReceita } from "@/hooks/useContasReceberUnificado";
import { NovaCobrancaModal } from "@/components/cobrancas/NovaCobrancaModal";
import { formatNumberToCurrency } from "@/lib/currencyUtils";
import { format, parseISO, isBefore, startOfDay } from "date-fns";

const origemLabel: Record<OrigemReceita, { label: string; icon: any; cls: string }> = {
  fatura: { label: "Fatura Industrial", icon: FileText, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  pdv_loja: { label: "PDV Loja", icon: Store, cls: "bg-green-50 text-green-700 border-green-200" },
  asaas: { label: "Cobrança Asaas", icon: CreditCard, cls: "bg-purple-50 text-purple-700 border-purple-200" },
  contrato: { label: "Contrato Aluguel", icon: ScrollText, cls: "bg-amber-50 text-amber-700 border-amber-200" },
  manual: { label: "Manual", icon: Receipt, cls: "bg-slate-50 text-slate-700 border-slate-200" },
};

const ContasReceberContent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState<OrigemReceita | "todos">("todos");
  const [showNovaCobranca, setShowNovaCobranca] = useState(false);

  const { data: contas = [], isLoading } = useContasReceberUnificado({
    origem: origemFilter,
  });

  const hoje = startOfDay(new Date());

  const enriquecidas = useMemo(() => contas.map((c) => {
    const statusReal = c.status === "pendente" && c.data_vencimento && isBefore(parseISO(c.data_vencimento), hoje)
      ? "atrasado"
      : c.status;
    return { ...c, statusReal };
  }), [contas, hoje]);

  const totalAReceber = enriquecidas
    .filter(c => c.statusReal === "pendente" || c.statusReal === "atrasado")
    .reduce((s, c) => s + Number(c.valor) - Number(c.valor_recebido), 0);

  const totalRecebido = enriquecidas
    .reduce((s, c) => s + Number(c.valor_recebido), 0);

  const filtered = enriquecidas.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = c.descricao.toLowerCase().includes(q) || (c.cliente_nome || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "todos" || c.statusReal === statusFilter;
    return matchSearch && matchStatus;
  });

  const fmtDate = (d: string | null) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";

  const statusVariant = (s: string) =>
    s === "recebido" ? "success" : s === "atrasado" ? "danger" : s === "cancelado" ? "secondary" : "warning";

  const statusLabel = (s: string) =>
    s === "recebido" ? "Recebido" : s === "atrasado" ? "Atrasado" : s === "cancelado" ? "Cancelado" : s === "parcial" ? "Parcial" : "Pendente";

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">A RECEBER</p>
              <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-1 truncate">R$ {formatNumberToCurrency(totalAReceber)}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </Card>
          <Card className="p-3 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">RECEBIDO</p>
              <p className="text-lg sm:text-2xl font-bold text-success mt-1 truncate">R$ {formatNumberToCurrency(totalRecebido)}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-success flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-base sm:text-lg">Contas a Receber (todas as origens)</h3>
            </div>
            <Button className="gap-2 bg-success hover:bg-success/90 w-full sm:w-auto" onClick={() => setShowNovaCobranca(true)}>
              <Plus className="w-4 h-4" />
              Nova Cobrança (Asaas)
            </Button>
          </div>

          <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Input placeholder="Buscar descrição ou cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            <Select value={origemFilter} onValueChange={(v) => setOrigemFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas origens</SelectItem>
                <SelectItem value="fatura">Faturas Industrial</SelectItem>
                <SelectItem value="pdv_loja">PDV Loja</SelectItem>
                <SelectItem value="asaas">Asaas</SelectItem>
                <SelectItem value="contrato">Contratos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">DESCRIÇÃO</TableHead>
                  <TableHead className="font-semibold">CLIENTE</TableHead>
                  <TableHead className="font-semibold">ORIGEM</TableHead>
                  <TableHead className="font-semibold text-right">VALOR</TableHead>
                  <TableHead className="font-semibold text-right">RECEBIDO</TableHead>
                  <TableHead className="font-semibold">VENCIMENTO</TableHead>
                  <TableHead className="font-semibold">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                ) : filtered.map((c) => {
                  const info = origemLabel[c.origem as OrigemReceita] || origemLabel.manual;
                  const Icon = info.icon;
                  return (
                    <TableRow key={`${c.origem}-${c.id}`} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{c.descricao}</TableCell>
                      <TableCell className="text-muted-foreground">{c.cliente_nome || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`gap-1 text-xs ${info.cls}`}><Icon className="w-3 h-3" />{info.label}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">R$ {formatNumberToCurrency(Number(c.valor))}</TableCell>
                      <TableCell className="text-right text-success">R$ {formatNumberToCurrency(Number(c.valor_recebido))}</TableCell>
                      <TableCell>{fmtDate(c.data_vencimento)}</TableCell>
                      <TableCell><StatusBadge variant={statusVariant((c as any).statusReal)}>{statusLabel((c as any).statusReal)}</StatusBadge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <NovaCobrancaModal open={showNovaCobranca} onOpenChange={setShowNovaCobranca} />
    </>
  );
};

export default ContasReceberContent;
