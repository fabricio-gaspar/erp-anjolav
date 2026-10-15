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

export async function invalidateDashboardQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    dashboardQueryKeyPrefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export function getDashboardLastUpdatedAt(queryClient: QueryClient): number {
  return dashboardQueryKeyPrefixes.reduce((latestUpdatedAt, queryKey) => {
    const latestForPrefix = queryClient
      .getQueryCache()
      .findAll({ queryKey })
      .reduce((latest, query) => Math.max(latest, query.state.dataUpdatedAt), 0);

    return Math.max(latestUpdatedAt, latestForPrefix);
  }, 0);
}
