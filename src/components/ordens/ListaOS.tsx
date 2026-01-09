import { useState } from "react";
import { Search, Plus, Eye, CheckCircle } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";

interface OrdemServico {
  id: string;
  numero: string;
  cliente: string;
  motorista: string;
  dataRetirada: string;
  status: "retirado" | "entregue" | "em_lavagem" | "finalizado" | "pronto_entrega";
}

const mockOrdens: OrdemServico[] = [
  {
    id: "1",
    numero: "OS-32210005",
    cliente: "FABRICIO GASPAR",
    motorista: "-",
    dataRetirada: "06/01/2026",
    status: "retirado",
  },
  {
    id: "2",
    numero: "OS-31986327",
    cliente: "FABRICIO GASPAR",
    motorista: "-",
    dataRetirada: "06/01/2026",
    status: "entregue",
  },
];

interface ListaOSProps {
  onNovaOS: () => void;
}

export function ListaOS({ onNovaOS }: ListaOSProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [ordens] = useState<OrdemServico[]>(mockOrdens);

  const filteredOrdens = ordens.filter(
    (os) =>
      os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.cliente.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusVariant = (status: OrdemServico["status"]) => {
    switch (status) {
      case "retirado":
        return "info";
      case "entregue":
        return "success";
      case "em_lavagem":
        return "warning";
      case "finalizado":
        return "success";
      case "pronto_entrega":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: OrdemServico["status"]) => {
    switch (status) {
      case "retirado":
        return "Retirado";
      case "entregue":
        return "Entregue";
      case "em_lavagem":
        return "Em Lavagem";
      case "finalizado":
        return "Finalizado";
      case "pronto_entrega":
        return "Pronto Entrega";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por OS ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onNovaOS} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Nova OS
        </Button>
      </div>

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
                Status
              </TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground uppercase text-center">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrdens.map((os) => (
              <TableRow key={os.id}>
                <TableCell className="font-medium">{os.numero}</TableCell>
                <TableCell>{os.cliente}</TableCell>
                <TableCell>{os.motorista}</TableCell>
                <TableCell>{os.dataRetirada}</TableCell>
                <TableCell>
                  <StatusBadge variant={getStatusVariant(os.status)}>
                    {getStatusLabel(os.status)}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    {os.status === "retirado" && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <CheckCircle className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
