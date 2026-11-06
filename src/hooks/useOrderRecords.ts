import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  createOrderAttachmentPath,
  removeOrphanOrderAttachment,
  sanitizeOrderAttachmentFileName,
  uploadOrderAttachment,
  type OrderAttachmentCategory,
} from "@/lib/orderAttachments";
import { invalidateDashboardQueriesAfterProductionAdvance } from "@/lib/queryDefaults";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

export interface OrderAttachment {
  id: string;
  tenant_id: string;
  ordem_servico_id: string;
  categoria: OrderAttachmentCategory;
  nome_arquivo: string;
  descricao: string | null;
  object_path: string;
  content_type: string;
  size_bytes: number;
  criado_por: string;
  created_at: string;
}

export function useOrderRecords(orderId: string | null) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const attachments = useQuery({
    queryKey: ["order-attachments", session?.user.id, activeTenant?.id, orderId, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id && orderId),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id || !orderId) return [];
      let query = supabase
        .from("ordem_anexos")
        .select(`
          id, tenant_id, ordem_servico_id, categoria, nome_arquivo,
          descricao, object_path, content_type, size_bytes, criado_por, created_at,
          ordem:ordens_servico!ordem_anexos_ordem_servico_id_fkey!inner(origem, tenant_id)
        `)
        .eq("ordem_servico_id", orderId)
        .eq("tenant_id", activeTenant.id)
        .eq("ordem.tenant_id", activeTenant.id)
        .order("created_at", { ascending: false });
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as OrderAttachment[];
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: async (input: {
      file: File;
      category: OrderAttachmentCategory;
      description?: string;
      objectPath: string;
    }) => {
      if (!session?.user.id || !activeTenant?.id || !orderId) {
        throw new Error("Uma sessão autenticada, uma empresa ativa e um pedido são obrigatórios");
      }
      const objectPath = await uploadOrderAttachment({
        tenantId: activeTenant.id,
        orderId,
        category: input.category,
        file: input.file,
        objectPath: input.objectPath,
      });
      const { data, error } = await supabase.rpc("registrar_anexo_ordem", {
        _ordem_servico_id: orderId,
        _categoria: input.category,
        _nome_arquivo: sanitizeOrderAttachmentFileName(input.file.name),
        _descricao: input.description?.trim() || null,
        _object_path: objectPath,
      });
      if (error) {
        await removeOrphanOrderAttachment(objectPath).catch(() => undefined);
        throw error;
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["order-attachments"] });
      toast.success("Anexo registrado no pedido.");
    },
    onError: (error: Error) => toast.error(`Anexo não registrado: ${error.message}`),
  });

  const prepareAttachmentPath = (input: {
    file: File;
    category: OrderAttachmentCategory;
  }) => {
    if (!activeTenant?.id || !orderId) {
      throw new Error("Uma empresa ativa e um pedido são obrigatórios");
    }
    return createOrderAttachmentPath({
      tenantId: activeTenant.id,
      orderId,
      category: input.category,
      file: input.file,
    });
  };

  const registerOccurrence = useMutation({
    mutationFn: async (input: {
      expectedStage: string;
      occurrence: string;
      newForecast?: string;
      idempotencyKey?: string;
    }) => {
      if (!session?.user.id || !activeTenant?.id || !orderId) {
        throw new Error("Uma sessão autenticada, uma empresa ativa e um pedido são obrigatórios");
      }
      const { data, error } = await supabase.rpc("registrar_ocorrencia_producao", {
        _ordem_ids: [orderId],
        _etapa_esperada: input.expectedStage,
        _funcionario_id: null,
        _ocorrencia: input.occurrence.trim(),
        _nova_previsao: input.newForecast || null,
        _idempotency_key: input.idempotencyKey ?? createIdempotencyKey("order-incident"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["historico_producao"] }),
        queryClient.invalidateQueries({ queryKey: ["ordem_servico"] }),
        queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
        queryClient.invalidateQueries({ queryKey: ["order-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["production-operations"] }),
      ]);
      void invalidateDashboardQueriesAfterProductionAdvance(queryClient);
      toast.success("Ocorrência registrada no histórico do pedido.");
    },
    onError: (error: Error) => toast.error(`Ocorrência não registrada: ${error.message}`),
  });

  return { attachments, uploadAttachment, registerOccurrence, prepareAttachmentPath };
}
