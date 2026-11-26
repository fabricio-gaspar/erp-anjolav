import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { PdvArea } from "@/lib/authorization";

export type PdvStoragePositionType = "cabideiro" | "balcao" | "prateleira";

export interface PdvStoragePosition {
  id: string;
  tenant_id: string;
  area: PdvArea;
  tipo: PdvStoragePositionType;
  codigo: string;
  nome_exibicao: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const normalizePosition = (value: unknown): PdvStoragePosition => {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    area: row.area === "industrial" ? "industrial" : "residencial",
    tipo: row.tipo === "cabideiro" || row.tipo === "balcao" ? row.tipo : "prateleira",
    codigo: String(row.codigo ?? ""),
    nome_exibicao: String(row.nome_exibicao ?? row.codigo ?? ""),
    ordem: Number(row.ordem ?? 0) || 0,
    ativo: row.ativo !== false,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
};

export function usePdvStoragePositions(area: PdvArea, enabled = true, includeInactive = false) {
  const { activeTenant, session } = useAuth();

  return useQuery({
    queryKey: ["pdv-storage-positions", activeTenant?.id, session?.user.id, area, includeInactive],
    enabled: enabled && Boolean(activeTenant?.id && session?.user.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_posicoes_pdv", { _area: area, _somente_ativas: !includeInactive });
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map(normalizePosition);
    },
    staleTime: 60_000,
  });
}

export interface SavePdvStoragePositionInput {
  id?: string | null;
  area: PdvArea;
  tipo: PdvStoragePositionType;
  codigo: string;
  nomeExibicao: string;
  ordem?: number;
  ativo?: boolean;
}

export function useSavePdvStoragePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SavePdvStoragePositionInput) => {
      const { data, error } = await supabase.rpc("salvar_posicao_pdv", {
        _id: input.id ?? null,
        _area: input.area,
        _tipo: input.tipo,
        _codigo: input.codigo.trim(),
        _nome_exibicao: input.nomeExibicao.trim(),
        _ordem: input.ordem ?? 0,
        _ativo: input.ativo ?? true,
      });
      if (error) throw error;
      return normalizePosition(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-storage-positions"] });
    },
  });
}

export function useDeletePdvStoragePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("excluir_posicao_pdv", { _id: id });
      if (error) throw error;
      return Boolean(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-storage-positions"] });
    },
  });
}

export function useSeedPdvStoragePositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (area: PdvArea) => {
      const { data, error } = await supabase.rpc("preencher_posicoes_padrao_pdv", { _area: area });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pdv-storage-positions"] });
    },
  });
}
