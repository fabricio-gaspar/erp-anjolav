import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LancamentoCliente {
  id: string;
  cliente_id: string;
  ordem_servico_id: string | null;
  status: "pendente" | "conferido" | "divergente";
  data_lancamento: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  itens?: ItemLancamentoCliente[];
}

export interface ItemLancamentoCliente {
  id: string;
  lancamento_id: string;
  produto_id: string;
  quantidade: number;
  observacoes: string | null;
  created_at: string;
  produto?: {
    id: string;
    nome: string;
    unidade: string | null;
  };
}

interface CreateLancamentoData {
  cliente_id: string;
  observacoes?: string;
  itens: {
    produto_id: string;
    quantidade: number;
    observacoes?: string;
  }[];
}

// Hook para buscar lançamentos do cliente pelo ID
export const useLancamentosCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ["lancamentos-cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      // Buscar lançamentos
      const { data: lancamentos, error } = await supabase
        .from("lancamentos_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!lancamentos || lancamentos.length === 0) return [];

      // Buscar itens para cada lançamento
      const lancamentosComItens = await Promise.all(
        lancamentos.map(async (lancamento) => {
          const { data: itens } = await supabase
            .from("itens_lancamento_cliente")
            .select("*")
            .eq("lancamento_id", lancamento.id);

          // Buscar produtos para os itens
          const itensComProduto = await Promise.all(
            (itens || []).map(async (item) => {
              const { data: produto } = await supabase
                .from("produtos")
                .select("id, nome, unidade")
                .eq("id", item.produto_id)
                .single();
              return { ...item, produto: produto || null };
            })
          );

          return { ...lancamento, itens: itensComProduto };
        })
      );

      return lancamentosComItens as LancamentoCliente[];
    },
    enabled: !!clienteId,
  });
};

// Hook para buscar lançamentos pendentes de um cliente (para integração na separação)
export const useLancamentosPendentesCliente = (clienteId: string | null) => {
  return useQuery({
    queryKey: ["lancamentos-pendentes-cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data: lancamento, error } = await supabase
        .from("lancamentos_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!lancamento) return null;

      // Buscar itens
      const { data: itens } = await supabase
        .from("itens_lancamento_cliente")
        .select("*")
        .eq("lancamento_id", lancamento.id);

      // Buscar produtos para os itens
      const itensComProduto = await Promise.all(
        (itens || []).map(async (item) => {
          const { data: produto } = await supabase
            .from("produtos")
            .select("id, nome, unidade")
            .eq("id", item.produto_id)
            .single();
          return { ...item, produto: produto || null };
        })
      );

      return { ...lancamento, itens: itensComProduto } as LancamentoCliente;
    },
    enabled: !!clienteId,
  });
};

// Hook para criar um novo lançamento do cliente
export const useCreateLancamentoCliente = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateLancamentoData) => {
      // Primeiro, cria o lançamento
      const { data: lancamento, error: lancamentoError } = await supabase
        .from("lancamentos_cliente")
        .insert({
          cliente_id: data.cliente_id,
          observacoes: data.observacoes || null,
          status: "pendente",
        })
        .select()
        .single();

      if (lancamentoError) throw lancamentoError;

      // Depois, cria os itens
      const itensToInsert = data.itens.map((item) => ({
        lancamento_id: lancamento.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        observacoes: item.observacoes || null,
      }));

      const { error: itensError } = await supabase
        .from("itens_lancamento_cliente")
        .insert(itensToInsert);

      if (itensError) throw itensError;

      return lancamento;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos-cliente", variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos-pendentes-cliente", variables.cliente_id] });
      toast.success("Lançamento enviado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar lançamento:", error);
      toast.error("Erro ao enviar lançamento");
    },
  });
};

// Hook para atualizar o status de um lançamento
export const useUpdateLancamentoClienteStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, clienteId }: { id: string; status: "pendente" | "conferido" | "divergente"; clienteId: string }) => {
      const { data, error } = await supabase
        .from("lancamentos_cliente")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos-cliente", variables.clienteId] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos-pendentes-cliente", variables.clienteId] });
    },
  });
};
