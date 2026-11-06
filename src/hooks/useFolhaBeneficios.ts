import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";
import type { FolhaPagamento } from "@/hooks/useFolhaPagamento";

export interface FolhaBeneficio {
  id: string;
  tenant_id: string;
  folha_id: string;
  funcionario_id: string;
  beneficio_id?: string | null;
  nome: string;
  categoria: string | null;
  tipo: "beneficio" | "desconto";
  valor: number;
  observacao: string | null;
  ativo: boolean;
  versao: number;
  created_at: string;
  updated_at: string;
}

function useRetainedIdempotencyKey(prefix: string) {
  const keys = useRef(new Map<string, string>());
  return {
    get(fingerprint: string) {
      const retained = keys.current.get(fingerprint);
      if (retained) return retained;
      const created = createIdempotencyKey(prefix);
      keys.current.set(fingerprint, created);
      return created;
    },
    release(fingerprint: string) {
      keys.current.delete(fingerprint);
    },
  };
}

export function useUpsertValorBeneficio() {
  const queryClient = useQueryClient();
  const idempotency = useRetainedIdempotencyKey("payroll-benefit");
  return useMutation({
    mutationFn: async ({ folha, beneficioId, valor }: {
      folha: FolhaPagamento;
      beneficioId: string;
      valor: number;
    }) => {
      const fingerprint = JSON.stringify([folha.id, folha.versao, beneficioId, valor]);
      const { data, error } = await supabase.rpc("definir_beneficio_folha", {
        _folha_id: folha.id,
        _versao_folha_observada: folha.versao,
        _beneficio_id: beneficioId,
        _valor: valor,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      if (!data || typeof data !== "object") {
        throw new Error("O servidor não retornou a folha atualizada.");
      }
      return data as unknown as FolhaPagamento;
    },
    onSuccess: async (_result, variables) => {
      idempotency.release(JSON.stringify([
        variables.folha.id,
        variables.folha.versao,
        variables.beneficioId,
        variables.valor,
      ]));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["folha_beneficios"] }),
        queryClient.invalidateQueries({ queryKey: ["folha_beneficios_periodo"] }),
        queryClient.invalidateQueries({ queryKey: ["folha_pagamento"] }),
        queryClient.invalidateQueries({ queryKey: ["folha_resumo"] }),
        queryClient.invalidateQueries({ queryKey: ["relatorio-mensal"] }),
      ]);
      toast.success("Benefício atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useFolhaBeneficiosByFolha(folhaIds: string[]) {
  const { activeTenant, user } = useAuth();
  const stableIds = [...new Set(folhaIds)].sort();
  return useQuery({
    queryKey: ["folha_beneficios", activeTenant?.id, user?.id, stableIds],
    queryFn: async () => {
      if (!activeTenant || stableIds.length === 0) return [];
      const { data, error } = await supabase
        .from("folha_beneficios")
        .select("*")
        .eq("tenant_id", activeTenant.id)
        .in("folha_id", stableIds);
      if (error) throw error;
      return (data ?? []) as unknown as FolhaBeneficio[];
    },
    enabled: Boolean(activeTenant && user && stableIds.length > 0),
    staleTime: 10_000,
  });
}

export function useFolhaBeneficiosPorPeriodo(inicio: Date, fim: Date) {
  const { activeTenant, user } = useAuth();
  const initialDate = format(startOfMonth(inicio), "yyyy-MM-dd");
  const finalDate = format(endOfMonth(fim), "yyyy-MM-dd");
  return useQuery({
    queryKey: [
      "folha_beneficios_periodo",
      activeTenant?.id,
      user?.id,
      initialDate,
      finalDate,
    ],
    queryFn: async () => {
      if (!activeTenant) return [];
      const { data: payrolls, error: payrollError } = await supabase
        .from("folha_pagamento")
        .select("id, competencia, funcionario:funcionarios(nome, empregador_cnpj, empregador_nome)")
        .eq("tenant_id", activeTenant.id)
        .gte("competencia", initialDate)
        .lte("competencia", finalDate);
      if (payrollError) throw payrollError;
      const payrollRows = payrolls ?? [];
      const ids = payrollRows.map((row) => row.id);
      if (!ids.length) return [];
      const { data: benefits, error: benefitError } = await supabase
        .from("folha_beneficios")
        .select("*")
        .eq("tenant_id", activeTenant.id)
        .eq("ativo", true)
        .in("folha_id", ids);
      if (benefitError) throw benefitError;
      const payrollMap = new Map(payrollRows.map((row) => [row.id, row]));
      return (benefits ?? []).map((benefit) => {
        const employee = payrollMap.get(benefit.folha_id)?.funcionario;
        return {
          ...benefit,
          funcionario_nome: employee?.nome || "—",
          empregador_nome: employee?.empregador_nome || "—",
        };
      }) as Array<FolhaBeneficio & { funcionario_nome: string; empregador_nome: string }>;
    },
    enabled: Boolean(activeTenant && user),
  });
}
