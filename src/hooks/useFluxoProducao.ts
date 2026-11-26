import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { clientClassificationValuesForArea } from "@/lib/operations";

export interface AgendamentoPendente {
  id: string;
  cliente_id: string;
  data: string;
  horario: string | null;
  motorista_id: string | null;
  observacoes: string | null;
  status: string;
  cliente?: { razao_social: string } | null;
  motorista?: { nome: string } | null;
}

/**
 * Busca agendamentos de RETIRADA ainda não realizados (até hoje).
 * Esses entram como cards na primeira coluna do Kanban.
 */
export function useAgendamentosRetiradaPendentes() {
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["agendamentos_retirada_pendentes", session?.user.id, activeTenant?.id, activeArea],
    refetchOnMount: "always",
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar retiradas");
      }
      const hoje = format(new Date(), "yyyy-MM-dd");
      let query = supabase
        .from("agendamentos")
        .select(`
          id, cliente_id, data, horario, motorista_id, observacoes, status,
          cliente:clientes!fk_agendamentos_cliente!inner(razao_social, classificacao, tenant_id),
          motorista:motoristas(nome)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("tipo", "retirada")
        .lte("data", hoje)
        .in("status", ["agendado", "confirmado"]);

      if (activeArea === "industrial") {
        query = query.in("cliente.classificacao", clientClassificationValuesForArea("industrial"));
      } else if (activeArea === "residencial") {
        query = query.in("cliente.classificacao", clientClassificationValuesForArea("residencial"));
      }

      const { data, error } = await query
        .order("data")
        .order("horario");
      if (error) throw error;
      return (data || []) as unknown as AgendamentoPendente[];
    },
  });
}

/**
 * Confirma a retirada: cria um ROL em separação e marca o agendamento como
 * realizado na mesma transação. O RPC registra o histórico inicial.
 */
export function useConfirmarRetiradaAgendamento() {
  const { activeTenant, session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agendamento: Pick<AgendamentoPendente, "id" | "status">) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para confirmar a retirada");
      }
      const { data, error } = await supabase.rpc("confirmar_retirada_agendamento", {
        _agendamento_id: agendamento.id,
        _status_esperado: agendamento.status,
      });
      if (error) throw error;
      const result = data as { id?: string; numero?: string; idempotent?: boolean } | null;
      if (!result?.id || !result.numero) {
        throw new Error("A confirmação da retirada não retornou a ordem criada");
      }
      return { id: result.id, numero: result.numero, idempotent: result.idempotent === true };
    },
    onSuccess: (os) => {
      qc.invalidateQueries({ queryKey: ["ordens_servico"] });
      qc.invalidateQueries({ queryKey: ["order-directory"] });
      qc.invalidateQueries({ queryKey: ["historico_producao"] });
      qc.invalidateQueries({ queryKey: ["agendamentos_retirada_pendentes"] });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success(os.idempotent
        ? `Retirada já confirmada — ROL ${os.numero}`
        : `Retirada confirmada — ROL ${os.numero} enviado para separação`);
    },
    onError: (e: Error) => toast.error("Erro ao confirmar retirada: " + e.message),
  });
}
