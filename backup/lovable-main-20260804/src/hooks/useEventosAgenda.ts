import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const query = useQuery({
    queryKey: ["eventos_agenda", mes],
    queryFn: async () => {
      let q = supabase.from("eventos_agenda").select("*").order("data_evento", { ascending: true }).order("horario", { ascending: true });
      
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
  });

  const createEvento = useMutation({
    mutationFn: async (data: CreateEventoData) => {
      const { data: evento, error } = await supabase
        .from("eventos_agenda")
        .insert(data)
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
      const { error } = await supabase.from("eventos_agenda").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos_agenda"] });
    },
  });

  const deleteEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eventos_agenda").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos_agenda"] });
      toast.success("Evento excluído!");
    },
  });

  const toggleConcluido = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await supabase.from("eventos_agenda").update({ concluido }).eq("id", id);
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
  return useQuery({
    queryKey: ["eventos_agenda", "hoje"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("eventos_agenda")
        .select("*")
        .eq("data_evento", hoje)
        .eq("concluido", false)
        .order("horario", { ascending: true });
      if (error) throw error;
      return data as EventoAgenda[];
    },
  });
};
