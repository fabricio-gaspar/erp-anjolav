/** Report data is built from the invoice snapshot, never current catalogue prices. */
export interface BillingReportItem {
  numero_rol?: string;
  data_rol?: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

export type BillingReportCell = string | number;
export interface BillingReportTable { headers: string[]; rows: BillingReportCell[][] }

export function buildBillingReport(items: BillingReportItem[], model: string | null | undefined): BillingReportTable {
  const formatDate = (date?: string) => {
    const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
  };
  const numeric = (value: number) => Number(value) || 0;
  if (model === "mapa_pecas") {
    return {
      headers: ["ROL", "Data do ROL", "Peça ou serviço", "Quantidade", "Unidade", "Valor unitário (R$)", "Subtotal (R$)"],
      rows: items.map(item => [item.numero_rol || "—", formatDate(item.data_rol), item.produto,
        numeric(item.quantidade), item.unidade, numeric(item.valor_unitario).toFixed(2), numeric(item.valor_total).toFixed(2)]),
    };
  }
  if (model === "mapa") {
    const grouped = new Map<string, { item: BillingReportItem; quantity: number; total: number }>();
    for (const item of items) {
      const key = JSON.stringify([item.produto, item.unidade, numeric(item.valor_unitario)]);
      const existing = grouped.get(key) ?? { item, quantity: 0, total: 0 };
      existing.quantity += numeric(item.quantidade);
      existing.total += numeric(item.valor_total);
      grouped.set(key, existing);
    }
    return { headers: ["Peça ou serviço", "Quantidade", "Unidade", "Valor unitário (R$)", "Subtotal (R$)"],
      rows: [...grouped.values()].map(row => [row.item.produto, Number(row.quantity.toFixed(3)), row.item.unidade,
        numeric(row.item.valor_unitario).toFixed(2), row.total.toFixed(2)]) };
  }
  if (model !== "detalhado" && model !== "mapa_mensal" && model != null && model !== "") {
    throw new Error("Modelo de relatório desconhecido. Configure o cliente antes do fechamento.");
  }
  const dates = [...new Set(items.map(item => item.data_rol?.slice(0, 10) || ""))].sort();
  const grouped = new Map<string, { item: BillingReportItem; dates: Map<string, number>; quantity: number; total: number }>();
  for (const item of items) {
    const date = item.data_rol?.slice(0, 10) || "";
    const key = JSON.stringify([item.produto, item.unidade, numeric(item.valor_unitario)]);
    const row = grouped.get(key) ?? { item, dates: new Map(), quantity: 0, total: 0 };
    row.dates.set(date, (row.dates.get(date) || 0) + numeric(item.quantidade));
    row.quantity += numeric(item.quantidade);
    row.total += numeric(item.valor_total);
    grouped.set(key, row);
  }
  return {
    headers: ["Peça ou serviço", "Unidade", ...dates.map(formatDate), "Quantidade total", "Valor unitário (R$)", "Subtotal (R$)"],
    rows: [...grouped.values()].map(row => [row.item.produto, row.item.unidade,
      ...dates.map(date => Number((row.dates.get(date) || 0).toFixed(3))), Number(row.quantity.toFixed(3)),
      numeric(row.item.valor_unitario).toFixed(2), row.total.toFixed(2)]),
  };
}
