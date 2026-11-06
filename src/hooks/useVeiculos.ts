import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  tipo: string | null;
  cor: string | null;
  ano: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type VeiculoInsert = Omit<Veiculo, "id" | "created_at" | "updated_at">;
export type VeiculoUpdate = Partial<VeiculoInsert>;

interface UseVeiculosOptions {
  enabled?: boolean;
}

export function useVeiculos(options: UseVeiculosOptions = {}) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  const invalidateVehicleQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["veiculos"] }),
    queryClient.invalidateQueries({ queryKey: ["vehicle-directory"] }),
    queryClient.invalidateQueries({ queryKey: ["vehicle-directory-summary"] }),
  ]);

  const { data: veiculos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["veiculos", session?.user.id, activeTenant?.id, activeArea, "active"],
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar veículos");
      }
      const { data, error } = await supabase
        .from("veiculos")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("ativo", true)
        .order("placa");
      if (error) throw error;
      return data as Veiculo[];
    },
  });

  const veiculosAtivos = veiculos.filter((v) => v.ativo);

  const createVeiculo = useMutation({
    mutationFn: async (veiculo: VeiculoInsert) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar veículos");
      }
      const { data, error } = await supabase
        .from("veiculos")
        .insert({ ...veiculo, tenant_id: activeTenant.id } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateVehicleQueries();
      toast.success("Veículo criado com sucesso!");
    },
    onError: (caught: Error) => {
      toast.error("Erro ao criar veículo: " + caught.message);
    },
  });

  const updateVeiculo = useMutation({
    mutationFn: async ({ id, ...updates }: VeiculoUpdate & { id: string }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar veículos");
      }
      const { data, error } = await supabase
        .from("veiculos")
        .update(updates)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateVehicleQueries();
      toast.success("Veículo atualizado com sucesso!");
    },
    onError: (caught: Error) => {
      toast.error("Erro ao atualizar veículo: " + caught.message);
    },
  });

  const setVeiculoStatus = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar veículos");
      }
      const { data, error } = await supabase
        .from("veiculos")
        .update({ ativo })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void invalidateVehicleQueries();
      toast.success(variables.ativo
        ? "Veículo reativado com sucesso!"
        : "Veículo arquivado. O histórico de rotas e pedidos foi preservado.");
    },
    onError: (caught: Error) => {
      toast.error("Erro ao alterar veículo: " + caught.message);
    },
  });

  return {
    veiculos,
    veiculosAtivos,
    isLoading,
    error,
    refetch,
    createVeiculo,
    updateVeiculo,
    setVeiculoStatus,
  };
}
