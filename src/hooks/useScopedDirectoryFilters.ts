import { useEffect, useState } from "react";
import type { useSearchParams } from "react-router-dom";
import { readScopedDraft, writeScopedDraft } from "@/lib/scopedDraft";

type SetSearchParams = ReturnType<typeof useSearchParams>[1];

export function useScopedDirectoryFilters(
  key: string | null,
  searchParams: URLSearchParams,
  setSearchParams: SetSearchParams,
) {
  const [restoredKey, setRestoredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key || restoredKey === key || searchParams.has("novo")) return;
    const saved = readScopedDraft<string>(key);
    const changedScope = restoredKey !== null;
    setRestoredKey(key);
    if (changedScope || (!searchParams.toString() && saved)) {
      setSearchParams(new URLSearchParams(saved ?? ""), { replace: true });
    }
  }, [key, restoredKey, searchParams, setSearchParams]);

  useEffect(() => {
    if (!key || restoredKey !== key || searchParams.has("novo")) return;
    const value = searchParams.toString();
    if (value) writeScopedDraft(key, value);
  }, [key, restoredKey, searchParams]);
}
