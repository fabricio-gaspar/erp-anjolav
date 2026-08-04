import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EtiquetasConfig {
  id: string;
  modelo_impressora: string | null;
  tipo_impressora: string | null;
  tamanho_etiqueta: string | null;
  margem_superior: number | null;
  margem_lateral: number | null;
  tamanho_fonte: number | null;
  altura_codigo_barras: number | null;
  created_at: string;
  updated_at: string;
}

export interface EtiquetasConfigUpdate {
  modelo_impressora?: string;
  tipo_impressora?: string;
  tamanho_etiqueta?: string;
  margem_superior?: number;
  margem_lateral?: number;
  tamanho_fonte?: number;
  altura_codigo_barras?: number;
}

export const useEtiquetasConfig = () => {
  return useQuery({
    queryKey: ["etiquetas-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etiquetas_configuracoes")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as EtiquetasConfig;
    },
  });
};

export const useUpdateEtiquetasConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EtiquetasConfigUpdate }) => {
      const { data, error } = await supabase
        .from("etiquetas_configuracoes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etiquetas-config"] });
      toast({
        title: "Sucesso",
        description: "Configurações de etiquetas salvas com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });
};
