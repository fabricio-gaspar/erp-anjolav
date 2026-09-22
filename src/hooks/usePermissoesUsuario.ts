import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRoutePermissionRequirement,
  hasAnyModulePermission,
  type ModulePermissionKey,
  type RoutePermissionRequirement,
} from "@/lib/authorization";

export const usePermissoesUsuario = () => {
  const { funcionario } = useAuth();

  return useQuery({
    queryKey: ["permissoes-usuario", funcionario?.id],
    queryFn: async () => {
      if (!funcionario?.id) return null;

      const { data, error } = await supabase
        .from("modulo_permissoes")
        .select("modulo_key, tem_acesso")
        .eq("funcionario_id", funcionario.id);

      if (error) throw error;

      // Build a map of module_key -> tem_acesso
      const map: Record<string, boolean> = {};
      data?.forEach((p) => {
        map[p.modulo_key] = p.tem_acesso;
      });
      return map;
    },
    enabled: !!funcionario?.id,
  });
};

export const useIsAdmin = () => {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["authorization", "is-admin", userId],
    queryFn: async () => {
      if (!userId) return false;

      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (error) throw error;
      return data === true;
    },
    enabled: !!userId,
    retry: false,
  });
};

export interface PermissionState {
  allowed: boolean;
  isLoading: boolean;
  isError: boolean;
}

export const usePermissaoModulo = (
  requiredModules?: ModulePermissionKey | RoutePermissionRequirement,
): PermissionState => {
  const { session } = useAuth();
  const permissionsQuery = usePermissoesUsuario();
  const adminQuery = useIsAdmin();
  const modules: RoutePermissionRequirement =
    typeof requiredModules === "string"
      ? [requiredModules]
      : requiredModules ?? [];

  if (!session) {
    return { allowed: false, isLoading: false, isError: false };
  }

  if (adminQuery.isLoading || (modules.length > 0 && permissionsQuery.isLoading)) {
    return { allowed: false, isLoading: true, isError: false };
  }

  if (adminQuery.isError || (modules.length > 0 && permissionsQuery.isError)) {
    return { allowed: false, isLoading: false, isError: true };
  }

  if (adminQuery.data === true) {
    return { allowed: true, isLoading: false, isError: false };
  }

  if (modules.length === 0) {
    return { allowed: true, isLoading: false, isError: false };
  }

  return {
    allowed: hasAnyModulePermission(permissionsQuery.data, modules),
    isLoading: false,
    isError: false,
  };
};

export const usePermissaoRota = (route: string): PermissionState => {
  const requirement = getRoutePermissionRequirement(route);
  const permission = usePermissaoModulo(requirement ?? undefined);

  if (!requirement) {
    return { allowed: false, isLoading: false, isError: false };
  }

  return permission;
};

export const useTemPermissao = (route: string): boolean => {
  return usePermissaoRota(route).allowed;
};

export const useTemPermissaoModulo = (moduleKey: ModulePermissionKey): boolean => {
  return usePermissaoModulo(moduleKey).allowed;
};
