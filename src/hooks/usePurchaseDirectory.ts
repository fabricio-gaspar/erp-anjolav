import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import type { PedidoCompra, PedidoCompraStatus } from "@/hooks/useCompras";
import type { PurchaseDirectoryStatus } from "@/lib/purchaseDirectory";

export interface PurchaseDirectoryItem {
  id: string;
  numero: number;
  fornecedor_id: string;
  fornecedor_nome: string;
  status: PedidoCompraStatus;
  data_pedido: string;
  previsao_entrega: string | null;
  prazo_pagamento_dias: number;
  valor_total: number;
  versao: number;
  created_at: string;
  quantidade_pendente: number;
  valor_pendente: number;
}

export interface PurchaseDirectoryPage {
  items: PurchaseDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    draftCount: number;
    receivingCount: number;
    pendingValue: number;
    availableCreditValue: number;
  };
}

interface PurchaseDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  status: PurchaseDirectoryStatus;
}

function requiredNonNegativeNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`O diretório de compras não informou ${field}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`O diretório de compras retornou ${field} inválido`);
  }
  return parsed;
}

function requiredPositiveInteger(value: unknown, field: string) {
  const parsed = requiredNonNegativeNumber(value, field);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`O diretório de compras retornou ${field} inválido`);
  }
  return parsed;
}

function isPurchaseDirectoryItem(value: unknown): value is PurchaseDirectoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && typeof item.fornecedor_id === "string"
    && typeof item.fornecedor_nome === "string"
    && typeof item.data_pedido === "string"
    && typeof item.created_at === "string"
    && ["rascunho", "aprovado", "parcial", "recebido", "cancelado"].includes(String(item.status))
    && Number.isFinite(Number(item.numero))
    && Number.isFinite(Number(item.prazo_pagamento_dias))
    && Number.isFinite(Number(item.versao))
    && Number.isFinite(Number(item.valor_total))
    && Number.isFinite(Number(item.quantidade_pendente))
    && Number.isFinite(Number(item.valor_pendente));
}

function normalizeDirectoryItem(value: PurchaseDirectoryItem): PurchaseDirectoryItem {
  return {
    ...value,
    numero: Number(value.numero),
    prazo_pagamento_dias: Number(value.prazo_pagamento_dias),
    valor_total: Number(value.valor_total),
    versao: Number(value.versao),
    quantidade_pendente: Number(value.quantidade_pendente),
    valor_pendente: Number(value.valor_pendente),
  };
}

export function usePurchaseDirectory({ page, pageSize, search, status }: PurchaseDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: [
      "purchase-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      page,
      pageSize,
      search,
      status,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    retry: false,
    queryFn: async (): Promise<PurchaseDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar compras");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_pedidos_compra", {
        _busca: search || null,
        _situacao: status,
        _pagina: page,
        _tamanho: pageSize,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor retornou um diretório de compras inválido");
      }
      const payload = data as unknown as Partial<PurchaseDirectoryPage>;
      if (!Array.isArray(payload.items) || !payload.summary || typeof payload.summary !== "object") {
        throw new Error("O servidor retornou um diretório de compras incompleto");
      }
      if (!payload.items.every(isPurchaseDirectoryItem)) {
        throw new Error("O servidor retornou pedidos de compra inválidos");
      }
      return {
        items: payload.items.map(normalizeDirectoryItem),
        total: requiredNonNegativeNumber(payload.total, "o total"),
        page: requiredPositiveInteger(payload.page, "a página"),
        pageSize: requiredPositiveInteger(payload.pageSize, "o tamanho da página"),
        summary: {
          draftCount: requiredNonNegativeNumber(payload.summary.draftCount, "os rascunhos"),
          receivingCount: requiredNonNegativeNumber(payload.summary.receivingCount, "os pedidos aguardando recebimento"),
          pendingValue: requiredNonNegativeNumber(payload.summary.pendingValue, "o valor pendente"),
          availableCreditValue: requiredNonNegativeNumber(payload.summary.availableCreditValue, "os créditos disponíveis"),
        },
      };
    },
  });
}

function isPurchaseOrderDetails(value: unknown): value is PedidoCompra {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === "string"
    && typeof order.fornecedor_id === "string"
    && typeof order.fornecedor_nome === "string"
    && typeof order.data_pedido === "string"
    && Array.isArray(order.itens)
    && Array.isArray(order.recebimentos)
    && Array.isArray(order.devolucoes)
    && Array.isArray(order.creditos)
    && ["rascunho", "aprovado", "parcial", "recebido", "cancelado"].includes(String(order.status));
}

export function usePurchaseOrderDetails(orderId: string | null, enabled = true) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["purchase-order", session?.user.id, activeTenant?.id, activeArea, orderId],
    enabled: Boolean(enabled && orderId && session?.user.id && activeTenant?.id),
    retry: false,
    queryFn: async (): Promise<PedidoCompra> => {
      if (!orderId || !session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão, empresa e pedido de compra são obrigatórios para consultar o detalhe");
      }
      const { data, error } = await supabase.rpc("consultar_pedido_compra_detalhes", { _pedido_id: orderId });
      if (error) throw error;
      if (!isPurchaseOrderDetails(data)) {
        throw new Error("O servidor retornou detalhes de compra inválidos");
      }
      return data as PedidoCompra;
    },
  });
}
