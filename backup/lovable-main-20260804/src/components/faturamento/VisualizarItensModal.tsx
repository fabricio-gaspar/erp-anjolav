import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Package, Calendar, FileText } from "lucide-react";
import type { Lancamento, ItemLancamento } from "@/hooks/useLancamentos";

interface VisualizarItensModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  itens: ItemLancamento[];
  isLoading?: boolean;
}

export function VisualizarItensModal({
  open,
  onOpenChange,
  lancamento,
  itens,
  isLoading,
}: VisualizarItensModalProps) {
  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  if (!lancamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Itens do Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{lancamento.cliente?.razao_social || "Cliente"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-medium">
                  {format(new Date(lancamento.data_lancamento), "dd/MM/yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">PRODUTO</TableHead>
                  <TableHead className="font-semibold text-center">QTD</TableHead>
                  <TableHead className="font-semibold text-center">UNID</TableHead>
                  <TableHead className="font-semibold text-right">UNIT.</TableHead>
                  <TableHead className="font-semibold text-right">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando itens...
                    </TableCell>
                  </TableRow>
                ) : itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.produto_nome}</TableCell>
                      <TableCell className="text-center">{Number(item.quantidade).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">
                          {item.unidade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(item.preco_unitario))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(item.subtotal))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="font-medium">Total do Lançamento</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(Number(lancamento.valor_total))}
            </span>
          </div>

          {/* Observation */}
          {lancamento.observacao && (
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Observação</p>
              <p className="text-sm">{lancamento.observacao}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
