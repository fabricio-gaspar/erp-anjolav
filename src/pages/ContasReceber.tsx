import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
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
import {
  DollarSign,
  CheckCircle,
  TrendingUp,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  ExternalLink,
  Copy,
  Loader2,
} from "lucide-react";
import { useAsaasCharges, useDeleteAsaasCharge, useUpdateChargeStatus } from "@/hooks/useAsaas";
import { NovaCobrancaModal } from "@/components/cobrancas/NovaCobrancaModal";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ContasReceber = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showNovaCobranca, setShowNovaCobranca] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: charges = [], isLoading } = useAsaasCharges();
  const deleteCharge = useDeleteAsaasCharge();
  const updateStatus = useUpdateChargeStatus();

  const totalAReceber = charges
    .filter((c) => c.status === "PENDING" || c.status === "OVERDUE")
    .reduce((sum, c) => sum + Number(c.value), 0);

  const totalRecebido = charges
    .filter((c) => c.status === "RECEIVED" || c.status === "CONFIRMED")
    .reduce((sum, c) => sum + Number(c.value), 0);

  const filteredCharges = charges.filter((charge) => {
    const matchesSearch =
      charge.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      charge.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = statusFilter === "todos";
    if (statusFilter === "pendente") matchesStatus = charge.status === "PENDING";
    if (statusFilter === "recebido") matchesStatus = charge.status === "RECEIVED" || charge.status === "CONFIRMED";
    if (statusFilter === "vencido") matchesStatus = charge.status === "OVERDUE";
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "RECEIVED":
      case "CONFIRMED":
        return "success";
      case "OVERDUE":
        return "danger";
      default:
        return "warning";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "RECEIVED":
      case "CONFIRMED":
        return "Recebido";
      case "OVERDUE":
        return "Vencido";
      case "PENDING":
        return "Pendente";
      default:
        return status;
    }
  };

  const handleBaixar = async (chargeId: string) => {
    await updateStatus.mutateAsync({
      chargeId,
      status: "RECEIVED",
      paidAt: new Date().toISOString(),
    });
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteCharge.mutateAsync(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const copyPixCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  };

  return (
    <AppLayout title="Contas a Receber">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas receitas e cobranças via Asaas
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                A RECEBER
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {formatCurrency(totalAReceber)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                RECEBIDO
              </p>
              <p className="text-2xl font-bold text-success mt-1">
                {formatCurrency(totalRecebido)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-success flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </Card>
        </div>

        {/* Table Section */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Cobranças</h3>
            </div>
            <Button 
              className="gap-2 bg-success hover:bg-success/90"
              onClick={() => setShowNovaCobranca(true)}
            >
              <Plus className="w-4 h-4" />
              Nova Cobrança
            </Button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">DESCRIÇÃO</TableHead>
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold text-right">VALOR</TableHead>
                <TableHead className="font-semibold">VENCIMENTO</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredCharges.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Nenhuma cobrança encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredCharges.map((charge) => (
                  <TableRow key={charge.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{charge.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {charge.customer_name}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(charge.value))}
                    </TableCell>
                    <TableCell>{formatDate(charge.due_date)}</TableCell>
                    <TableCell>
                      <StatusBadge variant={getStatusVariant(charge.status)}>
                        {getStatusLabel(charge.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <div className="flex items-center justify-end gap-1">
                          {charge.status === "PENDING" && (
                            <Button
                              size="sm"
                              className="gap-1 bg-success hover:bg-success/90 h-8"
                              onClick={() => handleBaixar(charge.id)}
                              disabled={updateStatus.isPending}
                            >
                              <Check className="w-3 h-3" />
                              Baixar
                            </Button>
                          )}
                          
                          {charge.pix_copy_paste && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => copyPixCode(charge.pix_copy_paste!)}
                                >
                                  <Copy className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copiar código PIX</TooltipContent>
                            </Tooltip>
                          )}

                          {charge.invoice_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(charge.invoice_url!, "_blank")}
                                >
                                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir fatura</TooltipContent>
                            </Tooltip>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteConfirm(charge.id)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <NovaCobrancaModal 
        open={showNovaCobranca} 
        onOpenChange={setShowNovaCobranca} 
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A cobrança será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ContasReceber;
