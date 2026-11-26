import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumberToCurrency } from "@/lib/currencyUtils";

interface HistoricoPagamentosContaModalProps {
  contaId: string | null;
  descricao: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentMethodLabels: Record<string, string> = {
  PIX: "PIX",
  TRANSFERENCIA: "Transferência",
  BOLETO: "Boleto",
  CARTAO: "Cartão",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

export function HistoricoPagamentosContaModal({
  contaId,
  descricao,
  open,
  onOpenChange,
}: HistoricoPagamentosContaModalProps) {
  const { activeTenant, session } = useAuth();
  const payments = useQuery({
    queryKey: ["contas-pagar-payments", session?.user.id, activeTenant?.id, contaId],
    enabled: open && Boolean(contaId && activeTenant?.id),
    queryFn: async () => {
      if (!contaId || !activeTenant?.id) throw new Error("Selecione uma conta válida");
      const { data, error } = await supabase
        .from("contas_pagar_pagamentos")
        .select("id,valor,data_pagamento,forma_pagamento,referencia,observacoes,status,created_at")
        .eq("conta_pagar_id", contaId)
        .order("data_pagamento", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de pagamentos</DialogTitle>
          <DialogDescription>{descricao} · registros mais recentes primeiro</DialogDescription>
        </DialogHeader>

        {payments.isLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />Carregando pagamentos…
          </div>
        ) : payments.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span>Não foi possível carregar o histórico desta despesa.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void payments.refetch()}>
              <RotateCcw className="mr-2 h-4 w-4" />Tentar novamente
            </Button>
          </div>
        ) : payments.data?.length ? (
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(payment.data_pagamento), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{paymentMethodLabels[payment.forma_pagamento] ?? payment.forma_pagamento}</TableCell>
                    <TableCell className="max-w-40 truncate">{payment.referencia || "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">{payment.observacoes || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold">R$ {formatNumberToCurrency(Number(payment.valor))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum pagamento registrado para esta despesa.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
