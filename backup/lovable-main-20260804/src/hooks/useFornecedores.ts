import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Fornecedor {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  telefone: string | null;
  email: string | null;
  contato_nome: string | null;
  endereco: any;
  categoria: string | null;
  observacoes: string | null;
  ativo: boolean;
  valor_recorrente: number | null;
  dia_vencimento: number | null;
  frequencia_pagamento: string | null;
  created_at: string;
  updated_at: string;
}

export function useFornecedores() {
  const queryClient = useQueryClient();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Fornecedor[];
    },
  });

  const criarFornecedor = useMutation({
    mutationFn: async (dados: Partial<Fornecedor>) => {
      const { data, error } = await supabase
        .from("fornecedores")
        .insert(dados as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor cadastrado com sucesso!");
    },
    onError: (err: any) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const atualizarFornecedor = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<Fornecedor> & { id: string }) => {
      const { data, error } = await supabase
        .from("fornecedores")
        .update(dados as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor atualizado!");
    },
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message),
  });

  const excluirFornecedor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
      toast.success("Fornecedor excluído!");
    },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  return { fornecedores, isLoading, criarFornecedor, atualizarFornecedor, excluirFornecedor };
}
