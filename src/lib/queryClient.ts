import { QueryClient } from "@tanstack/react-query";
import { dashboardQueryDefaults } from "@/lib/queryDefaults";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...dashboardQueryDefaults,
      gcTime: 24 * 60 * 60 * 1_000,
      networkMode: "online",
    },
    mutations: {
      networkMode: "online",
    },
  },
});
