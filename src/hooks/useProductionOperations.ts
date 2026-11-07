import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { createIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface ProductionOperation {
  id: string;
  tipo: "AVANCO_UNITARIO" | "AVANCO_LOTE" | "OCORRENCIA";
  etapa_anterior: string;
  etapa_nova: string | null;
  ordens_servico_ids: string[];
  recurso: string | null;
  ocorrencia: string | null;
  nova_previsao: string | null;
  resultado: Json;
  created_at: string;
  funcionario?: { nome: string } | null;
  lote?: { numero_lote: string } | null;
}

export interface ProductionOrderCommand {
  id: string;
  dadosFormulario?: Record<string, unknown>;
  itens?: Array<{ produto_id: string; quantidade: number }>;
}

async function invalidateProduction(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
    queryClient.invalidateQueries({ queryKey: ["historico_producao"] }),
    queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] }),
    queryClient.invalidateQueries({ queryKey: ["production-operations"] }),
    queryClient.invalidateQueries({ queryKey: ["production-batches"] }),
  ]);
}

export function useProductionOperations() {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  const operations = useQuery({
    queryKey: ["production-operations", session?.user.id, activeTenant?.id, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar operações de produção");
      }
      const { data, error } = await supabase
        .from("producao_operacoes")
        .select(`
          id, tipo, etapa_anterior, etapa_nova, ordens_servico_ids,
          recurso, ocorrencia, nova_previsao, resultado, created_at,
          funcionario:funcionarios(nome),
          lote:lotes_producao(numero_lote)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as ProductionOperation[];
    },
  });

  const processQueue = useMutation({
    mutationFn: async (input: {
      orders: ProductionOrderCommand[];
      expectedStage: string;
      nextStage: string;
      employeeId?: string;
      resource?: string;
      occurrence?: string;
      newForecast?: string;
      idempotencyKey?: string;
    }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para processar a produção");
      }
      const { data, error } = await supabase.rpc("processar_fila_producao", {
        _ordens: input.orders.map((order) => ({
          id: order.id,
          dados_formulario: order.dadosFormulario ?? {},
          itens: order.itens ?? [],
        })) as unknown as Json,
        _etapa_esperada: input.expectedStage,
        _proxima_etapa: input.nextStage,
        _funcionario_id: input.employeeId || null,
        _recurso: input.resource?.trim() || null,
        _ocorrencia: input.occurrence?.trim() || null,
        _nova_previsao: input.newForecast || null,
        _idempotency_key: input.idempotencyKey ?? createIdempotencyKey("production"),
      });
      if (error) throw error;
      return data as {
        orderCount: number;
        batchId: string | null;
        batchNumber: string | null;
        idempotent: boolean;
      };
    },
    onSuccess: async (result) => {
      await invalidateProduction(queryClient);
      toast.success(
        result.batchNumber
          ? `${result.orderCount} ROLs processados no lote ${result.batchNumber}.`
          : "Etapa de produção registrada.",
      );
    },
    onError: (error: Error) => toast.error(`Produção não atualizada: ${error.message}`),
  });

  const registerOccurrence = useMutation({
    mutationFn: async (input: {
      orderIds: string[];
      expectedStage: string;
      employeeId?: string;
      occurrence: string;
      newForecast?: string;
      idempotencyKey?: string;
    }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para registrar ocorrências");
      }
      const { data, error } = await supabase.rpc("registrar_ocorrencia_producao", {
        _ordem_ids: input.orderIds,
        _etapa_esperada: input.expectedStage,
        _funcionario_id: input.employeeId || null,
        _ocorrencia: input.occurrence.trim(),
        _nova_previsao: input.newForecast || null,
        _idempotency_key: input.idempotencyKey ?? createIdempotencyKey("production-incident"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidateProduction(queryClient);
      toast.success("Ocorrência registrada na fila de produção.");
    },
    onError: (error: Error) => toast.error(`Ocorrência não registrada: ${error.message}`),
  });

  return { operations, processQueue, registerOccurrence };
}
