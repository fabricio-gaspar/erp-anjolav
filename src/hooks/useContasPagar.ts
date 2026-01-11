import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  data_pagamento: string | null;
  status: "pendente" | "pago" | "vencido";
  categoria: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContaPagarInsert = Omit<ContaPagar, "id" | "created_at" | "updated_at">;
export type ContaPagarUpdate = Partial<ContaPagarInsert>;

export function useContasPagar() {
  const queryClient = useQueryClient();

  const { data: contas = [], isLoading, error } = useQuery({
    queryKey: ["contas_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .order("vencimento");
      if (error) throw error;
      return data as ContaPagar[];
    },
  });

  const createConta = useMutation({
    mutationFn: async (conta: ContaPagarInsert) => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .insert(conta)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar conta: " + error.message);
    },
  });

  const updateConta = useMutation({
    mutationFn: async ({ id, ...updates }: ContaPagarUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar conta: " + error.message);
    },
  });

  const deleteConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contas_pagar")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir conta: " + error.message);
    },
  });

  const marcarComoPago = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .update({
          status: "pago",
          data_pagamento: new Date().toISOString().split("T")[0],
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta marcada como paga!");
    },
    onError: (error) => {
      toast.error("Erro ao marcar como pago: " + error.message);
    },
  });

  // Totais
  const totalPendente = contas
    .filter((c) => c.status === "pendente")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalPago = contas
    .filter((c) => c.status === "pago")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalVencido = contas
    .filter((c) => c.status === "vencido")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  return {
    contas,
    isLoading,
    error,
    createConta,
    updateConta,
    deleteConta,
    marcarComoPago,
    totalPendente,
    totalPago,
    totalVencido,
  };
}
