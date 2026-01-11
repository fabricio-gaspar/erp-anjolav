import { useState } from "react";
import { Search, Plus, Eye, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { DetalhesOS } from "./DetalhesOS";

interface ListaOSProps {
  onNovaOS: () => void;
}

const statusConfig: Record<string, { label: string; variant: "info" | "success" | "warning" | "danger" | "default" }> = {
  retirada: { label: "Retirado", variant: "info" },
  separacao: { label: "Separação", variant: "warning" },
  lavagem: { label: "Lavagem", variant: "warning" },
  secagem: { label: "Secagem", variant: "warning" },
  passadoria: { label: "Passadoria", variant: "warning" },
  embalagem: { label: "Embalagem", variant: "info" },
  expedicao: { label: "Pronto Entrega", variant: "success" },
  entregue: { label: "Entregue", variant: "success" },
  cancelada: { label: "Cancelada", variant: "danger" },
};

export function ListaOS({ onNovaOS }: ListaOSProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);

  const { ordensServico, isLoading } = useOrdensServico();

  const filteredOrdens = ordensServico.filter((os) => {
    const matchesSearch =
      os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.cliente?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || os.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, variant: "default" as const };
  };

  if (selectedOSId) {
    return (
      <DetalhesOS
        ordemServicoId={selectedOSId}
        onBack={() => setSelectedOSId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por OS ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onNovaOS} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Nova OS
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando ordens...</span>
        </div>
      ) : filteredOrdens.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm || statusFilter !== "all"
            ? "Nenhuma OS encontrada com os filtros aplicados."
            : "Nenhuma ordem de serviço cadastrada."}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase">
                  Nº OS
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase">
                  Cliente
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase">
                  Motorista
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase">
                  Data Retirada
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase">
                  Previsão Entrega
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground uppercase text-center">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrdens.map((os) => {
                const statusInfo = getStatusConfig(os.status);
                return (
                  <TableRow key={os.id}>
                    <TableCell className="font-medium font-mono text-primary">
                      {os.numero}
                    </TableCell>
                    <TableCell>{os.cliente?.razao_social || "-"}</TableCell>
                    <TableCell>{os.motorista?.nome || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(os.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {os.data_previsao_entrega
                        ? format(new Date(os.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedOSId(os.id)}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {os.status !== "entregue" && os.status !== "cancelada" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedOSId(os.id)}
                          >
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
