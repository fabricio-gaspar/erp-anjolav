import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StatusConta = "pendente" | "parcial" | "pago" | "cancelado" | "vencido";

export interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor: string | null;
  fornecedor_id: string | null;
  valor: number;
  valor_pago: number;
  vencimento: string;
  data_pagamento: string | null;
  status: StatusConta;
  categoria: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContaPagarInsert = Omit<ContaPagar, "id" | "created_at" | "updated_at" | "valor_pago"> & { valor_pago?: number };

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
      return (data || []) as unknown as ContaPagar[];
    },
  });

  const createConta = useMutation({
    mutationFn: async (conta: ContaPagarInsert) => {
      const { data, error } = await (supabase as any)
        .from("contas_pagar")
        .insert(conta)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Conta criada com sucesso!");
    },
    onError: (error: any) => toast.error("Erro ao criar conta: " + error.message),
  });

  const updateConta = useMutation({
    mutationFn: async ({ id, ...updates }: ContaPagarUpdate & { id: string }) => {
      const { data, error } = await (supabase as any)
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
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Conta atualizada com sucesso!");
    },
    onError: (error: any) => toast.error("Erro ao atualizar conta: " + error.message),
  });

  const deleteConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_pagar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success("Conta excluída com sucesso!");
    },
    onError: (error: any) => toast.error("Erro ao excluir conta: " + error.message),
  });

  const marcarComoPago = useMutation({
    mutationFn: async (id: string) => {
      const conta = contas.find(c => c.id === id);
      const { data, error } = await (supabase as any)
        .from("contas_pagar")
        .update({
          status: "pago",
          valor_pago: conta?.valor ?? 0,
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
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] });
      toast.success("Conta marcada como paga!");
    },
    onError: (error: any) => toast.error("Erro ao marcar como pago: " + error.message),
  });

  // Status "atrasado" calculado em runtime
  const hoje = new Date().toISOString().split("T")[0];
  const isAtrasado = (c: ContaPagar) => (c.status === "pendente" || c.status === "parcial") && c.vencimento < hoje;

  const totalPendente = contas
    .filter((c) => (c.status === "pendente" || c.status === "parcial") && !isAtrasado(c))
    .reduce((acc, c) => acc + Number(c.valor) - Number(c.valor_pago || 0), 0);

  const totalPago = contas
    .filter((c) => c.status === "pago" || c.status === "parcial")
    .reduce((acc, c) => acc + Number(c.valor_pago || 0), 0);

  const totalVencido = contas
    .filter(isAtrasado)
    .reduce((acc, c) => acc + Number(c.valor) - Number(c.valor_pago || 0), 0);

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
    isAtrasado,
  };
}
