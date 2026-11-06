import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface EventoAgenda {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  horario: string | null;
  tipo: string;
  cor: string | null;
  concluido: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEventoData {
  titulo: string;
  descricao?: string;
  data_evento: string;
  horario?: string;
  tipo?: string;
  cor?: string;
}

export const useEventosAgenda = (mes?: string) => {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();

  const query = useQuery({
    queryKey: ["eventos_agenda", session?.user.id, activeTenant?.id, mes],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar os eventos");
      }
      let q = supabase
        .from("eventos_agenda")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("data_evento", { ascending: true })
        .order("horario", { ascending: true });
      
      if (mes) {
        const start = `${mes}-01`;
        const [y, m] = mes.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${mes}-${String(lastDay).padStart(2, "0")}`;
        q = q.gte("data_evento", start).lte("data_evento", end);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as EventoAgenda[];
    },
    enabled: Boolean(session?.user.id && activeTenant?.id),
  });

  const createEvento = useMutation({
    mutationFn: async (data: CreateEventoData) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar o evento");
      }
      const { data: evento, error } = await supabase
        .from("eventos_agenda")
        .insert({ ...data, tenant_id: activeTenant.id })
        .select()
        .single();
      if (error) throw error;
      return evento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos_agenda"] });
      toast.success("Evento criado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvento = useMutation({
    mutationFn: async ({ id, ...data }: Partial<EventoAgenda> & { id: string }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar o evento");
      }
      const { error } = await supabase
        .from("eventos_agenda")
        .update(data)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos_agenda"] });
    },
  });

  const deleteEvento = useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para excluir o evento");
      }
      const { error } = await supabase
        .from("eventos_agenda")
        .delete()
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos_agenda"] });
      toast.success("Evento excluído!");
    },
  });

  const toggleConcluido = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para concluir o evento");
      }
      const { error } = await supabase
        .from("eventos_agenda")
        .update({ concluido })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos_agenda"] });
    },
  });

  return {
    eventos: query.data || [],
    isLoading: query.isLoading,
    createEvento,
    updateEvento,
    deleteEvento,
    toggleConcluido,
  };
};

export const useEventosHoje = () => {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["eventos_agenda", session?.user.id, activeTenant?.id, "hoje"],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar os eventos");
      }
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("data_evento", hoje)
        .eq("concluido", false)
        .order("horario", { ascending: true });
      if (error) throw error;
      return data as EventoAgenda[];
    },
    enabled: Boolean(session?.user.id && activeTenant?.id),
  });
};
