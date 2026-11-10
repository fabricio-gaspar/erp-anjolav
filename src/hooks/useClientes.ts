import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import type { ClientDuplicateCandidate, ClientIdentityDraft } from "@/lib/clientIdentity";
import type { ClientAddressDraft, ClientAddressType } from "@/lib/clientAddress";
import type { ClientPriceMode } from "@/lib/clientPricing";

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
  tabela_preco_tipo: ClientPriceMode;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnderecoCliente {
  id: string;
  cliente_id: string;
  tipo: ClientAddressType;
  nome: string | null;
  principal: boolean;
  ativo: boolean;
  instrucoes: string | null;
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
  dia_fechamento: number | null;
  condicao_pagamento: string | null;
  cnpj_emissor_id: string | null;
  descricao_nf_id: string | null;
  listar_itens_detalhados: boolean | null;
  observacao_faturamento: string | null;
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
  tipo_relatorio: string | null;
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<Cliente, "id" | "created_at" | "updated_at" | "tabela_preco_tipo"> & {
  tabela_preco_tipo?: Cliente["tabela_preco_tipo"];
};
export type ClienteUpdate = Partial<ClienteInsert>;

function clientIdentityRpcArgs(input: ClientIdentityDraft) {
  return {
    _cliente_id: input.clientId ?? null,
    _tipo_pessoa: input.personType,
    _classificacao: input.classification,
    _cpf_cnpj: input.document || null,
    _razao_social: input.legalName,
    _nome_fantasia: input.tradeName || null,
    _email: input.email || null,
    _telefone: input.phone || null,
    _telefone2: input.secondaryPhone || null,
    _contato: input.contact || null,
    _inscricao_estadual: input.stateRegistration || null,
    _inscricao_municipal: input.municipalRegistration || null,
    _regime_tributario: input.taxRegime || null,
    _observacoes: input.notes || null,
  };
}

export function useReviewClientDuplicates() {
  const { activeTenant, session } = useAuth();
  return useMutation({
    mutationFn: async (input: ClientIdentityDraft) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para revisar duplicidades");
      }
      const { data, error } = await supabase.rpc("consultar_clientes_similares", {
        _cliente_id: input.clientId ?? null,
        _classificacao: input.classification,
        _cpf_cnpj: input.document || null,
        _email: input.email || null,
        _telefone: input.phone || null,
        _telefone2: input.secondaryPhone || null,
        _razao_social: input.legalName,
      });
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Resposta inválida ao revisar possíveis duplicidades");
      return data as unknown as ClientDuplicateCandidate[];
    },
  });
}

export function useSaveClientIdentity() {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  return useMutation({
    mutationFn: async (input: ClientIdentityDraft) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para salvar o cliente");
      }
      const { data, error } = await supabase.rpc("salvar_cliente", clientIdentityRpcArgs(input));
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor não retornou o cliente salvo");
      }
      return data as unknown as Cliente;
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["cliente", session?.user.id, activeTenant?.id, client.id] });
      queryClient.invalidateQueries({ queryKey: ["client-directory"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success("Cliente salvo com sucesso!");
    },
    onError: (error) => {
      if ((error as { code?: string }).code === "23505") {
        toast.error("CPF/CNPJ já cadastrado nesta empresa. Consulte também a outra operação antes de criar um novo cliente.");
        return;
      }
      toast.error("Erro ao salvar cliente: " + error.message);
    },
  });
}

export function useClientes({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();

  const { data: clientes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["clientes", session?.user.id, activeTenant?.id, activeArea],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar clientes");
      }
      let query = supabase
        .from("clientes")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("razao_social");
      if (activeArea !== "central") query = query.eq("classificacao", activeArea);

      const { data, error } = await query;
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const createCliente = useMutation({
    mutationFn: async (cliente: ClienteInsert) => {
      const scopedCliente = {
        ...cliente,
        classificacao: activeArea === "central" ? cliente.classificacao : activeArea,
      };
      const { data, error } = await supabase
        .from("clientes")
        .insert(scopedCliente)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["client-directory"] });
      toast.success("Cliente criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar cliente: " + error.message);
    },
  });

  const updateCliente = useMutation({
    mutationFn: async ({ id, ...updates }: ClienteUpdate & { id: string }) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      if (
        activeArea !== "central" &&
        updates.classificacao &&
        updates.classificacao !== activeArea
      ) {
        throw new Error("Não é permitido mover o cliente para outra unidade por este painel");
      }

      let query = supabase
        .from("clientes")
        .update(updates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (activeArea !== "central") query = query.eq("classificacao", activeArea);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["client-directory"] });
      toast.success("Cliente atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar cliente: " + error.message);
    },
  });

  const archiveCliente = useMutation({
    mutationFn: async (id: string) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      let query = supabase
        .from("clientes")
        .update({ ativo: false })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (activeArea !== "central") query = query.eq("classificacao", activeArea);
      const { data, error } = await query.select("id, ativo").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cliente não encontrado neste painel");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["client-directory"] });
      toast.success("Cliente arquivado. O histórico foi preservado.");
    },
    onError: (error) => {
      toast.error("Erro ao arquivar cliente: " + error.message);
    },
  });

  return {
    clientes,
    isLoading,
    isError,
    error,
    refetch,
    createCliente,
    updateCliente,
    archiveCliente,
  };
}

export function useClienteById(clienteId: string | null) {
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["cliente", session?.user.id, activeTenant?.id, clienteId, activeArea],
    queryFn: async () => {
      if (!clienteId || !session?.user.id || !activeTenant?.id) return null;
      let query = supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .filter("tenant_id", "eq", activeTenant.id);
      if (activeArea !== "central") query = query.eq("classificacao", activeArea);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as Cliente | null;
    },
    enabled: Boolean(clienteId && session?.user.id && activeTenant?.id),
  });
}

function useClientAddressesQuery(clienteId: string | null) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["endereco_cliente", session?.user.id, activeTenant?.id, clienteId],
    queryFn: async () => {
      if (!clienteId || !session?.user.id || !activeTenant?.id) return [] as EnderecoCliente[];
      const { data, error } = await supabase
        .from("enderecos_clientes")
        .select("*")
        .eq("cliente_id", clienteId)
        .filter("tenant_id", "eq", activeTenant.id)
        .order("ativo", { ascending: false })
        .order("principal", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EnderecoCliente[];
    },
    enabled: Boolean(clienteId && session?.user.id && activeTenant?.id),
  });
}

// Agenda de endereços do cliente. As mutações usam comandos de banco para
// manter a seleção principal e o arquivamento atômicos.
export function useEnderecosCliente(clienteId: string | null) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const query = useClientAddressesQuery(clienteId);

  const saveAddress = useMutation({
    mutationFn: async (address: ClientAddressDraft) => {
      if (!activeTenant?.id || !session?.user.id || !clienteId || address.clientId !== clienteId) {
        throw new Error("Sessão, empresa e cliente são obrigatórios para salvar o endereço");
      }
      const { data, error } = await supabase.rpc("salvar_endereco_cliente", {
        _endereco_id: address.id ?? null,
        _cliente_id: clienteId,
        _tipo: address.type,
        _nome: address.name || null,
        _cep: address.postalCode || null,
        _logradouro: address.street,
        _numero: address.number || null,
        _complemento: address.complement || null,
        _bairro: address.neighborhood || null,
        _cidade: address.city,
        _uf: address.state,
        _pais: address.country,
        _latitude: address.latitude,
        _longitude: address.longitude,
        _principal: address.primary,
        _instrucoes: address.instructions || null,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor não retornou o endereço salvo");
      }
      return data as unknown as EnderecoCliente;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["endereco_cliente"] });
      queryClient.invalidateQueries({ queryKey: ["enderecos_clientes_todos"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success("Endereço salvo com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar endereço: " + error.message);
    },
  });

  const archiveAddress = useMutation({
    mutationFn: async (addressId: string) => {
      if (!activeTenant?.id || !session?.user.id || !clienteId) {
        throw new Error("Sessão, empresa e cliente são obrigatórios para arquivar o endereço");
      }
      const { data, error } = await supabase.rpc("arquivar_endereco_cliente", {
        _endereco_id: addressId,
        _cliente_id: clienteId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["endereco_cliente"] });
      queryClient.invalidateQueries({ queryKey: ["enderecos_clientes_todos"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success("Endereço arquivado. Pedidos e rotas anteriores mantêm o endereço registrado.");
    },
    onError: (error) => {
      toast.error("Erro ao arquivar endereço: " + error.message);
    },
  });

  return {
    enderecos: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    saveAddress,
    archiveAddress,
  };
}

// Compatibilidade para pedidos, faturamento e logística: todos passam a usar
// explicitamente o endereço ativo principal, sem depender de maybeSingle.
export function useEnderecoCliente(clienteId: string | null) {
  const query = useClientAddressesQuery(clienteId);
  const addresses = query.data ?? [];
  const endereco = addresses.find((address) => address.ativo && address.principal)
    ?? addresses.find((address) => address.ativo)
    ?? null;
  return {
    endereco,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Configurações de Pagamento
export function useConfiguracaoPagamentoCliente(clienteId: string | null) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();

  const { data: configuracao, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["configuracao_pagamento_cliente", session?.user.id, activeTenant?.id, clienteId],
    queryFn: async () => {
      if (!clienteId || !session?.user.id || !activeTenant?.id) return null;
      const { data, error } = await supabase
        .from("configuracoes_pagamento_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .filter("tenant_id", "eq", activeTenant.id)
        .maybeSingle();
      if (error) throw error;
      return data as ConfiguracaoPagamentoCliente | null;
    },
    enabled: Boolean(clienteId && session?.user.id && activeTenant?.id),
  });

  const upsertConfiguracao = useMutation({
    mutationFn: async (configData: Omit<ConfiguracaoPagamentoCliente, "id" | "created_at" | "updated_at">) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      const { data: existing } = await supabase
        .from("configuracoes_pagamento_cliente")
        .select("id")
        .eq("cliente_id", configData.cliente_id)
        .filter("tenant_id", "eq", activeTenant.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("configuracoes_pagamento_cliente")
          .update(configData)
          .eq("id", existing.id)
          .filter("tenant_id", "eq", activeTenant.id)
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
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success("Configuração de pagamento salva!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração: " + error.message);
    },
  });

  return { configuracao, isLoading, isError, error, refetch, upsertConfiguracao };
}

// Configurações do Cliente (Acesso/Agenda)
export function useConfiguracaoCliente(clienteId: string | null) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();

  const { data: configuracao, isLoading, refetch } = useQuery({
    queryKey: ["configuracao_cliente", session?.user.id, activeTenant?.id, clienteId],
    queryFn: async () => {
      if (!clienteId || !session?.user.id || !activeTenant?.id) return null;
      const { data, error } = await supabase
        .from("configuracoes_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .filter("tenant_id", "eq", activeTenant.id)
        .maybeSingle();
      if (error) throw error;
      return data as ConfiguracaoCliente | null;
    },
    enabled: Boolean(clienteId && session?.user.id && activeTenant?.id),
    staleTime: 0, // Always refetch when clienteId changes
  });

  const upsertConfiguracao = useMutation({
    mutationFn: async (configData: Omit<ConfiguracaoCliente, "id" | "created_at" | "updated_at">) => {
      if (!activeTenant?.id) throw new Error("Empresa ativa não encontrada");
      const { data: existing } = await supabase
        .from("configuracoes_cliente")
        .select("id")
        .eq("cliente_id", configData.cliente_id)
        .filter("tenant_id", "eq", activeTenant.id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("configuracoes_cliente")
          .update(configData)
          .eq("id", existing.id)
          .filter("tenant_id", "eq", activeTenant.id)
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
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      toast.success("Configuração salva com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração: " + error.message);
    },
  });

  return { configuracao, isLoading, upsertConfiguracao, refetch };
}
