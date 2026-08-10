import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  CheckCircle,
  TrendingUp,
  Plus,
  Search,
  Trash2,
  Check,
  ExternalLink,
  Copy,
  Loader2,
  FileText,
  QrCode,
  Barcode,
  CreditCard,
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

interface AsaasCharge {
  id: string;
  asaas_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_cpf_cnpj: string | null;
  description: string;
  value: number;
  due_date: string;
  billing_type: string;
  status: string;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

const ContasReceber = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [showNovaCobranca, setShowNovaCobranca] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pixModalCharge, setPixModalCharge] = useState<AsaasCharge | null>(null);

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const getBillingTypeBadge = (billingType: string) => {
    switch (billingType) {
      case "BOLETO":
        return (
          <Badge variant="outline" className="gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
            <Barcode className="w-3 h-3" />
            Boleto
          </Badge>
        );
      case "PIX":
        return (
          <Badge variant="outline" className="gap-1 text-xs bg-green-50 text-green-700 border-green-200">
            <QrCode className="w-3 h-3" />
            PIX
          </Badge>
        );
      case "BOLETO_PIX":
        return (
          <Badge variant="outline" className="gap-1 text-xs bg-purple-50 text-purple-700 border-purple-200">
            <CreditCard className="w-3 h-3" />
            Boleto + PIX
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-xs">
            {billingType}
          </Badge>
        );
    }
  };

  // Extract boleto barcode from bank_slip_url if available
  const getBoletoLinhaDigitavel = (charge: AsaasCharge): string | null => {
    // The Asaas API returns invoice_url which contains the full payment page
    // For now we'll use the invoice_url as it contains boleto info
    return null; // Linha digitável would need to be stored separately
  };

  return (
    <AppLayout title="Contas a Receber" subtitle="Gerencie suas receitas e cobranças">
      <div className="content-panel">
        <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                A RECEBER
              </p>
              <p className="text-lg sm:text-2xl font-black text-amber-600 mt-1 truncate">
                {formatCurrency(totalAReceber)}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </Card>

          <Card className="p-3 sm:p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                RECEBIDO
              </p>
              <p className="text-lg sm:text-2xl font-black text-success mt-1 truncate">
                {formatCurrency(totalRecebido)}
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-success flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </Card>
        </div>

        {/* Table Section */}
        <Card className="overflow-hidden">
          <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-base sm:text-lg">Cobranças</h3>
            </div>
            <Button 
              className="gap-2 bg-success hover:bg-success/90 w-full sm:w-auto"
              onClick={() => setShowNovaCobranca(true)}
            >
              <Plus className="w-4 h-4" />
              Nova Cobrança
            </Button>
          </div>

          {/* Filters */}
          <div className="p-3 sm:p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
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
          <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">DESCRIÇÃO</TableHead>
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold text-right">VALOR</TableHead>
                <TableHead className="font-semibold">VENCIMENTO</TableHead>
                <TableHead className="font-semibold">FORMA</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredCharges.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
                          
                          {/* Ver Boleto PDF */}
                          {charge.bank_slip_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 border-blue-200 hover:bg-blue-50"
                                  onClick={() => window.open(charge.bank_slip_url!, "_blank")}
                                >
                                  <FileText className="w-4 h-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver Boleto (PDF)</TooltipContent>
                            </Tooltip>
                          )}

                          {/* QR Code PIX */}
                          {charge.pix_qr_code && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 border-green-200 hover:bg-green-50"
                                  onClick={() => setPixModalCharge(charge as AsaasCharge)}
                                >
                                  <QrCode className="w-4 h-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver QR Code PIX</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Copiar PIX Copia e Cola */}
                          {charge.pix_copy_paste && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 border-green-200 hover:bg-green-50"
                                  onClick={() => copyToClipboard(charge.pix_copy_paste!, "Código PIX")}
                                >
                                  <Copy className="w-4 h-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copiar código PIX</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Abrir Fatura */}
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
                              <TooltipContent>Abrir página de pagamento</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Excluir */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10"
                                onClick={() => setDeleteConfirm(charge.id)}
                              >
                                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir cobrança</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
        </div>
      </div>

      <NovaCobrancaModal
        open={showNovaCobranca} 
        onOpenChange={setShowNovaCobranca} 
      />

      {/* Modal QR Code PIX */}
      <Dialog open={!!pixModalCharge} onOpenChange={() => setPixModalCharge(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-green-600" />
              QR Code PIX
            </DialogTitle>
          </DialogHeader>
          {pixModalCharge && (
            <div className="flex flex-col items-center space-y-4">
              {/* QR Code Image */}
              <div className="p-4 bg-white rounded-lg border-2 border-green-200">
                <img 
                  src={`data:image/png;base64,${pixModalCharge.pix_qr_code}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>

              {/* Charge Info */}
              <div className="text-center space-y-1">
                <p className="text-2xl font-black text-green-600">
                  {formatCurrency(Number(pixModalCharge.value))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {pixModalCharge.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vencimento: {formatDate(pixModalCharge.due_date)}
                </p>
              </div>

              {/* Copy PIX Code */}
              {pixModalCharge.pix_copy_paste && (
                <div className="w-full space-y-2">
                  <p className="text-xs font-medium text-muted-foreground text-center">
                    PIX Copia e Cola
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={pixModalCharge.pix_copy_paste}
                      className="text-xs font-mono"
                    />
                    <Button 
                      variant="outline"
                      size="icon"
                      className="shrink-0 border-green-200 hover:bg-green-50"
                      onClick={() => copyToClipboard(pixModalCharge.pix_copy_paste!, "Código PIX")}
                    >
                      <Copy className="w-4 h-4 text-green-600" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
