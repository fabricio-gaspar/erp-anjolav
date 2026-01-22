import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Funcionario {
  id: string;
  user_id: string | null;
  nome: string;
  cargo: string;
  departamento: string | null;
  telefone: string | null;
  cpf: string | null;
  email: string | null;
  login: string;
  ativo: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFuncionarioData {
  nome: string;
  cargo: string;
  departamento?: string;
  telefone?: string;
  cpf?: string;
  email?: string;
  login: string;
  senha: string;
  avatar_url?: string;
}

export interface UpdateFuncionarioData {
  id: string;
  nome?: string;
  cargo?: string;
  departamento?: string;
  telefone?: string;
  cpf?: string;
  email?: string;
  login?: string;
  ativo?: boolean;
  avatar_url?: string;
}

// Get all employees
export const useFuncionarios = () => {
  return useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Funcionario[];
    },
  });
};

// Get single employee
export const useFuncionario = (id: string | undefined) => {
  return useQuery({
    queryKey: ["funcionario", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Funcionario;
    },
    enabled: !!id,
  });
};

// Create employee with auth user
export const useCreateFuncionario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFuncionarioData) => {
      // Check if login already exists
      const { data: existing } = await supabase
        .from("funcionarios")
        .select("id")
        .eq("login", data.login)
        .maybeSingle();

      if (existing) {
        throw new Error("Já existe um funcionário com este login");
      }

      // Create auth user if email is provided
      let userId: string | null = null;
      
      if (data.email) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.senha,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              nome: data.nome,
              cargo: data.cargo,
            },
          },
        });

        if (authError) {
          // If user already exists, throw a clear error
          if (authError.message.includes("already registered")) {
            throw new Error(
              `O email "${data.email}" já está cadastrado no sistema. ` +
              `Use outro email ou recupere a senha do usuário existente.`
            );
          }
          throw authError;
        } else if (authData.user) {
          userId = authData.user.id;
        }
      }

      // Create employee record
      const { data: funcionario, error } = await supabase
        .from("funcionarios")
        .insert({
          user_id: userId,
          nome: data.nome,
          cargo: data.cargo,
          departamento: data.departamento || null,
          telefone: data.telefone || null,
          cpf: data.cpf || null,
          email: data.email || null,
          login: data.login,
          avatar_url: data.avatar_url || null,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      // If cargo is MOTORISTA, automatically create a motorista record
      if (data.cargo === "MOTORISTA") {
        const { error: motoristaError } = await supabase
          .from("motoristas")
          .insert({
            nome: data.nome,
            telefone: data.telefone || null,
            email: data.email || null,
            funcionario_id: funcionario.id,
            ativo: true,
          });

        if (motoristaError) {
          console.error("Erro ao criar motorista:", motoristaError);
        }
      }

      return funcionario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      queryClient.invalidateQueries({ queryKey: ["motoristas"] });
      toast.success("Funcionário cadastrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao cadastrar funcionário");
    },
  });
};

// Update employee
export const useUpdateFuncionario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateFuncionarioData) => {
      const { id, ...updateData } = data;

      // Check if login already exists (if changing login)
      if (updateData.login) {
        const { data: existing } = await supabase
          .from("funcionarios")
          .select("id")
          .eq("login", updateData.login)
          .neq("id", id)
          .maybeSingle();

        if (existing) {
          throw new Error("Já existe um funcionário com este login");
        }
      }

      const { data: funcionario, error } = await supabase
        .from("funcionarios")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return funcionario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast.success("Funcionário atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar funcionário");
    },
  });
};

// Delete employee
export const useDeleteFuncionario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("funcionarios")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast.success("Funcionário removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao remover funcionário");
    },
  });
};

// Toggle employee status
export const useToggleFuncionarioStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data: funcionario, error } = await supabase
        .from("funcionarios")
        .update({ ativo })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return funcionario;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast.success(data.ativo ? "Funcionário ativado!" : "Funcionário desativado!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao alterar status");
    },
  });
};
