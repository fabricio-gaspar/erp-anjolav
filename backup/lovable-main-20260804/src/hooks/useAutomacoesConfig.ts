import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface AutomacaoConfig {
  id: string;
  tipo: "backup" | "fechamento" | "limpeza" | "notificacao";
  ativo: boolean;
  configuracao: Record<string, unknown>;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  created_at: string;
  updated_at: string;
}

export type AutomacaoConfigUpdate = Partial<Pick<AutomacaoConfig, "ativo" | "configuracao">>;

export function useAutomacoesConfig() {
  const queryClient = useQueryClient();

  const { data: automacoes = [], isLoading, error } = useQuery({
    queryKey: ["automacoes_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automacoes_config")
        .select("*")
        .order("tipo", { ascending: true });
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        tipo: item.tipo as AutomacaoConfig["tipo"],
        configuracao: (item.configuracao || {}) as Record<string, unknown>,
      })) as AutomacaoConfig[];
    },
  });

  const updateAutomacao = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & AutomacaoConfigUpdate) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.ativo !== undefined) {
        updateData.ativo = updates.ativo;
      }
      
      if (updates.configuracao !== undefined) {
        updateData.configuracao = updates.configuracao as Json;
      }

      const { data, error } = await supabase
        .from("automacoes_config")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        tipo: data.tipo as AutomacaoConfig["tipo"],
        configuracao: (data.configuracao || {}) as Record<string, unknown>,
      } as AutomacaoConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automacoes_config"] });
      toast.success("Automação atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Função para obter uma automação específica
  const getAutomacao = (tipo: AutomacaoConfig["tipo"]) => {
    return automacoes.find(a => a.tipo === tipo);
  };

  return {
    automacoes,
    isLoading,
    error,
    updateAutomacao,
    getAutomacao,
  };
}
