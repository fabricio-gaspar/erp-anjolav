import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Caixa {
  id: string;
  operador: string;
  operador_id: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  valor_abertura: number;
  valor_vendas: number;
  valor_sangrias: number;
  valor_reforcos: number;
  valor_esperado: number;
  valor_contado: number | null;
  diferenca: number | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaixaMovimentacao {
  id: string;
  caixa_id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  forma_pagamento: string | null;
  created_at: string;
}

export interface AbrirCaixaData {
  operador: string;
  valor_abertura: number;
}

export interface FecharCaixaData {
  caixa_id: string;
  valor_contado_dinheiro: number;
  valor_contado_pix: number;
  valor_contado_cartao_credito: number;
  valor_contado_cartao_debito: number;
  observacoes?: string;
}

export interface MovimentacaoData {
  caixa_id: string;
  tipo: "VENDA" | "SANGRIA" | "REFORCO";
  valor: number;
  descricao?: string;
  forma_pagamento?: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO";
}

// Get open cash register
export const useCaixaAberto = () => {
  return useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixas")
        .select("*")
        .eq("status", "ABERTO")
        .order("data_abertura", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Caixa | null;
    },
  });
};

// Get all cash registers with optional date filter
export const useCaixas = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ["caixas", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("caixas")
        .select("*")
        .order("data_abertura", { ascending: false });

      if (startDate) {
        query = query.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("data_fechamento", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Caixa[];
    },
  });
};

// Get closed cash registers
export const useCaixasFechados = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ["caixas-fechados", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("caixas")
        .select("*")
        .eq("status", "FECHADO")
        .order("data_fechamento", { ascending: false });

      if (startDate) {
        query = query.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("data_fechamento", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Caixa[];
    },
  });
};

// Get transactions for a cash register
export const useCaixaMovimentacoes = (caixaId: string | undefined) => {
  return useQuery({
    queryKey: ["caixa-movimentacoes", caixaId],
    queryFn: async () => {
      if (!caixaId) return [];
      
      const { data, error } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .eq("caixa_id", caixaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CaixaMovimentacao[];
    },
    enabled: !!caixaId,
  });
};

// Open cash register
export const useAbrirCaixa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AbrirCaixaData) => {
      // Check if there's already an open register
      const { data: existing } = await supabase
        .from("caixas")
        .select("id")
        .eq("status", "ABERTO")
        .maybeSingle();

      if (existing) {
        throw new Error("Já existe um caixa aberto. Feche-o antes de abrir um novo.");
      }

      const { data: newCaixa, error } = await supabase
        .from("caixas")
        .insert({
          operador: data.operador,
          valor_abertura: data.valor_abertura,
          valor_esperado: data.valor_abertura,
          status: "ABERTO",
        })
        .select()
        .single();

      if (error) throw error;
      return newCaixa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["caixas"] });
      toast.success("Caixa aberto com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao abrir caixa");
    },
  });
};

// Close cash register
export const useFecharCaixa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FecharCaixaData) => {
      // Get the current register data
      const { data: caixa, error: fetchError } = await supabase
        .from("caixas")
        .select("*")
        .eq("id", data.caixa_id)
        .single();

      if (fetchError) throw fetchError;

      // Get all transactions to calculate totals by payment method
      const { data: movimentacoes, error: movError } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .eq("caixa_id", data.caixa_id);

      if (movError) throw movError;

      // Calculate expected values by payment method
      const esperadoPorFormaPagamento = {
        DINHEIRO: caixa.valor_abertura,
        PIX: 0,
        CARTAO_CREDITO: 0,
        CARTAO_DEBITO: 0,
      };

      movimentacoes?.forEach((mov) => {
        const formaPagamento = mov.forma_pagamento || "DINHEIRO";
        if (mov.tipo === "VENDA") {
          esperadoPorFormaPagamento[formaPagamento as keyof typeof esperadoPorFormaPagamento] += Number(mov.valor);
        } else if (mov.tipo === "SANGRIA") {
          esperadoPorFormaPagamento.DINHEIRO -= Number(mov.valor);
        } else if (mov.tipo === "REFORCO") {
          esperadoPorFormaPagamento.DINHEIRO += Number(mov.valor);
        }
      });

      const valorContadoTotal = 
        data.valor_contado_dinheiro + 
        data.valor_contado_pix + 
        data.valor_contado_cartao_credito + 
        data.valor_contado_cartao_debito;

      const valorEsperadoTotal = 
        esperadoPorFormaPagamento.DINHEIRO + 
        esperadoPorFormaPagamento.PIX + 
        esperadoPorFormaPagamento.CARTAO_CREDITO + 
        esperadoPorFormaPagamento.CARTAO_DEBITO;

      const diferenca = valorContadoTotal - valorEsperadoTotal;

      const { data: updatedCaixa, error } = await supabase
        .from("caixas")
        .update({
          status: "FECHADO",
          data_fechamento: new Date().toISOString(),
          valor_contado: valorContadoTotal,
          valor_esperado: valorEsperadoTotal,
          diferenca: diferenca,
          observacoes: data.observacoes,
        })
        .eq("id", data.caixa_id)
        .select()
        .single();

      if (error) throw error;
      return { caixa: updatedCaixa, esperadoPorFormaPagamento };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["caixas"] });
      queryClient.invalidateQueries({ queryKey: ["caixas-fechados"] });
      toast.success("Caixa fechado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao fechar caixa");
    },
  });
};

// Add transaction
export const useAddMovimentacao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MovimentacaoData) => {
      const { data: movimentacao, error } = await supabase
        .from("caixa_movimentacoes")
        .insert({
          caixa_id: data.caixa_id,
          tipo: data.tipo,
          valor: data.valor,
          descricao: data.descricao,
          forma_pagamento: data.forma_pagamento,
        })
        .select()
        .single();

      if (error) throw error;

      // Update caixa totals
      const { data: caixa } = await supabase
        .from("caixas")
        .select("*")
        .eq("id", data.caixa_id)
        .single();

      if (caixa) {
        let updates: Partial<Caixa> = {};
        
        if (data.tipo === "VENDA") {
          updates.valor_vendas = Number(caixa.valor_vendas) + data.valor;
          updates.valor_esperado = Number(caixa.valor_esperado) + data.valor;
        } else if (data.tipo === "SANGRIA") {
          updates.valor_sangrias = Number(caixa.valor_sangrias) + data.valor;
          updates.valor_esperado = Number(caixa.valor_esperado) - data.valor;
        } else if (data.tipo === "REFORCO") {
          updates.valor_reforcos = Number(caixa.valor_reforcos) + data.valor;
          updates.valor_esperado = Number(caixa.valor_esperado) + data.valor;
        }

        await supabase
          .from("caixas")
          .update(updates)
          .eq("id", data.caixa_id);
      }

      return movimentacao;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["caixa-movimentacoes", variables.caixa_id] });
      toast.success("Movimentação registrada!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao registrar movimentação");
    },
  });
};
