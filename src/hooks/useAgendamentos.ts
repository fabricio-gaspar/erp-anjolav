import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Agendamento {
  id: string;
  cliente_id: string;
  tipo: "retirada" | "entrega";
  data: string;
  horario: string | null;
  frequencia: string | null;
  recorrente: boolean;
  motorista_id: string | null;
  observacoes: string | null;
  status: "agendado" | "confirmado" | "realizado" | "cancelado";
  created_at: string;
  updated_at: string;
  // Relacionamentos
  cliente?: {
    razao_social: string;
  };
  motorista?: {
    nome: string;
  };
}

export type AgendamentoInsert = Omit<Agendamento, "id" | "created_at" | "updated_at" | "cliente" | "motorista">;
export type AgendamentoUpdate = Partial<AgendamentoInsert>;

export function useAgendamentos(filtroData?: { inicio: string; fim: string }) {
  const queryClient = useQueryClient();

  const { data: agendamentos = [], isLoading, error } = useQuery({
    queryKey: ["agendamentos", filtroData],
    queryFn: async () => {
      let query = supabase
        .from("agendamentos")
        .select(`
          *,
          cliente:clientes(razao_social),
          motorista:motoristas(nome)
        `)
        .order("data")
        .order("horario");

      if (filtroData) {
        query = query
          .gte("data", filtroData.inicio)
          .lte("data", filtroData.fim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Agendamento[];
    },
  });

  const createAgendamento = useMutation({
    mutationFn: async (agendamento: AgendamentoInsert) => {
      const { data, error } = await supabase
        .from("agendamentos")
        .insert(agendamento)
        .select(`
          *,
          cliente:clientes(razao_social),
          motorista:motoristas(nome)
        `)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Agendamento criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar agendamento: " + error.message);
    },
  });

  const updateAgendamento = useMutation({
    mutationFn: async ({ id, ...updates }: AgendamentoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("agendamentos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Agendamento atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar agendamento: " + error.message);
    },
  });

  const deleteAgendamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Agendamento excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir agendamento: " + error.message);
    },
  });

  // Agendamentos por tipo
  const retiradas = agendamentos.filter((a) => a.tipo === "retirada");
  const entregas = agendamentos.filter((a) => a.tipo === "entrega");

  return {
    agendamentos,
    retiradas,
    entregas,
    isLoading,
    error,
    createAgendamento,
    updateAgendamento,
    deleteAgendamento,
  };
}
