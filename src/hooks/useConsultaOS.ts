import { useEffect, useState } from "react";
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

/**
 * Filtros exibidos na consulta operacional do ROL. Os valores de status
 * correspondem ao ciclo que a base realmente aceita, enquanto os filtros
 * agregados deixam explícito se a necessidade é operacional ou financeira.
 */
export const ROL_STATUS_FILTERS = [
  { value: "todos", label: "Todos os ROLs" },
  { value: "abertas", label: "Em operação" },
  { value: "retirada", label: "Aguardando separação" },
  { value: "separacao", label: "Em separação" },
  { value: "lavagem", label: "Em lavagem" },
  { value: "secagem", label: "Em secagem" },
  { value: "passadoria", label: "Em passadoria" },
  { value: "embalagem", label: "Em embalagem" },
  { value: "expedicao", label: "Pronto para entrega" },
  { value: "entregue", label: "Entregues" },
  { value: "pendentes_pagamento", label: "Pagamento pendente" },
  { value: "quitadas", label: "Pagamento em dia" },
  { value: "canceladas", label: "Canceladas" },
] as const;

const ROL_DATABASE_STATUSES = new Set([
  "retirada",
  "separacao",
  "lavagem",
  "secagem",
  "passadoria",
  "embalagem",
  "expedicao",
  "entregue",
  "cancelada",
]);

function normalizarNumeroRol(term: string) {
  return term.replace(/^(?:OS|ROL)\s*[-#:]?\s*/i, "").trim();
}

function useDebouncedTerm(value: string, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function useConsultaOS(searchTerm: string, statusFilter?: string, options: { enabled?: boolean; recent?: boolean } = {}) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const term = useDebouncedTerm(searchTerm.trim());
  const hasActiveFilter = Boolean(statusFilter && statusFilter !== "todos");
  return useQuery({
    queryKey: ["consulta-os", activeTenant?.id, user?.id, activeArea, term, statusFilter, options.recent],
    queryFn: async () => {
      if (!activeTenant || !user || activeArea === "central" || (!options.recent && term.length < 2 && !hasActiveFilter)) {
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
          condicao_pagamento,
          urgente,
          observacoes,
          cliente:clientes!ordens_servico_cliente_id_fkey!inner (
            id,
            razao_social,
            nome_fantasia,
            telefone,
            classificacao
          ),
          itens:itens_ordem_servico!itens_ordem_servico_ordem_servico_id_fkey (
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
          )
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("cliente.classificacao", activeArea)
        .order("created_at", { ascending: false })
        .limit(options.recent ? 100 : 20);

      // Apply the canonical operational or financial filter in the database.
      // This prevents a limited result set from being filtered only in the UI.
      if (statusFilter === "abertas") {
        query = query.not("status", "in", "(entregue,cancelada)");
      } else if (statusFilter === "pendentes_pagamento") {
        query = query.in("status_pagamento", ["pendente", "parcial"]);
      } else if (statusFilter === "quitadas") {
        query = query.eq("status_pagamento", "pago");
      } else if (statusFilter === "canceladas") {
        query = query.eq("status", "cancelada");
      } else if (statusFilter && ROL_DATABASE_STATUSES.has(statusFilter)) {
        query = query.eq("status", statusFilter);
      }

      // A barcode reader commonly sends the ROL number with an optional OS/ROL
      // prefix. Normalize it before looking up the persisted numeric code.
      const numeroRol = normalizarNumeroRol(term);
      const isNumeroOS = /^\d+$/.test(numeroRol);
      
      if (isNumeroOS) {
        query = query.ilike("numero", `%${numeroRol}%`);
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

      // Items and products are embedded in the same tenant-scoped request.
      // The prior implementation issued one additional query per ROL.
      return ordensData.map((ordem) => ({
        ...ordem,
        cliente: ordem.cliente as OrdemServicoConsulta["cliente"],
        itens: ((ordem.itens || []) as ItemOS[]).map((item) => ({
          ...item,
          produto: item.produto as ItemOS["produto"],
        })),
      })) as OrdemServicoConsulta[];
    },
    enabled: options.enabled !== false && !!activeTenant && !!user && activeArea !== "central" && (term.length >= 2 || !!options.recent || hasActiveFilter),
    staleTime: 30000,
  });
}

// The payment lookup uses shadcn Badge variants, which differ from the
// StatusBadge variants used by the production screens.
export function getStatusConfig(status: string) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    "retirada": { label: "Aguardando separação", variant: "secondary" },
    "separacao": { label: "Separação", variant: "default" },
    "lavagem": { label: "Lavagem", variant: "default" },
    "secagem": { label: "Secagem", variant: "default" },
    "passadoria": { label: "Passadoria", variant: "default" },
    "embalagem": { label: "Embalagem", variant: "default" },
    "expedicao": { label: "Pronto para entrega", variant: "outline" },
    "entregue": { label: "Entregue", variant: "secondary" },
    "cancelada": { label: "Cancelada", variant: "destructive" },
  };
  return config[status] || { label: status, variant: "secondary" as const };
}
