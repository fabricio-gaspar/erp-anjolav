import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { Json } from "@/integrations/supabase/types";

export interface Fornecedor {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  telefone: string | null;
  email: string | null;
  contato_nome: string | null;
  endereco: Json | null;
  categoria: string | null;
  observacoes: string | null;
  ativo: boolean;
  valor_recorrente: number | null;
  dia_vencimento: number | null;
  frequencia_pagamento: string | null;
  created_at: string;
  updated_at: string;
}

export type FornecedorInput = Pick<
  Fornecedor,
  | "nome"
  | "razao_social"
  | "cnpj_cpf"
  | "telefone"
  | "email"
  | "contato_nome"
  | "endereco"
  | "categoria"
  | "observacoes"
  | "ativo"
  | "valor_recorrente"
  | "dia_vencimento"
  | "frequencia_pagamento"
>;

interface UseFornecedoresOptions {
  enabled?: boolean;
}

export function useFornecedores(options: UseFornecedoresOptions = {}) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  const invalidateSupplierQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["fornecedores"] }),
    queryClient.invalidateQueries({ queryKey: ["supplier-directory"] }),
  ]);

  const { data: fornecedores = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["fornecedores", session?.user.id, activeTenant?.id, activeArea],
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar fornecedores");
      }
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const criarFornecedor = useMutation({
    mutationFn: async (dados: FornecedorInput) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar fornecedores");
      }
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({ ...dados, tenant_id: activeTenant.id } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateSupplierQueries();
      toast.success("Fornecedor cadastrado com sucesso!");
    },
    onError: (caught: Error) => toast.error("Erro ao cadastrar: " + caught.message),
  });

  const atualizarFornecedor = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<FornecedorInput> & { id: string }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar fornecedores");
      }
      const { data, error } = await supabase
        .from("fornecedores")
        .update(dados)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateSupplierQueries();
      toast.success("Fornecedor atualizado!");
    },
    onError: (caught: Error) => toast.error("Erro ao atualizar: " + caught.message),
  });

  const setFornecedorStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar fornecedores");
      }
      const { data, error } = await supabase
        .from("fornecedores")
        .update({ ativo })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void invalidateSupplierQueries();
      toast.success(variables.ativo
        ? "Fornecedor reativado com sucesso!"
        : "Fornecedor arquivado. O histórico foi preservado.");
    },
    onError: (caught: Error) => toast.error("Erro ao alterar a situação: " + caught.message),
  });

  return {
    fornecedores,
    isLoading,
    isError,
    error,
    refetch,
    criarFornecedor,
    atualizarFornecedor,
    setFornecedorStatus,
  };
}
