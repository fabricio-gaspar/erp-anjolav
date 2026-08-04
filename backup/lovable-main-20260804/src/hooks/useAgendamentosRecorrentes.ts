import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AgendamentoGerado } from "@/lib/agendamentoUtils";

export function useAgendamentosRecorrentes() {
  const queryClient = useQueryClient();

  // Deleta todos os agendamentos recorrentes de um cliente
  const deleteRecorrentesDoCliente = useMutation({
    mutationFn: async (clienteId: string) => {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("cliente_id", clienteId)
        .eq("recorrente", true);

      if (error) throw error;
      return true;
    },
    onError: (error) => {
      console.error("Erro ao remover agendamentos recorrentes:", error);
    },
  });

  // Cria agendamentos em lote
  const criarAgendamentosEmLote = useMutation({
    mutationFn: async (agendamentos: AgendamentoGerado[]) => {
      if (agendamentos.length === 0) return { count: 0 };

      const { error, data } = await supabase
        .from("agendamentos")
        .insert(agendamentos)
        .select();

      if (error) throw error;
      return { count: data?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      if (result.count > 0) {
        toast.success(`${result.count} agendamentos criados com sucesso!`);
      }
    },
    onError: (error) => {
      console.error("Erro ao criar agendamentos:", error);
      toast.error("Erro ao criar agendamentos automáticos.");
    },
  });

  // Função combinada: remove recorrentes antigos e cria novos
  const regenerarAgendamentos = async (
    clienteId: string,
    agendamentos: AgendamentoGerado[]
  ) => {
    try {
      // 1. Remover agendamentos recorrentes existentes
      await deleteRecorrentesDoCliente.mutateAsync(clienteId);

      // 2. Criar novos agendamentos
      if (agendamentos.length > 0) {
        await criarAgendamentosEmLote.mutateAsync(agendamentos);
      } else {
        toast.info("Nenhum agendamento foi gerado. Verifique os dias selecionados.");
      }

      return true;
    } catch (error) {
      console.error("Erro ao regenerar agendamentos:", error);
      return false;
    }
  };

  return {
    deleteRecorrentesDoCliente,
    criarAgendamentosEmLote,
    regenerarAgendamentos,
    isLoading:
      deleteRecorrentesDoCliente.isPending || criarAgendamentosEmLote.isPending,
  };
}
