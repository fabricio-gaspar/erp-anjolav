import { supabase } from "@/integrations/supabase/client";
import { ROLPreviewConfig, getFontFamily } from "@/components/configuracoes/ROLPreview";
import { generateCode128BPattern } from "@/lib/code128";
import { escapeHtml, openPrintDocument, safeHttpsUrl } from "@/lib/safePrint";

// ===== INTERFACES =====

export interface PrintOSData {
  numero: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  itens: { nome: string; quantidade: number; precoUnitario: number; subtotal: number }[];
  valorTotal: number;
  dataEmissao: Date;
  previsaoEntrega?: Date;
  observacoes?: string;
  bloco?: string;
  posicao?: string;
}

export interface EtiquetaData {
  osNumero: string;
  clienteNome: string;
  bloco?: string;
  posicao?: string;
  data: Date;
  produtoNome?: string;
  quantidade?: number;
}

export interface EtiquetaConfig {
  tamanhoEtiqueta: string;
  margemSuperior: number;
  margemLateral: number;
  tamanhoFonte: number;
  alturaCodigoBarras: number;
  nomeEmpresa?: string;
}

// ===== BARCODE GENERATOR (Code 128-B) =====

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

export function generateBarcodePattern(text: string): number[] {
  return generateCode128BPattern(text);
}

export function generateBarcodeSVG(text: string, height: number = 50): string {
  const pattern = generateBarcodePattern(text);
  const barWidth = 2;
  const quietZoneModules = 10;
  const totalWidth = (pattern.length + quietZoneModules * 2) * barWidth;
  const safeHeight = boundedNumber(height, 50, 10, 300);
  
  let x = quietZoneModules * barWidth;
  let bars = '';
  
  for (const bit of pattern) {
    if (bit === 1) {
      bars += `<rect x="${x}" y="0" width="${barWidth}" height="${safeHeight}" fill="black"/>`;
    }
    x += barWidth;
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${safeHeight}" viewBox="0 0 ${totalWidth} ${safeHeight}">${bars}</svg>`;
}

// ===== FETCH OS DATA =====

export async function fetchOSPrintData(ordemServicoId: string): Promise<PrintOSData | null> {
  try {
    // Fetch OS with client
    const { data: ordem, error: osError } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        cliente:clientes(razao_social, telefone, email)
      `)
      .eq("id", ordemServicoId)
      .single();

    if (osError || !ordem) return null;

    // Fetch items
    const { data: itens, error: itensError } = await supabase
      .from("itens_ordem_servico")
      .select(`
        *,
        produto:produtos(nome, unidade)
      `)
      .eq("ordem_servico_id", ordemServicoId);

    if (itensError) return null;

    const itensFormatted = (itens || []).map(item => ({
      nome: item.produto?.nome || "Produto",
      quantidade: Number(item.quantidade),
      precoUnitario: Number(item.preco_unitario),
      subtotal: Number(item.subtotal),
    }));

    const valorTotal = itensFormatted.reduce((acc, item) => acc + item.subtotal, 0);

    // Extrair prateleira/posição do primeiro item que tenha posicao_prateleira
    let bloco: string | undefined;
    let posicao: string | undefined;
    const itemComPosicao = (itens || []).find(item => item.posicao_prateleira);
    if (itemComPosicao?.posicao_prateleira) {
      const parts = itemComPosicao.posicao_prateleira.split('-');
      if (parts.length >= 3) {
        bloco = parts[0];
        posicao = parts.slice(1).join('-');
      } else if (parts.length === 2) {
        bloco = parts[0];
        posicao = parts[1];
      } else {
        posicao = itemComPosicao.posicao_prateleira;
      }
    }

    return {
      numero: ordem.numero,
      clienteNome: ordem.cliente?.razao_social || "Cliente",
      clienteTelefone: ordem.cliente?.telefone || undefined,
      clienteEmail: ordem.cliente?.email || undefined,
      itens: itensFormatted,
      valorTotal,
      dataEmissao: new Date(ordem.created_at),
      previsaoEntrega: ordem.data_previsao_entrega ? new Date(ordem.data_previsao_entrega + 'T00:00:00') : undefined,
      observacoes: ordem.observacoes || undefined,
      bloco,
      posicao,
    };
  } catch (error) {
    console.error("Error fetching OS print data:", error);
    return null;
  }
}

// ===== FETCH CONFIGS =====

export async function fetchROLConfig(): Promise<ROLPreviewConfig | null> {
  try {
    const { data, error } = await supabase
      .from("rol_configuracoes")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      nomeCurto: data.nome_curto || "AnjoLav",
      slogan: data.slogan || "",
      nomeCompleto: data.nome_completo || "",
      corPrimaria: data.cor_primaria || "#3c62f6",
      corSecundaria: data.cor_secundaria || "#2583eb",
      telefone: data.telefone || "",
      email: data.email || "",
      cnpj: data.cnpj || "",
      endereco: data.endereco || "",
      exibirLogo: data.exibir_logo ?? true,
      logoUrl: data.logo_url || "",
      larguraPapel: data.largura_papel || "80mm",
      fontePrincipal: data.fonte_principal || "courier",
      tamanhoNome: data.tamanho_nome || 14,
      tamanhoItem: data.tamanho_item || 11,
      tamanhoTotal: data.tamanho_total || 14,
      previsaoEntrega: data.previsao_entrega ?? true,
      bloco: data.bloco ?? false,
      observacoes: data.observacoes ?? true,
      assinaturaCliente: data.assinatura_cliente ?? true,
      tipoPreco: data.tipo_preco ?? true,
      linhaDesconto: data.linha_desconto ?? true,
      textoRodape: data.texto_rodape || "Obrigado pela preferência!",
      margemSuperior: data.margem_superior || 10,
      margemLateral: data.margem_lateral || 8,
    };
  } catch {
    return null;
  }
}

export async function fetchEtiquetaConfig(): Promise<EtiquetaConfig | null> {
  try {
    const { data, error } = await supabase
      .from("etiquetas_configuracoes")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) return null;

    // Also fetch company name
    const { data: rolData } = await supabase
      .from("rol_configuracoes")
      .select("nome_curto, nome_completo")
      .limit(1)
      .single();

    return {
      tamanhoEtiqueta: data.tamanho_etiqueta || "10x15",
      margemSuperior: data.margem_superior || 5,
      margemLateral: data.margem_lateral || 5,
      tamanhoFonte: data.tamanho_fonte || 12,
      alturaCodigoBarras: data.altura_codigo_barras || 50,
      nomeEmpresa: rolData?.nome_completo || rolData?.nome_curto || "ANJOLAV",
    };
  } catch {
    return null;
  }
}

// ===== GENERATE ROL HTML WITH REAL DATA =====

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
        .item-qty { width: 25px; }
        .item-name { flex: 1; text-align: left; }
        .item-unit { width: 45px; text-align: right; }
        .item-total { width: 50px; text-align: right; }
        .totals { border-top: 1px dashed #666; padding-top: 8px; margin-bottom: 8px; }
        .total-row { display: flex; justify-content: space-between; font-size: 10px; }
        .grand-total { font-size: ${tamanhoTotal}px; font-weight: bold; color: ${corPrimaria}; margin-top: 4px; }
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
        <div class="rol-title">RECIBO DE LAVANDERIA</div>
        <div class="rol-number">Nº ${osNumero} - ${escapeHtml(data.dataEmissao.toLocaleDateString('pt-BR'))} ${escapeHtml(data.dataEmissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</div>
      </div>

      <div class="section">
        <div class="client-info"><strong>Cliente:</strong> ${escapeHtml(data.clienteNome)}</div>
        ${data.clienteTelefone ? `<div class="client-info"><strong>Tel:</strong> ${escapeHtml(data.clienteTelefone)}</div>` : ''}
        ${config.previsaoEntrega && data.previsaoEntrega ? `<div class="client-info previsao"><strong>Previsão:</strong> ${data.previsaoEntrega.toLocaleDateString('pt-BR')}</div>` : ''}
      </div>

      <div class="section">
        <div class="items-header">
          <span class="item-qty">QTD</span>
          <span class="item-name">ITEM</span>
          ${config.tipoPreco ? '<span class="item-unit">UNIT</span><span class="item-total">TOTAL</span>' : ''}
        </div>
        ${data.itens.map(item => `
          <div class="item-row">
            <span class="item-qty">${item.quantidade}x</span>
            <span class="item-name">${escapeHtml(item.nome)}</span>
            ${config.tipoPreco ? `<span class="item-unit">${item.precoUnitario.toFixed(2)}</span><span class="item-total">${item.subtotal.toFixed(2)}</span>` : ''}
          </div>
        `).join('')}
      </div>

      ${config.tipoPreco ? `
        <div class="totals">
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>R$ ${data.valorTotal.toFixed(2)}</span>
          </div>
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

// ===== GENERATE ETIQUETA HTML WITH REAL DATA =====

function getEtiquetaDimensions(tamanho: string): { w: string; h: string } {
  const sizes: Record<string, { w: string; h: string }> = {
    '10x15': { w: '100mm', h: '150mm' },
    '10x10': { w: '100mm', h: '100mm' },
    '5x2.5': { w: '50mm', h: '25mm' },
    '10x5': { w: '100mm', h: '50mm' },
    '3x2': { w: '30mm', h: '20mm' },
  };
  return sizes[tamanho] || sizes['10x15'];
}

export function generateEtiquetaHTMLWithData(config: EtiquetaConfig, data: EtiquetaData): string {
  const size = getEtiquetaDimensions(config.tamanhoEtiqueta);
  const barcodeSVG = generateBarcodeSVG(data.osNumero, config.alturaCodigoBarras);
  const margemSuperior = boundedNumber(config.margemSuperior, 5, 0, 100);
  const margemLateral = boundedNumber(config.margemLateral, 5, 0, 100);
  const tamanhoFonte = boundedNumber(config.tamanhoFonte, 12, 6, 72);
  const osNumero = escapeHtml(data.osNumero);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta - ${osNumero}</title>
      <style>
        @page { size: ${size.w} ${size.h}; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          width: ${size.w};
          height: ${size.h};
          padding: ${margemSuperior}mm ${margemLateral}mm;
          display: flex;
          flex-direction: column;
        }
        .header { text-align: center; margin-bottom: 3mm; }
        .company { font-size: ${tamanhoFonte}px; font-weight: bold; text-transform: uppercase; }
        .content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .os-number { font-size: ${tamanhoFonte + 2}px; font-weight: bold; margin-bottom: 2mm; }
        .client { font-size: ${Math.max(6, tamanhoFonte - 2)}px; color: #444; margin-bottom: 2mm; text-align: center; }
        .produto { font-size: ${tamanhoFonte}px; font-weight: bold; color: #222; margin-bottom: 1mm; text-align: center; text-transform: uppercase; }
        .quantidade { font-size: ${Math.max(6, tamanhoFonte - 1)}px; font-weight: bold; color: #000; margin-bottom: 3mm; text-align: center; background: #f0f0f0; padding: 1mm 3mm; border-radius: 2px; }
        .barcode { display: flex; justify-content: center; margin-bottom: 1mm; }
        .barcode-number { font-size: ${Math.max(6, tamanhoFonte - 4)}px; font-family: monospace; color: #666; }
        .footer { text-align: center; margin-top: 2mm; }
        .location { font-size: ${Math.max(6, tamanhoFonte - 4)}px; color: #666; }
        .date { font-size: ${Math.max(6, tamanhoFonte - 4)}px; color: #888; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">${escapeHtml(config.nomeEmpresa || 'ANJOLAV LAVANDERIA')}</div>
      </div>
      
      <div class="content">
        <div class="os-number">OS: ${osNumero}</div>
        <div class="client">${escapeHtml(data.clienteNome)}</div>
        ${data.produtoNome ? `<div class="produto">${escapeHtml(data.produtoNome)}</div><div class="quantidade">QTD: ${escapeHtml(data.quantidade || 1)} peça(s)</div>` : ''}
        
        <div class="barcode">${barcodeSVG}</div>
        <div class="barcode-number">${osNumero}</div>
      </div>
      
      <div class="footer">
        ${(data.bloco || data.posicao) ? `<div class="location">${data.bloco ? `Bloco: ${escapeHtml(data.bloco)}` : ''} ${data.bloco && data.posicao ? '|' : ''} ${data.posicao ? `Pos: ${escapeHtml(data.posicao)}` : ''}</div>` : ''}
        <div class="date">${data.data.toLocaleDateString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;
}

// ===== PRINT FUNCTIONS =====

function openPrintWindow(html: string) {
  const printWindow = openPrintDocument(html, 'width=400,height=600,noopener,noreferrer');
  
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }
}

export async function printROLFromOS(ordemServicoId: string): Promise<boolean> {
  const [config, osData] = await Promise.all([
    fetchROLConfig(),
    fetchOSPrintData(ordemServicoId),
  ]);

  if (!config || !osData) return false;

  const html = generateROLHTMLWithData(config, osData);
  openPrintWindow(html);
  return true;
}

export async function printEtiquetaFromOS(ordemServicoId: string): Promise<boolean> {
  const [config, osData] = await Promise.all([
    fetchEtiquetaConfig(),
    fetchOSPrintData(ordemServicoId),
  ]);

  if (!config || !osData) return false;

  // Generate one label per item type
  if (osData.itens.length > 0) {
    const html = generateMultipleItemLabelsHTML(config, osData);
    openPrintWindow(html);
  } else {
    const etiquetaData: EtiquetaData = {
      osNumero: osData.numero,
      clienteNome: osData.clienteNome,
      bloco: osData.bloco,
      posicao: osData.posicao,
      data: osData.dataEmissao,
    };
    const html = generateEtiquetaHTMLWithData(config, etiquetaData);
    openPrintWindow(html);
  }
  return true;
}

export async function printMultipleEtiquetas(ordemServicoId: string, _quantidade: number): Promise<boolean> {
  const [config, osData] = await Promise.all([
    fetchEtiquetaConfig(),
    fetchOSPrintData(ordemServicoId),
  ]);

  if (!config || !osData) return false;

  // Generate one label per item type (ignoring manual quantidade, using actual items)
  if (osData.itens.length > 0) {
    const html = generateMultipleItemLabelsHTML(config, osData);
    openPrintWindow(html);
  } else {
    // Fallback: single generic label
    const etiquetaData: EtiquetaData = {
      osNumero: osData.numero,
      clienteNome: osData.clienteNome,
      bloco: osData.bloco,
      posicao: osData.posicao,
      data: osData.dataEmissao,
    };
    const html = generateEtiquetaHTMLWithData(config, etiquetaData);
    openPrintWindow(html);
  }
  return true;
}

// Generate a print page with one label per item type
function generateMultipleItemLabelsHTML(config: EtiquetaConfig, osData: PrintOSData): string {
  const size = getEtiquetaDimensions(config.tamanhoEtiqueta);
  const margemSuperior = boundedNumber(config.margemSuperior, 5, 0, 100);
  const margemLateral = boundedNumber(config.margemLateral, 5, 0, 100);
  const tamanhoFonte = boundedNumber(config.tamanhoFonte, 12, 6, 72);
  const osNumero = escapeHtml(osData.numero);

  const labels = osData.itens.map(item => {
    const barcodeSVG = generateBarcodeSVG(osData.numero, config.alturaCodigoBarras);
    return `
      <div class="label">
        <div class="header">
          <div class="company">${escapeHtml(config.nomeEmpresa || 'ANJOLAV LAVANDERIA')}</div>
        </div>
        <div class="content">
          <div class="os-number">OS: ${osNumero}</div>
          <div class="client">${escapeHtml(osData.clienteNome)}</div>
          <div class="produto">${escapeHtml(item.nome)}</div>
          <div class="quantidade">QTD: ${escapeHtml(item.quantidade)} peça(s)</div>
          <div class="barcode">${barcodeSVG}</div>
          <div class="barcode-number">${osNumero}</div>
        </div>
        <div class="footer">
          ${(osData.bloco || osData.posicao) ? `<div class="location">${osData.bloco ? `Bloco: ${escapeHtml(osData.bloco)}` : ''} ${osData.bloco && osData.posicao ? '|' : ''} ${osData.posicao ? `Pos: ${escapeHtml(osData.posicao)}` : ''}</div>` : ''}
          <div class="date">${osData.dataEmissao.toLocaleDateString('pt-BR')}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiquetas - ${osNumero}</title>
      <style>
        @page { size: ${size.w} ${size.h}; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; }
        .label {
          width: ${size.w};
          height: ${size.h};
          padding: ${margemSuperior}mm ${margemLateral}mm;
          display: flex;
          flex-direction: column;
          page-break-after: always;
        }
        .label:last-child { page-break-after: auto; }
        .header { text-align: center; margin-bottom: 3mm; }
        .company { font-size: ${tamanhoFonte}px; font-weight: bold; text-transform: uppercase; }
        .content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .os-number { font-size: ${tamanhoFonte + 2}px; font-weight: bold; margin-bottom: 2mm; }
        .client { font-size: ${Math.max(6, tamanhoFonte - 2)}px; color: #444; margin-bottom: 2mm; text-align: center; }
        .produto { font-size: ${tamanhoFonte}px; font-weight: bold; color: #222; margin-bottom: 1mm; text-align: center; text-transform: uppercase; }
        .quantidade { font-size: ${Math.max(6, tamanhoFonte - 1)}px; font-weight: bold; color: #000; margin-bottom: 3mm; text-align: center; background: #f0f0f0; padding: 1mm 3mm; border-radius: 2px; }
        .barcode { display: flex; justify-content: center; margin-bottom: 1mm; }
        .barcode-number { font-size: ${Math.max(6, tamanhoFonte - 4)}px; font-family: monospace; color: #666; }
        .footer { text-align: center; margin-top: 2mm; }
        .location { font-size: ${Math.max(6, tamanhoFonte - 4)}px; color: #666; }
        .date { font-size: ${Math.max(6, tamanhoFonte - 4)}px; color: #888; }
      </style>
    </head>
    <body>
      ${labels}
    </body>
    </html>
  `;
}
