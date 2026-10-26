import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useWorkspace, type WorkspaceArea } from "@/contexts/WorkspaceContext";
import {
  useFinanceiroAgregado,
  type FinanceiroAgregado,
  type PeriodoFinanceiro,
  type SetorFinanceiro,
} from "./useFinanceiroAgregado";

export type { SetorFinanceiro } from "./useFinanceiroAgregado";

export interface DashboardFinanceiroData extends FinanceiroAgregado {
  error: Error | null;
  errorReference: string | null;
  isLoading: boolean;
  isRetrying: boolean;
  retry: () => void;
  setorEfetivo: SetorFinanceiro;
}

const DASHBOARD_WINDOW_DAYS = 365;

const EMPTY_FINANCEIRO: FinanceiroAgregado = {
  resultadoRegistrado: 0,
  receitasTotais: 0,
  receitasCount: 0,
  despesasTotais: 0,
  despesasCount: 0,
  margemOperacionalRegistrada: 0,
  aReceberVencido: 0,
  aReceberHoje: 0,
  aReceberProximos7Dias: 0,
  aPagarVencido: 0,
  aPagarHoje: 0,
  aPagarProximos7Dias: 0,
  vencidasTotal: 0,
  vencidasCount: 0,
  vencemHoje: 0,
  vencemHojeCount: 0,
  proximos7Dias: 0,
  proximos7DiasCount: 0,
  receitasLoja: 0,
  receitasLojaCount: 0,
  movimentacoesVencidas: [],
};

function resolveSetorFinanceiro(area: WorkspaceArea, setorSolicitado: SetorFinanceiro): SetorFinanceiro {
  if (area === "industrial") return "industrial";
  if (area === "residencial") return "loja";
  return setorSolicitado;
}

function createDefaultPeriod(): PeriodoFinanceiro {
  const fim = new Date();
  const inicio = subDays(fim, DASHBOARD_WINDOW_DAYS);

  return {
    inicio: format(inicio, "yyyy-MM-dd"),
    fim: format(fim, "yyyy-MM-dd"),
  };
}

function createErrorReference(errorUpdatedAt: number): string | null {
  if (errorUpdatedAt <= 0) return null;
  return `FIN-${errorUpdatedAt.toString(36).toUpperCase()}`;
}

export function useDashboardFinanceiro(setor: SetorFinanceiro = "todos"): DashboardFinanceiroData {
  const { activeArea } = useWorkspace();
  const periodo = useMemo(createDefaultPeriod, []);
  const setorEfetivo = resolveSetorFinanceiro(activeArea, setor);
  const consulta = useFinanceiroAgregado(periodo, setorEfetivo);
  const retry = () => {
    void consulta.refetch();
  };

  return {
    ...(consulta.data ?? EMPTY_FINANCEIRO),
    error: consulta.error,
    errorReference: consulta.error ? createErrorReference(consulta.errorUpdatedAt) : null,
    isLoading: consulta.isLoading,
    isRetrying: consulta.isRefetching,
    retry,
    setorEfetivo,
  };
}
