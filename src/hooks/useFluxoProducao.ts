import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

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
  return useQuery({
    queryKey: ["agendamentos_retirada_pendentes", activeArea],
    refetchOnMount: "always",
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      let query = supabase
        .from("agendamentos")
        .select(`
          id, cliente_id, data, horario, motorista_id, observacoes, status,
          cliente:clientes(razao_social, classificacao),
          motorista:motoristas(nome)
        `)
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
 * realizado e registra histórico inicial.
 */
export function useConfirmarRetiradaAgendamento() {
  const { activeArea } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agendamento: AgendamentoPendente) => {
      const hoje = new Date().toISOString().split("T")[0];

      const { data: os, error: errOs } = await supabase
        .from("ordens_servico")
        .insert({
          numero: "",
          cliente_id: agendamento.cliente_id,
          motorista_id: agendamento.motorista_id,
          data_retirada: hoje,
          status: "separacao",
          prioridade: "normal",
          origem: activeArea,
          agendamento_id: agendamento.id,
          observacoes: agendamento.observacoes,
        })
        .select("id, numero")
        .single();
      if (errOs) throw errOs;

      const { data: agendaAtualizada, error: errAgenda } = await supabase
        .from("agendamentos")
        .update({ status: "realizado" })
        .eq("id", agendamento.id)
        .eq("status", agendamento.status)
        .select("id")
        .maybeSingle();
      if (errAgenda || !agendaAtualizada) {
        const { error: rollbackError } = await supabase
          .from("ordens_servico")
          .delete()
          .eq("id", os.id);
        if (rollbackError) console.error("Falha ao remover OS após conflito no agendamento");
        throw errAgenda ?? new Error("Este agendamento já foi processado por outro usuário");
      }

      const { error: errHistorico } = await supabase.from("historico_producao").insert({
        ordem_servico_id: os.id,
        etapa_anterior: null,
        etapa_nova: "separacao",
        observacoes: "Retirada confirmada via Fluxo de Produção — enviado direto para Separação",
      });
      if (errHistorico) {
        const [agendaRollback, osRollback] = await Promise.all([
          supabase
            .from("agendamentos")
            .update({ status: agendamento.status })
            .eq("id", agendamento.id)
            .eq("status", "realizado"),
          supabase.from("ordens_servico").delete().eq("id", os.id),
        ]);
        if (agendaRollback.error || osRollback.error) {
          console.error("Falha ao compensar confirmação incompleta de retirada", {
            agenda: Boolean(agendaRollback.error),
            ordem: Boolean(osRollback.error),
          });
          throw new Error("A retirada ficou inconsistente e requer revisão administrativa");
        }
        throw errHistorico;
      }

      return os;
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
