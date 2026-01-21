import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NotificacaoConfig {
  id: string;
  canal: "whatsapp" | "email" | "sms";
  evento: string;
  ativo: boolean;
  template: string;
  variaveis: string[];
  created_at: string;
  updated_at: string;
}

export type NotificacaoConfigInsert = Omit<NotificacaoConfig, "id" | "created_at" | "updated_at">;
export type NotificacaoConfigUpdate = Partial<NotificacaoConfigInsert>;

export function useNotificacoesConfig() {
  const queryClient = useQueryClient();

  const { data: notificacoes = [], isLoading, error } = useQuery({
    queryKey: ["notificacoes_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_config")
        .select("*")
        .order("canal", { ascending: true })
        .order("evento", { ascending: true });
      if (error) throw error;
      return data as NotificacaoConfig[];
    },
  });

  const updateNotificacao = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & NotificacaoConfigUpdate) => {
      const { data, error } = await supabase
        .from("notificacoes_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as NotificacaoConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes_config"] });
      toast.success("Notificação atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const createNotificacao = useMutation({
    mutationFn: async (notificacao: NotificacaoConfigInsert) => {
      const { data, error } = await supabase
        .from("notificacoes_config")
        .insert(notificacao)
        .select()
        .single();
      if (error) throw error;
      return data as NotificacaoConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes_config"] });
      toast.success("Notificação criada!");
    },
    onError: (error) => {
      toast.error("Erro ao criar: " + error.message);
    },
  });

  const deleteNotificacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes_config")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificacoes_config"] });
      toast.success("Notificação removida!");
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  return {
    notificacoes,
    isLoading,
    error,
    updateNotificacao,
    createNotificacao,
    deleteNotificacao,
  };
}
