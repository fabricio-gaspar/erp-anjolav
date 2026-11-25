import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { parseCanonicalOrderScan } from "@/lib/orderScanner";

export interface ItemOS {
  id: string;
  produto_id: string;
  quantidade: number;
  quantidade_aprovada?: number;
  quantidade_retida?: number;
  quantidade_retrabalho?: number;
  quantidade_entregue?: number;
  preco_unitario: number;
  subtotal: number;
  cor_item: string | null;
  marca_item: string | null;
  avarias: string | null;
  observacoes: string | null;
  posicao_prateleira: string | null;
  produto?: {
    nome: string;
    codigo: string | null;
    unidade?: string | null;
  };
}

export interface OrdemServicoConsulta {
  id: string;
  numero: string;
  status: string;
  status_logistica: string;
  entrega_modalidade: string;
  data_retirada: string;
  data_previsao_entrega: string | null;
  data_entrega: string | null;
  valor_total: number | null;
  valor_acrescimo_express?: number | null;
  taxa_entrega?: number | null;
  delivery_modelo_snapshot?: string | null;
  delivery_distancia_km_snapshot?: number | null;
  delivery_taxa_base_snapshot?: number | null;
  delivery_taxa_km_snapshot?: number | null;
  valor_desconto: number | null;
  valor_pago: number | null;
  status_pagamento: string | null;
  forma_pagamento: string | null;
  condicao_pagamento?: string | null;
  prioridade?: string | null;
  recebimento_modalidade?: string | null;
  percentual_urgencia?: number | null;
  urgente: boolean | null;
  observacoes: string | null;
  atendente_id?: string | null;
  atendente?: { id: string; nome: string } | null;
  cliente: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    telefone: string | null;
  };
  itens: ItemOS[];
  leitura?: {
    tipo: "pedido" | "item";
    itemId?: string;
  };
}

export function useConsultaOS(
  searchTerm: string,
  statusFilter?: string,
  options: { enabled?: boolean; recent?: boolean; dateFrom?: string; dateTo?: string; attendantId?: string; allowDateSearch?: boolean } = {},
) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const term = searchTerm.trim();
  const hasDateSearch = Boolean(options.allowDateSearch && options.dateFrom && options.dateTo);
  return useQuery({
    queryKey: ["consulta-os", activeTenant?.id, user?.id, activeArea, term, statusFilter, options.recent, options.dateFrom, options.dateTo, options.attendantId],
    queryFn: async () => {
      if (!activeTenant || !user || activeArea === "central" || (!options.recent && term.length < 2 && !hasDateSearch)) {
        return [];
      }
      if (options.dateFrom && options.dateTo && options.dateFrom > options.dateTo) {
        return [];
      }

      const leitura = parseCanonicalOrderScan(term);
      let scannedOrderId: string | null = null;
      if (leitura?.kind === "item") {
        const { data: scannedItem, error: scannedItemError } = await supabase
          .from("itens_ordem_servico")
          .select("ordem_servico_id")
          .eq("id", leitura.itemId)
          .maybeSingle();
        if (scannedItemError) throw scannedItemError;
        if (!scannedItem) return [];
        scannedOrderId = scannedItem.ordem_servico_id;
      }

      // Build the tenant- and area-scoped order query. RLS remains authoritative.
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!ordens_servico_cliente_id_fkey!inner (
            id,
            razao_social,
            nome_fantasia,
            telefone,
            classificacao
          )
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("cliente.classificacao", activeArea)
        .order("created_at", { ascending: false })
        .limit(options.recent ? 100 : 1000);

      // Apply status filter if provided
      if (statusFilter && statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }
      if (options.dateFrom) query = query.gte("data_retirada", options.dateFrom);
      if (options.dateTo) query = query.lte("data_retirada", options.dateTo);
      if (options.attendantId) query = query.eq("atendente_id", options.attendantId);

      // Search by OS number or client name
      const isNumeroOS = /^\d+$/.test(term) || /^(?:OS|ROL)?[-\s]*\d/i.test(term);

      if (scannedOrderId) {
        query = query.eq("id", scannedOrderId);
      } else if (leitura?.kind === "order") {
        query = query.eq("numero", leitura.orderNumber);
      } else if (isNumeroOS) {
        query = query.ilike("numero", `%${term}%`);
      } else if (term) {
        // Need to search by client name - first get matching clients
        const safeTerm = term.replace(/[%_(),.\\"]/g, " ").trim();
        if (!safeTerm) return [];
        const { data: clientesData, error: clientesError } = await supabase
          .from("clientes")
          .select("id")
          .filter("tenant_id", "eq", activeTenant.id)
          .eq("classificacao", activeArea)
          .or(`razao_social.ilike.%${safeTerm}%,nome_fantasia.ilike.%${safeTerm}%`);
        if (clientesError) throw clientesError;

        if (clientesData && clientesData.length > 0) {
          const clienteIds = clientesData.map(c => c.id);
          query = query.in("cliente_id", clienteIds);
        } else {
          return [];
        }
      }

      const { data: ordensData, error } = await query;

      if (error) throw error;
      if (!ordensData) return [];

      const attendantIds = Array.from(new Set(
        ordensData.map((order) => (order as { atendente_id?: string | null }).atendente_id).filter(Boolean),
      )) as string[];
      const attendantNames = new Map<string, string>();
      if (attendantIds.length > 0) {
        const employeeTable = supabase.from("funcionarios") as unknown as {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              in: (column: string, values: string[]) => Promise<{ data: Array<{ id: string; nome: string }> | null; error: Error | null }>;
            };
          };
        };
        const { data: attendants, error: attendantsError } = await employeeTable
          .select("id,nome").eq("tenant_id", activeTenant.id).in("id", attendantIds);
        if (!attendantsError) {
          (attendants ?? []).forEach((attendant) => attendantNames.set(attendant.id, attendant.nome));
        }
      }

      // Uma consulta por lote evita centenas de requisições ao filtrar um mês inteiro.
      const orderIds = ordensData.map((order) => order.id);
      const itemBatches = await Promise.all(Array.from({ length: Math.ceil(orderIds.length / 100) }, async (_, index) => {
        const items = [];
        let offset = 0;
        while (true) {
          const { data, error: itensError } = await supabase
            .from("itens_ordem_servico")
            .select(`
              id, ordem_servico_id, produto_id, quantidade, quantidade_aprovada,
              quantidade_retida, quantidade_retrabalho, quantidade_entregue,
              preco_unitario, subtotal, cor_item, marca_item, avarias, observacoes,
              posicao_prateleira, produto:produtos!itens_ordem_servico_produto_id_fkey (nome, codigo, unidade)
            `)
            .in("ordem_servico_id", orderIds.slice(index * 100, (index + 1) * 100))
            .order("id")
            .range(offset, offset + 999);
          if (itensError) throw itensError;
          items.push(...(data || []));
          if (!data || data.length < 1000) break;
          offset += data.length;
        }
        return items;
      }));
      const itemsByOrder = new Map<string, ItemOS[]>();
      itemBatches.flat().forEach((item) => {
        const items = itemsByOrder.get(item.ordem_servico_id) || [];
        items.push({ ...item, produto: item.produto as ItemOS["produto"] });
        itemsByOrder.set(item.ordem_servico_id, items);
      });

      const ordensComItens: OrdemServicoConsulta[] = await Promise.all(
        ordensData.map(async (ordem) => {
          return {
            ...ordem,
            cliente: ordem.cliente as OrdemServicoConsulta["cliente"],
            atendente: ordem.atendente_id && attendantNames.has(ordem.atendente_id)
              ? { id: ordem.atendente_id, nome: attendantNames.get(ordem.atendente_id) ?? "" }
              : null,
            leitura: leitura ? {
              tipo: leitura.kind === "item" ? "item" : "pedido",
              itemId: leitura.kind === "item" ? leitura.itemId : undefined,
            } : undefined,
            itens: itemsByOrder.get(ordem.id) || []
          };
        })
      );

      return ordensComItens;
    },
    enabled: options.enabled !== false && !!activeTenant && !!user && activeArea !== "central" && (term.length >= 2 || !!options.recent || hasDateSearch),
    staleTime: 30000,
  });
}

// Get status label and color
export function getStatusConfig(status: string) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    "entrada": { label: "Entrada", variant: "secondary" },
    "triagem": { label: "Triagem", variant: "secondary" },
    "lavagem": { label: "Lavagem", variant: "default" },
    "secagem": { label: "Secagem", variant: "default" },
    "passadoria": { label: "Passadoria", variant: "default" },
    "dobragem": { label: "Dobragem", variant: "default" },
    "conferencia": { label: "Conferência", variant: "default" },
    "embalagem": { label: "Embalagem", variant: "default" },
    "pronto_entrega": { label: "Pronto Entrega", variant: "outline" },
    "entregue": { label: "Entregue", variant: "secondary" },
    "cancelado": { label: "Cancelado", variant: "destructive" },
  };
  return config[status] || { label: status, variant: "secondary" as const };
}
