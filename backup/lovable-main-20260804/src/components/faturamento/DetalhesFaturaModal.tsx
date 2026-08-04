import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Receipt,
  CreditCard,
  Send,
  Check,
  Clock,
  Calendar,
  Building2,
  Mail,
  Phone,
  Copy,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Fatura } from "@/hooks/useFaturas";
import { cn } from "@/lib/utils";

interface DetalhesFaturaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: Fatura | null;
}

export function DetalhesFaturaModal({
  open,
  onOpenChange,
  fatura,
}: DetalhesFaturaModalProps) {
  if (!fatura) return null;

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pendente":
        return { label: "Pendente", variant: "warning" as const };
      case "relatorio_gerado":
        return { label: "Relatório Gerado", variant: "info" as const };
      case "nota_emitida":
        return { label: "Nota Emitida", variant: "info" as const };
      case "pagamento_configurado":
        return { label: "Aguardando Envio", variant: "info" as const };
      case "enviada":
      case "enviado":
        return { label: "Enviada", variant: "default" as const };
      case "pago":
        return { label: "Pago", variant: "success" as const };
      case "cancelado":
        return { label: "Cancelado", variant: "danger" as const };
      default:
        return { label: status, variant: "default" as const };
    }
  };

  const statusConfig = getStatusConfig(fatura.status);

  const itensSnapshot = (fatura.itens_snapshot as Array<{
    id: string;
    produto: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    valor_total: number;
  }>) || [];

  const handleCopyPixCode = () => {
    if (fatura.pix_copia_cola) {
      navigator.clipboard.writeText(fatura.pix_copia_cola);
      toast.success("Código PIX copiado!");
    }
  };

  const handleCopyBoleto = () => {
    if (fatura.boleto_linha_digitavel) {
      navigator.clipboard.writeText(fatura.boleto_linha_digitavel);
      toast.success("Linha digitável copiada!");
    }
  };

  // Progress indicators
  const etapas = [
    { label: "Relatório", completed: fatura.relatorio_gerado },
    { label: "NF", completed: !!fatura.numero_nf },
    { label: "Pagamento", completed: !!fatura.forma_pagamento },
    { label: "Envio", completed: !!fatura.data_envio },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-primary" />
            Detalhes da Fatura
            <StatusBadge variant={statusConfig.variant}>
              {statusConfig.label}
            </StatusBadge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Progress Indicator */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
              {etapas.map((etapa, index) => (
                <div key={etapa.label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        etapa.completed
                          ? "bg-success text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {etapa.completed ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="text-xs mt-1 text-muted-foreground">
                      {etapa.label}
                    </span>
                  </div>
                  {index < etapas.length - 1 && (
                    <div
                      className={cn(
                        "h-0.5 w-12 mx-2",
                        etapa.completed ? "bg-success" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Client & Period Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="w-4 h-4 text-primary" />
                  Cliente
                </div>
                <div>
                  <p className="font-semibold">{fatura.cliente?.razao_social}</p>
                  <p className="text-sm text-muted-foreground">
                    {fatura.cliente?.cpf_cnpj || "CPF/CNPJ não informado"}
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {fatura.cliente?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {fatura.cliente.email}
                    </div>
                  )}
                  {fatura.cliente?.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {fatura.cliente.telefone}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="w-4 h-4 text-primary" />
                  Período & Valor
                </div>
                <div>
                  <p className="font-semibold">
                    {format(new Date(fatura.periodo_inicio), "dd/MM/yyyy")} -{" "}
                    {format(new Date(fatura.periodo_fim), "dd/MM/yyyy")}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-2">
                    {formatCurrency(Number(fatura.valor_total))}
                  </p>
                </div>
                {fatura.data_vencimento && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Vencimento:</span>
                    <span className="font-medium">
                      {format(new Date(fatura.data_vencimento), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            {itensSnapshot.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">
                    Itens da Fatura ({itensSnapshot.length})
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">PRODUTO</TableHead>
                      <TableHead className="text-xs text-right">QTD</TableHead>
                      <TableHead className="text-xs text-right">UNIT.</TableHead>
                      <TableHead className="text-xs text-right">TOTAL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensSnapshot.map((item, index) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="text-sm">{item.produto}</TableCell>
                        <TableCell className="text-sm text-right">
                          {item.quantidade} {item.unidade}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {formatCurrency(item.valor_unitario)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium">
                          {formatCurrency(item.valor_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* NF Info */}
            {fatura.numero_nf && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Receipt className="w-4 h-4 text-primary" />
                  Nota Fiscal
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Número:</span>
                    <span className="ml-2 font-mono font-medium">
                      {fatura.numero_nf}
                    </span>
                  </div>
                  {fatura.data_emissao_nf && (
                    <div>
                      <span className="text-muted-foreground">Emissão:</span>
                      <span className="ml-2">
                        {format(new Date(fatura.data_emissao_nf), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                  )}
                </div>
                {fatura.chave_acesso && (
                  <div className="mt-2">
                    <span className="text-muted-foreground text-xs">Chave de Acesso:</span>
                    <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded mt-1">
                      {fatura.chave_acesso}
                    </p>
                  </div>
                )}
                {fatura.link_pdf_nf && (
                  <Button variant="outline" size="sm" className="mt-2 gap-2" asChild>
                    <a href={fatura.link_pdf_nf} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" />
                      Abrir PDF da NF
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Payment Info */}
            {fatura.forma_pagamento && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Pagamento
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {fatura.forma_pagamento}
                  </Badge>
                  {fatura.data_vencimento && (
                    <span className="text-sm text-muted-foreground">
                      Vence em {format(new Date(fatura.data_vencimento), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>

                {fatura.pix_copia_cola && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">PIX Copia e Cola:</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs p-2 bg-muted rounded truncate">
                        {fatura.pix_copia_cola}
                      </code>
                      <Button variant="outline" size="sm" onClick={handleCopyPixCode}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {fatura.boleto_linha_digitavel && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Linha Digitável:</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs p-2 bg-muted rounded truncate font-mono">
                        {fatura.boleto_linha_digitavel}
                      </code>
                      <Button variant="outline" size="sm" onClick={handleCopyBoleto}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {fatura.boleto_url && (
                      <Button variant="outline" size="sm" className="gap-2" asChild>
                        <a href={fatura.boleto_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                          Abrir Boleto
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Send Info */}
            {fatura.data_envio && (
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Send className="w-4 h-4 text-primary" />
                  Envio
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Enviado em:</span>
                    <span className="ml-2">
                      {format(new Date(fatura.data_envio), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  {fatura.canais_envio && fatura.canais_envio.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Canais:</span>
                      {fatura.canais_envio.map((canal) => (
                        <Badge key={canal} variant="outline" className="capitalize">
                          {canal}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {fatura.destinatario_envio && (
                    <div>
                      <span className="text-muted-foreground">Destinatário:</span>
                      <span className="ml-2">{fatura.destinatario_envio}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observation */}
            {fatura.observacao_fatura && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Observações
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {fatura.observacao_fatura}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
