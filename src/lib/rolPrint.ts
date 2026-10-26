import type { ROLPreviewConfig } from "../components/configuracoes/ROLPreview.tsx";
import { escapeHtml, safeHttpsUrl } from "./safePrint.ts";
import { parseCustomerPaymentTerms, PAYMENT_CONDITION_LABELS, PAYMENT_METHOD_LABELS, BILLING_FREQUENCY_LABELS } from "./customerPaymentTerms.ts";

/** Temporary, narrow extension for OS columns absent from generated database types. */
export interface RolOrderCommercialSnapshot {
  condicao_pagamento?: string | null;
  condicoes_comerciais?: unknown;
}

export interface RolCommercialData {
  condicaoPagamento?: string | null;
  condicoesComerciais?: unknown;
  /** Current customer setting, never presented as the historical order snapshot. */
  tabelaPrecoAtual?: string | null;
  origem?: string | null;
  statusOS?: string | null;
  statusPagamento?: string | null;
  valorPago?: number | null;
  valorTotal: number;
  valorDesconto?: number;
  valorUrgencia?: number;
}

export interface PrintOSData extends RolCommercialData {
  numero: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  itens: { nome: string; unidade?: string; quantidade: number; precoUnitario: number; subtotal: number }[];
  valorTotal: number;
  dataEmissao: Date;
  previsaoEntrega?: Date;
  observacoes?: string;
  bloco?: string;
  posicao?: string;
  fidelidade?: {
    programaAtivo: boolean;
    exibirRol: boolean;
    saldoPontos: number;
    valorSaldo: number;
    pontosGanhosNestaOrdem: number;
    pontosMinimosResgate: number;
  };
}

interface RolOrderData extends RolOrderCommercialSnapshot {
  valor_total: number | null;
  valor_desconto?: number | null;
  valor_pago?: number | null;
  urgente?: boolean | null;
  percentual_urgencia?: number | null;
  status_pagamento?: string | null;
  status?: string | null;
  origem?: string | null;
}

/** Retain stored OS/item prices for either area; never recalculate using today's price list. */
export function buildRolOrderDetails(
  order: RolOrderData,
  items: Pick<PrintOSData["itens"][number], "subtotal">[],
  tabelaPrecoAtual?: string | null,
): RolCommercialData {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = Number.isFinite(order.valor_desconto) ? Math.max(0, order.valor_desconto ?? 0) : 0;
  const urgencyRate = order.urgente && Number.isFinite(order.percentual_urgencia) ? Math.max(0, order.percentual_urgencia ?? 0) : 0;
  const urgency = Math.round(Math.max(0, subtotal - discount) * urgencyRate) / 100;
  return {
    condicaoPagamento: order.condicao_pagamento ?? null,
    condicoesComerciais: order.condicoes_comerciais,
    tabelaPrecoAtual,
    origem: order.origem,
    statusOS: order.status,
    statusPagamento: order.status_pagamento,
    valorPago: order.valor_pago,
    valorDesconto: discount,
    valorUrgencia: urgency,
    valorTotal: order.valor_total !== null && Number.isFinite(order.valor_total)
      ? order.valor_total
      : Math.max(0, Math.round((subtotal - discount + urgency) * 100) / 100),
  };
}

function snapshotRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function getRolCommercialSummary(data: RolCommercialData) {
  const snapshot = snapshotRecord(data.condicoesComerciais);
  // A null/unknown OS condition is legacy withdrawal, even if the JSON says monthly/billed.
  const terms = parseCustomerPaymentTerms({
    condicao_pagamento: data.condicaoPagamento,
    tipo_faturamento: typeof snapshot.tipo_faturamento === "string" ? snapshot.tipo_faturamento : null,
    forma_pagamento: typeof snapshot.forma_pagamento === "string" ? snapshot.forma_pagamento : null,
    dia_fechamento: typeof snapshot.dia_fechamento === "number" ? snapshot.dia_fechamento : null,
    dia_vencimento: typeof snapshot.dia_vencimento === "number" ? snapshot.dia_vencimento : null,
  });
  const tableLabel = (value: unknown) => value === "padrao" ? "Padrão" : value === "personalizada" ? "Personalizada" : null;
  const snapshotTable = tableLabel(snapshot.tabela_preco_tipo);
  const currentTable = tableLabel(data.tabelaPrecoAtual);
  const table = snapshotTable
    ? `${snapshotTable} (registrada na OS)`
    : currentTable
      ? `${currentTable} (cadastro atual; tabela da OS não registrada)`
      : "Não registrada na OS";
  const paidAmount = typeof data.valorPago === "number" && Number.isFinite(data.valorPago) ? Math.max(0, data.valorPago) : null;
  const paid = paidAmount !== null && data.valorTotal > 0 && Math.round(paidAmount * 100) >= Math.round(data.valorTotal * 100);
  const partial = paidAmount !== null && paidAmount > 0 && !paid;
  const billed = terms.condition === "faturado";
  const cancelled = data.statusOS === "cancelada";
  const status = cancelled ? "OS cancelada"
    : paid ? "Pagamento registrado"
      : partial ? "Pagamento parcial registrado"
        : billed ? "Faturado — não pago"
          : paidAmount === null && !data.statusPagamento ? "Pagamento não informado"
            : "Pagamento pendente";
  const notice = cancelled ? "OS cancelada: este ROL não representa cobrança."
    : billed ? "Pagamento pelo fechamento da fatura. Este ROL não comprova quitação e não é cobrança individual da OS."
      : "Este ROL não substitui o comprovante de pagamento.";
  const frequency = billed && typeof snapshot.tipo_faturamento === "string" && Object.prototype.hasOwnProperty.call(BILLING_FREQUENCY_LABELS, snapshot.tipo_faturamento)
    ? BILLING_FREQUENCY_LABELS[terms.frequency]
    : null;
  return {
    condition: PAYMENT_CONDITION_LABELS[terms.condition],
    table,
    area: data.origem === "industrial" ? "Industrial" : data.origem === "residencial" || data.origem === "loja" ? "Residencial" : null,
    preferredMethod: terms.preferredMethod ? PAYMENT_METHOD_LABELS[terms.preferredMethod] : null,
    frequency,
    closingDay: terms.closingDay,
    dueDay: terms.dueDay,
    status,
    notice,
    paidAmount,
    outstanding: paidAmount === null ? null : Math.max(0, Math.round((data.valorTotal - paidAmount) * 100) / 100),
    billed,
    cancelled,
  };
}

export function generateROLCommercialHTML(data: RolCommercialData, showPrices = true): string {
  const info = getRolCommercialSummary(data);
  return `<div class="section commercial-terms">
    ${info.area ? `<div><strong>Atendimento:</strong> ${info.area}</div>` : ""}
    <div><strong>Condição da OS:</strong> ${escapeHtml(info.condition)}</div>
    <div><strong>Tabela de preços:</strong> ${escapeHtml(info.table)}</div>
    ${info.preferredMethod ? `<div><strong>Método preferido:</strong> ${escapeHtml(info.preferredMethod)} (não comprova pagamento)</div>` : ""}
    ${info.billed ? `<div><strong>Periodicidade:</strong> ${escapeHtml(info.frequency ?? "Não registrada")}${info.closingDay ? ` · Fechamento: dia ${info.closingDay}` : ""}${info.dueDay ? ` · Vencimento: dia ${info.dueDay}` : ""}</div>` : ""}
    <div><strong>Situação:</strong> ${escapeHtml(info.status)}</div>
    ${showPrices && info.paidAmount !== null && !info.cancelled ? `<div>Valor pago registrado na OS: R$ ${info.paidAmount.toFixed(2)}</div>` : ""}
    ${showPrices && info.outstanding !== null && info.outstanding > 0 && !info.cancelled ? `<div>${info.billed ? "Saldo vinculado ao faturamento" : "Saldo pendente"}: R$ ${info.outstanding.toFixed(2)}</div>` : ""}
    <div class="obs">${escapeHtml(info.notice)}</div>
  </div>`;
}

export const getFontFamily = (font: string) => {
  switch (font) {
    case 'courier': return 'Courier New, monospace';
    case 'arial': return 'Arial, sans-serif';
    case 'times': return 'Times New Roman, serif';
    case 'consolas': return 'Consolas, monospace';
    default: return 'Courier New, monospace';
  }
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.min(max, Math.max(min, numericValue))
    : fallback;
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)
    ? value
    : fallback;
}

export function generateROLHTMLWithData(config: ROLPreviewConfig, data: PrintOSData): string {
  const width = config.larguraPapel === '58mm' ? '58mm' : '80mm';
  const fontFamily = getFontFamily(config.fontePrincipal);
  const margemSuperior = boundedNumber(config.margemSuperior, 10, 0, 100);
  const margemLateral = boundedNumber(config.margemLateral, 8, 0, 100);
  const tamanhoNome = boundedNumber(config.tamanhoNome, 14, 6, 72);
  const tamanhoItem = boundedNumber(config.tamanhoItem, 11, 6, 72);
  const tamanhoTotal = boundedNumber(config.tamanhoTotal, 14, 6, 72);
  const corPrimaria = safeColor(config.corPrimaria, "#3c62f6");
  const corSecundaria = safeColor(config.corSecundaria, "#2583eb");
  const logoUrl = safeHttpsUrl(config.logoUrl);
  const osNumero = escapeHtml(data.numero);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ROL - ${osNumero}</title>
      <style>
        @page { size: ${width} auto; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: ${fontFamily};
          width: ${width};
          padding: ${margemSuperior}px ${margemLateral}px;
          font-size: 10px;
          line-height: 1.3;
        }
        .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
        .logo { max-height: 40px; margin-bottom: 8px; }
        .company-name { font-size: ${tamanhoNome}px; font-weight: bold; color: ${corPrimaria}; text-transform: uppercase; }
        .cnpj, .address, .contact { font-size: 9px; color: #666; margin-top: 2px; }
        .rol-info { text-align: center; margin-bottom: 8px; }
        .rol-title { font-size: 10px; font-weight: bold; color: ${corSecundaria}; }
        .rol-number { font-size: 9px; color: #666; }
        .section { border-top: 1px dashed #666; padding-top: 8px; margin-bottom: 8px; }
        .client-info { font-size: 10px; }
        .previsao { color: #d97706; font-weight: 500; }
        .items-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; color: ${corPrimaria}; margin-bottom: 4px; }
        .item-row { display: flex; justify-content: space-between; font-size: ${tamanhoItem}px; padding: 2px 0; }
        .item-qty { width: 48px; flex-shrink: 0; overflow-wrap: anywhere; }
        .item-name { flex: 1; min-width: 0; text-align: left; overflow-wrap: anywhere; }
        .item-unit { width: 45px; flex-shrink: 0; text-align: right; }
        .item-total { width: 50px; flex-shrink: 0; text-align: right; }
        .commercial-terms { overflow-wrap: anywhere; break-inside: avoid; }
        .totals { border-top: 1px dashed #666; padding-top: 8px; margin-bottom: 8px; }
        .total-row { display: flex; justify-content: space-between; font-size: 10px; }
        .grand-total { font-size: ${tamanhoTotal}px; font-weight: bold; color: ${corPrimaria}; margin-top: 4px; }
        .loyalty { border: 1px dashed ${corSecundaria}; color: #444; font-size: 9px; margin-top: 8px; padding: 6px; text-align: center; }
        .obs { font-size: 9px; color: #666; }
        .bloco { font-size: 9px; text-align: center; color: #888; }
        .signature { padding-top: 20px; margin-bottom: 8px; }
        .signature-line { border-bottom: 1px solid #666; margin: 0 20px 4px 20px; }
        .signature-label { font-size: 9px; text-align: center; color: #888; }
        .footer { border-top: 1px dashed #666; padding-top: 8px; text-align: center; }
        .footer-text { font-size: 9px; color: #888; }
        .footer-slogan { font-size: 8px; color: #aaa; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${config.exibirLogo && logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />` : ''}
        <div class="company-name">${escapeHtml(config.nomeCompleto || config.nomeCurto)}</div>
        ${config.cnpj ? `<div class="cnpj">CNPJ: ${escapeHtml(config.cnpj)}</div>` : ''}
        ${config.endereco ? `<div class="address">${escapeHtml(config.endereco)}</div>` : ''}
        ${config.telefone || config.email ? `<div class="contact">${escapeHtml(config.telefone)}${config.telefone && config.email ? ' | ' : ''}${escapeHtml(config.email)}</div>` : ''}
      </div>

      <div class="rol-info">
        <div class="rol-title">ROL DE LAVANDERIA</div>
        <div class="rol-number">Nº ${osNumero} - ${escapeHtml(data.dataEmissao.toLocaleDateString('pt-BR'))} ${escapeHtml(data.dataEmissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</div>
      </div>

      <div class="section">
        <div class="client-info"><strong>Cliente:</strong> ${escapeHtml(data.clienteNome)}</div>
        ${data.clienteTelefone ? `<div class="client-info"><strong>Tel:</strong> ${escapeHtml(data.clienteTelefone)}</div>` : ''}
        ${config.previsaoEntrega && data.previsaoEntrega ? `<div class="client-info previsao"><strong>Previsão:</strong> ${data.previsaoEntrega.toLocaleDateString('pt-BR')}</div>` : ''}
      </div>

      ${generateROLCommercialHTML(data, config.tipoPreco)}

      <div class="section">
        <div class="items-header">
          <span class="item-qty">QTD</span>
          <span class="item-name">ITEM</span>
          ${config.tipoPreco ? '<span class="item-unit">UNIT</span><span class="item-total">TOTAL</span>' : ''}
        </div>
        ${data.itens.map(item => `
          <div class="item-row">
            <span class="item-qty">${escapeHtml(item.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 20 }))}${item.unidade ? ` ${escapeHtml(item.unidade)}` : 'x'}</span>
            <span class="item-name">${escapeHtml(item.nome)}</span>
            ${config.tipoPreco ? `<span class="item-unit">${item.precoUnitario.toFixed(2)}</span><span class="item-total">${item.subtotal.toFixed(2)}</span>` : ''}
          </div>
        `).join('')}
      </div>

      ${config.tipoPreco ? `
        <div class="totals">
          ${(data.valorDesconto ?? 0) > 0 || (data.valorUrgencia ?? 0) > 0 ? `<div class="total-row"><span>Subtotal:</span><span>R$ ${data.itens.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}</span></div>` : ''}
          ${config.linhaDesconto && (data.valorDesconto ?? 0) > 0 ? `<div class="total-row"><span>Desconto:</span><span>- R$ ${data.valorDesconto.toFixed(2)}</span></div>` : ''}
          ${(data.valorUrgencia ?? 0) > 0 ? `<div class="total-row"><span>Urgência:</span><span>+ R$ ${data.valorUrgencia.toFixed(2)}</span></div>` : ''}
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>R$ ${data.valorTotal.toFixed(2)}</span>
          </div>
        </div>
      ` : ''}

      ${config.exibirFidelidade && data.fidelidade?.programaAtivo && data.fidelidade.exibirRol ? `
        <div class="loyalty">
          <strong>FIDELIDADE</strong><br />
          ${data.fidelidade.pontosGanhosNestaOrdem > 0 ? `Você ganhou ${Math.floor(data.fidelidade.pontosGanhosNestaOrdem)} pontos nesta compra.<br />` : ''}
          Saldo: ${Math.floor(data.fidelidade.saldoPontos)} pontos (R$ ${Number(data.fidelidade.valorSaldo).toFixed(2)})
          ${data.fidelidade.saldoPontos < data.fidelidade.pontosMinimosResgate ? `<br />Resgate a partir de ${Math.floor(data.fidelidade.pontosMinimosResgate)} pontos.` : ''}
        </div>
      ` : ''}

      ${config.observacoes && data.observacoes ? `
        <div class="section">
          <div class="obs"><strong>Obs:</strong> ${escapeHtml(data.observacoes)}</div>
        </div>
      ` : ''}

      ${config.bloco && (data.bloco || data.posicao) ? `
        <div class="section">
          <div class="bloco">${data.bloco ? `Bloco: ${escapeHtml(data.bloco)}` : ''} ${data.bloco && data.posicao ? '|' : ''} ${data.posicao ? `Posição: ${escapeHtml(data.posicao)}` : ''}</div>
        </div>
      ` : ''}

      ${config.assinaturaCliente ? `
        <div class="section signature">
          <div class="signature-line"></div>
          <div class="signature-label">Assinatura do Cliente</div>
        </div>
      ` : ''}

      <div class="footer">
        <div class="footer-text">${escapeHtml(config.textoRodape || 'Obrigado pela preferência!')}</div>
        <div class="footer-slogan">${escapeHtml(config.slogan)}</div>
      </div>
    </body>
    </html>
  `;
}

