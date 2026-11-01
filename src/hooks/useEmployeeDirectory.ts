import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildEmployeeDirectorySearchFilter,
  getEmployeeDirectoryRange,
  type EmployeeDirectoryStatus,
} from "@/lib/employeeDirectory";
import type { Funcionario } from "./useFuncionarios";

interface UseEmployeeDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  status: EmployeeDirectoryStatus;
  department: string;
}

export interface EmployeeDirectoryPage {
  funcionarios: Funcionario[];
  total: number;
  page: number;
  pageSize: number;
}

export function useEmployeeDirectory({
  page,
  pageSize,
  search,
  status,
  department,
}: UseEmployeeDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getEmployeeDirectoryRange(page, pageSize);
  const searchFilter = buildEmployeeDirectorySearchFilter(search);

  return useQuery({
    queryKey: [
      "employee-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      searchFilter,
      status,
      department,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<EmployeeDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar funcionários");
      }

      let query = supabase
        .from("funcionarios")
        .select("*", { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome")
        .order("id")
        .range(range.from, range.to);

      if (status !== "all") query = query.eq("ativo", status === "active");
      if (department !== "all") query = query.eq("departamento", department);
      if (searchFilter) query = query.or(searchFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        funcionarios: (data ?? []) as Funcionario[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}

export function useEmployeeDirectorySummary() {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["employee-directory-summary", session?.user.id, activeTenant?.id, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir funcionários");
      }

      const base = () => supabase
        .from("funcionarios")
        .select("id", { count: "exact", head: true })
        .filter("tenant_id", "eq", activeTenant.id);
      const [totalResult, activeResult] = await Promise.all([
        base(),
        base().eq("ativo", true),
      ]);
      const error = totalResult.error ?? activeResult.error;
      if (error) throw error;

      return { total: totalResult.count ?? 0, active: activeResult.count ?? 0 };
    },
  });
}
