import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
  cor: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoriaFinanceiraInsert = Omit<CategoriaFinanceira, "id" | "created_at" | "updated_at">;

export function useCategoriasFinanceiras(tipo?: "receita" | "despesa") {
  const qc = useQueryClient();

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias_financeiras", tipo ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("categorias_financeiras").select("*").order("ordem").order("nome");
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CategoriaFinanceira[];
    },
  });

  const createCategoria = useMutation({
    mutationFn: async (input: Partial<CategoriaFinanceiraInsert>) => {
      const { data, error } = await (supabase as any)
        .from("categorias_financeiras")
        .insert({ ativo: true, ordem: 100, cor: "slate", ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Categoria criada!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const updateCategoria = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<CategoriaFinanceira> & { id: string }) => {
      const { error } = await (supabase as any).from("categorias_financeiras").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Categoria atualizada!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const deleteCategoria = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("categorias_financeiras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Categoria excluída!");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  return { categorias, isLoading, createCategoria, updateCategoria, deleteCategoria };
}
