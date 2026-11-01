import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type PdvCapacityArea = "industrial" | "residencial";

export interface PdvCapacitySetting {
  id: string;
  area: PdvCapacityArea;
  date: string;
  limit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SavePdvCapacityInput {
  area: PdvCapacityArea;
  date: string;
  limit: number;
  active?: boolean;
}

function parseCapacity(value: unknown): PdvCapacitySetting | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const area = record.area;
  const date = record.date;
  const limit = Number(record.limit);
  if (
    typeof record.id !== "string" ||
    (area !== "industrial" && area !== "residencial") ||
    typeof date !== "string" ||
    !Number.isFinite(limit) ||
    typeof record.active !== "boolean" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) return null;
  return {
    id: record.id,
    area,
    date,
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

/**
 * Administrative settings are written through database commands that verify
 * the tenant administrator again. The PDV itself only consumes the protected
 * read model in usePdvCapacity.
 */
export function usePdvCapacitySettings() {
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

  const save = useMutation({
    mutationFn: async (input: SavePdvCapacityInput) => {
      if (!canManage) throw new Error("Somente administradores podem configurar a capacidade operacional");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Data de capacidade inválida");
      if (!Number.isFinite(input.limit) || input.limit <= 0 || input.limit > 999_999_999.999) {
        throw new Error("Limite de capacidade inválido");
      }
      const { data, error } = await supabase.rpc("configurar_capacidade_pdv", {
        _area: input.area,
        _data: input.date,
        _limite_carga: Math.round(input.limit * 1000) / 1000,
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

  return {
    capacities: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    canManage,
    refetch: query.refetch,
    saveCapacity: save.mutateAsync,
    isSaving: save.isPending,
  };
}
