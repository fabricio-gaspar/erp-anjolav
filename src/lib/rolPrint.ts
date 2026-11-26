import type { ROLPreviewConfig } from "../components/configuracoes/ROLPreview.tsx";
import { escapeHtml, safeHttpsUrl } from "./safePrint.ts";
import { parseCustomerPaymentTerms, PAYMENT_CONDITION_LABELS, PAYMENT_METHOD_LABELS, BILLING_FREQUENCY_LABELS } from "./customerPaymentTerms.ts";
import { CLIENT_PRICE_MODE_LABELS, isClientPriceMode } from "./clientPricing.ts";
import { generateCode128BPattern } from "./code128.ts";
import { buildOrderScanCode } from "./orderScanner.ts";

/** Temporary, narrow extension for OS columns absent from generated database types. */
export interface RolOrderCommercialSnapshot {
  condicao_pagamento?: string | null;
  condicoes_comerciais?: unknown;
  delivery_modelo_snapshot?: string | null;
  delivery_distancia_km_snapshot?: number | null;
  delivery_taxa_base_snapshot?: number | null;
  delivery_taxa_km_snapshot?: number | null;
}

export interface RolCommercialData {
  condicaoPagamento?: string | null;
  condicoesComerciais?: unknown;
  /** Current customer setting, never presented as the historical order snapshot. */
  tabelaPrecoAtual?: string | null;
  origem?: string | null;
  statusOS?: string | null;
  statusPagamento?: string | null;
  formaPagamento?: string | null;
  valorPago?: number | null;
  valorTotal: number;
  valorDesconto?: number;
  valorUrgencia?: number;
  taxaEntrega?: number;
  deliveryModelo?: string | null;
  deliveryDistanciaKm?: number | null;
  deliveryTaxaBase?: number | null;
  deliveryTaxaKm?: number | null;
}

export interface PrintOSData extends RolCommercialData {
  numero: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteCodigo?: string;
  clienteEndereco?: {
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
  };
  atendenteNome?: string;
  itens: { id?: string; nome: string; unidade?: string; quantidade: number; precoUnitario: number; subtotal: number; posicaoPrateleira?: string | null; detalhes?: string | null }[];
  valorTotal: number;
  dataEmissao: Date;
  previsaoEntrega?: Date;
  recebimentoModalidade?: string | null;
  entregaModalidade?: string | null;
  observacoes?: string;
  bloco?: string;
  posicao?: string;
  fidelidadeDisponivel?: boolean;
  fidelidade?: {
    programaAtivo: boolean;
    exibirRol?: boolean;
    saldoPontos: number;
    valorSaldo: number;
    pontosGanhosNestaOrdem: number;
    pontosMinimosResgate: number;
  };
}

function renderRolLoyaltyBlock(data: PrintOSData): string {
  if (data.fidelidadeDisponivel === false || !data.fidelidade) {
    return `<div class="loyalty"><strong>FIDELIDADE</strong><br />Saldo de pontos indisponível no momento.</div>`;
  }

  const loyalty = data.fidelidade;
  const points = Math.max(0, Math.floor(Number(loyalty.saldoPontos) || 0));
  const balance = Math.max(0, Number(loyalty.valorSaldo) || 0);
  const earned = Math.max(0, Math.floor(Number(loyalty.pontosGanhosNestaOrdem) || 0));
  const minimum = Math.max(0, Math.floor(Number(loyalty.pontosMinimosResgate) || 0));

  return `<div class="loyalty">
    <strong>FIDELIDADE</strong><br />
    ${loyalty.programaAtivo
      ? `Pontos acumulados neste ROL: ${earned}.<br />Saldo disponível: ${points} pontos (${formatRolMoney(balance)}).${minimum > 0 && points < minimum ? `<br />Resgate a partir de ${minimum} pontos.` : ""}`
      : `Programa não ativo para esta operação. Saldo disponível: ${points} pontos (${formatRolMoney(balance)}).`}
  </div>`;
}

interface RolOrderData extends RolOrderCommercialSnapshot {
  valor_total: number | null;
  valor_acrescimo_express?: number | null;
  taxa_entrega?: number | null;
  valor_desconto?: number | null;
  valor_pago?: number | null;
  urgente?: boolean | null;
  percentual_urgencia?: number | null;
  status_pagamento?: string | null;
  forma_pagamento?: string | null;
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
  const urgency = Number.isFinite(order.valor_acrescimo_express)
    ? Math.max(0, Number(order.valor_acrescimo_express))
    : Math.round(Math.max(0, subtotal - discount) * urgencyRate) / 100;
  return {
    condicaoPagamento: order.condicao_pagamento ?? null,
    condicoesComerciais: order.condicoes_comerciais,
    tabelaPrecoAtual,
    origem: order.origem,
    statusOS: order.status,
    statusPagamento: order.status_pagamento,
    formaPagamento: order.forma_pagamento,
    valorPago: order.valor_pago,
    valorDesconto: discount,
    valorUrgencia: urgency,
    taxaEntrega: Number.isFinite(order.taxa_entrega) ? Math.max(0, Number(order.taxa_entrega)) : 0,
    deliveryModelo: order.delivery_modelo_snapshot ?? null,
    deliveryDistanciaKm: Number.isFinite(order.delivery_distancia_km_snapshot) ? Math.max(0, Number(order.delivery_distancia_km_snapshot)) : null,
    deliveryTaxaBase: Number.isFinite(order.delivery_taxa_base_snapshot) ? Math.max(0, Number(order.delivery_taxa_base_snapshot)) : null,
    deliveryTaxaKm: Number.isFinite(order.delivery_taxa_km_snapshot) ? Math.max(0, Number(order.delivery_taxa_km_snapshot)) : null,
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
  const tableLabel = (value: unknown) => isClientPriceMode(value) ? CLIENT_PRICE_MODE_LABELS[value] : null;
  const snapshotTable = tableLabel(snapshot.tabela_preco_tipo);
  const currentTable = tableLabel(data.tabelaPrecoAtual);
  const table = snapshotTable
    ? `${snapshotTable} (registrada no ROL)`
    : currentTable
      ? `${currentTable} (cadastro atual; tabela do ROL não registrada)`
      : "Não registrada no ROL";
  const paidAmount = typeof data.valorPago === "number" && Number.isFinite(data.valorPago) ? Math.max(0, data.valorPago) : null;
  const paid = paidAmount !== null && data.valorTotal > 0 && Math.round(paidAmount * 100) >= Math.round(data.valorTotal * 100);
  const partial = paidAmount !== null && paidAmount > 0 && !paid;
  const billed = terms.condition === "faturado";
  const cancelled = data.statusOS === "cancelada";
  const status = cancelled ? "ROL cancelado"
    : paid ? "Pagamento registrado"
      : partial ? "Pagamento parcial registrado"
        : billed ? "Faturado — não pago"
          : paidAmount === null && !data.statusPagamento ? "Pagamento não informado"
            : "Pagamento pendente";
  const notice = cancelled ? "ROL cancelado: este recibo não representa cobrança."
    : billed ? "Pagamento pelo fechamento da fatura. Este ROL não comprova quitação e não é cobrança individual."
      : "Este ROL não substitui o comprovante de pagamento.";
  const frequency = billed && typeof snapshot.tipo_faturamento === "string" && Object.prototype.hasOwnProperty.call(BILLING_FREQUENCY_LABELS, snapshot.tipo_faturamento)
    ? BILLING_FREQUENCY_LABELS[terms.frequency]
    : null;
  return {
    condition: PAYMENT_CONDITION_LABELS[terms.condition],
    table,
    area: data.origem === "industrial" ? "Industrial" : data.origem === "residencial" || data.origem === "loja" ? "Doméstico" : null,
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
    <div><strong>Condição do ROL:</strong> ${escapeHtml(info.condition)}</div>
    <div><strong>Tabela de preços:</strong> ${escapeHtml(info.table)}</div>
    ${info.preferredMethod ? `<div><strong>Método preferido:</strong> ${escapeHtml(info.preferredMethod)} (não comprova pagamento)</div>` : ""}
    ${info.billed ? `<div><strong>Periodicidade:</strong> ${escapeHtml(info.frequency ?? "Não registrada")}${info.closingDay ? ` · Fechamento: dia ${info.closingDay}` : ""}${info.dueDay ? ` · Vencimento: dia ${info.dueDay}` : ""}</div>` : ""}
    <div><strong>Situação:</strong> ${escapeHtml(info.status)}</div>
    ${showPrices && info.paidAmount !== null && !info.cancelled ? `<div>Valor pago registrado no ROL: R$ ${info.paidAmount.toFixed(2)}</div>` : ""}
    ${showPrices && info.outstanding !== null && info.outstanding > 0 && !info.cancelled ? `<div>${info.billed ? "Saldo vinculado ao faturamento" : "Saldo pendente"}: R$ ${info.outstanding.toFixed(2)}</div>` : ""}
    <div class="obs">${escapeHtml(info.notice)}</div>
  </div>`;
}

function generateRolBarcodeSvg(value: string, height = 34): string {
  const pattern = generateCode128BPattern(value);
  const moduleWidth = 1.4;
  const quietZone = 8;
  const width = (pattern.length + quietZone * 2) * moduleWidth;
  let x = quietZone * moduleWidth;
  const bars = pattern.map((bit) => {
    const bar = bit === 1 ? `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#111"/>` : "";
    x += moduleWidth;
    return bar;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Código do ROL">${bars}</svg>`;
}

function formatRolDate(date?: Date | null, withTime = false): string {
  if (!date || Number.isNaN(date.getTime())) return "—";
  const value = date.toLocaleDateString("pt-BR");
  return withTime ? `${value} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : value;
}

function formatRolMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function formatRolUnit(unit?: string): string {
  const normalized = (unit || "").trim().toLowerCase();
  if (["mt", "m", "metro", "metros", "m²", "m2"].includes(normalized)) return "m²";
  if (["kg", "quilo", "kilo"].includes(normalized)) return "kg";
  if (["un", "unidade"].includes(normalized)) return "unidade";
  if (["pç", "pc", "peça", "peca"].includes(normalized)) return "peça";
  return unit || "";
}

function formatRolQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);
}

function formatRolQuantitySummary(items: PrintOSData["itens"]): string {
  const totals = new Map<string, { unit: string; quantity: number }>();
  items.forEach((item) => {
    const unit = formatRolUnit(item.unidade) || "unidade";
    const entry = totals.get(unit);
    totals.set(unit, { unit, quantity: (entry?.quantity ?? 0) + item.quantidade });
  });
  return [...totals.values()].map(({ unit, quantity }) => `${formatRolQuantity(quantity)} ${unit}`).join(" · ") || "0 itens";
}

function addressLines(address?: PrintOSData["clienteEndereco"]): string {
  if (!address) return "";
  const street = [address.logradouro, address.numero].filter(Boolean).join(", ");
  const locality = [address.bairro, address.cidade, address.uf].filter(Boolean).join(" · ");
  return [street, address.complemento, locality, address.cep && `CEP ${address.cep}`].filter(Boolean).map(escapeHtml).join("<br />");
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
  const printableWidth = config.larguraPapel === '58mm' ? '48mm' : '72mm';
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
  const entregaLabel = data.entregaModalidade === "entrega" ? "Delivery" : "Retirada";
  const recebimentoLabel = data.recebimentoModalidade === "coleta" ? "Coleta" : "Balcão";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ROL - ${osNumero}</title>
      <style>
        @page { size: ${width} auto; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { width: 100%; max-width: ${printableWidth}; margin: 0 auto; overflow-x: hidden; }
        body {
          font-family: ${fontFamily};
          width: 100%;
          max-width: ${printableWidth};
          margin: 0 auto;
          padding: ${margemSuperior}px ${margemLateral}px;
          font-size: 10px;
          line-height: 1.3;
          overflow-x: hidden;
        }
        img, svg { max-width: 100%; }
        .header { text-align: center; border-bottom: 1px dashed #666; padding-bottom: 8px; margin-bottom: 8px; }
        .logo { max-height: 40px; margin-bottom: 8px; }
        .company-name { font-size: ${tamanhoNome}px; font-weight: bold; color: ${corPrimaria}; text-transform: uppercase; }
        .cnpj, .address, .contact { font-size: 9px; color: #666; margin-top: 2px; }
        .rol-info { text-align: center; margin-bottom: 8px; }
        .rol-title { font-size: 10px; font-weight: bold; color: ${corSecundaria}; }
        .rol-number { font-size: 9px; color: #666; }
         .rol-barcode { display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 4px; }
         .rol-barcode svg { width: 46%; height: 28px; }
         .rol-barcode-label { font-size: 8px; font-family: monospace; }
        .section { border-top: 1px dashed #666; padding-top: 8px; margin-bottom: 8px; }
        .client-info { font-size: 10px; }
        .previsao { color: #d97706; font-weight: 500; }
        .items-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; color: ${corPrimaria}; margin-bottom: 4px; }
        .item-row { display: flex; justify-content: space-between; font-size: ${tamanhoItem}px; padding: 2px 0; }
        .item-qty { flex: 0 0 18%; overflow-wrap: anywhere; }
         .item-operation { flex: 0 0 9%; text-align: center; }
        .item-name { flex: 1; min-width: 0; text-align: left; overflow-wrap: anywhere; }
        .item-unit { flex: 0 0 18%; text-align: right; overflow-wrap: anywhere; }
        .item-total { flex: 0 0 18%; text-align: right; overflow-wrap: anywhere; }
        .item-details { padding: 1px 0 3px 18%; font-size: 8px; color: #666; overflow-wrap: anywhere; }
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
         <div class="rol-barcode">${generateRolBarcodeSvg(buildOrderScanCode(data.numero))}<span class="rol-barcode-label">${osNumero}</span></div>
      </div>

      <div class="section">
        <div class="client-info"><strong>Cliente:</strong> ${escapeHtml(data.clienteNome)}</div>
         ${data.clienteCodigo ? `<div class="client-info"><strong>Cód.:</strong> ${escapeHtml(data.clienteCodigo)}</div>` : ''}
        ${data.clienteTelefone ? `<div class="client-info"><strong>Tel:</strong> ${escapeHtml(data.clienteTelefone)}</div>` : ''}
         ${addressLines(data.clienteEndereco) ? `<div class="client-info"><strong>Endereço:</strong><br />${addressLines(data.clienteEndereco)}</div>` : ''}
         ${data.atendenteNome ? `<div class="client-info"><strong>Atendente:</strong> ${escapeHtml(data.atendenteNome)}</div>` : ''}
        ${config.previsaoEntrega && data.previsaoEntrega ? `<div class="client-info previsao"><strong>Previsão:</strong> ${data.previsaoEntrega.toLocaleDateString('pt-BR')}</div>` : ''}
        <div class="client-info"><strong>Recebimento:</strong> ${recebimentoLabel}</div>
        <div class="client-info"><strong>Modalidade de entrega:</strong> ${entregaLabel}</div>
      </div>

      ${generateROLCommercialHTML(data, config.tipoPreco)}

      <div class="section">
        <div class="items-header">
          <span class="item-qty">QTD</span>
          <span class="item-name">ITEM</span>
           <span class="item-operation">OP.</span>
          ${config.tipoPreco ? '<span class="item-unit">UNIT</span><span class="item-total">TOTAL</span>' : ''}
        </div>
        ${data.itens.map(item => `
          <div class="item-row-wrap">
            <div class="item-row">
              <span class="item-qty">${escapeHtml(formatRolQuantity(item.quantidade))} ${escapeHtml(formatRolUnit(item.unidade))}</span>
              <span class="item-name">${escapeHtml(item.nome)}</span>
               <span class="item-operation">—</span>
              ${config.tipoPreco ? `<span class="item-unit">${item.precoUnitario.toFixed(2)}</span><span class="item-total">${item.subtotal.toFixed(2)}</span>` : ''}
            </div>
            ${item.detalhes ? `<div class="item-details">${escapeHtml(item.detalhes)}</div>` : ''}
          </div>
        `).join('')}
      </div>

      ${(config.tipoPreco || (data.taxaEntrega ?? 0) > 0 || data.deliveryModelo === "km") ? `
        <div class="totals">
          ${config.tipoPreco ? `
            ${(data.valorDesconto ?? 0) > 0 || (data.valorUrgencia ?? 0) > 0 || (data.taxaEntrega ?? 0) > 0 ? `<div class="total-row"><span>Subtotal:</span><span>${formatRolMoney(data.itens.reduce((sum, item) => sum + item.subtotal, 0))}</span></div>` : ''}
            ${config.linhaDesconto && (data.valorDesconto ?? 0) > 0 ? `<div class="total-row"><span>Desconto:</span><span>- ${formatRolMoney(data.valorDesconto)}</span></div>` : ''}
            ${(data.valorUrgencia ?? 0) > 0 ? `<div class="total-row"><span>Lavagem Expressa:</span><span>+ ${formatRolMoney(data.valorUrgencia)}</span></div>` : ''}
          ` : ''}
          ${(data.taxaEntrega ?? 0) > 0 ? `<div class="total-row"><span>Taxa de delivery:</span><span>+ ${formatRolMoney(data.taxaEntrega)}</span></div>` : ''}
          ${data.deliveryModelo === "km" && data.deliveryDistanciaKm != null ? `<div class="total-row"><span>Distância cobrada:</span><span>${formatRolQuantity(data.deliveryDistanciaKm)} km</span></div><div class="total-row"><span>Tarifa delivery:</span><span>${formatRolMoney(data.deliveryTaxaBase ?? 0)} base + ${formatRolMoney(data.deliveryTaxaKm ?? 0)}/km</span></div>` : ''}
          ${config.tipoPreco ? `
            <div class="total-row grand-total"><span>TOTAL:</span><span>${formatRolMoney(data.valorTotal)}</span></div>
            <div class="total-row"><span>VALOR RECEBIDO:</span><span>${formatRolMoney(data.valorPago)}</span></div>
            <div class="total-row"><span>A PAGAR:</span><span>${formatRolMoney(Math.max(0, data.valorTotal - Number(data.valorPago || 0)))}</span></div>
          ` : ''}
        </div>
      ` : ''}

      ${renderRolLoyaltyBlock(data)}

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

/**
 * Produces the second customer-facing document: the availability/collection
 * receipt. It is deliberately separate from the entry ROL so each action has
 * one unambiguous document and the availability copy can include locations.
 */
export function generateROLDisponibilidadeHTMLWithData(config: ROLPreviewConfig, data: PrintOSData): string {
  const width = config.larguraPapel === "58mm" ? "58mm" : "80mm";
  const printableWidth = config.larguraPapel === "58mm" ? "48mm" : "72mm";
  const fontFamily = getFontFamily(config.fontePrincipal);
  const margemSuperior = boundedNumber(config.margemSuperior, 10, 0, 100);
  const margemLateral = boundedNumber(config.margemLateral, 8, 0, 100);
  const logoUrl = safeHttpsUrl(config.logoUrl);
  const osNumero = escapeHtml(data.numero);
  const locations = data.itens
    .map((item) => item.posicaoPrateleira?.trim())
    .filter((value): value is string => Boolean(value));
  const locationLabel = locations.length > 0 ? [...new Set(locations)].join(" · ") : "A confirmar";
  const paid = Number(data.valorPago || 0);
  const outstanding = Math.max(0, data.valorTotal - paid);
  const address = addressLines(data.clienteEndereco);

  return `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>ROL disponível - ${osNumero}</title>
      <style>
        @page { size: ${width} auto; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { width: 100%; max-width: ${printableWidth}; margin: 0 auto; overflow-x: hidden; }
        body { font-family: ${fontFamily}; width: 100%; max-width: ${printableWidth}; margin: 0 auto; padding: ${margemSuperior}px ${margemLateral}px; font-size: 10px; line-height: 1.3; color: #111; overflow-x: hidden; }
        img, svg, table { max-width: 100%; }
        .header { text-align: center; border-bottom: 1px solid #111; padding-bottom: 7px; margin-bottom: 7px; }
        .logo { max-height: 40px; max-width: 70%; margin-bottom: 5px; }
        .company { font-size: 13px; font-weight: bold; text-transform: uppercase; }
        .muted { color: #444; font-size: 9px; }
        .title { text-align: center; font-size: 14px; font-weight: bold; margin: 4px 0 8px; }
        .section { border-top: 1px solid #111; padding-top: 6px; margin-top: 7px; }
        .section-title { text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 5px; }
        .row { display: flex; justify-content: space-between; gap: 5px; min-width: 0; overflow-wrap: anywhere; }
        .client { line-height: 1.45; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 9px; overflow-wrap: anywhere; }
        th, td { border-bottom: 1px solid #777; padding: 3px 1px; text-align: left; vertical-align: top; }
        th { font-weight: bold; }
        th:last-child, td:last-child { text-align: right; }
        .total { font-weight: bold; font-size: 11px; }
        .loyalty { border: 1px dashed #555; padding: 6px; margin-top: 7px; text-align: center; font-size: 9px; }
        .location { border: 1px solid #111; padding: 6px; text-align: center; font-weight: bold; font-size: 11px; }
        .signature { padding-top: 22px; text-align: center; }
        .signature-line { border-bottom: 1px solid #111; margin: 0 20px 4px; }
        .footer { border-top: 1px solid #111; margin-top: 8px; padding-top: 6px; text-align: center; }
      </style>
    </head><body>
      <div class="header">
        ${config.exibirLogo && logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />` : ""}
        <div class="company">${escapeHtml(config.nomeCompleto || config.nomeCurto)}</div>
        ${config.telefone ? `<div class="muted">Telefone: ${escapeHtml(config.telefone)}</div>` : ""}
        ${config.email ? `<div class="muted">E-mail: ${escapeHtml(config.email)}</div>` : ""}
      </div>
      <div class="title">ROL DISPONÍVEL: ${osNumero}</div>
      <div class="row"><span>Data de disponibilidade: ${formatRolDate(new Date(), true)}</span><span>Atendido por: ${escapeHtml(data.atendenteNome || "—")}</span></div>

      <div class="section client">
        <div class="section-title">DADOS DO CLIENTE</div>
        <div><strong>Nome:</strong> ${escapeHtml(data.clienteNome)}</div>
        ${address ? `<div><strong>Endereço:</strong><br />${address}</div>` : ""}
        ${data.clienteTelefone ? `<div><strong>Telefone:</strong> ${escapeHtml(data.clienteTelefone)}</div>` : ""}
      </div>

      <div class="section">
        <div class="section-title">PEÇAS DISPONÍVEIS</div>
        <table><thead><tr><th>ROL</th><th>ENTRADA</th><th>PEÇA</th><th>LOCAL</th><th>QTD.</th></tr></thead>
          <tbody>${data.itens.map((item) => `<tr><td>${osNumero}</td><td>${formatRolDate(data.dataEmissao)}</td><td>${escapeHtml(item.nome)}</td><td>${escapeHtml(item.posicaoPrateleira || "—")}</td><td>${escapeHtml(`${formatRolQuantity(item.quantidade)} ${formatRolUnit(item.unidade)}`)}</td></tr>`).join("")}</tbody>
        </table>
        <div class="row total" style="margin-top: 5px;"><span>VOLUMES DISPONÍVEIS:</span><span>${escapeHtml(formatRolQuantitySummary(data.itens))}</span></div>
      </div>

      <div class="section">
        <div class="section-title">ROL / PAGAMENTO</div>
        <div class="row"><span>VALOR DO ROL:</span><span>${formatRolMoney(data.valorTotal)}</span></div>
        ${(data.taxaEntrega ?? 0) > 0 ? `<div class="row"><span>TAXA DE DELIVERY:</span><span>${formatRolMoney(data.taxaEntrega)}</span></div>` : ''}
        ${data.deliveryModelo === "km" && data.deliveryDistanciaKm != null ? `<div class="row"><span>DISTÂNCIA COBRADA:</span><span>${formatRolQuantity(data.deliveryDistanciaKm)} km</span></div><div class="row"><span>TARIFA:</span><span>${formatRolMoney(data.deliveryTaxaBase ?? 0)} base + ${formatRolMoney(data.deliveryTaxaKm ?? 0)}/km</span></div>` : ''}
        <div class="row"><span>VALOR RECEBIDO:</span><span>${formatRolMoney(paid)}</span></div>
        <div class="row total"><span>VALOR EM ABERTO:</span><span>${formatRolMoney(outstanding)}</span></div>
        <div class="row"><span>FORMA DE RECEBIMENTO:</span><span>${escapeHtml(data.formaPagamento || getRolCommercialSummary(data).preferredMethod || "Não informada")}</span></div>
      </div>

      <div class="section location">LOCALIZAÇÃO PARA RETIRADA<br />${escapeHtml(locationLabel)}</div>
      ${renderRolLoyaltyBlock(data)}
      ${data.observacoes ? `<div class="section"><strong>Observações:</strong> ${escapeHtml(data.observacoes)}</div>` : ""}
      ${config.assinaturaCliente ? `<div class="signature"><div class="signature-line"></div><div class="muted">Assinatura do Cliente</div></div>` : ""}
      <div class="footer"><div>${escapeHtml(config.textoRodape || "Obrigado pela preferência!")}</div><div class="muted">${escapeHtml(config.slogan)}</div></div>
    </body></html>
  `;
}

