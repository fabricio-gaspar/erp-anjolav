import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HistoricoEnvio {
  id: string;
  fatura_id: string;
  canal: "email" | "whatsapp";
  destinatario: string;
  mensagem: string | null;
  documentos_enviados: string[];
  status: "enviado" | "entregue" | "erro" | "lido";
  erro_mensagem: string | null;
  usuario: string | null;
  created_at: string;
}

export interface HistoricoEnvioInsert {
  fatura_id: string;
  canal: "email" | "whatsapp";
  destinatario: string;
  mensagem?: string | null;
  documentos_enviados?: string[];
  status?: "enviado" | "entregue" | "erro" | "lido";
  erro_mensagem?: string | null;
  usuario?: string | null;
}

export function useHistoricoEnvios(faturaId: string | null) {
  const queryClient = useQueryClient();

  const { data: envios = [], isLoading, error } = useQuery({
    queryKey: ["historico_envios", faturaId],
    queryFn: async () => {
      if (!faturaId) return [];
      const { data, error } = await supabase
        .from("historico_envios")
        .select("*")
        .eq("fatura_id", faturaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as HistoricoEnvio[];
    },
    enabled: !!faturaId,
  });

  const createEnvio = useMutation({
    mutationFn: async (envio: HistoricoEnvioInsert) => {
      const { data, error } = await supabase
        .from("historico_envios")
        .insert(envio)
        .select()
        .single();
      if (error) throw error;
      return data as HistoricoEnvio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historico_envios"] });
    },
    onError: (error) => {
      toast.error("Erro ao registrar envio: " + error.message);
    },
  });

  const updateEnvioStatus = useMutation({
    mutationFn: async ({ id, status, erro_mensagem }: { id: string; status: string; erro_mensagem?: string }) => {
      const { data, error } = await supabase
        .from("historico_envios")
        .update({ status, erro_mensagem })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as HistoricoEnvio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historico_envios"] });
    },
  });

  return {
    envios,
    isLoading,
    error,
    createEnvio,
    updateEnvioStatus,
  };
}

// Hook para buscar todos os envios de múltiplas faturas
export function useHistoricoEnviosMultiple(faturaIds: string[]) {
  return useQuery({
    queryKey: ["historico_envios_multiple", faturaIds],
    queryFn: async () => {
      if (faturaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("historico_envios")
        .select("*")
        .in("fatura_id", faturaIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as HistoricoEnvio[];
    },
    enabled: faturaIds.length > 0,
  });
}
