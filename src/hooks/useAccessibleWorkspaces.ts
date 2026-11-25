import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  WORKSPACE_AREAS,
  type AccessibleWorkspaceMap,
} from "@/lib/appRoutes";

const NO_ACCESSIBLE_WORKSPACES: Readonly<AccessibleWorkspaceMap> = {
  central: false,
  industrial: false,
  residencial: false,
};

export function useAccessibleWorkspaces() {
  const { session, activeTenant } = useAuth();
  const userId = session?.user.id;
  const enabled = Boolean(userId && activeTenant?.id);

  const query = useQuery<AccessibleWorkspaceMap>({
    queryKey: ["accessible-workspaces", userId, activeTenant?.id],
    enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!userId || !activeTenant?.id) return NO_ACCESSIBLE_WORKSPACES;

      const accessChecks = await Promise.all(
        WORKSPACE_AREAS.map(async (area) => {
          const { data, error } = await supabase.rpc("has_area_access", {
            _user_id: userId,
            _area: area,
          });
          if (error) throw error;
          return [area, data === true] as const;
        }),
      );

      return Object.fromEntries(accessChecks) as AccessibleWorkspaceMap;
    },
  });

  const areas = query.data ?? NO_ACCESSIBLE_WORKSPACES;

  return {
    ...query,
    areas,
  };
}
