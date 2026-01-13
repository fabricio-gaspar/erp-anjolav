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
import { Agendamento } from "@/hooks/useAgendamentos";

interface ExcluirAgendamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onConfirm: (id: string) => void;
}

export function ExcluirAgendamentoModal({
  open,
  onOpenChange,
  agendamento,
  onConfirm,
}: ExcluirAgendamentoModalProps) {
  const handleConfirm = () => {
    if (agendamento) {
      onConfirm(agendamento.id);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Agendamento?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O agendamento de{" "}
            <strong>{agendamento?.cliente?.razao_social}</strong> será removido
            permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
