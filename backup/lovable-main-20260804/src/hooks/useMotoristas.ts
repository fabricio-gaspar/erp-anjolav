import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useMotoristas() {
  const queryClient = useQueryClient();

  const { data: motoristas = [], isLoading, error } = useQuery({
    queryKey: ["motoristas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motoristas")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Motorista[];
    },
  });

  const motoristasAtivos = motoristas.filter((m) => m.ativo);

  const createMotorista = useMutation({
    mutationFn: async (motorista: MotoristaInsert) => {
      const { data, error } = await supabase
        .from("motoristas")
        .insert(motorista)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      toast.success("Motorista criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar motorista: " + error.message);
    },
  });

  const updateMotorista = useMutation({
    mutationFn: async ({ id, ...updates }: MotoristaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("motoristas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      toast.success("Motorista atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar motorista: " + error.message);
    },
  });

  const deleteMotorista = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("motoristas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      toast.success("Motorista excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir motorista: " + error.message);
    },
  });

  return {
    motoristas,
    motoristasAtivos,
    isLoading,
    error,
    createMotorista,
    updateMotorista,
    deleteMotorista,
  };
}
