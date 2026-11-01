import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

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
  senha?: string;
  accessProfile?: EmployeeAccessProfile;
  inviteRedirectTo?: string;
  avatar_url?: string;
}

export type EmployeeAccessProfile = "pdv_domestico" | "pdv_industrial" | "administracao";

export interface CreateFuncionarioResult {
  employee: Funcionario;
  userId: string | null;
  accessLink: string | null;
  accessProfile: EmployeeAccessProfile | null;
  tenantId: string;
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

const invalidateEmployeeQueries = (queryClient: ReturnType<typeof useQueryClient>) => Promise.all([
  queryClient.invalidateQueries({ queryKey: ["funcionarios"] }),
  queryClient.invalidateQueries({ queryKey: ["employee-directory"] }),
  queryClient.invalidateQueries({ queryKey: ["employee-directory-summary"] }),
  queryClient.invalidateQueries({ queryKey: ["motoristas"] }),
  queryClient.invalidateQueries({ queryKey: ["driver-directory"] }),
  queryClient.invalidateQueries({ queryKey: ["driver-directory-summary"] }),
]);

interface UseFuncionariosOptions {
  enabled?: boolean;
  includeInactive?: boolean;
}

// Operational employee selector; the administrative directory has its own paginated hook.
export const useFuncionarios = (options: UseFuncionariosOptions = {}) => {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: [
      "funcionarios",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      options.includeInactive === true ? "all" : "active",
    ],
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar funcionários");
      }
      let query = supabase
        .from("funcionarios")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome", { ascending: true });
      if (options.includeInactive !== true) query = query.eq("ativo", true);

      const { data, error } = await query;

      if (error) throw error;
      return data as Funcionario[];
    },
  });
};

// Get single employee
export const useFuncionario = (id: string | undefined) => {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["funcionario", session?.user.id, activeTenant?.id, activeArea, id],
    queryFn: async () => {
      if (!id || !session?.user.id || !activeTenant?.id) return null;
      
      const { data, error } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .single();

      if (error) throw error;
      return data as Funcionario;
    },
    enabled: Boolean(id && session?.user.id && activeTenant?.id),
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
          password: data.senha || null,
          accessProfile: data.accessProfile,
          inviteRedirectTo: data.inviteRedirectTo,
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

      return {
        employee: result.employee as Funcionario,
        userId: typeof result.userId === "string" ? result.userId : null,
        accessLink: typeof result.accessLink === "string" ? result.accessLink : null,
        accessProfile: result.accessProfile ?? null,
        tenantId: typeof result.tenantId === "string" ? result.tenantId : "",
      } satisfies CreateFuncionarioResult;
    },
    onSuccess: () => {
      void invalidateEmployeeQueries(queryClient);
      toast.success("Usuário vinculado e link de ativação gerado.");
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
      void invalidateEmployeeQueries(queryClient);
      toast.success("Funcionário atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar funcionário");
    },
  });
};

// Archive employee while preserving payroll and audit history
export const useArchiveFuncionario = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error: fnError } = await supabase.functions.invoke("manage-employee", {
        body: { action: "archive", employeeId: id },
      });
      if (fnError) throw new Error(traduzirErroAuth(fnError.message) || "Erro ao arquivar funcionário");
      if (result?.error) throw new Error(traduzirErroAuth(result.error));
      if (!result?.success || !result?.archived) throw new Error("O arquivamento não foi confirmado");
    },
    onSuccess: () => {
      void invalidateEmployeeQueries(queryClient);
      toast.success("Funcionário arquivado e acesso removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao arquivar funcionário");
    },
  });
};

/** @deprecated Use useArchiveFuncionario; retained for local compatibility. */
export const useDeleteFuncionario = useArchiveFuncionario;

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
      void invalidateEmployeeQueries(queryClient);
      toast.success(data.ativo ? "Funcionário ativado!" : "Funcionário desativado!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao alterar status");
    },
  });
};
