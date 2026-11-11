import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface MensagemLog {
  id: string;
  ordem_servico_id: string | null;
  fatura_id: string | null;
  cliente_id: string | null;
  telefone: string;
  mensagem: string;
  evento: string;
  status: "pendente" | "processando" | "enviado" | "entregue" | "lido" | "falhou" | "incerto" | "dead_letter";
  erro: string | null;
  canal: string;
  provider_message_id: string | null;
  provider_attempted_at: string | null;
  attempt_count: number;
  sent_at: string | null;
  reconciled_at: string | null;
  reconciliation_result: string | null;
  reconciliation_reason: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export function useMensagensLog(filtros?: { cliente_id?: string; ordem_servico_id?: string }) {
  const { activeTenant } = useAuth();
  return useQuery<MensagemLog[]>({
    queryKey: ["mensagens_log", activeTenant?.id, filtros],
    enabled: Boolean(activeTenant?.id),
    queryFn: async () => {
      let query = (supabase as unknown as SupabaseClient)
        .from("mensagens_log")
        .select("id, ordem_servico_id, fatura_id, cliente_id, telefone, mensagem, evento, status, erro, canal, provider_message_id, provider_attempted_at, attempt_count, sent_at, reconciled_at, reconciliation_result, reconciliation_reason, last_error_code, created_at, updated_at")
        .eq("tenant_id", activeTenant!.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filtros?.cliente_id) {
        query = query.eq("cliente_id", filtros.cliente_id);
      }
      if (filtros?.ordem_servico_id) {
        query = query.eq("ordem_servico_id", filtros.ordem_servico_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as MensagemLog[];
    },
  });
}
