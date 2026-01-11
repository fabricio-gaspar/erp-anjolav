import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Interfaces
export interface ContratoAluguel {
  id: string;
  cliente_id: string;
  descricao: string;
  valor_servico: number;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemContratoAluguel {
  id: string;
  contrato_id: string;
  produto_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  valor_unitario: number;
  created_at: string;
  produto?: {
    id: string;
    nome: string;
    preco: number;
    unidade: string;
  } | null;
}

export interface ContratoInsert {
  cliente_id: string;
  descricao?: string;
  valor_servico?: number;
  ativo?: boolean;
  data_inicio?: string;
  data_fim?: string | null;
  observacoes?: string | null;
}

export interface ContratoUpdate {
  id: string;
  descricao?: string;
  valor_servico?: number;
  ativo?: boolean;
  data_inicio?: string;
  data_fim?: string | null;
  observacoes?: string | null;
}

export interface ItemContratoInsert {
  contrato_id: string;
  produto_id?: string | null;
  descricao_item?: string | null;
  quantidade?: number;
  valor_unitario?: number;
}

// Hook para buscar contrato ativo do cliente
export function useContratoCliente(clienteId: string | null) {
  return useQuery({
    queryKey: ["contrato-cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from("contratos_aluguel")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ContratoAluguel | null;
    },
    enabled: !!clienteId,
  });
}

// Hook para buscar todos os contratos ativos
export function useContratosAtivos() {
  return useQuery({
    queryKey: ["contratos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_aluguel")
        .select(`
          *,
          clientes:cliente_id (
            id,
            razao_social,
            nome_fantasia
          )
        `)
        .eq("ativo", true);

      if (error) throw error;
      return data;
    },
  });
}

// Hook para buscar itens do contrato
export function useItensContrato(contratoId: string | null) {
  return useQuery({
    queryKey: ["itens-contrato", contratoId],
    queryFn: async () => {
      if (!contratoId) return [];

      const { data, error } = await supabase
        .from("itens_contrato_aluguel")
        .select(`
          *,
          produto:produto_id (
            id,
            nome,
            preco,
            unidade
          )
        `)
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as ItemContratoAluguel[];
    },
    enabled: !!contratoId,
  });
}

// Hook principal com mutations
export function useContratosAluguel() {
  const queryClient = useQueryClient();

  // Criar contrato
  const createContrato = useMutation({
    mutationFn: async (contrato: ContratoInsert) => {
      const { data, error } = await supabase
        .from("contratos_aluguel")
        .insert(contrato)
        .select()
        .single();

      if (error) throw error;
      return data as ContratoAluguel;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contrato-cliente", data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ["contratos-ativos"] });
      toast.success("Contrato criado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar contrato:", error);
      toast.error("Erro ao criar contrato");
    },
  });

  // Atualizar contrato
  const updateContrato = useMutation({
    mutationFn: async (contrato: ContratoUpdate) => {
      const { id, ...rest } = contrato;
      const { data, error } = await supabase
        .from("contratos_aluguel")
        .update(rest)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as ContratoAluguel;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contrato-cliente", data.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ["contratos-ativos"] });
      toast.success("Contrato atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar contrato:", error);
      toast.error("Erro ao atualizar contrato");
    },
  });

  // Deletar contrato
  const deleteContrato = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contratos_aluguel")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contrato-cliente"] });
      queryClient.invalidateQueries({ queryKey: ["contratos-ativos"] });
      toast.success("Contrato excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao excluir contrato:", error);
      toast.error("Erro ao excluir contrato");
    },
  });

  // Adicionar item ao contrato
  const addItemContrato = useMutation({
    mutationFn: async (item: ItemContratoInsert) => {
      const { data, error } = await supabase
        .from("itens_contrato_aluguel")
        .insert(item)
        .select(`
          *,
          produto:produto_id (
            id,
            nome,
            preco,
            unidade
          )
        `)
        .single();

      if (error) throw error;
      return data as ItemContratoAluguel;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["itens-contrato", data.contrato_id] });
      toast.success("Item adicionado ao contrato!");
    },
    onError: (error) => {
      console.error("Erro ao adicionar item:", error);
      toast.error("Erro ao adicionar item");
    },
  });

  // Atualizar item do contrato
  const updateItemContrato = useMutation({
    mutationFn: async ({ id, ...rest }: { id: string; quantidade?: number; valor_unitario?: number }) => {
      const { data, error } = await supabase
        .from("itens_contrato_aluguel")
        .update(rest)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["itens-contrato", data.contrato_id] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar item:", error);
      toast.error("Erro ao atualizar item");
    },
  });

  // Remover item do contrato
  const removeItemContrato = useMutation({
    mutationFn: async ({ id, contratoId }: { id: string; contratoId: string }) => {
      const { error } = await supabase
        .from("itens_contrato_aluguel")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return contratoId;
    },
    onSuccess: (contratoId) => {
      queryClient.invalidateQueries({ queryKey: ["itens-contrato", contratoId] });
      toast.success("Item removido do contrato!");
    },
    onError: (error) => {
      console.error("Erro ao remover item:", error);
      toast.error("Erro ao remover item");
    },
  });

  return {
    createContrato,
    updateContrato,
    deleteContrato,
    addItemContrato,
    updateItemContrato,
    removeItemContrato,
  };
}

// Hook para calcular valor total do contrato
export function useCalculoContrato(contrato: ContratoAluguel | null, itens: ItemContratoAluguel[]) {
  const valorServico = contrato?.valor_servico || 0;
  const valorItens = itens.reduce((acc, item) => acc + (item.quantidade * item.valor_unitario), 0);
  const totalPecas = itens.reduce((acc, item) => acc + item.quantidade, 0);
  const totalMensal = valorServico + valorItens;

  return {
    valorServico,
    valorItens,
    totalPecas,
    totalMensal,
  };
}
