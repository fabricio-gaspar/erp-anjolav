import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PdvCapacityArea = "industrial" | "residencial";

export interface PdvCapacitySetting {
  id: string;
  area: PdvCapacityArea;
  limit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PdvCapacityForDate {
  area: PdvCapacityArea;
  date: string;
  limit: number | null;
  isOverride: boolean;
  active: boolean;
  defaultLimit: number | null;
  dailyLimit: number | null;
}

interface SavePdvCapacityInput {
  area: PdvCapacityArea;
  limit: number;
  active?: boolean;
}

function parseCapacity(value: unknown): PdvCapacitySetting | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const area = record.area;
  const limit = Number(record.limit);
  if (
    typeof record.id !== "string" ||
    (area !== "industrial" && area !== "residencial") ||
    !Number.isFinite(limit) ||
    typeof record.active !== "boolean" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) return null;
  return {
    id: record.id,
    area,
    limit,
    active: record.active,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseCapacityList(value: unknown): PdvCapacitySetting[] {
  return Array.isArray(value)
    ? value.map(parseCapacity).filter((capacity): capacity is PdvCapacitySetting => capacity !== null)
    : [];
}

function parseCapacityForDate(value: unknown): PdvCapacityForDate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if ((record.area !== "industrial" && record.area !== "residencial") || typeof record.date !== "string") return null;
  const nullableNumber = (candidate: unknown) => candidate === null || candidate === undefined ? null : Number(candidate);
  const limit = nullableNumber(record.limit);
  const defaultLimit = nullableNumber(record.defaultLimit);
  const dailyLimit = nullableNumber(record.dailyLimit);
  if ([limit, defaultLimit, dailyLimit].some((candidate) => candidate !== null && !Number.isFinite(candidate))) return null;
  return {
    area: record.area,
    date: record.date,
    limit,
    isOverride: record.isOverride === true,
    active: record.active === true,
    defaultLimit,
    dailyLimit,
  };
}

/**
 * Administrative settings are written through database commands that verify
 * the tenant administrator again. The PDV itself only consumes the protected
 * read model in usePdvCapacity.
 */
export function usePdvCapacitySettings(area: PdvCapacityArea, date: string) {
  const { activeTenant, security, session } = useAuth();
  const queryClient = useQueryClient();
  const canManage = Boolean(activeTenant && security.isAdmin);
  const queryKey = ["pdv-capacity-settings", session?.user.id, activeTenant?.id] as const;

  const query = useQuery({
    queryKey,
    enabled: canManage,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_capacidades_pdv");
      if (error) throw error;
      return parseCapacityList(data);
    },
  });

  const dailyKey = ["pdv-capacity-setting-date", session?.user.id, activeTenant?.id, area, date] as const;
  const dailyQuery = useQuery({
    queryKey: dailyKey,
    enabled: canManage && Boolean(date),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_configuracao_capacidade_pdv_data", {
        _area: area,
        _data: date,
      });
      if (error) throw error;
      const parsed = parseCapacityForDate(data);
      if (!parsed) throw new Error("Resposta de capacidade diária inválida");
      return parsed;
    },
  });

  const save = useMutation({
    mutationFn: async (input: SavePdvCapacityInput) => {
      if (!canManage) throw new Error("Somente administradores podem configurar a capacidade operacional");
      if (!Number.isInteger(input.limit) || input.limit <= 0 || input.limit > 999_999_999) {
        throw new Error("Limite de capacidade inválido");
      }
      const { data, error } = await supabase.rpc("configurar_capacidade_pdv", {
        _area: input.area,
        _limite_carga: input.limit,
        _ativo: input.active ?? true,
      });
      if (error) throw error;
      const capacity = parseCapacity(data);
      if (!capacity) throw new Error("Resposta de capacidade inválida");
      return capacity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["pdv-capacity"] });
      toast.success("Capacidade operacional salva");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a capacidade operacional");
    },
  });

  const saveDay = useMutation({
    mutationFn: async (input: SavePdvCapacityInput & { date: string }) => {
      if (!canManage) throw new Error("Somente administradores podem configurar a capacidade operacional");
      if (!input.date || !Number.isInteger(input.limit) || input.limit <= 0 || input.limit > 999_999_999) {
        throw new Error("Informe uma data válida e uma capacidade diária inteira positiva");
      }
      const { data, error } = await supabase.rpc("configurar_capacidade_pdv_data", {
        _area: input.area,
        _data: input.date,
        _limite_carga: input.limit,
        _ativo: input.active ?? true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dailyKey }),
        queryClient.invalidateQueries({ queryKey: ["pdv-capacity"] }),
      ]);
      toast.success("Capacidade da data salva");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a capacidade da data");
    },
  });

  return {
    capacities: query.data ?? [],
    dailyCapacity: dailyQuery.data ?? null,
    isLoading: query.isLoading,
    isDailyLoading: dailyQuery.isLoading,
    isError: query.isError,
    isDailyError: dailyQuery.isError,
    canManage,
    refetch: query.refetch,
    saveCapacity: save.mutateAsync,
    saveDailyCapacity: saveDay.mutateAsync,
    isSaving: save.isPending || saveDay.isPending,
  };
}
