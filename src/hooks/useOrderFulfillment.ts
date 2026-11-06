import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

export type QualityBucket = "PENDENTE" | "APROVADO" | "RETIDO" | "RETRABALHO";
export type QualityResult = Exclude<QualityBucket, "PENDENTE">;

export interface QualityMovementInput {
  item_id: string;
  origem: QualityBucket;
  resultado: QualityResult;
  quantidade: number;
  motivo?: string;
}

export interface DeliveryItemInput {
  item_id: string;
  quantidade: number;
}

export interface QualityMovementRecord {
  id: string;
  origem: QualityBucket;
  resultado: QualityResult;
  quantidade: number;
  motivo: string | null;
  nova_previsao: string | null;
  created_at: string;
  funcionario?: { nome: string } | null;
  item?: {
    id: string;
    produto?: { nome: string; unidade: string } | null;
  } | null;
}

export interface DeliveryRecord {
  id: string;
  status: string;
  nome_recebedor: string;
  documento_recebedor: string | null;
  observacoes: string | null;
  autorizada_com_saldo: boolean;
  motivo_autorizacao_saldo: string | null;
  created_at: string;
  funcionario?: { nome: string } | null;
  itens?: Array<{
    quantidade: number;
    item?: {
      id: string;
      produto?: { nome: string; unidade: string } | null;
    } | null;
  }>;
}

export function useOrderFulfillment(orderId: string | null) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const qualityHistory = useQuery({
    queryKey: ["order-quality", session?.user.id, activeTenant?.id, orderId, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id && orderId),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id || !orderId) return [];
      let query = supabase
        .from("qualidade_movimentos")
        .select(`
          id, origem, resultado, quantidade, motivo, nova_previsao, created_at,
          funcionario:funcionarios(nome),
          item:itens_ordem_servico!inner(id, produto:produtos(nome, unidade)),
          ordem:ordens_servico!qualidade_movimentos_ordem_servico_id_fkey!inner(origem, tenant_id)
        `)
        .eq("ordem_servico_id", orderId)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("ordem.tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QualityMovementRecord[];
    },
  });

  const deliveries = useQuery({
    queryKey: ["order-deliveries", session?.user.id, activeTenant?.id, orderId, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id && orderId),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id || !orderId) return [];
      let query = supabase
        .from("entregas_pedido")
        .select(`
          id, status, nome_recebedor, documento_recebedor, observacoes,
          autorizada_com_saldo, motivo_autorizacao_saldo, created_at,
          funcionario:funcionarios(nome),
          itens:entregas_pedido_itens(
            quantidade,
            item:itens_ordem_servico(id, produto:produtos(nome, unidade))
          ),
          ordem:ordens_servico!entregas_pedido_ordem_servico_id_fkey!inner(origem, tenant_id)
        `)
        .eq("ordem_servico_id", orderId)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("ordem.tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryRecord[];
    },
  });

  const invalidateOrder = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ordem_servico"] }),
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
      queryClient.invalidateQueries({ queryKey: ["order-directory"] }),
      queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] }),
      queryClient.invalidateQueries({ queryKey: ["order-quality"] }),
      queryClient.invalidateQueries({ queryKey: ["order-deliveries"] }),
    ]);
  };

  const registerQuality = useMutation({
    mutationFn: async (input: {
      movements: QualityMovementInput[];
      employeeId?: string;
      notes?: string;
      newForecast?: string;
      idempotencyKey: string;
    }) => {
      if (!orderId) throw new Error("Pedido não informado");
      if (!session?.user.id || !activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      const { data, error } = await supabase.rpc("registrar_qualidade_pedido", {
        _ordem_servico_id: orderId,
        _movimentos: input.movements as unknown as Json,
        _funcionario_id: input.employeeId || null,
        _observacoes: input.notes?.trim() || null,
        _nova_previsao: input.newForecast || null,
        _idempotency_key: input.idempotencyKey,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidateOrder();
      toast.success("Resultado de qualidade registrado.");
    },
    onError: (error: Error) => toast.error(`Qualidade não registrada: ${error.message}`),
  });

  const registerDelivery = useMutation({
    mutationFn: async (input: {
      items: DeliveryItemInput[];
      receiverName: string;
      receiverDocument?: string;
      notes?: string;
      authorizeWithBalance: boolean;
      balanceAuthorizationReason?: string;
      employeeId?: string;
      idempotencyKey: string;
    }) => {
      if (!orderId) throw new Error("Pedido não informado");
      if (!session?.user.id || !activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      const { data, error } = await supabase.rpc("registrar_entrega_parcial_pedido", {
        _ordem_servico_id: orderId,
        _itens: input.items as unknown as Json,
        _nome_recebedor: input.receiverName.trim(),
        _documento_recebedor: input.receiverDocument?.trim() || null,
        _observacoes: input.notes?.trim() || null,
        _autorizar_com_saldo: input.authorizeWithBalance,
        _motivo_autorizacao_saldo: input.balanceAuthorizationReason?.trim() || null,
        _funcionario_id: input.employeeId || null,
        _idempotency_key: input.idempotencyKey,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidateOrder();
      toast.success("Entrega registrada sem perder os itens pendentes.");
    },
    onError: (error: Error) => toast.error(`Entrega não registrada: ${error.message}`),
  });

  return {
    qualityHistory,
    deliveries,
    registerQuality,
    registerDelivery,
  };
}
