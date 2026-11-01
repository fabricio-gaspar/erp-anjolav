import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface Motorista {
  id: string;
  nome: string;
  cnh: string | null;
  cnh_validade: string | null;
  telefone: string | null;
  email: string | null;
  funcionario_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type MotoristaInsert = Omit<Motorista, "id" | "created_at" | "updated_at">;
export type MotoristaUpdate = Partial<MotoristaInsert>;

interface UseMotoristasOptions {
  enabled?: boolean;
}

export function useMotoristas(options: UseMotoristasOptions = {}) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  const invalidateDriverQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["motoristas"] }),
    queryClient.invalidateQueries({ queryKey: ["driver-directory"] }),
    queryClient.invalidateQueries({ queryKey: ["driver-directory-summary"] }),
  ]);

  const { data: motoristas = [], isLoading, error, refetch } = useQuery({
    queryKey: ["motoristas", session?.user.id, activeTenant?.id, activeArea, "active"],
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar motoristas");
      }
      const { data, error } = await supabase
        .from("motoristas")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Motorista[];
    },
  });

  const motoristasAtivos = motoristas.filter((m) => m.ativo);

  const createMotorista = useMutation({
    mutationFn: async (motorista: MotoristaInsert) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar motoristas");
      }
      const { data, error } = await supabase
        .from("motoristas")
        .insert({ ...motorista, tenant_id: activeTenant.id } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateDriverQueries();
      toast.success("Motorista criado com sucesso!");
    },
    onError: (caught: Error) => {
      toast.error("Erro ao criar motorista: " + caught.message);
    },
  });

  const updateMotorista = useMutation({
    mutationFn: async ({ id, ...updates }: MotoristaUpdate & { id: string }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar motoristas");
      }
      const { data, error } = await supabase
        .from("motoristas")
        .update(updates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateDriverQueries();
      toast.success("Motorista atualizado com sucesso!");
    },
    onError: (caught: Error) => {
      toast.error("Erro ao atualizar motorista: " + caught.message);
    },
  });

  const setMotoristaStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar motoristas");
      }
      const { data, error } = await supabase
        .from("motoristas")
        .update({ ativo })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void invalidateDriverQueries();
      toast.success(variables.ativo
        ? "Motorista reativado com sucesso!"
        : "Motorista arquivado. O histórico de rotas e pedidos foi preservado.");
    },
    onError: (caught: Error) => {
      toast.error("Erro ao alterar motorista: " + caught.message);
    },
  });

  return {
    motoristas,
    motoristasAtivos,
    isLoading,
    error,
    refetch,
    createMotorista,
    updateMotorista,
    setMotoristaStatus,
  };
}
