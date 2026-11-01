import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { ClientProfile } from "@/lib/clientProfile";

export function useClientProfile(clientId: string | null) {
  const { activeTenant, session } = useAuth();

  return useQuery({
    queryKey: ["client-profile", session?.user.id, activeTenant?.id, clientId],
    enabled: Boolean(session?.user.id && activeTenant?.id && clientId),
    retry: false,
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id || !clientId) {
        throw new Error("Sessão, empresa e cliente são obrigatórios para consultar a ficha");
      }
      const { data, error } = await supabase.rpc("consultar_ficha_cliente", {
        _cliente_id: clientId,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor retornou uma ficha de cliente inválida");
      }
      return data as unknown as ClientProfile;
    },
  });
}
