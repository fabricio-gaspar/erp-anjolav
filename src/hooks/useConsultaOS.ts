import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";

export interface ItemOS {
  id: string;
  produto_id: string;
  quantidade: number;
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
  };
}

export interface OrdemServicoConsulta {
  id: string;
  numero: string;
  status: string;
  data_retirada: string;
  data_previsao_entrega: string | null;
  data_entrega: string | null;
  valor_total: number | null;
  valor_desconto: number | null;
  valor_pago: number | null;
  status_pagamento: string | null;
  forma_pagamento: string | null;
  condicao_pagamento?: string | null;
  urgente: boolean | null;
  observacoes: string | null;
  cliente: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    telefone: string | null;
  };
  itens: ItemOS[];
}

export function useConsultaOS(searchTerm: string, statusFilter?: string, options: { enabled?: boolean; recent?: boolean } = {}) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const term = searchTerm.trim();
  return useQuery({
    queryKey: ["consulta-os", activeTenant?.id, user?.id, activeArea, term, statusFilter, options.recent],
    queryFn: async () => {
      if (!activeTenant || !user || activeArea === "central" || (!options.recent && term.length < 2)) {
        return [];
      }

      // Build the query
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
        .limit(options.recent ? 100 : 20);

      // Apply status filter if provided
      if (statusFilter && statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      // Search by OS number or client name
      const isNumeroOS = /^\d+$/.test(term) || /^(?:OS|ROL)?[-\s]*\d/i.test(term);
      
      if (isNumeroOS) {
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

      // Fetch items for each order
      const ordensComItens: OrdemServicoConsulta[] = await Promise.all(
        ordensData.map(async (ordem) => {
          const { data: itensData, error: itensError } = await supabase
            .from("itens_ordem_servico")
            .select(`
              id,
              produto_id,
              quantidade,
              preco_unitario,
              subtotal,
              cor_item,
              marca_item,
              avarias,
              observacoes,
              posicao_prateleira,
              produto:produtos!itens_ordem_servico_produto_id_fkey (
                nome,
                codigo
              )
            `)
            .eq("ordem_servico_id", ordem.id);
          if (itensError) throw itensError;

          return {
            ...ordem,
            cliente: ordem.cliente as OrdemServicoConsulta["cliente"],
            itens: (itensData || []).map(item => ({
              ...item,
              produto: item.produto as ItemOS["produto"]
            }))
          };
        })
      );

      return ordensComItens;
    },
    enabled: options.enabled !== false && !!activeTenant && !!user && activeArea !== "central" && (term.length >= 2 || !!options.recent),
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
