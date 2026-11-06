import { useMemo } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { useWorkspace, type WorkspaceArea } from "@/contexts/WorkspaceContext";
import {
  useFinanceiroAgregado,
  type FinanceiroAgregado,
  type PeriodoFinanceiro,
  type SetorFinanceiro,
} from "./useFinanceiroAgregado";

export type { PeriodoFinanceiro, SetorFinanceiro } from "./useFinanceiroAgregado";

export interface DashboardFinanceiroData extends FinanceiroAgregado {
  error: Error | null;
  errorReference: string | null;
  isLoading: boolean;
  isRetrying: boolean;
  retry: () => void;
  setorEfetivo: SetorFinanceiro;
}

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

export function createDefaultFinancialPeriod(): PeriodoFinanceiro {
  const currentDate = new Date();

  return {
    inicio: format(startOfMonth(currentDate), "yyyy-MM-dd"),
    fim: format(endOfMonth(currentDate), "yyyy-MM-dd"),
  };
}

function createErrorReference(errorUpdatedAt: number): string | null {
  if (errorUpdatedAt <= 0) return null;
  return `FIN-${errorUpdatedAt.toString(36).toUpperCase()}`;
}

export function useDashboardFinanceiro(
  setor: SetorFinanceiro = "todos",
  selectedPeriod?: PeriodoFinanceiro,
): DashboardFinanceiroData {
  const { activeArea } = useWorkspace();
  const defaultPeriod = useMemo(createDefaultFinancialPeriod, []);
  const periodo = selectedPeriod ?? defaultPeriod;
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
