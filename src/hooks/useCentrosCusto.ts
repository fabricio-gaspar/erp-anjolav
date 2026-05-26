import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CentroCusto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useCentrosCusto() {
  const qc = useQueryClient();

  const { data: centros = [], isLoading } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("centros_custo")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []) as CentroCusto[];
    },
  });

  const createCentro = useMutation({
    mutationFn: async (input: { nome: string; descricao?: string | null }) => {
      const { data, error } = await (supabase as any)
        .from("centros_custo")
        .insert({ ativo: true, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo criado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const updateCentro = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<CentroCusto> & { id: string }) => {
      const { error } = await (supabase as any).from("centros_custo").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo atualizado!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const deleteCentro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("centros_custo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo excluído!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  return { centros, isLoading, createCentro, updateCentro, deleteCentro };
}
