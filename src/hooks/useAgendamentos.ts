import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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

export function useAgendamentos() {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();

  const createAgendamento = useMutation({
    mutationFn: async (agendamento: AgendamentoInsert) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar o agendamento");
      }
      const { data, error } = await supabase
        .from("agendamentos")
        .insert({ ...agendamento, tenant_id: activeTenant.id })
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
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar o agendamento");
      }
      const { data, error } = await supabase
        .from("agendamentos")
        .update(updates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
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

  return {
    createAgendamento,
    updateAgendamento,
  };
}
