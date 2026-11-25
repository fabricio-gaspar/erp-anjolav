import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadOfflineQueryCache, saveOfflineQueryCache } from "@/lib/offlineStore";
import { OFFLINE_QUERY_CACHE_MAX_AGE_MS, shouldPersistOfflineQuery } from "@/lib/offlinePolicy";

export async function restoreOfflineQueryCache(queryClient: QueryClient, userId: string): Promise<boolean> {
  try {
    const cached = await loadOfflineQueryCache(userId);
    if (!cached || Date.now() - Date.parse(cached.updatedAt) > OFFLINE_QUERY_CACHE_MAX_AGE_MS) return false;
    hydrate(queryClient, cached.value);
    return true;
  } catch (error) {
    console.warn("Não foi possível restaurar o cache offline", error);
    return false;
  }
}

export async function bootstrapOfflineQueryCache(queryClient: QueryClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user.id) return null;
    await restoreOfflineQueryCache(queryClient, data.session.user.id);
    return data.session.user.id;
  } catch {
    return null;
  }
}

export function subscribeOfflineQueryCache(queryClient: QueryClient, userId: string): () => void {
  let timer: number | null = null;
  let stopped = false;

  const persist = () => {
    timer = null;
    if (stopped) return;
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === "success" && shouldPersistOfflineQuery(query.queryKey),
    });
    void saveOfflineQueryCache(userId, state).catch((error) => {
      console.warn("Não foi possível atualizar o cache offline", error);
    });
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(persist, 750);
  });

  persist();

  return () => {
    stopped = true;
    unsubscribe();
    if (timer !== null) window.clearTimeout(timer);
  };
}
