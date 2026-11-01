import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { createIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export type RouteStatus = "pendente" | "em_rota" | "concluida" | "cancelada";
export type StopStatus =
  | "pendente"
  | "em_atendimento"
  | "realizada"
  | "tentativa_falha"
  | "reagendada"
  | "cancelada";
export type RouteEventType =
  | "CHEGADA"
  | "OCORRENCIA"
  | "TENTATIVA_FALHA"
  | "REAGENDAMENTO"
  | "CONCLUIDA"
  | "ENDERECO_CORRIGIDO";

export interface AddressSnapshot {
  id?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  latitude?: number;
  longitude?: number;
}

export interface RotaEntrega {
  id: string;
  tenant_id: string;
  data: string;
  motorista_id: string | null;
  veiculo_id: string | null;
  status: RouteStatus;
  km_inicial: number | null;
  km_final: number | null;
  hora_saida: string | null;
  hora_retorno: string | null;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  motorista?: { id: string; nome: string } | null;
  veiculo?: { id: string; placa: string; modelo: string } | null;
  paradas?: ParadaRota[];
}

export interface ParadaRota {
  id: string;
  tenant_id: string;
  rota_id: string;
  ordem: number;
  tipo: "retirada" | "entrega";
  cliente_id: string | null;
  ordem_servico_id: string | null;
  agendamento_id: string | null;
  status: StopStatus;
  hora_chegada: string | null;
  hora_saida: string | null;
  assinatura_url: string | null;
  foto_comprovante_url: string | null;
  observacoes: string | null;
  motivo_nao_entrega: string | null;
  tentativas: number;
  versao: number;
  janela_inicio: string | null;
  janela_fim: string | null;
  reagendada_para: string | null;
  recebedor_nome: string | null;
  recebedor_documento: string | null;
  entrega_id: string | null;
  endereco_snapshot: AddressSnapshot;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
  cliente?: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  ordem_servico?: { id: string; numero: string } | null;
}

export interface RotaOperacao {
  id: string;
  rota_id: string | null;
  parada_id: string | null;
  tipo: string;
  payload: Json;
  resultado: Json;
  endereco_anterior: Json | null;
  endereco_novo: Json | null;
  criado_por: string;
  created_at: string;
}

export interface RotaInsert {
  data: string;
  motorista_id?: string | null;
  veiculo_id?: string | null;
  km_inicial?: number | null;
  observacoes?: string | null;
  idempotencyKey?: string;
}

export interface ParadaInsert {
  rota_id: string;
  tipo: "retirada" | "entrega";
  cliente_id?: string | null;
  ordem_servico_id?: string | null;
  agendamento_id?: string | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
  observacoes?: string | null;
  idempotencyKey?: string;
}

export interface RouteEventInput {
  paradaId: string;
  expectedVersion: number;
  tipo: RouteEventType;
  motivo?: string | null;
  reagendadaPara?: string | null;
  recebedorNome?: string | null;
  recebedorDocumento?: string | null;
  fotoComprovanteUrl?: string | null;
  assinaturaUrl?: string | null;
  entregaId?: string | null;
  enderecoCorrigido?: AddressSnapshot | null;
  idempotencyKey?: string;
}

const routeSelection = `
  *,
  motorista:motoristas(id, nome),
  veiculo:veiculos(id, placa, modelo)
`;

const stopSelection = `
  *,
  cliente:clientes(id, razao_social, nome_fantasia),
  ordem_servico:ordens_servico(id, numero)
`;

async function loadStops(routeId: string, tenantId: string): Promise<ParadaRota[]> {
  const { data, error } = await supabase
    .from("paradas_rota")
    .select(stopSelection)
    .eq("rota_id", routeId)
    .filter("tenant_id", "eq", tenantId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as ParadaRota[];
}

export function useRotasDoDia(data: string) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["rotas_entrega", session?.user.id, activeTenant?.id, data],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar as rotas");
      }
      const { data: routes, error } = await supabase
        .from("rotas_entrega")
        .select(routeSelection)
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("data", data)
        .order("created_at", { ascending: true });
      if (error) throw error;

      return Promise.all(
        (routes || []).map(async (route) => ({
          ...route,
          paradas: await loadStops(route.id, activeTenant.id),
        })),
      ) as Promise<RotaEntrega[]>;
    },
    enabled: Boolean(data && session?.user.id && activeTenant?.id),
  });
}

export function useRotaAtiva(motoristaId: string | null) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["rota_ativa", session?.user.id, activeTenant?.id, motoristaId],
    queryFn: async () => {
      if (!motoristaId || !session?.user.id || !activeTenant?.id) return null;
      const { data, error } = await supabase
        .from("rotas_entrega")
        .select(routeSelection)
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("motorista_id", motoristaId)
        .eq("status", "em_rota")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ...data, paradas: await loadStops(data.id, activeTenant.id) } as unknown as RotaEntrega;
    },
    enabled: Boolean(motoristaId && session?.user.id && activeTenant?.id),
  });
}

export function useRota(rotaId: string | null) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["rota_entrega", session?.user.id, activeTenant?.id, rotaId],
    queryFn: async () => {
      if (!rotaId || !session?.user.id || !activeTenant?.id) return null;
      const { data, error } = await supabase
        .from("rotas_entrega")
        .select(routeSelection)
        .eq("id", rotaId)
        .filter("tenant_id", "eq", activeTenant.id)
        .single();
      if (error) throw error;
      return { ...data, paradas: await loadStops(rotaId, activeTenant.id) } as unknown as RotaEntrega;
    },
    enabled: Boolean(rotaId && session?.user.id && activeTenant?.id),
  });
}

export function useRotaOperacoes(rotaId: string | null) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["rota_operacoes", session?.user.id, activeTenant?.id, rotaId],
    queryFn: async () => {
      if (!rotaId || !session?.user.id || !activeTenant?.id) return [];
      const { data, error } = await supabase
        .from("rota_operacoes")
        .select("id, rota_id, parada_id, tipo, payload, resultado, endereco_anterior, endereco_novo, criado_por, created_at")
        .eq("rota_id", rotaId)
        .filter("tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RotaOperacao[];
    },
    enabled: Boolean(rotaId && session?.user.id && activeTenant?.id),
  });
}

export function useRotasEntregaMutations() {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const requireWorkspace = () => {
    if (!session?.user.id || !activeTenant?.id) {
      throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar rotas");
    }
  };
  const refreshRoutes = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rotas_entrega"] }),
      queryClient.invalidateQueries({ queryKey: ["rota_ativa"] }),
      queryClient.invalidateQueries({ queryKey: ["rota_entrega"] }),
      queryClient.invalidateQueries({ queryKey: ["rota_operacoes"] }),
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] }),
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
    ]);
  };

  const createRota = useMutation({
    mutationFn: async (route: RotaInsert) => {
      requireWorkspace();
      const { data, error } = await supabase.rpc("criar_rota_planejada", {
        _data: route.data,
        _motorista_id: route.motorista_id ?? null,
        _veiculo_id: route.veiculo_id ?? null,
        _km_inicial: route.km_inicial ?? null,
        _observacoes: route.observacoes ?? null,
        _idempotency_key: route.idempotencyKey ?? createIdempotencyKey("route-create"),
      });
      if (error) throw error;
      return data as { routeId: string; status: RouteStatus; idempotent: boolean };
    },
    onSuccess: refreshRoutes,
    onError: (error: Error) => toast.error(`Erro ao criar rota: ${error.message}`),
  });

  const addParada = useMutation({
    mutationFn: async (stop: ParadaInsert) => {
      requireWorkspace();
      const { data, error } = await supabase.rpc("adicionar_parada_planejada", {
        _rota_id: stop.rota_id,
        _tipo: stop.tipo,
        _cliente_id: stop.cliente_id ?? null,
        _ordem_servico_id: stop.ordem_servico_id ?? null,
        _agendamento_id: stop.agendamento_id ?? null,
        _janela_inicio: stop.janela_inicio ?? null,
        _janela_fim: stop.janela_fim ?? null,
        _observacoes: stop.observacoes ?? null,
        _idempotency_key: stop.idempotencyKey ?? createIdempotencyKey("route-stop"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshRoutes,
    onError: (error: Error) => toast.error(`Erro ao adicionar parada: ${error.message}`),
  });

  const reordenarParadas = useMutation({
    mutationFn: async ({ rotaId, paradaIds }: { rotaId: string; paradaIds: string[] }) => {
      requireWorkspace();
      const { data, error } = await supabase.rpc("reordenar_paradas_rota", {
        _rota_id: rotaId,
        _parada_ids: paradaIds,
        _idempotency_key: createIdempotencyKey("route-order"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshRoutes,
    onError: (error: Error) => toast.error(`Erro ao ordenar paradas: ${error.message}`),
  });

  const iniciarRota = useMutation({
    mutationFn: async ({ rotaId, kmInicial }: { rotaId: string; kmInicial: number }) => {
      requireWorkspace();
      const { data, error } = await supabase.rpc("iniciar_rota_planejada", {
        _rota_id: rotaId,
        _km_inicial: kmInicial,
        _idempotency_key: createIdempotencyKey("route-start"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await refreshRoutes();
      toast.success("Rota iniciada com registro auditável.");
    },
    onError: (error: Error) => toast.error(`Erro ao iniciar rota: ${error.message}`),
  });

  const finalizarRota = useMutation({
    mutationFn: async ({ rotaId, kmFinal }: { rotaId: string; kmFinal: number }) => {
      requireWorkspace();
      const { data, error } = await supabase.rpc("finalizar_rota_planejada", {
        _rota_id: rotaId,
        _km_final: kmFinal,
        _idempotency_key: createIdempotencyKey("route-finish"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await refreshRoutes();
      toast.success("Rota finalizada com sucesso.");
    },
    onError: (error: Error) => toast.error(`Erro ao finalizar rota: ${error.message}`),
  });

  const registrarEvento = useMutation({
    mutationFn: async (event: RouteEventInput) => {
      requireWorkspace();
      const { data, error } = await supabase.rpc("registrar_evento_parada_rota", {
        _parada_id: event.paradaId,
        _expected_version: event.expectedVersion,
        _tipo: event.tipo,
        _motivo: event.motivo ?? null,
        _reagendada_para: event.reagendadaPara ?? null,
        _recebedor_nome: event.recebedorNome ?? null,
        _recebedor_documento: event.recebedorDocumento ?? null,
        _foto_comprovante_url: event.fotoComprovanteUrl ?? null,
        _assinatura_url: event.assinaturaUrl ?? null,
        _entrega_id: event.entregaId ?? null,
        _endereco_corrigido: (event.enderecoCorrigido as Json | null | undefined) ?? null,
        _idempotency_key: event.idempotencyKey ?? createIdempotencyKey("route-event"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refreshRoutes,
    onError: (error: Error) => toast.error(`Evento não registrado: ${error.message}`),
  });

  return {
    createRota,
    addParada,
    reordenarParadas,
    iniciarRota,
    finalizarRota,
    registrarEvento,
  };
}

export function useRotasEntrega() {
  return {
    ...useRotasEntregaMutations(),
    useRotasDoDia,
    useRotaAtiva,
    useRota,
    useRotaOperacoes,
  };
}
