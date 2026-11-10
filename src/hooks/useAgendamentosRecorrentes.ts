import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AgendamentoGerado } from "@/lib/agendamentoUtils";
import { useAuth } from "@/contexts/AuthContext";
import { createIdempotencyKey } from "@/lib/idempotency";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import type { Json } from "@/integrations/supabase/types";

export function useAgendamentosRecorrentes() {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { allowed: canManageAgenda } = usePermissaoModulo("agenda");

  const regenerateSchedule = useMutation({
    mutationFn: async ({
      clienteId,
      agendamentos,
      idempotencyKey,
    }: {
      clienteId: string;
      agendamentos: AgendamentoGerado[];
      idempotencyKey: string;
    }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar a agenda");
      }
      if (!canManageAgenda) {
        throw new Error("Sem permissão para alterar a agenda recorrente");
      }
      const payload = agendamentos.map(({ tipo, data, horario, frequencia }) => ({
        tipo,
        data,
        horario,
        frequencia,
      }));
      const { data, error } = await supabase.rpc("regenerar_agendamentos_recorrentes", {
        _cliente_id: clienteId,
        _agendamentos: payload as unknown as Json,
        _idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return data as {
        cancelados?: number;
        criados?: number;
        preservados?: number;
        idempotent?: boolean;
      } | null;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      const created = Number(result?.criados ?? 0);
      const canceled = Number(result?.cancelados ?? 0);
      toast.success(`Agenda atualizada: ${created} criados e ${canceled} anteriores cancelados.`);
    },
    onError: (error) => {
      console.error("Erro ao regenerar agenda recorrente:", error);
      toast.error("Não foi possível atualizar os agendamentos automáticos.");
    },
  });

  const regenerarAgendamentos = async (
    clienteId: string,
    agendamentos: AgendamentoGerado[]
  ) => {
    try {
      await regenerateSchedule.mutateAsync({
        clienteId,
        agendamentos,
        idempotencyKey: createIdempotencyKey("appointment-recurrence"),
      });
      return true;
    } catch (error) {
      console.error("Erro ao regenerar agendamentos:", error);
      return false;
    }
  };

  return {
    regenerarAgendamentos,
    isLoading: regenerateSchedule.isPending,
  };
}
