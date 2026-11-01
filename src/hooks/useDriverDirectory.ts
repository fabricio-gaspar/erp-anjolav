import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDriverDirectorySearchFilter,
  getDriverDirectoryRange,
  getDriverLicenseWindow,
  type DriverDirectoryStatus,
  type DriverLicenseStatus,
} from "@/lib/driverDirectory";
import type { Motorista } from "./useMotoristas";

interface UseDriverDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  status: DriverDirectoryStatus;
  licenseStatus: DriverLicenseStatus;
}

export interface DriverDirectoryPage {
  motoristas: Motorista[];
  total: number;
  page: number;
  pageSize: number;
}

export function useDriverDirectory({
  page,
  pageSize,
  search,
  status,
  licenseStatus,
}: UseDriverDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getDriverDirectoryRange(page, pageSize);
  const searchFilter = buildDriverDirectorySearchFilter(search);
  const licenseWindow = getDriverLicenseWindow();

  return useQuery({
    queryKey: [
      "driver-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      searchFilter,
      status,
      licenseStatus,
      licenseWindow?.today,
      licenseWindow?.warningEnd,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id && licenseWindow),
    queryFn: async (): Promise<DriverDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id || !licenseWindow) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar motoristas");
      }

      let query = supabase
        .from("motoristas")
        .select("*", { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome")
        .order("id")
        .range(range.from, range.to);

      if (status !== "all") query = query.eq("ativo", status === "active");
      if (licenseStatus === "missing") {
        query = query.is("cnh_validade", null);
      } else if (licenseStatus === "expired") {
        query = query.lt("cnh_validade", licenseWindow.today);
      } else if (licenseStatus === "warning") {
        query = query.gte("cnh_validade", licenseWindow.today).lte("cnh_validade", licenseWindow.warningEnd);
      } else if (licenseStatus === "valid") {
        query = query.gt("cnh_validade", licenseWindow.warningEnd);
      }
      if (searchFilter) query = query.or(searchFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        motoristas: (data ?? []) as Motorista[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}

export function useDriverDirectorySummary() {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const licenseWindow = getDriverLicenseWindow();

  return useQuery({
    queryKey: [
      "driver-directory-summary",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      licenseWindow?.today,
      licenseWindow?.warningEnd,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id && licenseWindow),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id || !licenseWindow) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir motoristas");
      }

      const base = () => supabase
        .from("motoristas")
        .select("id", { count: "exact", head: true })
        .filter("tenant_id", "eq", activeTenant.id);
      const [totalResult, activeResult, attentionResult] = await Promise.all([
        base(),
        base().eq("ativo", true),
        base().not("cnh_validade", "is", null).lte("cnh_validade", licenseWindow.warningEnd),
      ]);
      const error = totalResult.error ?? activeResult.error ?? attentionResult.error;
      if (error) throw error;

      return {
        total: totalResult.count ?? 0,
        active: activeResult.count ?? 0,
        licenseAttention: attentionResult.count ?? 0,
      };
    },
  });
}
