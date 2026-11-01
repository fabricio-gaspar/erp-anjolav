import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildVehicleDirectorySearchFilter,
  getVehicleDirectoryRange,
  type VehicleDirectoryStatus,
} from "@/lib/vehicleDirectory";
import type { Veiculo } from "./useVeiculos";

interface UseVehicleDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  status: VehicleDirectoryStatus;
  type: string;
}

export interface VehicleDirectoryPage {
  veiculos: Veiculo[];
  total: number;
  page: number;
  pageSize: number;
}

export function useVehicleDirectory({
  page,
  pageSize,
  search,
  status,
  type,
}: UseVehicleDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getVehicleDirectoryRange(page, pageSize);
  const searchFilter = buildVehicleDirectorySearchFilter(search);

  return useQuery({
    queryKey: [
      "vehicle-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      searchFilter,
      status,
      type,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<VehicleDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar veículos");
      }

      let query = supabase
        .from("veiculos")
        .select("*", { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("placa")
        .order("id")
        .range(range.from, range.to);

      if (status !== "all") query = query.eq("ativo", status === "active");
      if (type !== "all") query = query.eq("tipo", type);
      if (searchFilter) query = query.or(searchFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        veiculos: (data ?? []) as Veiculo[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}

export function useVehicleDirectorySummary() {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["vehicle-directory-summary", session?.user.id, activeTenant?.id, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir veículos");
      }

      const base = () => supabase
        .from("veiculos")
        .select("id", { count: "exact", head: true })
        .filter("tenant_id", "eq", activeTenant.id);
      const [totalResult, activeResult] = await Promise.all([
        base(),
        base().eq("ativo", true),
      ]);
      const error = totalResult.error ?? activeResult.error;
      if (error) throw error;

      return {
        total: totalResult.count ?? 0,
        active: activeResult.count ?? 0,
      };
    },
  });
}
