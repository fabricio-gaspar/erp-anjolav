import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface FolhaBeneficio {
  id: string;
  folha_id: string;
  funcionario_id: string;
  beneficio_id?: string | null;
  nome: string;
  categoria: string;
  tipo: "beneficio" | "desconto";
  valor: number;
  observacao: string | null;
  created_at?: string;
}

/**
 * Upsert valor de um benefício do catálogo para uma folha.
 * Se valor = 0 e já existir, remove o registro.
 */
export function useUpsertValorBeneficio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      folha_id: string;
      funcionario_id: string;
      beneficio_id: string;
      nome: string;
      valor: number;
    }) => {
      const { data: existing } = await supabase
        .from("folha_beneficios" as any)
        .select("id")
        .eq("folha_id", p.folha_id)
        .eq("beneficio_id", p.beneficio_id)
        .maybeSingle();

      if (p.valor === 0) {
        if (existing) {
          const { error } = await supabase.from("folha_beneficios" as any).delete().eq("id", (existing as any).id);
          if (error) throw error;
        }
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from("folha_beneficios" as any)
          .update({ valor: p.valor, nome: p.nome })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("folha_beneficios" as any).insert({
          folha_id: p.folha_id,
          funcionario_id: p.funcionario_id,
          beneficio_id: p.beneficio_id,
          nome: p.nome,
          categoria: "catalogo",
          tipo: "beneficio",
          valor: p.valor,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folha_beneficios"] });
      qc.invalidateQueries({ queryKey: ["folha_beneficios_periodo"] });
      qc.invalidateQueries({ queryKey: ["relatorio-mensal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFolhaBeneficiosByFolha(folhaIds: string[]) {
  return useQuery({
    queryKey: ["folha_beneficios", folhaIds.sort().join(",")],
    queryFn: async () => {
      if (!folhaIds.length) return [] as FolhaBeneficio[];
      const { data, error } = await supabase
        .from("folha_beneficios" as any)
        .select("*")
        .in("folha_id", folhaIds);
      if (error) throw error;
      return (data || []) as unknown as FolhaBeneficio[];
    },
    enabled: folhaIds.length > 0,
    refetchOnMount: "always",
  });
}

export function useFolhaBeneficiosPorPeriodo(inicio: Date, fim: Date) {
  const ini = format(startOfMonth(inicio), "yyyy-MM-dd");
  const f = format(endOfMonth(fim), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["folha_beneficios_periodo", ini, f],
    queryFn: async () => {
      // join via folha_pagamento competencia
      const { data: folhas, error: e1 } = await supabase
        .from("folha_pagamento" as any)
        .select("id, competencia, funcionario:funcionarios(nome, empregador_cnpj, empregador_nome)")
        .gte("competencia", ini)
        .lte("competencia", f);
      if (e1) throw e1;
      const ids = (folhas || []).map((x: any) => x.id);
      if (!ids.length) return [];
      const { data: bens, error: e2 } = await supabase
        .from("folha_beneficios" as any)
        .select("*")
        .in("folha_id", ids);
      if (e2) throw e2;
      const fmap = new Map((folhas || []).map((x: any) => [x.id, x]));
      return (bens || []).map((b: any) => ({
        ...b,
        funcionario_nome: fmap.get(b.folha_id)?.funcionario?.nome || "—",
        empregador_nome: fmap.get(b.folha_id)?.funcionario?.empregador_nome || "—",
      })) as Array<FolhaBeneficio & { funcionario_nome: string; empregador_nome: string }>;
    },
  });
}

export function useAddFolhaBeneficio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: Omit<FolhaBeneficio, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("folha_beneficios" as any)
        .insert(b)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folha_beneficios"] });
      qc.invalidateQueries({ queryKey: ["folha_beneficios_periodo"] });
      qc.invalidateQueries({ queryKey: ["relatorio-mensal"] });
      toast.success("Benefício adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFolhaBeneficio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folha_beneficios" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folha_beneficios"] });
      qc.invalidateQueries({ queryKey: ["folha_beneficios_periodo"] });
      qc.invalidateQueries({ queryKey: ["relatorio-mensal"] });
      toast.success("Removido");
    },
  });
}
