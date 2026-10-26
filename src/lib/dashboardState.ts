export interface DashboardSourceState {
  label: string;
  enabled: boolean;
  isLoading: boolean;
  hasError: boolean;
}

export interface DashboardState {
  loadingSources: string[];
  failedSources: string[];
  hasBlockingLoad: false;
}

/**
 * Dashboard cards are independent. A slow or failed source must not hide the
 * rest of the workspace behind a full-page spinner.
 */
export function resolverEstadoDashboard(sources: DashboardSourceState[]): DashboardState {
  return {
    loadingSources: sources
      .filter((source) => source.enabled && source.isLoading)
      .map((source) => source.label),
    failedSources: sources
      .filter((source) => source.enabled && source.hasError)
      .map((source) => source.label),
    hasBlockingLoad: false,
  };
}
