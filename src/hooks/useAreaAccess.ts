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
      if (!area) return true;

      const { data, error } = await supabase.rpc("has_area_access", {
        _user_id: userId,
        _area: area
      });

      if (error) throw error;
      return !!data;
    },
    enabled: !!userId,
    retry: false,
  });
};
