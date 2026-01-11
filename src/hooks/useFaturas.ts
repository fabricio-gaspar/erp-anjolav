import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Fatura {
  id: string;
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status: "pendente" | "nota_emitida" | "pago";
  numero_nf: string | null;
  asaas_charge_id: string | null;
  created_at: string;
  updated_at: string;
  // Join fields
  cliente?: {
    razao_social: string;
    cpf_cnpj: string | null;
    email: string | null;
    telefone: string | null;
  };
}

export interface FaturaInsert {
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status?: string;
  numero_nf?: string | null;
  asaas_charge_id?: string | null;
}

export interface FaturaUpdate {
  status?: string;
  numero_nf?: string | null;
  asaas_charge_id?: string | null;
  valor_total?: number;
}

export function useFaturas(periodoInicio?: string, periodoFim?: string) {
  const queryClient = useQueryClient();

  const { data: faturas = [], isLoading, error } = useQuery({
    queryKey: ["faturas", periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("faturas")
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone)
        `)
        .order("created_at", { ascending: false });

      if (periodoInicio) {
        query = query.gte("periodo_inicio", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("periodo_fim", periodoFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Fatura[];
    },
  });

  const createFatura = useMutation({
    mutationFn: async (fatura: FaturaInsert) => {
      const { data, error } = await supabase
        .from("faturas")
        .insert(fatura)
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone)
        `)
        .single();
      if (error) throw error;
      return data as Fatura;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      toast.success("Fatura criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar fatura: " + error.message);
    },
  });

  const updateFatura = useMutation({
    mutationFn: async ({ id, ...updates }: FaturaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("faturas")
        .update(updates)
        .eq("id", id)
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone)
        `)
        .single();
      if (error) throw error;
      return data as Fatura;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      toast.success("Fatura atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar fatura: " + error.message);
    },
  });

  const deleteFatura = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faturas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      toast.success("Fatura excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir fatura: " + error.message);
    },
  });

  // Summary calculations
  const summary = {
    totalPrevisto: faturas.reduce((sum, f) => sum + Number(f.valor_total), 0),
    pendente: faturas
      .filter((f) => f.status === "pendente")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    notaEmitida: faturas
      .filter((f) => f.status === "nota_emitida")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    pago: faturas
      .filter((f) => f.status === "pago")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    totalClientes: new Set(faturas.map((f) => f.cliente_id)).size,
  };

  return {
    faturas,
    summary,
    isLoading,
    error,
    createFatura,
    updateFatura,
    deleteFatura,
  };
}

export function useFaturaById(faturaId: string | null) {
  return useQuery({
    queryKey: ["fatura", faturaId],
    queryFn: async () => {
      if (!faturaId) return null;
      const { data, error } = await supabase
        .from("faturas")
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone)
        `)
        .eq("id", faturaId)
        .maybeSingle();
      if (error) throw error;
      return data as Fatura | null;
    },
    enabled: !!faturaId,
  });
}
