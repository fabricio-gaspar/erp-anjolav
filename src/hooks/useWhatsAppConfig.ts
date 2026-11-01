import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createIdempotencyKey } from "@/lib/idempotency";

export interface WhatsAppInstancia {
  id: string;
  nome_instancia: string;
  api_url: string | null;
  webhook_n8n_url: string | null;
  status: string;
  qr_code: string | null;
  created_at: string;
  updated_at: string;
}

type WhatsAppConfigUpdate = Pick<
  WhatsAppInstancia,
  "nome_instancia" | "api_url" | "webhook_n8n_url"
>;

export function useWhatsAppConfig() {
  const queryClient = useQueryClient();

  const { data: instancia, isLoading } = useQuery({
    queryKey: ["whatsapp_instancia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instancias")
        .select("id, nome_instancia, api_url, webhook_n8n_url, status, qr_code, created_at, updated_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as WhatsAppInstancia | null;
    },
  });

  const salvarConfig = useMutation({
    mutationFn: async (config: WhatsAppConfigUpdate) => {
      if (instancia?.id) {
        const { error } = await supabase
          .from("whatsapp_instancias")
          .update(config)
          .eq("id", instancia.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_instancias")
          .insert(config);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_instancia"] });
      toast({ title: "Configuração salva com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const conectar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: { action: "connect" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_instancia"] });
      if (data?.qr_code) {
        toast({ title: "QR Code gerado! Escaneie com seu celular." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao conectar", description: error.message, variant: "destructive" });
    },
  });

  const verificarStatus = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_instancia"] });
      toast({
        title: data?.connected ? "WhatsApp conectado! 🟢" : "WhatsApp desconectado 🔴",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao verificar status", description: error.message, variant: "destructive" });
    },
  });

  const desconectar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp_instancia"] });
      toast({ title: "WhatsApp desconectado" });
    },
  });

  const enviarMensagem = useMutation({
    mutationFn: async (params: {
      telefone: string;
      mensagem: string;
      ordem_servico_id?: string;
      cliente_id?: string;
      evento?: string;
      idempotencyKey?: string;
    }) => {
      const { idempotencyKey, ...payload } = params;
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: {
          action: "send",
          ...payload,
          idempotency_key: idempotencyKey || createIdempotencyKey("whatsapp-manual"),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Mensagem enviada com sucesso! ✅" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar mensagem", description: error.message, variant: "destructive" });
    },
  });

  const retryDelivery = useMutation({
    mutationFn: async (deliveryId: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: { action: "retry", delivery_id: deliveryId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mensagens_log"] });
      toast({
        title: data?.success ? "Mensagem confirmada pelo provedor" : "Tentativa registrada",
        description: data?.pendingReconciliation ? "O resultado ficou incerto e exige conciliação." : undefined,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Falha ao tentar novamente", description: error.message, variant: "destructive" });
    },
  });

  const resolveDelivery = useMutation({
    mutationFn: async (params: { deliveryId: string; resolution: "CONFIRMADO_ENVIADO" | "CONFIRMADO_NAO_ENVIADO"; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: {
          action: "resolve",
          delivery_id: params.deliveryId,
          resolution: params.resolution,
          reason: params.reason,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensagens_log"] });
      toast({ title: "Resultado conciliado e registrado" });
    },
    onError: (error: Error) => {
      toast({ title: "Falha na conciliação", description: error.message, variant: "destructive" });
    },
  });

  return {
    instancia,
    isLoading,
    salvarConfig,
    conectar,
    verificarStatus,
    desconectar,
    enviarMensagem,
    retryDelivery,
    resolveDelivery,
    isConectado: instancia?.status === "conectado",
  };
}
