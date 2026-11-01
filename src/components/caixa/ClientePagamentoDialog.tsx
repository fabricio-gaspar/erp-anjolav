import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientePagamento } from "@/components/clientes/ClientePagamento";

interface ClientePagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string | null;
}

export function ClientePagamentoDialog({ open, onOpenChange, clienteId }: ClientePagamentoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-5xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração de pagamento do cliente</DialogTitle>
          <DialogDescription>
            Ajuste rapidamente as mesmas opções disponíveis no cadastro do cliente. As alterações ficam salvas para os próximos faturamentos.
          </DialogDescription>
        </DialogHeader>
        <ClientePagamento
          clienteId={clienteId}
          onBack={() => onOpenChange(false)}
          onSave={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
