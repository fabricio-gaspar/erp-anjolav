import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RotaEntrega {
  id: string;
  data: string;
  motorista_id: string | null;
  veiculo_id: string | null;
  status: string;
  km_inicial: number | null;
  km_final: number | null;
  hora_saida: string | null;
  hora_retorno: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  motorista?: { id: string; nome: string } | null;
  veiculo?: { id: string; placa: string; modelo: string } | null;
  paradas?: ParadaRota[];
}

export interface ParadaRota {
  id: string;
  rota_id: string;
  ordem: number;
  tipo: "retirada" | "entrega";
  cliente_id: string | null;
  ordem_servico_id: string | null;
  agendamento_id: string | null;
  status: string;
  hora_chegada: string | null;
  hora_saida: string | null;
  assinatura_url: string | null;
  foto_comprovante_url: string | null;
  observacoes: string | null;
  motivo_nao_entrega: string | null;
  created_at: string;
  cliente?: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  ordem_servico?: { id: string; numero: string } | null;
  endereco?: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export interface RotaInsert {
  data: string;
  motorista_id?: string | null;
  veiculo_id?: string | null;
  status?: string;
  km_inicial?: number | null;
  observacoes?: string | null;
}

export interface ParadaInsert {
  rota_id: string;
  ordem: number;
  tipo: "retirada" | "entrega";
  cliente_id?: string | null;
  ordem_servico_id?: string | null;
  agendamento_id?: string | null;
  observacoes?: string | null;
}

// Hook para buscar rotas de uma data específica
export function useRotasDoDia(data: string) {
  return useQuery({
    queryKey: ["rotas_entrega", data],
    queryFn: async () => {
      const { data: rotas, error } = await supabase
        .from("rotas_entrega")
        .select(`
          *,
          motorista:motoristas(id, nome),
          veiculo:veiculos(id, placa, modelo)
        `)
        .eq("data", data)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Buscar paradas de cada rota
      const rotasComParadas = await Promise.all(
        (rotas || []).map(async (rota) => {
          const { data: paradas } = await supabase
            .from("paradas_rota")
            .select(`
              *,
              cliente:clientes(id, razao_social, nome_fantasia),
              ordem_servico:ordens_servico(id, numero)
            `)
            .eq("rota_id", rota.id)
            .order("ordem", { ascending: true });

          return { ...rota, paradas: paradas || [] };
        })
      );

      return rotasComParadas as RotaEntrega[];
    },
    enabled: !!data,
  });
}

// Hook para buscar rota ativa do motorista
export function useRotaAtiva(motoristaId: string | null) {
  return useQuery({
    queryKey: ["rota_ativa", motoristaId],
    queryFn: async () => {
      if (!motoristaId) return null;

      const { data, error } = await supabase
        .from("rotas_entrega")
        .select(`
          *,
          motorista:motoristas(id, nome),
          veiculo:veiculos(id, placa, modelo)
        `)
        .eq("motorista_id", motoristaId)
        .eq("status", "em_rota")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (!data) return null;

      // Buscar paradas
      const { data: paradas } = await supabase
        .from("paradas_rota")
        .select(`
          *,
          cliente:clientes(id, razao_social, nome_fantasia),
          ordem_servico:ordens_servico(id, numero)
        `)
        .eq("rota_id", data.id)
        .order("ordem", { ascending: true });

      // Buscar endereços dos clientes
      const paradasComEnderecos = await Promise.all(
        (paradas || []).map(async (parada) => {
          if (!parada.cliente_id) return parada;
          
          const { data: endereco } = await supabase
            .from("enderecos_clientes")
            .select("logradouro, numero, bairro, cidade, latitude, longitude")
            .eq("cliente_id", parada.cliente_id)
            .single();

          return { ...parada, endereco: endereco || null };
        })
      );

      return { ...data, paradas: paradasComEnderecos } as RotaEntrega;
    },
    enabled: !!motoristaId,
  });
}

// Hook para buscar uma rota específica
export function useRota(rotaId: string | null) {
  return useQuery({
    queryKey: ["rota_entrega", rotaId],
    queryFn: async () => {
      if (!rotaId) return null;

      const { data: rota, error } = await supabase
        .from("rotas_entrega")
        .select(`
          *,
          motorista:motoristas(id, nome),
          veiculo:veiculos(id, placa, modelo)
        `)
        .eq("id", rotaId)
        .single();

      if (error) throw error;

      // Buscar paradas
      const { data: paradas } = await supabase
        .from("paradas_rota")
        .select(`
          *,
          cliente:clientes(id, razao_social, nome_fantasia),
          ordem_servico:ordens_servico(id, numero)
        `)
        .eq("rota_id", rotaId)
        .order("ordem", { ascending: true });

      // Buscar endereços
      const paradasComEnderecos = await Promise.all(
        (paradas || []).map(async (parada) => {
          if (!parada.cliente_id) return parada;
          
          const { data: endereco } = await supabase
            .from("enderecos_clientes")
            .select("logradouro, numero, bairro, cidade, latitude, longitude")
            .eq("cliente_id", parada.cliente_id)
            .single();

          return { ...parada, endereco: endereco || null };
        })
      );

      return { ...rota, paradas: paradasComEnderecos } as RotaEntrega;
    },
    enabled: !!rotaId,
  });
}

// Mutations
export function useRotasEntregaMutations() {
  const queryClient = useQueryClient();

  const createRota = useMutation({
    mutationFn: async (rota: RotaInsert) => {
      const { data, error } = await supabase
        .from("rotas_entrega")
        .insert(rota)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      toast.success("Rota criada com sucesso!");
      return data;
    },
    onError: (error) => {
      toast.error("Erro ao criar rota: " + error.message);
    },
  });

  const updateRota = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RotaEntrega> & { id: string }) => {
      const { data, error } = await supabase
        .from("rotas_entrega")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] });
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar rota: " + error.message);
    },
  });

  const deleteRota = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rotas_entrega")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      toast.success("Rota excluída com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir rota: " + error.message);
    },
  });

  const addParada = useMutation({
    mutationFn: async (parada: ParadaInsert) => {
      const { data, error } = await supabase
        .from("paradas_rota")
        .insert(parada)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] });
    },
    onError: (error) => {
      toast.error("Erro ao adicionar parada: " + error.message);
    },
  });

  const updateParada = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ParadaRota> & { id: string }) => {
      const { data, error } = await supabase
        .from("paradas_rota")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar parada: " + error.message);
    },
  });

  const removeParada = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("paradas_rota")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] });
    },
    onError: (error) => {
      toast.error("Erro ao remover parada: " + error.message);
    },
  });

  // Ações de rota
  const iniciarRota = useMutation({
    mutationFn: async ({ rotaId, kmInicial }: { rotaId: string; kmInicial: number }) => {
      const { data, error } = await supabase
        .from("rotas_entrega")
        .update({
          status: "em_rota",
          km_inicial: kmInicial,
          hora_saida: new Date().toISOString(),
        })
        .eq("id", rotaId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] });
      toast.success("Rota iniciada! Boa viagem!");
    },
    onError: (error) => {
      toast.error("Erro ao iniciar rota: " + error.message);
    },
  });

  const finalizarRota = useMutation({
    mutationFn: async ({ rotaId, kmFinal }: { rotaId: string; kmFinal: number }) => {
      const { data, error } = await supabase
        .from("rotas_entrega")
        .update({
          status: "concluida",
          km_final: kmFinal,
          hora_retorno: new Date().toISOString(),
        })
        .eq("id", rotaId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] });
      toast.success("Rota finalizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao finalizar rota: " + error.message);
    },
  });

  const registrarChegada = useMutation({
    mutationFn: async (paradaId: string) => {
      const { data, error } = await supabase
        .from("paradas_rota")
        .update({
          hora_chegada: new Date().toISOString(),
        })
        .eq("id", paradaId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] });
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] });
    },
  });

  const registrarEntrega = useMutation({
    mutationFn: async ({ 
      paradaId, 
      status, 
      motivoNaoEntrega,
      fotoUrl,
      assinaturaUrl,
    }: { 
      paradaId: string; 
      status: "realizada" | "nao_entregue";
      motivoNaoEntrega?: string;
      fotoUrl?: string;
      assinaturaUrl?: string;
    }) => {
      const { data, error } = await supabase
        .from("paradas_rota")
        .update({
          status,
          hora_saida: new Date().toISOString(),
          motivo_nao_entrega: motivoNaoEntrega || null,
          foto_comprovante_url: fotoUrl || null,
          assinatura_url: assinaturaUrl || null,
        })
        .eq("id", paradaId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] });
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] });
      if (variables.status === "realizada") {
        toast.success("Entrega registrada!");
      } else {
        toast.warning("Não entregue registrado");
      }
    },
    onError: (error) => {
      toast.error("Erro ao registrar: " + error.message);
    },
  });

  return {
    createRota,
    updateRota,
    deleteRota,
    addParada,
    updateParada,
    removeParada,
    iniciarRota,
    finalizarRota,
    registrarChegada,
    registrarEntrega,
  };
}

// Hook combinado para facilitar uso
export function useRotasEntrega() {
  const mutations = useRotasEntregaMutations();
  
  return {
    ...mutations,
    useRotasDoDia,
    useRotaAtiva,
    useRota,
  };
}
