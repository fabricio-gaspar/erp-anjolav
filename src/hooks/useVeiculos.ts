import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useVeiculos() {
  const queryClient = useQueryClient();

  const { data: veiculos = [], isLoading, error } = useQuery({
    queryKey: ["veiculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("*")
        .order("placa");
      if (error) throw error;
      return data as Veiculo[];
    },
  });

  const veiculosAtivos = veiculos.filter((v) => v.ativo);

  const createVeiculo = useMutation({
    mutationFn: async (veiculo: VeiculoInsert) => {
      const { data, error } = await supabase
        .from("veiculos")
        .insert(veiculo)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      toast.success("Veículo criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar veículo: " + error.message);
    },
  });

  const updateVeiculo = useMutation({
    mutationFn: async ({ id, ...updates }: VeiculoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("veiculos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      toast.success("Veículo atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar veículo: " + error.message);
    },
  });

  const deleteVeiculo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("veiculos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["veiculos"] });
      toast.success("Veículo excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir veículo: " + error.message);
    },
  });

  return {
    veiculos,
    veiculosAtivos,
    isLoading,
    error,
    createVeiculo,
    updateVeiculo,
    deleteVeiculo,
  };
}
