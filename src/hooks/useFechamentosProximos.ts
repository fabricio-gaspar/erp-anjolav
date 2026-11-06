import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodicidadeContrato } from "@/hooks/useContratosAluguel";

export interface ClienteFechamento {
  id: string;
  contratoId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  periodicidade: PeriodicidadeContrato;
  diaFechamento: number;
  diaVencimento: number;
  dataFechamento: string;
  diasRestantes: number;
  quantidadePendente: number;
  valorPendente: number;
}

function readClosures(data: unknown): ClienteFechamento[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object" || !("id" in item) || !("dataFechamento" in item)) return [];
    const value = item as Record<string, unknown>;
    return [{
      id: String(value.id),
      contratoId: String(value.contratoId),
      razaoSocial: String(value.razaoSocial || "Cliente industrial"),
      nomeFantasia: value.nomeFantasia ? String(value.nomeFantasia) : null,
      periodicidade: value.periodicidade as PeriodicidadeContrato,
      diaFechamento: Number(value.diaFechamento),
      diaVencimento: Number(value.diaVencimento),
      dataFechamento: String(value.dataFechamento),
      diasRestantes: Number(value.diasRestantes),
      quantidadePendente: Number(value.quantidadePendente),
      valorPendente: Number(value.valorPendente),
    }];
  });
}

export function useFechamentosProximos(diasAntecedencia = 31) {
  return useQuery({
    queryKey: ["fechamentos_proximos", diasAntecedencia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_fechamentos_industriais", {
        _dias_antecedencia: diasAntecedencia,
      });
      if (error) throw error;
      return readClosures(data);
    },
  });
}
