import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useConsultaOS(searchTerm: string, statusFilter?: string) {
  return useQuery({
    queryKey: ["consulta-os", searchTerm, statusFilter],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      // Build the query
      let query = supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          status,
          data_retirada,
          data_previsao_entrega,
          data_entrega,
          valor_total,
          valor_desconto,
          valor_pago,
          status_pagamento,
          forma_pagamento,
          urgente,
          observacoes,
          cliente:clientes (
            id,
            razao_social,
            nome_fantasia,
            telefone
          )
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      // Apply status filter if provided
      if (statusFilter && statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      // Search by OS number or client name
      const isNumeroOS = /^\d+$/.test(searchTerm) || searchTerm.includes("-");
      
      if (isNumeroOS) {
        query = query.ilike("numero", `%${searchTerm}%`);
      } else {
        // Need to search by client name - first get matching clients
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id")
          .or(`razao_social.ilike.%${searchTerm}%,nome_fantasia.ilike.%${searchTerm}%`);
        
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
          const { data: itensData } = await supabase
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
              produto:produtos (
                nome,
                codigo
              )
            `)
            .eq("ordem_servico_id", ordem.id);

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
    enabled: searchTerm.length >= 2,
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
