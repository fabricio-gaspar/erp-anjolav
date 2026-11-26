import type { OfflinePdvReceipt } from "@/lib/offlineStore";
import { reserveAndPrintPreparedDocument } from "@/lib/safePrint";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

export function createOfflineLocalReference(idempotencyKey: string, createdAt: string): string {
  const suffix = idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? "LOCAL"
    : `${String(date.getDate()).padStart(2, "0")}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `OFF-${stamp}-${suffix || "PENDENTE"}`;
}

export function generateOfflinePdvReceiptHtml(receipt: OfflinePdvReceipt): string {
  const itemRows = receipt.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
      <td>${escapeHtml(item.name)}${item.details ? `<small>${escapeHtml(item.details)}</small>` : ""}</td>
      <td>${escapeHtml(formatMoney(item.subtotal))}</td>
    </tr>`).join("");

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>ROL provisório ${escapeHtml(receipt.localReference)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body { width: 80mm; margin: 0; padding: 8mm 5mm; color: #111; font: 11px/1.35 Arial, sans-serif; }
        h1 { margin: 0; text-align: center; font-size: 18px; }
        h2 { margin: 4px 0 8px; text-align: center; font-size: 12px; }
        .warning { margin: 10px 0; border: 2px solid #111; padding: 8px; text-align: center; font-weight: 700; }
        .section { border-top: 1px dashed #555; padding: 7px 0; }
        p { margin: 2px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 4px 0; border-bottom: 1px dotted #aaa; text-align: left; vertical-align: top; }
        th:last-child, td:last-child { text-align: right; }
        td:first-child { width: 54px; }
        small { display: block; color: #555; font-size: 9px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .total { display: flex; justify-content: space-between; margin-top: 5px; font-size: 15px; font-weight: 800; }
        .footer { margin-top: 10px; text-align: center; font-size: 9px; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(receipt.tenantName || "ANJOLAV")}</h1>
      <h2>COMPROVANTE PROVISÓRIO DE ENTRADA</h2>
      <div class="warning">SEM INTERNET · AGUARDANDO SINCRONIZAÇÃO<br />Não é documento fiscal nem confirmação de pagamento.</div>
      <div class="section">
        <p><strong>Referência local:</strong> ${escapeHtml(receipt.localReference)}</p>
        <p><strong>Registrado em:</strong> ${escapeHtml(formatDate(receipt.createdAt))}</p>
        <p><strong>Operador:</strong> ${escapeHtml(receipt.operatorName)}</p>
        <p><strong>Operação:</strong> ${receipt.area === "industrial" ? "Industrial" : "Doméstica"}</p>
      </div>
      <div class="section">
        <p><strong>Cliente:</strong> ${escapeHtml(receipt.clientName)}</p>
        ${receipt.clientDocument ? `<p><strong>Documento:</strong> ${escapeHtml(receipt.clientDocument)}</p>` : ""}
        <p><strong>Previsão:</strong> ${escapeHtml(formatDate(receipt.deliveryDate))}</p>
        <p><strong>Recebimento:</strong> ${receipt.receiptMode === "coleta" ? "Coleta" : "Balcão"}</p>
        <p><strong>Entrega:</strong> ${receipt.deliveryMode === "entrega" ? "Delivery" : "Retirada no balcão"}</p>
      </div>
      <div class="section">
        <table>
          <thead><tr><th>QTD</th><th>ITEM</th><th>VALOR</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        ${receipt.discountAmount > 0 ? `<p>Desconto: -${escapeHtml(formatMoney(receipt.discountAmount))}</p>` : ""}
        ${receipt.urgencyAmount > 0 ? `<p>Urgência: +${escapeHtml(formatMoney(receipt.urgencyAmount))}</p>` : ""}
        ${(receipt.deliveryFee ?? 0) > 0 ? `<p>Taxa de delivery: +${escapeHtml(formatMoney(receipt.deliveryFee))}</p>` : ""}
        <div class="total"><span>TOTAL</span><span>${escapeHtml(formatMoney(receipt.total))}</span></div>
      </div>
      ${receipt.notes ? `<div class="section"><strong>Observações:</strong><p>${escapeHtml(receipt.notes)}</p></div>` : ""}
      <div class="footer">O número oficial do ROL será gerado após a reconexão. Consulte a Central de sincronização no PDV.</div>
    </body>
  </html>`;
}

export function printOfflinePdvReceipt(receipt: OfflinePdvReceipt): Promise<boolean> {
  return reserveAndPrintPreparedDocument(
    async () => generateOfflinePdvReceiptHtml(receipt),
    { features: "width=400,height=650,noopener,noreferrer" },
  );
}
