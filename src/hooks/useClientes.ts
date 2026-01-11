import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Cliente {
  id: string;
  tipo_pessoa: "cpf" | "cnpj";
  classificacao: "residencial" | "industrial";
  cpf_cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  telefone2: string | null;
  contato: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  regime_tributario: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnderecoCliente {
  id: string;
  cliente_id: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoPagamentoCliente {
  id: string;
  cliente_id: string;
  tipo_faturamento: string | null;
  forma_pagamento: string | null;
  dia_vencimento: number | null;
  condicao_pagamento: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoCliente {
  id: string;
  cliente_id: string;
  codigo_acesso: string | null;
  link_acesso: string | null;
  frequencia: string | null;
  dias_retirada: string[];
  dias_entrega: string[];
  horario_retirada: string | null;
  horario_entrega: string | null;
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<Cliente, "id" | "created_at" | "updated_at">;
export type ClienteUpdate = Partial<ClienteInsert>;

export function useClientes() {
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading, error } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const createCliente = useMutation({
    mutationFn: async (cliente: ClienteInsert) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert(cliente)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar cliente: " + error.message);
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, ...updates }: ClienteUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("clientes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar cliente: " + error.message);
    },
  });

  const deleteCliente = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir cliente: " + error.message);
    },
  });

  return {
    clientes,
    isLoading,
    error,
    createCliente,
    updateCliente,
    deleteCliente,
  };
}

export function useClienteById(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as Cliente | null;
    },
    enabled: !!clienteId,
  });
}

// Endereços
export function useEnderecoCliente(clienteId: string | null) {
  const queryClient = useQueryClient();

  const { data: endereco, isLoading } = useQuery({
    queryKey: ["endereco_cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("enderecos_clientes")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as EnderecoCliente | null;
    },
    enabled: !!clienteId,
  });

  const upsertEndereco = useMutation({
    mutationFn: async (enderecoData: Omit<EnderecoCliente, "id" | "created_at" | "updated_at">) => {
      const { data: existing } = await supabase
        .from("enderecos_clientes")
        .select("id")
        .eq("cliente_id", enderecoData.cliente_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("enderecos_clientes")
          .update(enderecoData)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("enderecos_clientes")
          .insert(enderecoData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["endereco_cliente"] });
      toast.success("Endereço salvo com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar endereço: " + error.message);
    },
  });

  return { endereco, isLoading, upsertEndereco };
}

// Configurações de Pagamento
export function useConfiguracaoPagamentoCliente(clienteId: string | null) {
  const queryClient = useQueryClient();

  const { data: configuracao, isLoading } = useQuery({
    queryKey: ["configuracao_pagamento_cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("configuracoes_pagamento_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as ConfiguracaoPagamentoCliente | null;
    },
    enabled: !!clienteId,
  });

  const upsertConfiguracao = useMutation({
    mutationFn: async (configData: Omit<ConfiguracaoPagamentoCliente, "id" | "created_at" | "updated_at">) => {
      const { data: existing } = await supabase
        .from("configuracoes_pagamento_cliente")
        .select("id")
        .eq("cliente_id", configData.cliente_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("configuracoes_pagamento_cliente")
          .update(configData)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("configuracoes_pagamento_cliente")
          .insert(configData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracao_pagamento_cliente"] });
      toast.success("Configuração de pagamento salva!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração: " + error.message);
    },
  });

  return { configuracao, isLoading, upsertConfiguracao };
}

// Configurações do Cliente (Acesso/Agenda)
export function useConfiguracaoCliente(clienteId: string | null) {
  const queryClient = useQueryClient();

  const { data: configuracao, isLoading } = useQuery({
    queryKey: ["configuracao_cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("configuracoes_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .maybeSingle();
      if (error) throw error;
      return data as ConfiguracaoCliente | null;
    },
    enabled: !!clienteId,
  });

  const upsertConfiguracao = useMutation({
    mutationFn: async (configData: Omit<ConfiguracaoCliente, "id" | "created_at" | "updated_at">) => {
      const { data: existing } = await supabase
        .from("configuracoes_cliente")
        .select("id")
        .eq("cliente_id", configData.cliente_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("configuracoes_cliente")
          .update(configData)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("configuracoes_cliente")
          .insert(configData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracao_cliente"] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração: " + error.message);
    },
  });

  return { configuracao, isLoading, upsertConfiguracao };
}
