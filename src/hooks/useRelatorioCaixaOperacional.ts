import { useQuery } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import { hasCompleteCashPeriod, receiptsByOrder } from "@/lib/cashReportMath";

export type CashReportPaymentGroup = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "OUTROS";

export interface CashReportGeneralRow {
  forma: CashReportPaymentGroup;
  entrada: number;
  saida: number;
  saldoApurado: number;
  saldoContado: number | null;
  diferenca: number | null;
}

export interface CashReportMovementRow {
  id: string;
  data: string;
  historico: string;
  tipo: "E" | "S";
  forma: string;
  valor: number;
  documento: string;
  tipoDocumento: string;
  usuario: string;
}

export interface CashReportOrderRow {
  id: string;
  codigo: string;
  cliente: string;
  desconto: number;
  total: number;
  adiantamento: number;
  tipoSolicitacao: string;
  sobra: number;
}

export interface CashReportReceiptRow {
  id: string;
  codigo: string;
  cliente: string;
  aberto: number;
  desconto: number;
  recebido: number;
}

export interface CashReportOperationalData {
  dateLabel: string;
  operationScoped: boolean;
  cashBalancesAvailable: boolean;
  general: CashReportGeneralRow[];
  movements: CashReportMovementRow[];
  orders: CashReportOrderRow[];
  receipts: CashReportReceiptRow[];
  totals: {
    entrada: number;
    saida: number;
    vendas: number;
    recebimentos: number;
  };
}

interface RawMovement {
  id: string;
  tipo: string | null;
  valor: number | string | null;
  descricao: string | null;
  forma_pagamento: string | null;
  evento_pagamento: string | null;
  cliente_id: string | null;
  ordem_servico_id: string | null;
  criado_por: string | null;
  responsavel_nome: string | null;
  referencia: string | null;
  ocorrido_em: string | null;
  created_at: string;
}

interface RawPayment {
  id: string;
  ordem_servico_id: string | null;
  metodo: string | null;
  valor: number | string | null;
  valor_recebido: number | string | null;
  status: string | null;
  criado_por: string | null;
  created_at: string;
}

interface RawCash {
  id: string;
  operation_type: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  valor_abertura: number | string | null;
  fechamento_resumo: Record<string, unknown> | null;
  status: string | null;
}

interface RawOrder {
  id: string;
  numero: string | null;
  cliente_id: string | null;
  valor_total: number | string | null;
  valor_desconto: number | string | null;
  valor_pago: number | string | null;
  forma_pagamento: string | null;
  condicao_pagamento: string | null;
  entrega_modalidade: string | null;
  recebimento_modalidade: string | null;
  origem: string | null;
  clientes?: { razao_social?: string | null; nome_fantasia?: string | null } | null;
}

const PAYMENT_GROUPS: CashReportPaymentGroup[] = ["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "OUTROS"];

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePaymentGroup = (value: string | null | undefined): CashReportPaymentGroup => {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "DINHEIRO") return "DINHEIRO";
  if (normalized === "PIX") return "PIX";
  if (["CARTAO_CREDITO", "CREDITO", "CREDITO_VISA", "CREDITO_MASTER"].includes(normalized)) return "CARTAO_CREDITO";
  if (["CARTAO_DEBITO", "DEBITO", "DEBITO_VISA", "DEBITO_MASTER"].includes(normalized)) return "CARTAO_DEBITO";
  return "OUTROS";
};

const paymentLabel = (value: string | null | undefined) => {
  const group = normalizePaymentGroup(value);
  return group === "CARTAO_CREDITO" ? "CARTÃO CRÉDITO"
    : group === "CARTAO_DEBITO" ? "CARTÃO DÉBITO"
      : group;
};

const getCustomerName = (order: RawOrder | undefined) => order?.clientes?.nome_fantasia?.trim()
  || order?.clientes?.razao_social?.trim()
  || "Cliente não identificado";

const getOrderRequestType = (order: RawOrder) => {
  const value = order.entrega_modalidade || order.recebimento_modalidade || order.condicao_pagamento;
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export function useRelatorioCaixaOperacional(startDate: Date, endDate: Date) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const operationType = activeArea === "central" ? null : activeArea === "industrial" ? "industrial" : "domestico";
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const rangeStart = startOfDay(startDate);
  const rangeEnd = addDays(startOfDay(endDate), 1);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  return useQuery<CashReportOperationalData>({
    queryKey: ["relatorio-caixa-operacional", activeTenant?.id, session?.user.id, activeArea, startIso, endIso],
    enabled: Boolean(activeTenant?.id && session?.user.id),
    queryFn: async () => {
      if (!activeTenant?.id || !session?.user.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar o relatório");
      }

      const db = supabase as any;
      let orderQuery = db
        .from("ordens_servico")
        .select("id, numero, cliente_id, valor_total, valor_desconto, valor_pago, forma_pagamento, condicao_pagamento, entrega_modalidade, recebimento_modalidade, origem, clientes!ordens_servico_cliente_id_fkey(razao_social, nome_fantasia)")
        .eq("tenant_id", activeTenant.id)
        .gte("data_retirada", format(rangeStart, "yyyy-MM-dd"))
        .lt("data_retirada", format(rangeEnd, "yyyy-MM-dd"));
      if (allowedOrigins) orderQuery = orderQuery.in("origem", [...allowedOrigins]);

      let movementQuery = db.from("caixa_movimentacoes")
          .select("id, tipo, valor, descricao, forma_pagamento, evento_pagamento, cliente_id, ordem_servico_id, criado_por, responsavel_nome, referencia, ocorrido_em, created_at")
          .eq("tenant_id", activeTenant.id)
          .gte("ocorrido_em", startIso)
          .lt("ocorrido_em", endIso);
      let paymentQuery = db.from("pdv_pagamentos")
          .select("id, ordem_servico_id, metodo, valor, valor_recebido, status, criado_por, created_at")
          .eq("tenant_id", activeTenant.id)
          .or(`and(confirmado_em.gte.${startIso},confirmado_em.lt.${endIso}),and(confirmado_em.is.null,created_at.gte.${startIso},created_at.lt.${endIso})`);
      if (operationType) {
        movementQuery = movementQuery.eq("operation_type", operationType);
        paymentQuery = paymentQuery.eq("operation_type", operationType);
      }
      const fetchAll = async <T,>(query: any): Promise<T[]> => {
        const rows: T[] = [];
        for (let offset = 0; offset <= 10000; offset += 500) {
          const { data, error } = await query.range(offset, offset + 499);
          if (error) throw error;
          if (offset === 10000 && data?.length) throw new Error("O período contém mais de 10.000 registros. Reduza o intervalo para obter um relatório completo.");
          rows.push(...(data ?? []));
          if (!data || data.length < 500) break;
        }
        return rows;
      };
      const [movements, cashData, listOrders, payments] = await Promise.all([
        fetchAll<RawMovement>(movementQuery.order("ocorrido_em", { ascending: true }).order("id", { ascending: true })),
        fetchAll<RawCash>(db.from("caixas")
          .select("id, operation_type, data_abertura, data_fechamento, valor_abertura, fechamento_resumo, status")
          .eq("tenant_id", activeTenant.id)
          .or(`data_abertura.gte.${startIso},data_fechamento.gte.${startIso},data_fechamento.is.null`)
          .lt("data_abertura", endIso).order("data_abertura", { ascending: true }).order("id", { ascending: true })),
        fetchAll<RawOrder>(orderQuery.order("created_at", { ascending: true }).order("id", { ascending: true })),
        fetchAll<RawPayment>(paymentQuery.order("created_at", { ascending: true }).order("id", { ascending: true })),
      ]);
      // A abertura e a contagem pertencem ao caixa compartilhado, não a uma operação.
      const cashRegisters = operationType ? [] : cashData;
      const cashBalancesAvailable = !operationType && hasCompleteCashPeriod(cashRegisters, startIso, endIso);
      const referencedOrderIds = [...new Set([
        ...payments.map((payment) => payment.ordem_servico_id).filter(Boolean),
        ...movements.map((movement) => movement.ordem_servico_id).filter(Boolean),
      ])] as string[];
      const listedOrderIds = new Set(listOrders.map(order => order.id));
      const missingOrderIds = referencedOrderIds.filter((id) => !listedOrderIds.has(id));
      const referencedOrders: RawOrder[] = [];
      for (let offset = 0; offset < missingOrderIds.length; offset += 100) {
        const referencedResult = await db
          .from("ordens_servico")
          .select("id, numero, cliente_id, valor_total, valor_desconto, valor_pago, forma_pagamento, condicao_pagamento, entrega_modalidade, recebimento_modalidade, origem, clientes!ordens_servico_cliente_id_fkey(razao_social, nome_fantasia)")
          .eq("tenant_id", activeTenant.id)
          .in("id", missingOrderIds.slice(offset, offset + 100));
        if (referencedResult.error) throw referencedResult.error;
        referencedOrders.push(...((referencedResult.data ?? []) as RawOrder[]));
      }
      const ordersById = new Map([...listOrders, ...referencedOrders].map((order) => [order.id, order]));

      const actorIds = [...new Set([
        ...movements.map((movement) => movement.criado_por),
        ...payments.map((payment) => payment.criado_por),
      ].filter(Boolean))] as string[];
      const employeesResult = actorIds.length > 0
        ? await db.from("funcionarios").select("user_id, nome").eq("tenant_id", activeTenant.id).in("user_id", actorIds)
        : { data: [], error: null };
      const employeeNames = new Map<string, string>((employeesResult.data ?? []).map((employee: { user_id: string | null; nome: string }) => [employee.user_id, employee.nome]));
      const userName = (userId: string | null, fallback?: string | null) => employeeNames.get(userId ?? "") || fallback?.trim() || "Usuário não identificado";

      const generalAccumulator = new Map<CashReportPaymentGroup, { entrada: number; saida: number; abertura: number; contado: number; hasContado: boolean }>();
      PAYMENT_GROUPS.forEach((forma) => generalAccumulator.set(forma, { entrada: 0, saida: 0, abertura: 0, contado: 0, hasContado: false }));
      (cashBalancesAvailable ? cashRegisters : []).forEach((cash) => {
        const dinheiro = generalAccumulator.get("DINHEIRO")!;
        dinheiro.abertura += toNumber(cash.valor_abertura);
        const resumo = cash.fechamento_resumo ?? {};
        const countedKeys: Record<CashReportPaymentGroup, string> = {
          DINHEIRO: "dinheiro_contado",
          PIX: "pix_conferido",
          CARTAO_CREDITO: "cartao_credito_conferido",
          CARTAO_DEBITO: "cartao_debito_conferido",
          OUTROS: "outros_conferido",
        };
        if (cash.status === "FECHADO") {
          PAYMENT_GROUPS.forEach((forma) => {
            const value = resumo[countedKeys[forma]];
            if (value != null) {
              const target = generalAccumulator.get(forma)!;
              target.contado += toNumber(value);
              target.hasContado = true;
            }
          });
        }
      });

      const movementRows: CashReportMovementRow[] = movements.map((movement) => {
        const order = movement.ordem_servico_id ? ordersById.get(movement.ordem_servico_id) : undefined;
        const orderCode = order?.numero || movement.referencia || "0";
        const type = ["SANGRIA", "PAGAMENTO"].includes(String(movement.tipo).toUpperCase()) || movement.evento_pagamento === "ESTORNO" ? "S" : "E";
        const history = movement.descricao?.trim() || (order ? `${movement.tipo === "VENDA" ? "REC. ROL" : movement.tipo} ${orderCode} · CLI: ${getCustomerName(order)}` : "Movimentação de caixa");
        return {
          id: movement.id,
          data: movement.ocorrido_em || movement.created_at,
          historico: history,
          tipo: type,
          forma: paymentLabel(movement.forma_pagamento),
          valor: toNumber(movement.valor),
          documento: orderCode,
          tipoDocumento: order ? "ROL" : movement.tipo === "SANGRIA" || movement.tipo === "REFORCO" ? "CX" : "ENT",
          usuario: userName(movement.criado_por, movement.responsavel_nome),
        };
      });

      movements.forEach((movement) => {
        const tipo = String(movement.tipo ?? "").toUpperCase();
        const forma = tipo === "SANGRIA" || tipo === "REFORCO" ? "DINHEIRO" : normalizePaymentGroup(movement.forma_pagamento);
        const target = generalAccumulator.get(forma)!;
        const value = toNumber(movement.valor);
        if (["VENDA", "RECEBIMENTO", "BAIXA", "REFORCO"].includes(tipo) && movement.evento_pagamento !== "ESTORNO") target.entrada += value;
        if (tipo === "SANGRIA" || tipo === "PAGAMENTO" || movement.evento_pagamento === "ESTORNO") target.saida += value;
      });

      const general = PAYMENT_GROUPS.map((forma) => {
        const item = generalAccumulator.get(forma)!;
        const saldoApurado = item.abertura + item.entrada - item.saida;
        const saldoContado = item.hasContado ? item.contado : null;
        return {
          forma,
          entrada: item.entrada,
          saida: item.saida,
          saldoApurado,
          saldoContado,
          diferenca: saldoContado == null ? null : saldoContado - saldoApurado,
        };
      });

      const toOrderRow = (order: RawOrder): CashReportOrderRow => {
        const total = toNumber(order.valor_total);
        const desconto = toNumber(order.valor_desconto);
        const adiantamento = toNumber(order.valor_pago);
        return {
          id: order.id,
          codigo: order.numero || order.id.slice(0, 8),
          cliente: getCustomerName(order),
          desconto,
          total,
          adiantamento,
          tipoSolicitacao: getOrderRequestType(order),
          sobra: Math.max(total - adiantamento, 0),
        };
      };
      const orders = listOrders.map(toOrderRow);

      const receivedByOrder = receiptsByOrder(payments, movements);
      const receipts = [...receivedByOrder.entries()].map(([orderId, received]) => {
        const order = ordersById.get(orderId);
        const total = toNumber(order?.valor_total);
        const desconto = toNumber(order?.valor_desconto);
        return {
          id: orderId,
          codigo: order?.numero || orderId.slice(0, 8),
          cliente: getCustomerName(order),
          aberto: Math.max(total - toNumber(order?.valor_pago || received), 0),
          desconto,
          recebido: received,
        };
      }).sort((a, b) => a.codigo.localeCompare(b.codigo));

      return {
        dateLabel: format(rangeStart, "dd/MM/yyyy"),
        operationScoped: Boolean(operationType),
        cashBalancesAvailable,
        general,
        movements: movementRows,
        orders,
        receipts,
        totals: {
          entrada: general.reduce((sum, row) => sum + row.entrada, 0),
          saida: general.reduce((sum, row) => sum + row.saida, 0),
          vendas: movements.filter((movement) => String(movement.tipo).toUpperCase() === "VENDA" && movement.evento_pagamento !== "ESTORNO").reduce((sum, movement) => sum + toNumber(movement.valor), 0),
          recebimentos: receipts.reduce((sum, row) => sum + row.recebido, 0),
        },
      };
    },
  });
}
