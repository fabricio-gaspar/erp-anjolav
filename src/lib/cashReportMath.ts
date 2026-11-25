type Amount = number | string | null;
type Payment = { ordem_servico_id: string | null; status: string | null; valor: Amount; valor_recebido: Amount };
type Movement = { ordem_servico_id: string | null; tipo: string | null; evento_pagamento: string | null; valor: Amount };
type Cash = { data_abertura: string; data_fechamento: string | null };

export function hasCompleteCashPeriod(cashes: Cash[], startIso: string, endIso: string): boolean {
  return cashes.length > 0 && cashes.every(cash => Date.parse(cash.data_abertura) >= Date.parse(startIso)
    && (!cash.data_fechamento || Date.parse(cash.data_fechamento) < Date.parse(endIso)));
}

export function receiptsByOrder(payments: Payment[], movements: Movement[]): Map<string, number> {
  const total = new Map<string, number>();
  for (const payment of payments) {
    if (!payment.ordem_servico_id || !["confirmado", "em_revisao", "pago", "aprovado"].includes(String(payment.status ?? "").toLowerCase())) continue;
    const value = Number(payment.valor ?? payment.valor_recebido);
    total.set(payment.ordem_servico_id, (total.get(payment.ordem_servico_id) ?? 0) + (Number.isFinite(value) ? value : 0));
  }
  const ordersWithPayments = new Set(total.keys());
  for (const movement of movements) {
    const id = movement.ordem_servico_id;
    if (!id || ordersWithPayments.has(id) || !["VENDA", "RECEBIMENTO", "BAIXA"].includes(String(movement.tipo ?? "").toUpperCase()) || movement.evento_pagamento === "ESTORNO") continue;
    const value = Number(movement.valor);
    total.set(id, (total.get(id) ?? 0) + (Number.isFinite(value) ? value : 0));
  }
  return total;
}
