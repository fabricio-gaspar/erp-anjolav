import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { Database } from "@/integrations/supabase/types";

type FiscalRow = Database["public"]["Tables"]["configuracoes_fiscais"]["Row"];

export type ConfiguracaoFiscal = FiscalRow & {
  ambiente: "producao" | "homologacao";
  modo_emissao: "simulacao" | "homologacao" | "producao" | null;
  credencial_status: "nao_configurada" | "configurada" | "homologada" | "expirada" | "erro";
};

export interface DescricaoServicoFiscal {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
}

export type ConfiguracaoFiscalInsert = Database["public"]["Tables"]["configuracoes_fiscais"]["Insert"];
export type ConfiguracaoFiscalUpdate = Database["public"]["Tables"]["configuracoes_fiscais"]["Update"];

export type ConfiguracaoFiscalOperacional = Pick<
  ConfiguracaoFiscal,
  | "id"
  | "nome"
  | "cnpj"
  | "razao_social"
  | "inscricao_municipal"
  | "inscricao_estadual"
  | "endereco"
  | "aliquota_iss"
  | "codigo_servico"
  | "ambiente"
  | "ativo"
  | "validade_certificado"
  | "regime_tributario"
  | "codigo_municipio_ibge"
  | "modo_emissao"
  | "operation_type"
  | "provedor_nfse"
  | "credencial_status"
  | "homologado_em"
  | "emitir_automaticamente"
  | "created_at"
  | "updated_at"
>;

export function useConfiguracoesFiscaisOperacionais() {
  const { data: configuracoes = [], isLoading, error } = useQuery({
    queryKey: ["configuracoes_fiscais", "operacional"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_fiscal_configs_for_operations");
      if (error) throw error;
      return Array.isArray(data) ? data as unknown as ConfiguracaoFiscalOperacional[] : [];
    },
  });

  const activeConfigurations = configuracoes.filter((config) => config.ativo);

  return {
    configuracoes,
    configuracaoAtiva: activeConfigurations.length === 1 ? activeConfigurations[0] : undefined,
    isLoading,
    error,
  };
}

export function useConfiguracoesFiscais() {
  const queryClient = useQueryClient();

  const { data: configuracoes = [], isLoading, error } = useQuery({
    queryKey: ["configuracoes_fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_fiscais")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as ConfiguracaoFiscal[];
    },
  });

  const activeConfigurations = configuracoes.filter((config) => config.ativo);
  const configuracaoAtiva = activeConfigurations.length === 1 ? activeConfigurations[0] : undefined;

  const createConfiguracao = useMutation({
    mutationFn: async (config: ConfiguracaoFiscalInsert) => {
      const { data, error } = await supabase
        .from("configuracoes_fiscais")
        .insert(config)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] });
      toast.success("Configuração fiscal criada!");
    },
    onError: (error) => {
      toast.error("Erro ao criar configuração: " + error.message);
    },
  });

  const updateConfiguracao = useMutation({
    mutationFn: async ({ id, ...updates }: ConfiguracaoFiscalUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("configuracoes_fiscais")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] });
      toast.success("Configuração fiscal atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar configuração: " + error.message);
    },
  });

  const deleteConfiguracao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("configuracoes_fiscais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] });
      toast.success("Configuração fiscal excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir configuração: " + error.message);
    },
  });

  return {
    configuracoes,
    configuracaoAtiva,
    isLoading,
    error,
    createConfiguracao,
    updateConfiguracao,
    deleteConfiguracao,
  };
}

// Descrições de Serviços
export function useDescricoesServicosFiscais() {
  const queryClient = useQueryClient();

  const { data: descricoes = [], isLoading } = useQuery({
    queryKey: ["descricoes_servicos_fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("descricoes_servicos_fiscais")
        .select("*")
        .order("descricao");
      if (error) throw error;
      return data as DescricaoServicoFiscal[];
    },
  });

  const addDescricao = useMutation({
    mutationFn: async (descricao: string) => {
      const { data, error } = await supabase
        .from("descricoes_servicos_fiscais")
        .insert({ descricao })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["descricoes_servicos_fiscais"] });
      toast.success("Descrição adicionada!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar descrição: " + error.message);
    },
  });

  const updateDescricao = useMutation({
    mutationFn: async ({ id, descricao }: { id: string; descricao: string }) => {
      const { data, error } = await supabase
        .from("descricoes_servicos_fiscais")
        .update({ descricao })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["descricoes_servicos_fiscais"] });
      toast.success("Descrição atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar descrição: " + error.message);
    },
  });

  const deleteDescricao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("descricoes_servicos_fiscais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["descricoes_servicos_fiscais"] });
      toast.success("Descrição removida!");
    },
    onError: (error) => {
      toast.error("Erro ao remover descrição: " + error.message);
    },
  });

  return { descricoes, isLoading, addDescricao, updateDescricao, deleteDescricao };
}
