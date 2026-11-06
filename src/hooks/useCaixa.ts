import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCashRegisterQueriesAfterClose } from "@/lib/queryDefaults";
import { toast } from "sonner";

export interface Caixa {
  id: string;
  identificador_caixa: string;
  operador: string;
  operador_id: string | null;
  aberto_por: string | null;
  fechado_por: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  valor_abertura: number;
  valor_vendas: number;
  valor_sangrias: number;
  valor_reforcos: number;
  valor_esperado: number;
  valor_contado: number | null;
  diferenca: number | null;
  status: string;
  observacoes: string | null;
  fechamento_resumo: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ClosedCashRegister = Pick<
  Caixa,
  | "id"
  | "identificador_caixa"
  | "operador"
  | "data_abertura"
  | "data_fechamento"
  | "valor_abertura"
  | "valor_vendas"
  | "valor_sangrias"
  | "valor_reforcos"
  | "valor_esperado"
  | "valor_contado"
  | "diferenca"
  | "status"
  | "observacoes"
>;

export interface CaixaMovimentacao {
  id: string;
  caixa_id: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  forma_pagamento: string | null;
  cliente_id: string | null;
  ordem_servico_id: string | null;
  created_at: string;
}

export interface AbrirCaixaData {
  valor_abertura: number;
  identificador_caixa?: string;
  idempotency_key: string;
}

export interface FecharCaixaData {
  caixa_id: string;
  valor_contado_dinheiro: number;
  valor_contado_pix: number;
  valor_contado_cartao_credito: number;
  valor_contado_cartao_debito: number;
  observacoes?: string;
  idempotency_key: string;
}

export interface MovimentacaoData {
  caixa_id: string;
  tipo: "SANGRIA" | "REFORCO";
  valor: number;
  descricao: string;
  idempotency_key: string;
}

export interface CaixaResumo {
  caixaId: string;
  status: string;
  identificador: string;
  operador: string;
  abertoEm: string;
  dinheiro: number;
  pix: number;
  cartaoCredito: number;
  cartaoDebito: number;
  outros: number;
  vendasLiquidas: number;
  sangrias: number;
  suprimentos: number;
}

export type CashDifferenceFilter = "todos" | "com" | "sem" | "sobra" | "falta";

export interface ClosedCashRegisterSummary {
  quantidade: number;
  quantidade_com_diferenca: number;
  total_vendas: number;
  media_por_caixa: number;
  total_sangrias: number;
  total_reforcos: number;
  total_diferencas: number;
  dinheiro: number;
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
  outros: number;
}

export interface ClosedCashRegisterDirectory {
  items: ClosedCashRegister[];
  total: number;
  pagina: number;
  tamanho_pagina: number;
  paginas: number;
  summary: ClosedCashRegisterSummary;
}

interface ClosedCashRegisterDirectoryOptions {
  startDate: Date;
  endExclusive: Date;
  page: number;
  pageSize?: number;
  search?: string;
  difference?: CashDifferenceFilter;
}

const EMPTY_CASH_DIRECTORY: ClosedCashRegisterDirectory = {
  items: [],
  total: 0,
  pagina: 1,
  tamanho_pagina: 12,
  paginas: 1,
  summary: {
    quantidade: 0,
    quantidade_com_diferenca: 0,
    total_vendas: 0,
    media_por_caixa: 0,
    total_sangrias: 0,
    total_reforcos: 0,
    total_diferencas: 0,
    dinheiro: 0,
    pix: 0,
    cartao_credito: 0,
    cartao_debito: 0,
    outros: 0,
  },
};

export const useClosedCashRegisterDirectory = ({
  startDate,
  endExclusive,
  page,
  pageSize = 12,
  search = "",
  difference = "todos",
}: ClosedCashRegisterDirectoryOptions) => {
  const { activeTenant, session } = useAuth();
  const normalizedPage = Math.max(1, Math.trunc(page) || 1);
  const normalizedPageSize = Math.min(100, Math.max(1, Math.trunc(pageSize) || 12));
  const normalizedSearch = search.trim().slice(0, 120);

  return useQuery({
    queryKey: [
      "closed-cash-register-directory",
      activeTenant?.id,
      session?.user.id,
      startDate.toISOString(),
      endExclusive.toISOString(),
      normalizedPage,
      normalizedPageSize,
      normalizedSearch,
      difference,
    ],
    enabled: Boolean(activeTenant?.id && session?.user.id),
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<ClosedCashRegisterDirectory> => {
      if (!activeTenant?.id || !session?.user.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar caixas");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_caixas_fechados", {
        _inicio: startDate.toISOString(),
        _fim_exclusivo: endExclusive.toISOString(),
        _pagina: normalizedPage,
        _tamanho_pagina: normalizedPageSize,
        _busca: normalizedSearch || null,
        _diferenca: difference,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) return EMPTY_CASH_DIRECTORY;
      return data as unknown as ClosedCashRegisterDirectory;
    },
  });
};

// Get open cash register
export const useCaixaAberto = (enabled = true) => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["caixa-aberto", activeTenant?.id, session?.user.id],
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) return null;
      const { data, error } = await supabase
        .from("caixas")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("status", "ABERTO")
        .order("data_abertura", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Caixa | null;
    },
    enabled: enabled && Boolean(activeTenant?.id && session?.user.id),
  });
};

// Get last closed cash register
export const useUltimoCaixaFechado = () => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["ultimo-caixa-fechado", activeTenant?.id, session?.user.id],
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) return null;
      const { data, error } = await supabase
        .from("caixas")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("status", "FECHADO")
        .order("data_fechamento", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Caixa | null;
    },
    enabled: Boolean(activeTenant?.id && session?.user.id),
  });
};

// Get all cash registers with optional date filter
export const useCaixas = (startDate?: Date, endDate?: Date) => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["caixas", activeTenant?.id, session?.user.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) return [];
      let query = supabase
        .from("caixas")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("data_abertura", { ascending: false });

      if (startDate) {
        query = query.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("data_fechamento", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Caixa[];
    },
    enabled: Boolean(activeTenant?.id && session?.user.id),
  });
};

// Get closed cash registers
export const useCaixasFechados = (startDate?: Date, endDate?: Date) => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["caixas-fechados", activeTenant?.id, session?.user.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) return [];
      let query = supabase
        .from("caixas")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("status", "FECHADO")
        .order("data_fechamento", { ascending: false });

      if (startDate) {
        query = query.gte("data_fechamento", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("data_fechamento", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Caixa[];
    },
    enabled: Boolean(activeTenant?.id && session?.user.id),
  });
};

// Get transactions for a cash register
export const useCaixaMovimentacoes = (caixaId: string | undefined) => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["caixa-movimentacoes", activeTenant?.id, session?.user.id, caixaId],
    queryFn: async () => {
      if (!caixaId || !activeTenant?.id || !session?.user.id) return [];
      
      const { data, error } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("caixa_id", caixaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CaixaMovimentacao[];
    },
    enabled: Boolean(caixaId && activeTenant?.id && session?.user.id),
  });
};

export const useResumoCaixa = (caixaId: string | undefined, enabled = true) => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["caixa-resumo", activeTenant?.id, session?.user.id, caixaId],
    enabled: Boolean(caixaId && activeTenant?.id && session?.user.id) && enabled,
    queryFn: async () => {
      if (!caixaId) return null;
      const { data, error } = await supabase.rpc("obter_resumo_caixa", { _caixa_id: caixaId });
      if (error) throw error;
      return data as unknown as CaixaResumo;
    },
  });
};

// Open cash register
export const useAbrirCaixa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AbrirCaixaData) => {
      const { data: newCaixa, error } = await supabase.rpc("abrir_caixa", {
        _valor_abertura: data.valor_abertura,
        _identificador_caixa: data.identificador_caixa ?? "principal",
        _idempotency_key: data.idempotency_key,
      });
      if (error) throw error;
      return newCaixa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["caixas"] });
      toast.success("Caixa aberto com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao abrir caixa");
    },
  });
};

// Close cash register
export const useFecharCaixa = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FecharCaixaData) => {
      const { data: updatedCaixa, error } = await supabase.rpc("fechar_caixa", {
        _caixa_id: data.caixa_id,
        _valor_contado_dinheiro: data.valor_contado_dinheiro,
        _valor_conferido_pix: data.valor_contado_pix,
        _valor_conferido_cartao_credito: data.valor_contado_cartao_credito,
        _valor_conferido_cartao_debito: data.valor_contado_cartao_debito,
        _observacoes: data.observacoes ?? null,
        _idempotency_key: data.idempotency_key,
      });
      if (error) throw error;
      return updatedCaixa;
    },
    onSuccess: () => {
      void invalidateCashRegisterQueriesAfterClose(queryClient);
      toast.success("Caixa fechado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao fechar caixa");
    },
  });
};

// Add transaction
export const useAddMovimentacao = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MovimentacaoData) => {
      const { data: movimentacao, error } = await supabase.rpc("registrar_movimentacao_caixa", {
        _caixa_id: data.caixa_id,
        _tipo: data.tipo,
        _valor: data.valor,
        _descricao: data.descricao,
        _idempotency_key: data.idempotency_key,
      });
      if (error) throw error;
      return movimentacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
      queryClient.invalidateQueries({ queryKey: ["caixa-movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["caixa-resumo"] });
      toast.success("Movimentação registrada!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao registrar movimentação");
    },
  });
};
