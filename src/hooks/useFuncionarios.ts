import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Traduz erros comuns de auth (HIBP, senha curta, etc.) para mensagens amigáveis
const traduzirErroAuth = (raw: string | undefined | null): string => {
  const msg = (raw || "").toString();
  if (/known to be weak|pwned|leaked|HIBP/i.test(msg)) {
    return "Esta senha é muito fraca ou já apareceu em vazamentos públicos. Escolha uma senha mais forte (combine letras maiúsculas, minúsculas, números e símbolos).";
  }
  if (/Password should be at least|password.*short|min(imum)? length|menos de 12 caracteres/i.test(msg)) {
    return "A senha é muito curta. Use no mínimo 12 caracteres.";
  }
  if (/already registered|already been registered/i.test(msg)) {
    return "Este email já está cadastrado no sistema.";
  }
  // Caso típico: 'Edge function returned 400: Error, {"error":"..."}'
  const match = msg.match(/\{"error":"([^"]+)"\}/);
  if (match) return traduzirErroAuth(match[1]);
  return msg;
};

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
  data_admissao: string | null;
  carga_horaria: number | null;
  dias_trabalhados: string[] | null;
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
  departamento?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  email?: string | null;
  login?: string;
  ativo?: boolean;
  avatar_url?: string | null;
  data_admissao?: string | null;
  carga_horaria?: number | null;
  dias_trabalhados?: string[] | null;
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
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: {
          action: "create",
          email: data.email || null,
          password: data.senha,
          nome: data.nome,
          cargo: data.cargo,
          departamento: data.departamento || null,
          telefone: data.telefone || null,
          cpf: data.cpf || null,
          login: data.login,
          avatar_url: data.avatar_url || null,
        },
      });

      if (fnError) {
        throw new Error(traduzirErroAuth(fnError.message) || "Erro ao cadastrar funcionário");
      }
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      if (!result?.employee) throw new Error("O cadastro não retornou o funcionário criado");

      return result.employee as Funcionario;
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
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: { action: "update", employeeId: id, ...updateData },
      });
      if (fnError) throw new Error(traduzirErroAuth(fnError.message) || "Erro ao atualizar funcionário");
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      if (!result?.employee) throw new Error("A atualização não retornou o funcionário");
      return result.employee as Funcionario;
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

// Archive employee while preserving payroll and audit history
export const useDeleteFuncionario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: { action: "delete", employeeId: id },
      });
      if (fnError) throw new Error(traduzirErroAuth(fnError.message) || "Erro ao arquivar funcionário");
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      if (!result?.success || !result?.archived) throw new Error("O arquivamento não foi confirmado");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      toast.success("Funcionário arquivado e acesso removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao arquivar funcionário");
    },
  });
};

// Change employee password
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: {
          action: "update-password",
          userId,
          newPassword,
        },
      });

      if (fnError) throw new Error(traduzirErroAuth(fnError.message) || "Erro ao alterar senha");
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      return result;
    },
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao alterar senha");
    },
  });
};

// Update employee auth email
export const useUpdateAuthEmail = () => {
  return useMutation({
    mutationFn: async ({ userId, newEmail }: { userId: string; newEmail: string }) => {
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: {
          action: "update-email",
          userId,
          newEmail,
        },
      });

      if (fnError) throw new Error(traduzirErroAuth(fnError.message) || "Erro ao atualizar email");
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      return result;
    },
    onSuccess: () => {
      toast.success("Email de autenticação atualizado!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar email");
    },
  });
};

// Toggle employee status
export const useToggleFuncionarioStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: { action: "set-active", employeeId: id, active: ativo },
      });
      if (fnError) throw new Error(traduzirErroAuth(fnError.message) || "Erro ao alterar status");
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      if (!result?.employee) throw new Error("A alteração de status não foi confirmada");
      return result.employee as Funcionario;
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
