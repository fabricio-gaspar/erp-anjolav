import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ModuloPermissao {
  id: string;
  funcionario_id: string;
  modulo_key: string;
  tem_acesso: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissaoUpdate {
  funcionario_id: string;
  modulo_key: string;
  tem_acesso: boolean;
}

export const useModuloPermissoes = () => {
  return useQuery({
    queryKey: ["modulo-permissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulo_permissoes")
        .select("*");

      if (error) throw error;
      return data as ModuloPermissao[];
    },
  });
};

export const useSavePermissoes = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (permissoes: PermissaoUpdate[]) => {
      const { error } = await supabase
        .from("modulo_permissoes")
        .upsert(permissoes, { 
          onConflict: "funcionario_id,modulo_key",
          ignoreDuplicates: false 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modulo-permissoes"] });
      toast({
        title: "Sucesso",
        description: "Permissões salvas com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Erro ao salvar permissões:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar permissões. Tente novamente.",
        variant: "destructive",
      });
    },
  });
};
