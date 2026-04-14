import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OrdemServico {
  id: string;
  numero: string;
  cliente_id: string;
  motorista_id: string | null;
  veiculo_id: string | null;
  data_retirada: string;
  data_previsao_entrega: string | null;
  data_entrega: string | null;
  status: "retirada" | "lavagem" | "secagem" | "passadoria" | "embalagem" | "expedicao" | "entregue" | "cancelada";
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Campos de pagamento
  valor_total: number | null;
  valor_desconto: number | null;
  forma_pagamento: string | null;
  status_pagamento: "pendente" | "parcial" | "pago" | null;
  pago_na_entrada: boolean | null;
  valor_pago: number | null;
  urgente: boolean | null;
  percentual_urgencia: number | null;
  origem: string;
  // Relacionamentos
  cliente?: {
    razao_social: string;
  };
  motorista?: {
    nome: string;
  };
  veiculo?: {
    placa: string;
    modelo: string;
  };
}

export interface ItemOrdemServico {
  id: string;
  ordem_servico_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacoes: string | null;
  cor_item: string | null;
  marca_item: string | null;
  avarias: string | null;
  posicao_prateleira: string | null;
  created_at: string;
  produto?: {
    nome: string;
    unidade: string;
  };
}

export type OrdemServicoInsert = Omit<OrdemServico, "id" | "numero" | "created_at" | "updated_at" | "cliente" | "motorista" | "veiculo">;
export type OrdemServicoUpdate = Partial<Omit<OrdemServicoInsert, "cliente_id">>;

export function useOrdensServico() {
  const queryClient = useQueryClient();

  const { data: ordensServico = [], isLoading, error } = useQuery({
    queryKey: ["ordens_servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social),
          motorista:motoristas(nome),
          veiculo:veiculos(placa, modelo)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrdemServico[];
    },
  });

  const createOrdemServico = useMutation({
    mutationFn: async (os: Omit<OrdemServicoInsert, "numero">) => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .insert({ ...os, numero: "" }) // Trigger irá gerar o número
        .select(`
          *,
          cliente:clientes(razao_social),
          motorista:motoristas(nome),
          veiculo:veiculos(placa, modelo)
        `)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      toast.success(`OS ${data.numero} criada com sucesso!`);
    },
    onError: (error) => {
      toast.error("Erro ao criar OS: " + error.message);
    },
  });

  const updateOrdemServico = useMutation({
    mutationFn: async ({ id, ...updates }: OrdemServicoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      toast.success("OS atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar OS: " + error.message);
    },
  });

  const deleteOrdemServico = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ordens_servico")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      toast.success("OS excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir OS: " + error.message);
    },
  });

  return {
    ordensServico,
    isLoading,
    error,
    createOrdemServico,
    updateOrdemServico,
    deleteOrdemServico,
  };
}

// Itens da OS
export function useItensOrdemServico(ordemServicoId: string | null) {
  const queryClient = useQueryClient();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens_ordem_servico", ordemServicoId],
    queryFn: async () => {
      if (!ordemServicoId) return [];
      const { data, error } = await supabase
        .from("itens_ordem_servico")
        .select(`
          *,
          produto:produtos(nome, unidade)
        `)
        .eq("ordem_servico_id", ordemServicoId);
      if (error) throw error;
      return data as ItemOrdemServico[];
    },
    enabled: !!ordemServicoId,
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<ItemOrdemServico, "id" | "created_at" | "produto">) => {
      const { data, error } = await supabase
        .from("itens_ordem_servico")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] });
      toast.success("Item adicionado!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar item: " + error.message);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("itens_ordem_servico")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] });
      toast.success("Item removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover item: " + error.message);
    },
  });

  return { itens, isLoading, addItem, removeItem };
}
