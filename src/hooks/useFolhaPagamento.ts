import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";

export type FolhaStatus = "aberto" | "fechado" | "cancelado";

export interface FolhaPagamento {
  id: string;
  tenant_id: string;
  funcionario_id: string;
  competencia: string;
  salario_base: number;
  horas_extras: number;
  horas_extras_50?: number | null;
  horas_extras_70?: number | null;
  horas_extras_100?: number | null;
  reflexo_dsr?: number | null;
  comissoes: number;
  gratificacao: number;
  vale_transporte: number;
  vale_alimentacao: number;
  vale_refeicao: number;
  plano_saude: number;
  plano_odontologico: number;
  outros_beneficios: number;
  desconto_inss: number;
  desconto_irrf: number;
  desconto_vt: number;
  outros_descontos: number;
  adiantamento_salarial?: number | null;
  desconto_emprestimo?: number | null;
  desconto_cesta_basica?: number | null;
  contribuicao_assistencial?: number | null;
  troco_mes?: number | null;
  troco_mes_anterior?: number | null;
  estorno_provisao?: number | null;
  base_fgts?: number | null;
  valor_fgts?: number | null;
  base_irrf?: number | null;
  faixa_irrf?: number | null;
  salario_contrib_inss?: number | null;
  dias_trabalhados?: number | null;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  custo_total_empresa: number;
  status: FolhaStatus;
  data_pagamento: string | null;
  conta_pagar_id: string | null;
  observacoes: string | null;
  versao: number;
  cancelamento_motivo: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  updated_at: string;
  funcionario?: {
    id: string;
    nome: string;
    cargo: string;
    empregador_cnpj?: string | null;
    empregador_nome?: string | null;
  };
}

export interface FolhaResumo {
  total: number;
  abertas: number;
  fechadas: number;
  canceladas: number;
  salarios: number;
  beneficios: number;
  valor_operacional: number;
}

const EMPTY_SUMMARY: FolhaResumo = {
  total: 0,
  abertas: 0,
  fechadas: 0,
  canceladas: 0,
  salarios: 0,
  beneficios: 0,
  valor_operacional: 0,
};

function normalizeSummary(value: unknown): FolhaResumo {
  const summary = value && typeof value === "object" ? value as Partial<FolhaResumo> : {};
  return {
    total: Number(summary.total ?? 0),
    abertas: Number(summary.abertas ?? 0),
    fechadas: Number(summary.fechadas ?? 0),
    canceladas: Number(summary.canceladas ?? 0),
    salarios: Number(summary.salarios ?? 0),
    beneficios: Number(summary.beneficios ?? 0),
    valor_operacional: Number(summary.valor_operacional ?? 0),
  };
}

function normalizePayroll(value: unknown): FolhaPagamento {
  if (!value || typeof value !== "object") {
    throw new Error("O servidor não retornou a folha atualizada.");
  }
  return value as FolhaPagamento;
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

function useInvalidateFolha() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["folha_pagamento"] }),
    queryClient.invalidateQueries({ queryKey: ["folha_resumo"] }),
    queryClient.invalidateQueries({ queryKey: ["folha_beneficios"] }),
    queryClient.invalidateQueries({ queryKey: ["folha_beneficios_periodo"] }),
    queryClient.invalidateQueries({ queryKey: ["contas_pagar"] }),
    queryClient.invalidateQueries({ queryKey: ["contas-pagar-directory"] }),
    queryClient.invalidateQueries({ queryKey: ["relatorio-mensal"] }),
  ]);
}

export function useFolhaPagamento(competencia: string, funcionarioIds?: string[]) {
  const { activeTenant, user } = useAuth();
  const stableIds = funcionarioIds ? [...new Set(funcionarioIds)].sort() : null;

  return useQuery({
    queryKey: ["folha_pagamento", activeTenant?.id, user?.id, competencia, stableIds],
    queryFn: async () => {
      if (!activeTenant) return [];
      let query = supabase
        .from("folha_pagamento")
        .select("*, funcionario:funcionarios(id, nome, cargo, empregador_cnpj, empregador_nome)")
        .eq("tenant_id", activeTenant.id)
        .eq("competencia", competencia)
        .order("created_at", { ascending: true });
      if (stableIds) query = query.in("funcionario_id", stableIds);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FolhaPagamento[];
    },
    enabled: Boolean(activeTenant && user && competencia && (!stableIds || stableIds.length > 0)),
    staleTime: 10_000,
  });
}

export function useFolhaResumo(competencia: string) {
  const { activeTenant, user } = useAuth();
  return useQuery({
    queryKey: ["folha_resumo", activeTenant?.id, user?.id, competencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_resumo_folha_pagamento", {
        _competencia: competencia,
      });
      if (error) throw error;
      return normalizeSummary(data);
    },
    enabled: Boolean(activeTenant && user && competencia),
    placeholderData: EMPTY_SUMMARY,
    staleTime: 10_000,
  });
}

export function useGerarFolhaMes() {
  const invalidate = useInvalidateFolha();
  const idempotency = useRetainedIdempotencyKey("payroll-generate");
  return useMutation({
    mutationFn: async (competencia: string) => {
      const { data, error } = await supabase.rpc("gerar_folha_competencia", {
        _competencia: competencia,
        _idempotency_key: idempotency.get(competencia),
      });
      if (error) throw error;
      const payload = data && typeof data === "object"
        ? data as { inserted?: number; existing?: number; canceled?: number; total?: number }
        : {};
      return {
        inserted: Number(payload.inserted ?? 0),
        existing: Number(payload.existing ?? 0),
        canceled: Number(payload.canceled ?? 0),
        total: Number(payload.total ?? 0),
      };
    },
    onSuccess: async (result, competencia) => {
      idempotency.release(competencia);
      await invalidate();
      toast.success(`Folha gerada: ${result.inserted} nova(s), ${result.existing} já existente(s)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateFolha() {
  const invalidate = useInvalidateFolha();
  const idempotency = useRetainedIdempotencyKey("payroll-update");
  return useMutation({
    mutationFn: async ({ folha, field, value }: {
      folha: FolhaPagamento;
      field: "salario_base" | "adiantamento_salarial";
      value: number;
    }) => {
      const fingerprint = JSON.stringify([folha.id, folha.versao, field, value]);
      const { data, error } = await supabase.rpc("atualizar_folha_aberta", {
        _folha_id: folha.id,
        _versao_observada: folha.versao,
        _campo: field,
        _valor: value,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      return normalizePayroll(data);
    },
    onSuccess: async (_result, variables) => {
      idempotency.release(JSON.stringify([
        variables.folha.id,
        variables.folha.versao,
        variables.field,
        variables.value,
      ]));
      await invalidate();
      toast.success("Folha atualizada");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useFecharFolhaMes() {
  const invalidate = useInvalidateFolha();
  const idempotency = useRetainedIdempotencyKey("payroll-close");
  return useMutation({
    mutationFn: async ({ competencia, dataPagamento }: {
      competencia: string;
      dataPagamento: string;
    }) => {
      const fingerprint = JSON.stringify([competencia, dataPagamento]);
      const { data, error } = await supabase.rpc("fechar_folha_competencia", {
        _competencia: competencia,
        _vencimento: dataPagamento,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      const payload = data && typeof data === "object" ? data as { closed?: number } : {};
      return { closed: Number(payload.closed ?? 0) };
    },
    onSuccess: async (result, variables) => {
      idempotency.release(JSON.stringify([variables.competencia, variables.dataPagamento]));
      await invalidate();
      toast.success(`${result.closed} folha(s) fechada(s) e lançada(s) em Contas a Pagar`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useCancelFolha() {
  const invalidate = useInvalidateFolha();
  const idempotency = useRetainedIdempotencyKey("payroll-cancel");
  return useMutation({
    mutationFn: async ({ folha, motivo }: { folha: FolhaPagamento; motivo: string }) => {
      const reason = motivo.trim();
      const fingerprint = JSON.stringify([folha.id, folha.versao, reason]);
      const { data, error } = await supabase.rpc("cancelar_folha_aberta", {
        _folha_id: folha.id,
        _versao_observada: folha.versao,
        _motivo: reason,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      return normalizePayroll(data);
    },
    onSuccess: async (_result, variables) => {
      idempotency.release(JSON.stringify([
        variables.folha.id,
        variables.folha.versao,
        variables.motivo.trim(),
      ]));
      await invalidate();
      toast.success("Folha cancelada com histórico preservado");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useFolhaMesPorIntervalo(inicio: Date, fim: Date) {
  const { activeTenant, user } = useAuth();
  const compInicio = format(startOfMonth(inicio), "yyyy-MM-dd");
  const compFim = format(endOfMonth(fim), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["folha_intervalo", activeTenant?.id, user?.id, compInicio, compFim],
    queryFn: async () => {
      if (!activeTenant) return [];
      const { data, error } = await supabase
        .from("folha_pagamento")
        .select("*, funcionario:funcionarios(id, nome, cargo, empregador_cnpj, empregador_nome)")
        .eq("tenant_id", activeTenant.id)
        .gte("competencia", compInicio)
        .lte("competencia", compFim);
      if (error) throw error;
      return (data ?? []) as unknown as FolhaPagamento[];
    },
    enabled: Boolean(activeTenant && user),
  });
}
