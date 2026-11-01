import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface CentroCusto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface UseCentrosCustoOptions {
  enabled?: boolean;
}

export function useCentrosCusto(options: UseCentrosCustoOptions = {}) {
  const qc = useQueryClient();
  const { activeTenant, session } = useAuth();

  const requireWorkspace = () => {
    if (!session?.user.id || !activeTenant?.id) {
      throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar centros de custo");
    }
  };

  const { data: centros = [], isLoading } = useQuery({
    queryKey: ["centros_custo", session?.user.id, activeTenant?.id],
    queryFn: async () => {
      requireWorkspace();
      const { data, error } = await supabase
        .from("centros_custo")
        .select("*")
        .filter("tenant_id", "eq", activeTenant!.id)
        .order("nome")
        .order("id");
      if (error) throw error;
      return (data || []) as CentroCusto[];
    },
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
  });

  const createCentro = useMutation({
    mutationFn: async (input: { nome: string; descricao?: string | null }) => {
      requireWorkspace();
      if (!input.nome.trim()) throw new Error("Nome é obrigatório");
      const { data, error } = await supabase
        .from("centros_custo")
        .insert({ ativo: true, ...input, nome: input.nome.trim(), tenant_id: activeTenant!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo criado!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const updateCentro = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<CentroCusto> & { id: string }) => {
      requireWorkspace();
      const updates = { ...rest, ...(rest.nome ? { nome: rest.nome.trim() } : {}) };
      const { error } = await supabase
        .from("centros_custo")
        .update(updates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const setCentroAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      requireWorkspace();
      const { error } = await supabase
        .from("centros_custo")
        .update({ ativo })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Situação do centro de custo atualizada sem apagar o histórico.");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  return { centros, isLoading, createCentro, updateCentro, setCentroAtivo };
}
