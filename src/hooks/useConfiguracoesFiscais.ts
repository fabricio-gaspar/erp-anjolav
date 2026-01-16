import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import type { Json } from "@/integrations/supabase/types";

export interface ConfiguracaoFiscal {
  id: string;
  nome: string;
  cnpj: string | null;
  razao_social: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  endereco: Json;
  aliquota_iss: number | null;
  codigo_servico: string | null;
  ambiente: "producao" | "homologacao";
  ativo: boolean;
  certificado_url: string | null;
  validade_certificado: string | null;
  urls_webservice: Json;
  series_numeracao: Json;
  csc_dados: Json;
  regime_tributario: string | null;
  // Novos campos para integração NFS-e
  codigo_municipio_ibge: string | null;
  url_api_nfse: string | null;
  senha_certificado_encrypted: string | null;
  modo_emissao: "simulacao" | "homologacao" | "producao" | null;
  created_at: string;
  updated_at: string;
}

export interface DescricaoServicoFiscal {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
}

export type ConfiguracaoFiscalInsert = Omit<ConfiguracaoFiscal, "id" | "created_at" | "updated_at"> & {
  codigo_municipio_ibge?: string | null;
  url_api_nfse?: string | null;
  senha_certificado_encrypted?: string | null;
  modo_emissao?: "simulacao" | "homologacao" | "producao" | null;
};
export type ConfiguracaoFiscalUpdate = Partial<ConfiguracaoFiscalInsert>;

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

  const configuracaoAtiva = configuracoes.find((c) => c.ativo);

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

  const setAtiva = useMutation({
    mutationFn: async (id: string) => {
      // Desativa todas
      await supabase
        .from("configuracoes_fiscais")
        .update({ ativo: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Ativa a selecionada
      const { data, error } = await supabase
        .from("configuracoes_fiscais")
        .update({ ativo: true })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] });
      toast.success("Configuração fiscal ativada!");
    },
    onError: (error) => {
      toast.error("Erro ao ativar configuração: " + error.message);
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
    setAtiva,
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
