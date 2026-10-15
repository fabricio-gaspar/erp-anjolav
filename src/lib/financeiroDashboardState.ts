export type SetorFinanceiro = "todos" | "industrial" | "loja";

export interface PeriodoFinanceiro {
  inicio: string;
  fim: string;
}

interface FinanceiroCacheClient {
  removeQueries(filters: { queryKey: readonly unknown[]; exact?: boolean }): unknown;
}

interface EstadoWidgetFinanceiroInput {
  hasError: boolean;
  isLoading: boolean;
  isRetrying: boolean;
}

type EstadoWidgetFinanceiro =
  | { kind: "loading"; ariaBusy: true; showRetry: false; retryDisabled: true }
  | { kind: "error"; ariaBusy: false; showRetry: true; retryDisabled: false }
  | { kind: "retrying"; ariaBusy: true; showRetry: true; retryDisabled: true }
  | { kind: "ready"; ariaBusy: false; showRetry: false; retryDisabled: true };

const FINANCEIRO_AGREGADO_QUERY_PREFIX = ["financeiro-agregado"] as const;
const MAX_INTERVALO_FINANCEIRO_DIAS = 366;
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const SETORES_FINANCEIROS: readonly SetorFinanceiro[] = ["todos", "industrial", "loja"];

function normalizarDataIso(valor: string, campo: "inicial" | "final"): string {
  const dataNormalizada = valor.trim();
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNormalizada);

  if (!correspondencia) {
    throw new Error(`Data ${campo} inválida`);
  }

  const ano = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const dia = Number(correspondencia[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new Error(`Data ${campo} inválida`);
  }

  return dataNormalizada;
}

export function normalizarPeriodoFinanceiro(periodo: PeriodoFinanceiro): PeriodoFinanceiro {
  const inicio = normalizarDataIso(periodo.inicio, "inicial");
  const fim = normalizarDataIso(periodo.fim, "final");
  const inicioData = new Date(`${inicio}T00:00:00.000Z`);
  const fimData = new Date(`${fim}T00:00:00.000Z`);
  const intervaloEmDias = (fimData.getTime() - inicioData.getTime()) / MILISSEGUNDOS_POR_DIA;

  if (intervaloEmDias < 0) {
    throw new Error("Intervalo financeiro inválido");
  }

  if (intervaloEmDias > MAX_INTERVALO_FINANCEIRO_DIAS) {
    throw new Error(`O intervalo financeiro máximo é de ${MAX_INTERVALO_FINANCEIRO_DIAS} dias`);
  }

  return { inicio, fim };
}

export function criarChaveConsultaFinanceira(
  tenantId: string | null,
  periodo: PeriodoFinanceiro,
  setor: SetorFinanceiro,
) {
  if (!SETORES_FINANCEIROS.includes(setor)) {
    throw new Error("Setor financeiro inválido");
  }

  const periodoNormalizado = normalizarPeriodoFinanceiro(periodo);

  return [
    ...FINANCEIRO_AGREGADO_QUERY_PREFIX,
    tenantId,
    periodoNormalizado.inicio,
    periodoNormalizado.fim,
    setor,
  ] as const;
}

export function limparCacheFinanceiroAgregado(queryClient: FinanceiroCacheClient): void {
  queryClient.removeQueries({ queryKey: FINANCEIRO_AGREGADO_QUERY_PREFIX });
}

export function resolverEstadoWidgetFinanceiro({
  hasError,
  isLoading,
  isRetrying,
}: EstadoWidgetFinanceiroInput): EstadoWidgetFinanceiro {
  if (isLoading) {
    return { kind: "loading", ariaBusy: true, showRetry: false, retryDisabled: true };
  }

  if (hasError) {
    return isRetrying
      ? { kind: "retrying", ariaBusy: true, showRetry: true, retryDisabled: true }
      : { kind: "error", ariaBusy: false, showRetry: true, retryDisabled: false };
  }

  return { kind: "ready", ariaBusy: false, showRetry: false, retryDisabled: true };
}
