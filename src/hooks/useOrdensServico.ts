import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAllowedOrderOrigins,
  getCanonicalOrderOrigin,
  isOrderOriginAllowed,
} from "@/lib/workspaceScope";

export interface OrdemServico {
  id: string;
  numero: string;
  cliente_id: string;
  motorista_id: string | null;
  veiculo_id: string | null;
  data_retirada: string;
  data_previsao_entrega: string | null;
  data_entrega: string | null;
  status: "retirada" | "separacao" | "lavagem" | "secagem" | "passadoria" | "embalagem" | "expedicao" | "entregue" | "cancelada";
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Campos de pagamento
  valor_total: number | null;
  valor_desconto: number | null;
  forma_pagamento: string | null;
  condicao_pagamento?: string | null;
  status_pagamento: "pendente" | "parcial" | "pago" | null;
  status_qualidade?: "nao_iniciada" | "em_analise" | "aprovada" | "com_pendencias";
  status_logistica?: "nao_iniciada" | "aguardando_coleta" | "coletado" | "aguardando_entrega" | "em_rota" | "entrega_parcial" | "entregue" | "tentativa_falha" | "cancelada";
  status_fiscal?: "nao_aplicavel" | "pendente" | "emitida" | "cancelada";
  versao_producao?: number;
  pago_na_entrada: boolean | null;
  valor_pago: number | null;
  urgente: boolean | null;
  percentual_urgencia: number | null;
  origem: string;
  // Relacionamentos
  cliente?: {
    razao_social: string;
    classificacao: "industrial" | "residencial";
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
  quantidade_aprovada?: number;
  quantidade_retida?: number;
  quantidade_retrabalho?: number;
  quantidade_entregue?: number;
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

export function useOrdensServico({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const { data: ordensServico = [], isLoading, error } = useQuery({
    queryKey: ["ordens_servico", session?.user.id, activeTenant?.id, activeArea],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar pedidos");
      }
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social, classificacao),
          motorista:motoristas(nome),
          veiculo:veiculos(placa, modelo)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: false });
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return data as OrdemServico[];
    },
  });

  const createOrdemServico = useMutation({
    mutationFn: async (os: Omit<OrdemServicoInsert, "numero">) => {
      const scopedOrder = {
        ...os,
        origem: getCanonicalOrderOrigin(activeArea, os.origem),
        numero: "",
      };
      const { data, error } = await supabase
        .from("ordens_servico")
        .insert(scopedOrder) // Trigger irá gerar o número
        .select(`
          *,
          cliente:clientes(razao_social, classificacao),
          motorista:motoristas(nome),
          veiculo:veiculos(placa, modelo)
        `)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["order-directory"] });
      toast.success(`ROL ${data.numero} criado com sucesso!`);
    },
    onError: (error) => {
      toast.error("Erro ao criar ROL: " + error.message);
    },
  });

  const updateOrdemServico = useMutation({
    mutationFn: async ({ id, ...updates }: OrdemServicoUpdate & { id: string }) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      if (updates.origem && !isOrderOriginAllowed(activeArea, updates.origem)) {
        throw new Error("Não é permitido mover o ROL para outro painel");
      }
      const scopedUpdates = activeArea === "central"
        ? updates
        : { ...updates, ...(updates.origem ? { origem: activeArea } : {}) };
      let query = supabase
        .from("ordens_servico")
        .update(scopedUpdates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["order-directory"] });
      toast.success("ROL atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar ROL: " + error.message);
    },
  });

  const deleteOrdemServico = useMutation({
    mutationFn: async (id: string) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      let scopeQuery = supabase
        .from("ordens_servico")
        .select("id")
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) scopeQuery = scopeQuery.in("origem", [...allowedOrigins]);
      const { data: scopedOrder, error: scopeError } = await scopeQuery.maybeSingle();
      if (scopeError) throw scopeError;
      if (!scopedOrder) throw new Error("ROL não encontrado neste painel");
      const { error } = await supabase.rpc("cancelar_ordem_servico", {
        _ordem_servico_id: id,
        _motivo: "Cancelada pelo usuário no módulo de ROLs.",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["order-directory"] });
      toast.success("ROL cancelado e preservado no histórico.");
    },
    onError: (error) => {
      toast.error("Erro ao cancelar ROL: " + error.message);
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
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens_ordem_servico", session?.user.id, activeTenant?.id, ordemServicoId, activeArea],
    queryFn: async () => {
      if (!ordemServicoId || !session?.user.id || !activeTenant?.id) return [];
      let query = supabase
        .from("itens_ordem_servico")
        .select(`
          *,
          produto:produtos(nome, unidade),
          ordem:ordens_servico!inner(origem, tenant_id)
        `)
        .eq("ordem_servico_id", ordemServicoId)
        .filter("ordem.tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return data as ItemOrdemServico[];
    },
    enabled: Boolean(ordemServicoId && session?.user.id && activeTenant?.id),
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<ItemOrdemServico, "id" | "created_at" | "produto">) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      let scopeQuery = supabase
        .from("ordens_servico")
        .select("id")
        .eq("id", item.ordem_servico_id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) scopeQuery = scopeQuery.in("origem", [...allowedOrigins]);
      const { data: scopedOrder, error: scopeError } = await scopeQuery.maybeSingle();
      if (scopeError) throw scopeError;
      if (!scopedOrder) throw new Error("ROL não encontrado neste painel");
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
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      let scopeQuery = supabase
        .from("itens_ordem_servico")
        .select("id, ordem:ordens_servico!inner(origem, tenant_id)")
        .eq("id", id)
        .filter("ordem.tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) scopeQuery = scopeQuery.in("ordem.origem", [...allowedOrigins]);
      const { data: scopedItem, error: scopeError } = await scopeQuery.maybeSingle();
      if (scopeError) throw scopeError;
      if (!scopedItem) throw new Error("Item não encontrado neste painel");
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
