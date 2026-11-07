import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface SavePdvQuoteInput {
  clientId: string;
  items: Json[];
  notes?: string | null;
  total: number;
  validUntil: string;
}

export function useSavePdvQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, items, notes, total, validUntil }: SavePdvQuoteInput) => {
      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          cliente_id: clientId,
          itens_snapshot: items,
          observacoes: notes?.trim() || null,
          status: "aberto",
          validade: validUntil,
          valor_total: total,
        })
        .select("id, status, valor_total, validade")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    },
  });
}
