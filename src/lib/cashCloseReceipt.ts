import { escapeHtml } from "@/lib/safePrint";

export interface CashCloseReceiptData {
  identifier: string;
  operator: string;
  openedAt: string | null;
  closedAt: string;
  openingFloat: number;
  sales: number;
  withdrawals: number;
  reinforcements: number;
  pendingPickupAmount: number;
  pendingPickupOrders: number;
  observations: string;
  payments: Array<{ label: string; expected: number; counted: number }>;
  totalExpected: number;
  totalCounted: number;
  totalDifference: number;
}

const currency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "—";

export function generateCashCloseReceiptHTML(data: CashCloseReceiptData): string {
  const payments = data.payments.map((payment) => {
    const difference = Math.round((payment.counted - payment.expected) * 100) / 100;
    return `<div class="payment">
      <div class="line"><strong>${escapeHtml(payment.label)}</strong><span>Esperado ${currency(payment.expected)}</span></div>
      <div class="line muted"><span>Conferido ${currency(payment.counted)}</span><span>Diferença ${difference > 0 ? "+" : ""}${currency(difference)}</span></div>
    </div>`;
  }).join("");

  const differenceLabel = data.totalDifference > 0 ? "+" : "";

  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Fechamento de caixa - ${escapeHtml(data.identifier)}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; }
          html, body { width: 100%; margin: 0 auto; }
          body {
            width: 72mm;
            max-width: calc(100vw - 4mm);
            padding: 3mm 1mm;
            color: #111;
            font: 10px/1.35 Arial, sans-serif;
            overflow-wrap: anywhere;
          }
          h1 { margin: 0 0 2mm; font-size: 13px; text-align: center; }
          .subtitle { text-align: center; font-size: 9px; margin-bottom: 3mm; }
          .section { border-top: 1px dashed #333; padding-top: 2mm; margin-top: 2mm; }
          .heading { margin-bottom: 1mm; font-weight: 700; text-align: center; }
          .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; }
          .line > :last-child { text-align: right; }
          .muted { color: #444; font-size: 9px; }
          .payment { padding: 1mm 0; border-bottom: 1px dotted #aaa; }
          .total { font-size: 12px; font-weight: 700; }
          .note { margin-top: 2mm; font-size: 9px; }
          .signature { margin-top: 10mm; border-top: 1px solid #333; padding-top: 1mm; text-align: center; font-size: 9px; }
          .footer { margin-top: 3mm; border-top: 1px dashed #333; padding-top: 2mm; text-align: center; font-size: 8px; }
          @media print { body { margin: 0 auto; } }
        </style>
      </head>
      <body>
        <h1>FECHAMENTO DE CAIXA</h1>
        <div class="subtitle">Relatório interno · ${escapeHtml(data.identifier)}</div>
        <div class="line"><span>Operador</span><strong>${escapeHtml(data.operator || "—")}</strong></div>
        <div class="line"><span>Abertura</span><span>${escapeHtml(dateTime(data.openedAt))}</span></div>
        <div class="line"><span>Fechamento</span><span>${escapeHtml(dateTime(data.closedAt))}</span></div>

        <div class="section">
          <div class="heading">MOVIMENTAÇÃO</div>
          <div class="line"><span>Fundo de abertura</span><span>${currency(data.openingFloat)}</span></div>
          <div class="line"><span>Vendas líquidas</span><span>${currency(data.sales)}</span></div>
          <div class="line"><span>Sangrias</span><span>${currency(data.withdrawals)}</span></div>
          <div class="line"><span>Reforços</span><span>${currency(data.reinforcements)}</span></div>
        </div>

        <div class="section">
          <div class="heading">CONFERÊNCIA POR FORMA DE PAGAMENTO</div>
          ${payments}
          <div class="line total"><span>Total esperado</span><span>${currency(data.totalExpected)}</span></div>
          <div class="line total"><span>Total conferido</span><span>${currency(data.totalCounted)}</span></div>
          <div class="line total"><span>Diferença</span><span>${differenceLabel}${currency(data.totalDifference)}</span></div>
        </div>

        <div class="section">
          <div class="heading">ROLs A RECEBER NA RETIRADA</div>
          <div class="line"><span>Quantidade</span><span>${data.pendingPickupOrders}</span></div>
          <div class="line"><span>Saldo pendente</span><span>${currency(data.pendingPickupAmount)}</span></div>
          <div class="note">Este saldo não compõe o caixa até o pagamento ser recebido.</div>
        </div>

        ${data.observations ? `<div class="section"><div class="heading">OBSERVAÇÕES</div><div>${escapeHtml(data.observations)}</div></div>` : ""}
        <div class="signature">Assinatura do operador</div>
        <div class="footer">Relatório de conferência do caixa. Não substitui documento fiscal.</div>
      </body>
    </html>`;
}
