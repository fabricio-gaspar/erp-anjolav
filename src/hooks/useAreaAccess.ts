import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAreaAccess = (area?: string) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["area-access", userId, area],
    queryFn: async () => {
      if (!userId) return false;
      
      // If no area specified, return all areas user has access to
      if (!area) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        
        const isAdmin = roles?.some(r => r.role === "admin");
        if (isAdmin) return ["central", "industrial", "residencial"];

        const { data: areaPerms } = await supabase
          .from("area_permissoes")
          .select("area")
          .eq("user_id", userId);
        
        return areaPerms?.map(p => p.area) || [];
      }

      const { data } = await supabase.rpc("has_area_access", {
        _user_id: userId,
        _area: area
      });
      return !!data;
    },
    enabled: !!userId,
  });
};
