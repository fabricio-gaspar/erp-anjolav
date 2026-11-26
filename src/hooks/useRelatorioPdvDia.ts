import { useQuery } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/usePermissoesUsuario";
import type { Caixa, CaixaMovimentacao } from "@/hooks/useCaixa";

export interface PdvDailyEvent {
  id: string;
  occurredAt: string;
  type: string;
  description: string;
  operator: string;
  source: string;
  amount: number | null;
}

export interface PdvDailyAuditEvent {
  id: string;
  occurredAt: string;
  action: string;
  entity: string;
  operator: string;
}

export interface PdvDailyReport {
  financialEvents: PdvDailyEvent[];
  auditEvents: PdvDailyAuditEvent[];
  totals: {
    sales: number;
    withdrawals: number;
    reinforcements: number;
    financialEvents: number;
  };
  auditIsAvailable: boolean;
}

interface EmployeeIdentity {
  id: string;
  user_id: string | null;
  nome: string;
}

const formatOperator = (value: string | null | undefined) => value?.trim() || "Usuário não identificado";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const entityLabel = (table: string) => ({
  caixas: "Caixa",
  caixa_movimentacoes: "Movimentação de caixa",
  ordens_servico: "ROL",
  itens_ordem_servico: "Item do ROL",
  pdv_pagamentos: "Pagamento",
}[table] ?? table);

const actionLabel = (action: string) => ({
  INSERT: "Inserção",
  UPDATE: "Edição",
  DELETE: "Exclusão",
}[action] ?? action);

export function useRelatorioPdvDia(day: Date) {
  const { activeTenant, session } = useAuth();
  const adminQuery = useIsAdmin();
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const isAdmin = adminQuery.data === true;

  return useQuery<PdvDailyReport>({
    queryKey: ["relatorio-pdv-dia", activeTenant?.id, session?.user.id, dayStart.toISOString(), isAdmin],
    enabled: Boolean(activeTenant?.id && session?.user.id && !adminQuery.isLoading),
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar o relatório");
      }

      // The report intentionally combines several legacy PDV tables whose generated
      // relationships are too deep for TypeScript's Supabase inference.
      const db = supabase as any;
      const [openedCashResult, closedCashResult, movementResult, paymentResult] = await Promise.all([
        db
          .from("caixas")
          .select("*")
          .eq("tenant_id", activeTenant.id)
          .gte("data_abertura", dayStart.toISOString())
          .lt("data_abertura", dayEnd.toISOString()),
        db
          .from("caixas")
          .select("*")
          .eq("tenant_id", activeTenant.id)
          .gte("data_fechamento", dayStart.toISOString())
          .lt("data_fechamento", dayEnd.toISOString()),
        db
          .from("caixa_movimentacoes")
          .select("*")
          .eq("tenant_id", activeTenant.id)
          .gte("created_at", dayStart.toISOString())
          .lt("created_at", dayEnd.toISOString())
          .order("created_at", { ascending: false }),
        db
          .from("pdv_pagamentos")
          .select("id, caixa_id, metodo, valor, status, criado_por, created_at")
          .eq("tenant_id", activeTenant.id)
          .gte("created_at", dayStart.toISOString())
          .lt("created_at", dayEnd.toISOString())
          .order("created_at", { ascending: false }),
      ]);

      const firstError = [openedCashResult, closedCashResult, movementResult, paymentResult].find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const cashRegisters = new Map<string, Caixa>();
      [...(openedCashResult.data ?? []), ...(closedCashResult.data ?? [])].forEach((row) => {
        cashRegisters.set(row.id, row as Caixa);
      });
      const movements = (movementResult.data ?? []) as CaixaMovimentacao[];
      const payments = (paymentResult.data ?? []) as Array<{
        id: string;
        caixa_id: string | null;
        metodo: string;
        valor: number;
        status: string;
        criado_por: string | null;
        created_at: string;
      }>;

      const actorIds = new Set<string>();
      cashRegisters.forEach((cash) => {
        if (cash.aberto_por) actorIds.add(cash.aberto_por);
        if (cash.fechado_por) actorIds.add(cash.fechado_por);
      });
      movements.forEach((movement) => movement.criado_por && actorIds.add(movement.criado_por));
      payments.forEach((payment) => payment.criado_por && actorIds.add(payment.criado_por));

      let auditRows: Array<{
        id: string;
        action: string;
        actor_id: string | null;
        entity_table: string;
        occurred_at: string;
      }> = [];
      let auditIsAvailable = false;
      if (isAdmin) {
        const auditResult = await db
          .from("audit_events")
          .select("id, action, actor_id, entity_table, occurred_at")
          .eq("tenant_id", activeTenant.id)
          .gte("occurred_at", dayStart.toISOString())
          .lt("occurred_at", dayEnd.toISOString())
          .in("entity_table", ["caixas", "caixa_movimentacoes", "ordens_servico", "itens_ordem_servico", "pdv_pagamentos"])
          .order("occurred_at", { ascending: false });
        if (!auditResult.error) {
          auditRows = auditResult.data ?? [];
          auditIsAvailable = true;
          auditRows.forEach((row) => row.actor_id && actorIds.add(row.actor_id));
        }
      }

      let employees: EmployeeIdentity[] = [];
      if (actorIds.size > 0) {
        const employeeResult = await db
          .from("funcionarios")
          .select("id, user_id, nome")
          .eq("tenant_id", activeTenant.id);
        if (!employeeResult.error) employees = (employeeResult.data ?? []) as EmployeeIdentity[];
      }
      const byEmployeeId = new Map(employees.map((employee) => [employee.id, employee.nome]));
      const byUserId = new Map(employees.filter((employee) => employee.user_id).map((employee) => [employee.user_id as string, employee.nome]));
      const userName = (userId: string | null | undefined) => formatOperator(userId ? byUserId.get(userId) : null);

      const financialEvents: PdvDailyEvent[] = [];
      cashRegisters.forEach((cash) => {
        if (cash.data_abertura >= dayStart.toISOString() && cash.data_abertura < dayEnd.toISOString()) {
          financialEvents.push({
            id: `open-${cash.id}`,
            occurredAt: cash.data_abertura,
            type: "ABERTURA",
            description: `Abertura do caixa ${cash.identificador_caixa || "principal"}`,
            operator: userName(cash.aberto_por) !== "Usuário não identificado"
              ? userName(cash.aberto_por)
              : formatOperator(cash.operador),
            source: "Caixa",
            amount: toNumber(cash.valor_abertura),
          });
        }
        if (cash.data_fechamento && cash.data_fechamento >= dayStart.toISOString() && cash.data_fechamento < dayEnd.toISOString()) {
          financialEvents.push({
            id: `close-${cash.id}`,
            occurredAt: cash.data_fechamento,
            type: "FECHAMENTO",
            description: `Fechamento do caixa ${cash.identificador_caixa || "principal"}`,
            operator: userName(cash.fechado_por) !== "Usuário não identificado"
              ? userName(cash.fechado_por)
              : formatOperator(cash.operador),
            source: "Caixa",
            amount: toNumber(cash.valor_contado),
          });
        }
      });

      movements.forEach((movement) => {
        financialEvents.push({
          id: movement.id,
          occurredAt: movement.created_at,
          type: movement.tipo,
          description: movement.descricao || "Sem descrição",
          operator: userName(movement.criado_por),
          source: "Movimentação",
          amount: toNumber(movement.valor),
        });
      });

      payments.forEach((payment) => {
        financialEvents.push({
          id: `payment-${payment.id}`,
          occurredAt: payment.created_at,
          type: "PAGAMENTO",
          description: `${payment.metodo} · ${payment.status}`,
          operator: userName(payment.criado_por),
          source: "PDV",
          amount: toNumber(payment.valor),
        });
      });

      financialEvents.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

      const auditEvents: PdvDailyAuditEvent[] = auditRows.map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        action: actionLabel(row.action),
        entity: entityLabel(row.entity_table),
        operator: userName(row.actor_id),
      }));

      return {
        financialEvents,
        auditEvents,
        auditIsAvailable,
        totals: {
          sales: movements.filter((movement) => movement.tipo === "VENDA" && movement.evento_pagamento !== "ESTORNO").reduce((sum, movement) => sum + toNumber(movement.valor), 0),
          withdrawals: movements.filter((movement) => movement.tipo === "SANGRIA").reduce((sum, movement) => sum + toNumber(movement.valor), 0),
          reinforcements: movements.filter((movement) => movement.tipo === "REFORCO").reduce((sum, movement) => sum + toNumber(movement.valor), 0),
          financialEvents: financialEvents.length,
        },
      };
    },
  });
}
