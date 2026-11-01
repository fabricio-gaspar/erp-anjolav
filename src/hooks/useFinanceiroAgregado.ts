import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  criarChaveConsultaFinanceira,
  normalizarPeriodoFinanceiro,
  type PeriodoFinanceiro,
  type SetorFinanceiro,
} from "@/lib/financeiroDashboardState";
import { supabase } from "@/integrations/supabase/client";

export type { PeriodoFinanceiro, SetorFinanceiro } from "@/lib/financeiroDashboardState";

export interface MovimentacaoVencida {
  id: string;
  tipo: "fatura" | "despesa";
  descricao: string;
  cliente: string;
  dataVencimento: string;
  valor: number;
}

export interface FinanceiroAgregado {
  resultadoRegistrado: number;
  receitasTotais: number;
  receitasCount: number;
  despesasTotais: number;
  despesasCount: number;
  margemOperacionalRegistrada: number;
  aReceberVencido: number;
  aReceberHoje: number;
  aReceberProximos7Dias: number;
  aPagarVencido: number;
  aPagarHoje: number;
  aPagarProximos7Dias: number;
  vencidasTotal: number;
  vencidasCount: number;
  vencemHoje: number;
  vencemHojeCount: number;
  proximos7Dias: number;
  proximos7DiasCount: number;
  receitasLoja: number;
  receitasLojaCount: number;
  movimentacoesVencidas: MovimentacaoVencida[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  const numberValue = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Resposta agregada inválida: ${key}`);
  }

  return numberValue;
}

function readText(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Resposta agregada inválida: ${key}`);
  }

  return value;
}

function readOverdueItems(value: unknown): MovimentacaoVencida[] {
  if (!Array.isArray(value)) {
    throw new Error("Resposta agregada inválida: movimentacoes_vencidas");
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Resposta agregada inválida: item vencido");
    }

    const tipo = readText(item, "tipo");
    if (tipo !== "fatura" && tipo !== "despesa") {
      throw new Error("Resposta agregada inválida: tipo vencido");
    }

    return {
      id: readText(item, "id"),
      tipo,
      descricao: readText(item, "descricao"),
      cliente: readText(item, "cliente"),
      dataVencimento: readText(item, "data_vencimento"),
      valor: readNumber(item, "valor"),
    };
  });
}

export function normalizarFinanceiroAgregado(data: unknown): FinanceiroAgregado {
  if (!isRecord(data)) {
    throw new Error("Resposta agregada inválida");
  }

  return {
    resultadoRegistrado: readNumber(data, "resultado_registrado"),
    receitasTotais: readNumber(data, "receitas_totais"),
    receitasCount: readNumber(data, "receitas_count"),
    despesasTotais: readNumber(data, "despesas_totais"),
    despesasCount: readNumber(data, "despesas_count"),
    margemOperacionalRegistrada: readNumber(data, "margem_operacional_registrada"),
    aReceberVencido: readNumber(data, "a_receber_vencido"),
    aReceberHoje: readNumber(data, "a_receber_hoje"),
    aReceberProximos7Dias: readNumber(data, "a_receber_proximos_7_dias"),
    aPagarVencido: readNumber(data, "a_pagar_vencido"),
    aPagarHoje: readNumber(data, "a_pagar_hoje"),
    aPagarProximos7Dias: readNumber(data, "a_pagar_proximos_7_dias"),
    vencidasTotal: readNumber(data, "vencidas_total"),
    vencidasCount: readNumber(data, "vencidas_count"),
    vencemHoje: readNumber(data, "vencem_hoje"),
    vencemHojeCount: readNumber(data, "vencem_hoje_count"),
    proximos7Dias: readNumber(data, "proximos_7_dias"),
    proximos7DiasCount: readNumber(data, "proximos_7_dias_count"),
    receitasLoja: readNumber(data, "receitas_loja"),
    receitasLojaCount: readNumber(data, "receitas_loja_count"),
    movimentacoesVencidas: readOverdueItems(data.movimentacoes_vencidas),
  };
}

export function useFinanceiroAgregado(periodo: PeriodoFinanceiro, setor: SetorFinanceiro) {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.id || null;
  const periodoNormalizado = normalizarPeriodoFinanceiro(periodo);
  const queryKey = criarChaveConsultaFinanceira(tenantId, periodoNormalizado, setor);

  return useQuery({
    queryKey,
    enabled: tenantId !== null,
    queryFn: async (): Promise<FinanceiroAgregado> => {
      const { data, error } = await supabase.rpc("consultar_dashboard_financeiro", {
        _inicio: periodoNormalizado.inicio,
        _fim: periodoNormalizado.fim,
        _setor: setor,
      });

      if (error) {
        throw new Error("Não foi possível consultar o resumo financeiro.");
      }

      return normalizarFinanceiroAgregado(data);
    },
    retry: 1,
    staleTime: 30_000,
  });
}
