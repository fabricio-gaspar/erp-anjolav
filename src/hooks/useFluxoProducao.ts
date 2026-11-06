import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

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
        query = query.filter("cliente.classificacao", "eq", "industrial");
      } else if (activeArea === "residencial") {
        query = query.filter("cliente.classificacao", "eq", "residencial");
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
 * Confirma a retirada: cria a OS no status "retirada", marca o agendamento como
 * realizado; o histórico inicial é registrado pelo gatilho da própria OS.
 */
export function useConfirmarRetiradaAgendamento() {
  const { activeTenant, session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agendamento: AgendamentoPendente) => {
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
      qc.invalidateQueries({ queryKey: ["agendamentos_retirada_pendentes"] });
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success(`Retirada confirmada — OS ${os.numero} enviada para Separação`);
    },
    onError: (e: Error) => toast.error("Erro ao confirmar retirada: " + e.message),
  });
}
