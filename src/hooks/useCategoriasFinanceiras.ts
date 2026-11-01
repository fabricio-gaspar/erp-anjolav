import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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

interface UseCategoriasFinanceirasOptions {
  enabled?: boolean;
}

export function useCategoriasFinanceiras(
  tipo?: "receita" | "despesa",
  options: UseCategoriasFinanceirasOptions = {},
) {
  const qc = useQueryClient();
  const { activeTenant, session } = useAuth();

  const requireWorkspace = () => {
    if (!session?.user.id || !activeTenant?.id) {
      throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar categorias");
    }
  };

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias_financeiras", session?.user.id, activeTenant?.id, tipo ?? "all"],
    queryFn: async () => {
      requireWorkspace();
      let q = supabase
        .from("categorias_financeiras")
        .select("*")
        .filter("tenant_id", "eq", activeTenant!.id)
        .order("ordem")
        .order("nome")
        .order("id");
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CategoriaFinanceira[];
    },
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
  });

  const createCategoria = useMutation({
    mutationFn: async (input: Partial<CategoriaFinanceiraInsert>) => {
      requireWorkspace();
      if (!input.nome?.trim() || !input.tipo) throw new Error("Nome e tipo são obrigatórios");
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .insert({
          ativo: true,
          ordem: 100,
          cor: "slate",
          ...input,
          nome: input.nome.trim(),
          tipo: input.tipo,
          tenant_id: activeTenant!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Categoria criada!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const updateCategoria = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<CategoriaFinanceira> & { id: string }) => {
      requireWorkspace();
      const updates = { ...rest, ...(rest.nome ? { nome: rest.nome.trim() } : {}) };
      const { error } = await supabase
        .from("categorias_financeiras")
        .update(updates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Categoria atualizada!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const setCategoriaAtiva = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      requireWorkspace();
      const { error } = await supabase
        .from("categorias_financeiras")
        .update({ ativo })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      toast.success("Situação da categoria atualizada sem apagar o histórico.");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  return { categorias, isLoading, createCategoria, updateCategoria, setCategoriaAtiva };
}
