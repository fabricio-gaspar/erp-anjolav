import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface ModulosVisiveis {
  os: boolean;
  documentos: boolean;
  agendamento: boolean;
  historico: boolean;
  financeiro: boolean;
}

export interface PortalConfig {
  id: string;
  portal_ativo: boolean;
  modulos_visiveis: ModulosVisiveis;
  texto_boas_vindas: string | null;
  cor_primaria: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export type PortalConfigUpdate = Partial<Omit<PortalConfig, "id" | "created_at" | "updated_at">>;

const defaultModulos: ModulosVisiveis = {
  os: true,
  documentos: true,
  agendamento: true,
  historico: true,
  financeiro: false,
};

function parseModulosVisiveis(json: Json | null): ModulosVisiveis {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return defaultModulos;
  }
  
  const obj = json as Record<string, unknown>;
  return {
    os: typeof obj.os === "boolean" ? obj.os : true,
    documentos: typeof obj.documentos === "boolean" ? obj.documentos : true,
    agendamento: typeof obj.agendamento === "boolean" ? obj.agendamento : true,
    historico: typeof obj.historico === "boolean" ? obj.historico : true,
    financeiro: typeof obj.financeiro === "boolean" ? obj.financeiro : false,
  };
}

export function usePortalConfig() {
  const queryClient = useQueryClient();

  const { data: portalConfig, isLoading, error } = useQuery({
    queryKey: ["portal_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_config")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        modulos_visiveis: parseModulosVisiveis(data.modulos_visiveis),
      } as PortalConfig;
    },
  });

  const updatePortalConfig = useMutation({
    mutationFn: async (updates: PortalConfigUpdate) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.portal_ativo !== undefined) updateData.portal_ativo = updates.portal_ativo;
      if (updates.texto_boas_vindas !== undefined) updateData.texto_boas_vindas = updates.texto_boas_vindas;
      if (updates.cor_primaria !== undefined) updateData.cor_primaria = updates.cor_primaria;
      if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
      if (updates.modulos_visiveis !== undefined) {
        updateData.modulos_visiveis = updates.modulos_visiveis as unknown as Json;
      }

      if (!portalConfig?.id) {
        // Criar se não existir
        const { data, error } = await supabase
          .from("portal_config")
          .insert(updateData)
          .select()
          .single();
        if (error) throw error;
        return {
          ...data,
          modulos_visiveis: parseModulosVisiveis(data.modulos_visiveis),
        } as PortalConfig;
      }

      const { data, error } = await supabase
        .from("portal_config")
        .update(updateData)
        .eq("id", portalConfig.id)
        .select()
        .single();
      if (error) throw error;
      return {
        ...data,
        modulos_visiveis: parseModulosVisiveis(data.modulos_visiveis),
      } as PortalConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal_config"] });
      toast.success("Configurações do portal atualizadas!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  return {
    portalConfig,
    isLoading,
    error,
    updatePortalConfig,
  };
}
