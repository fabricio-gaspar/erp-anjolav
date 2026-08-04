import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Printer, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalRelatorio } from "@/hooks/usePortalData";
import type { FaturaPortal } from "@/hooks/usePortalData";

interface VisualizarRelatorioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fatura: FaturaPortal;
  clienteNome: string;
  empresaNome?: string;
  logoUrl?: string;
}

export function VisualizarRelatorioModal({
  open,
  onOpenChange,
  fatura,
  clienteNome,
  empresaNome,
  logoUrl,
}: VisualizarRelatorioModalProps) {
  const { data: lancamentos, isLoading } = usePortalRelatorio(open ? fatura.id : null);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const getMesAno = () => {
    return format(new Date(fatura.periodo_inicio), "MMMM/yyyy", { locale: ptBR });
  };

  const handlePrint = () => {
    const printContent = document.getElementById("relatorio-print-content");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório - ${clienteNome}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .header { text-align: center; margin-bottom: 20px; }
          .header img { max-height: 60px; }
          .total-row { font-weight: bold; background-color: #f0f0f0; }
          .text-right { text-align: right; }
          .cliente-info { margin-bottom: 15px; padding: 10px; background: #f9f9f9; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Calcular totais
  const totais = lancamentos?.reduce(
    (acc, lanc) => {
      const itensTotal = lanc.itens?.reduce(
        (itemAcc, item) => ({
          quantidade: itemAcc.quantidade + Number(item.quantidade || 0),
          valor: itemAcc.valor + Number(item.subtotal || 0),
        }),
        { quantidade: 0, valor: 0 }
      ) || { quantidade: 0, valor: 0 };

      return {
        quantidade: acc.quantidade + itensTotal.quantidade,
        valor: acc.valor + itensTotal.valor,
      };
    },
    { quantidade: 0, valor: 0 }
  ) || { quantidade: 0, valor: 0 };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Relatório - {getMesAno()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-64" />
            </div>
          ) : !lancamentos || lancamentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum lançamento encontrado para esta fatura</p>
            </div>
          ) : (
            <div id="relatorio-print-content" className="p-4">
              {/* Header */}
              <div className="header text-center mb-6 pb-4 border-b">
                {logoUrl && (
                  <img src={logoUrl} alt="Logo" className="h-12 mx-auto mb-2" />
                )}
                <h2 className="text-lg font-bold">{empresaNome || "Relatório de Serviços"}</h2>
                <p className="text-sm text-muted-foreground">
                  Período: {format(new Date(fatura.periodo_inicio), "dd/MM/yyyy")} a{" "}
                  {format(new Date(fatura.periodo_fim), "dd/MM/yyyy")}
                </p>
              </div>

              {/* Cliente Info */}
              <div className="cliente-info bg-muted/30 p-3 rounded-lg mb-4">
                <p className="font-medium">{clienteNome}</p>
                <p className="text-sm text-muted-foreground">Ref: {getMesAno()}</p>
              </div>

              {/* Lançamentos */}
              {lancamentos.map((lancamento, idx) => (
                <div key={lancamento.id} className="mb-6">
                  <div className="bg-muted/50 p-2 rounded-t font-medium text-sm flex justify-between">
                    <span>
                      ROL #{idx + 1} - {format(new Date(lancamento.data_lancamento), "dd/MM/yyyy")}
                    </span>
                    {lancamento.data_entrega && (
                      <span className="text-muted-foreground">
                        Entrega: {format(new Date(lancamento.data_entrega), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="border p-2 text-left">Descrição</th>
                        <th className="border p-2 text-right w-20">Qtd</th>
                        <th className="border p-2 text-right w-28">Unitário</th>
                        <th className="border p-2 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamento.itens?.map((item) => (
                        <tr key={item.id}>
                          <td className="border p-2">{item.produto_nome}</td>
                          <td className="border p-2 text-right">
                            {Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade}
                          </td>
                          <td className="border p-2 text-right">
                            {formatCurrency(Number(item.preco_unitario))}
                          </td>
                          <td className="border p-2 text-right">
                            {formatCurrency(Number(item.subtotal))}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/20 font-medium">
                        <td className="border p-2">Subtotal ROL</td>
                        <td className="border p-2 text-right">
                          {lancamento.itens?.reduce((sum, i) => sum + Number(i.quantidade), 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="border p-2"></td>
                        <td className="border p-2 text-right">
                          {formatCurrency(Number(lancamento.valor_total))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Total Geral */}
              <div className="mt-6 p-4 bg-primary/10 rounded-lg">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>TOTAL GERAL</span>
                  <div className="text-right">
                    <span className="text-muted-foreground mr-4">
                      {totais.quantidade.toLocaleString("pt-BR")} peças
                    </span>
                    <span className="text-primary">
                      {formatCurrency(totais.valor)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handlePrint} disabled={isLoading || !lancamentos?.length}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
