import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfiguracaoGeral {
  id: string;
  nome_empresa: string | null;
  cor_primaria: string | null;
  logo_url: string | null;
  pix_tipo_chave: string | null;
  pix_chave: string | null;
  banco_nome: string | null;
  banco_agencia: string | null;
  banco_conta: string | null;
  banco_titular: string | null;
  template_pix: string | null;
  template_boleto: string | null;
  template_transferencia: string | null;
  whatsapp_numero: string | null;
  created_at: string;
  updated_at: string;
}

export type ConfiguracaoGeralUpdate = Partial<Omit<ConfiguracaoGeral, "id" | "created_at" | "updated_at">>;

export function useConfiguracoesGerais() {
  const queryClient = useQueryClient();

  const { data: configuracao, isLoading, error } = useQuery({
    queryKey: ["configuracoes_gerais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_gerais")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as ConfiguracaoGeral | null;
    },
  });

  const saveConfiguracao = useMutation({
    mutationFn: async (updates: ConfiguracaoGeralUpdate) => {
      // Verifica se já existe um registro
      const { data: existing } = await supabase
        .from("configuracoes_gerais")
        .select("id")
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("configuracoes_gerais")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("configuracoes_gerais")
          .insert(updates)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_gerais"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  return {
    configuracao,
    isLoading,
    error,
    saveConfiguracao,
  };
}
