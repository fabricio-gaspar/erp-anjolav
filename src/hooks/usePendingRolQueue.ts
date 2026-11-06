import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { createIdempotencyKey } from "@/lib/idempotency";
import type { ItemLancamento, Lancamento } from "@/hooks/useLancamentos";

export type PendingRolCycle = "quinzenal" | "mensal" | "outro";
export type PendingRolStage = "em_processo" | "prateleira" | "entregue";

export interface PendingRol extends Lancamento {
  ciclo: PendingRolCycle;
}

export interface PendingRolSummary {
  quantidade: number;
  clientes: number;
  valor_total: number;
  quinzenal: number;
  mensal: number;
  outro: number;
}

export interface PendingRolQueueResult {
  items: PendingRol[];
  total: number;
  page: number;
  page_size: number;
  summary: PendingRolSummary;
}

export interface PendingRolFilters {
  page: number;
  pageSize: number;
  search?: string;
  cycle?: PendingRolCycle;
  stage?: PendingRolStage;
  clientId?: string;
  startDate?: string;
  endDate?: string;
}

export interface PendingRolDesiredItem {
  id?: string;
  produto_id?: string;
  descricao?: string;
  quantidade: number;
}

export interface CreateManualRolInput {
  clientId: string;
  date: string;
  deliveryDate: string | null;
  note: string | null;
  items: Array<{ produto_id: string; descricao?: string; quantidade: number }>;
  idempotencyKey: string;
}

const EMPTY_SUMMARY: PendingRolSummary = {
  quantidade: 0,
  clientes: 0,
  valor_total: 0,
  quinzenal: 0,
  mensal: 0,
  outro: 0,
};

function normalizeQueue(value: unknown): PendingRolQueueResult {
  const payload = (value && typeof value === "object" ? value : {}) as Partial<PendingRolQueueResult>;
  const summary = (payload.summary && typeof payload.summary === "object"
    ? payload.summary
    : EMPTY_SUMMARY) as Partial<PendingRolSummary>;

  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    total: Number(payload.total ?? 0),
    page: Number(payload.page ?? 1),
    page_size: Number(payload.page_size ?? 25),
    summary: {
      quantidade: Number(summary.quantidade ?? 0),
      clientes: Number(summary.clientes ?? 0),
      valor_total: Number(summary.valor_total ?? 0),
      quinzenal: Number(summary.quinzenal ?? 0),
      mensal: Number(summary.mensal ?? 0),
      outro: Number(summary.outro ?? 0),
    },
  };
}

function normalizeLaunch(value: unknown): Lancamento {
  if (!value || typeof value !== "object") {
    throw new Error("O servidor não retornou o ROL atualizado.");
  }
  return value as Lancamento;
}

export function usePendingRolQueue(filters: PendingRolFilters) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const enabled = Boolean(activeTenant && user && activeArea !== "central");

  return useQuery({
    queryKey: [
      "pending-rolls",
      activeTenant?.id,
      user?.id,
      activeArea,
      filters,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_fila_lancamentos_pendentes", {
        _area: activeArea,
        _pagina: filters.page,
        _tamanho: filters.pageSize,
        _busca: filters.search || undefined,
        _ciclo: filters.cycle || undefined,
        _etapa: filters.stage || undefined,
        _cliente_id: filters.clientId || undefined,
        _data_inicio: filters.startDate || undefined,
        _data_fim: filters.endDate || undefined,
      });
      if (error) throw error;
      return normalizeQueue(data);
    },
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });
}

export function usePendingRolBillingSelection(ids: string[]) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const stableIds = [...new Set(ids)].sort();

  return useQuery({
    queryKey: ["pending-roll-billing-selection", activeTenant?.id, user?.id, activeArea, stableIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_lancamentos_para_faturamento", {
        _area: activeArea,
        _ids: stableIds,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as (Lancamento & { itens: ItemLancamento[] })[];
    },
    enabled: Boolean(activeTenant && user && activeArea !== "central" && stableIds.length > 0),
    staleTime: 5_000,
  });
}

function useInvalidatePendingRolData() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["pending-rolls"] }),
    queryClient.invalidateQueries({ queryKey: ["pending-roll-billing-selection"] }),
    queryClient.invalidateQueries({ queryKey: ["rol-directory"] }),
    queryClient.invalidateQueries({ queryKey: ["lancamentos"] }),
    queryClient.invalidateQueries({ queryKey: ["itens_lancamento"] }),
    queryClient.invalidateQueries({ queryKey: ["faturas"] }),
  ]);
}

function useRetainedIdempotencyKey(prefix: string) {
  const keysRef = useRef(new Map<string, string>());

  return {
    get(fingerprint: string) {
      const retained = keysRef.current.get(fingerprint);
      if (retained) return retained;
      const created = createIdempotencyKey(prefix);
      keysRef.current.set(fingerprint, created);
      return created;
    },
    release(fingerprint: string) {
      keysRef.current.delete(fingerprint);
    },
  };
}

export function useUpdatePendingRolStage() {
  const invalidate = useInvalidatePendingRolData();
  const idempotency = useRetainedIdempotencyKey("pending-rol-stage");
  return useMutation({
    mutationFn: async ({ launchId, observedUpdatedAt, stage }: {
      launchId: string;
      observedUpdatedAt: string;
      stage: PendingRolStage;
    }) => {
      const fingerprint = JSON.stringify([launchId, observedUpdatedAt, stage]);
      const { data, error } = await supabase.rpc("atualizar_etapa_lancamento_pendente", {
        _lancamento_id: launchId,
        _updated_at_observado: observedUpdatedAt,
        _etapa: stage,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      return normalizeLaunch(data);
    },
    onSuccess: async (_data, variables) => {
      idempotency.release(JSON.stringify([variables.launchId, variables.observedUpdatedAt, variables.stage]));
      await invalidate();
    },
  });
}

export function useCreateManualRol() {
  const invalidate = useInvalidatePendingRolData();
  return useMutation({
    mutationFn: async ({ clientId, date, deliveryDate, note, items, idempotencyKey }: CreateManualRolInput) => {
      const { data, error } = await supabase.rpc("criar_lancamento_manual", {
        _cliente_id: clientId,
        _data_lancamento: date,
        _data_entrega: deliveryDate,
        _observacao: note,
        _itens: items as unknown as Json,
        _idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return normalizeLaunch(data);
    },
    onSuccess: invalidate,
  });
}

export function useEditPendingRol() {
  const invalidate = useInvalidatePendingRolData();
  const idempotency = useRetainedIdempotencyKey("pending-rol-edit");
  return useMutation({
    mutationFn: async ({ launch, date, deliveryDate, note, items }: {
      launch: Lancamento;
      date: string;
      deliveryDate: string | null;
      note: string | null;
      items: PendingRolDesiredItem[];
    }) => {
      const fingerprint = JSON.stringify([
        launch.id,
        launch.updated_at,
        date,
        deliveryDate,
        note,
        items,
      ]);
      const { data, error } = await supabase.rpc("editar_lancamento_pendente", {
        _lancamento_id: launch.id,
        _updated_at_observado: launch.updated_at,
        _data_lancamento: date,
        _data_entrega: deliveryDate || undefined,
        _observacao: note || undefined,
        _itens: items as unknown as Json,
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      return normalizeLaunch(data);
    },
    onSuccess: async (_data, variables) => {
      idempotency.release(JSON.stringify([
        variables.launch.id,
        variables.launch.updated_at,
        variables.date,
        variables.deliveryDate,
        variables.note,
        variables.items,
      ]));
      await invalidate();
    },
  });
}

export function useCancelPendingRol() {
  const invalidate = useInvalidatePendingRolData();
  const idempotency = useRetainedIdempotencyKey("pending-rol-cancel");
  return useMutation({
    mutationFn: async ({ launch, reason }: { launch: Lancamento; reason: string }) => {
      const fingerprint = JSON.stringify([launch.id, launch.updated_at, reason.trim()]);
      const { data, error } = await supabase.rpc("cancelar_lancamento_pendente", {
        _lancamento_id: launch.id,
        _updated_at_observado: launch.updated_at,
        _motivo: reason.trim(),
        _idempotency_key: idempotency.get(fingerprint),
      });
      if (error) throw error;
      return normalizeLaunch(data);
    },
    onSuccess: async (_data, variables) => {
      idempotency.release(JSON.stringify([
        variables.launch.id,
        variables.launch.updated_at,
        variables.reason.trim(),
      ]));
      await invalidate();
    },
  });
}
