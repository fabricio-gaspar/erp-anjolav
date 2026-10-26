import type { DefaultOptions, QueryClient } from "@tanstack/react-query";

const DASHBOARD_STALE_TIME_MS = 60_000;
const QUERY_RETRY_DELAY_BASE_MS = 1_000;
const QUERY_RETRY_DELAY_MAX_MS = 30_000;

export const dashboardQueryKeyPrefixes = [
  ["metricas_producao"],
  ["agenda_retiradas"],
  ["agenda_entregas"],
  ["resumo_processamento"],
  ["contas_pagar"],
  ["caixa-aberto"],
  ["ultimo-caixa-fechado"],
  ["faturas"],
  ["fechamentos_proximos"],
  ["eventos_agenda"],
  ["estoque_produtos"],
  ["rols_loja"],
] as const;

const dashboardProductionAdvanceQueryKeyPrefixes = [
  ["metricas_producao"],
  ["resumo_processamento"],
  ["agenda_entregas"],
  ["rols_loja"],
] as const;

const cashRegisterCloseQueryKeyPrefixes = [
  ["caixa-aberto"],
  ["caixas"],
  ["caixas-fechados"],
  ["ultimo-caixa-fechado"],
] as const;

export function getQueryRetryDelay(attemptIndex: number): number {
  return Math.min(
    QUERY_RETRY_DELAY_BASE_MS * 2 ** attemptIndex,
    QUERY_RETRY_DELAY_MAX_MS,
  );
}

export const dashboardQueryDefaults = {
  staleTime: DASHBOARD_STALE_TIME_MS,
  retry: 2,
  retryDelay: getQueryRetryDelay,
  refetchOnMount: true,
  refetchOnReconnect: true,
  refetchOnWindowFocus: true,
} satisfies NonNullable<DefaultOptions["queries"]>;

async function invalidateQueryKeyPrefixes(
  queryClient: QueryClient,
  queryKeyPrefixes: readonly (readonly string[])[],
): Promise<void> {
  await Promise.all(
    queryKeyPrefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export function invalidateDashboardQueries(queryClient: QueryClient): Promise<void> {
  return invalidateQueryKeyPrefixes(queryClient, dashboardQueryKeyPrefixes);
}

export function invalidateDashboardQueriesAfterProductionAdvance(
  queryClient: QueryClient,
): Promise<void> {
  return invalidateQueryKeyPrefixes(queryClient, dashboardProductionAdvanceQueryKeyPrefixes);
}

export function invalidateCashRegisterQueriesAfterClose(queryClient: QueryClient): Promise<void> {
  return invalidateQueryKeyPrefixes(queryClient, cashRegisterCloseQueryKeyPrefixes);
}
