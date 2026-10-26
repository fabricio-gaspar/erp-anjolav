import { supabase } from "@/integrations/supabase/client";
import type { ROLPreviewConfig } from "@/components/configuracoes/ROLPreview";
import { generateROLHTMLWithData, buildRolOrderDetails, type PrintOSData, type RolOrderCommercialSnapshot } from "@/lib/rolPrint";
export { generateROLHTMLWithData, type PrintOSData } from "@/lib/rolPrint";
import { generateCode128BPattern } from "@/lib/code128";
import { escapeHtml, openPrintDocument, printDocumentWhenReady, reservePrintWindow, safeHttpsUrl, writePrintDocument } from "@/lib/safePrint";

// ===== INTERFACES =====

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
    // Fetch the records independently. The schema keeps both a direct FK and
    // a tenant-scoped composite FK for these relations; PostgREST embeds can
    // therefore fail with HTTP 300 even when an explicit FK hint is present.
    const { data: ordem, error: osError } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("id", ordemServicoId)
      .single();

    if (osError || !ordem) {
      console.error("Error fetching OS for ROL:", osError);
      return null;
    }

    const [clienteResult, itensResult] = await Promise.all([
      ordem.cliente_id
        ? supabase
            .from("clientes")
            .select("razao_social, telefone, email, tabela_preco_tipo")
            .eq("id", ordem.cliente_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("itens_ordem_servico")
        .select("*")
        .eq("ordem_servico_id", ordemServicoId),
    ]);

    const { data: cliente, error: clienteError } = clienteResult;
    const { data: itens, error: itensError } = itensResult;
    if (clienteError || itensError) {
      console.error("Error fetching ROL relations:", { clienteError, itensError });
      return null;
    }

    const produtoIds = [...new Set((itens || []).map(item => item.produto_id).filter(Boolean))];
    const { data: produtos, error: produtosError } = produtoIds.length > 0
      ? await supabase
          .from("produtos")
          .select("id, nome, unidade")
          .in("id", produtoIds)
      : { data: [], error: null };

    if (produtosError) {
      console.error("Error fetching ROL products:", produtosError);
      return null;
    }

    const produtoById = new Map((produtos || []).map(produto => [produto.id, produto]));

    const itensFormatted = (itens || []).map(item => ({
      nome: produtoById.get(item.produto_id)?.nome || "Produto",
      unidade: produtoById.get(item.produto_id)?.unidade || undefined,
      quantidade: Number(item.quantidade),
      precoUnitario: Number(item.preco_unitario),
      subtotal: Number(item.subtotal),
    }));

    // The new columns are returned by select("*") until generated types catch up.
    const commercialSnapshot = ordem as typeof ordem & RolOrderCommercialSnapshot;
    const orderDetails = buildRolOrderDetails(commercialSnapshot, itensFormatted, cliente?.tabela_preco_tipo);

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

    type LoyaltyResponse = PrintOSData["fidelidade"];
    let fidelidade: LoyaltyResponse | null = null;
    try {
      const typedRpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: LoyaltyResponse | null; error: unknown }>;
      const loyaltyResult = await typedRpc("consultar_fidelidade_rol", { _ordem_servico_id: ordemServicoId });
      fidelidade = loyaltyResult.data;
    } catch (error) {
      // Loyalty is optional for the ROL. A missing/temporarily unavailable RPC
      // must not prevent printing the OS, customer and item data already loaded.
      console.warn("Loyalty data unavailable for ROL:", error);
    }

    return {
      numero: ordem.numero,
      clienteNome: cliente?.razao_social || "Cliente",
      clienteTelefone: cliente?.telefone || undefined,
      clienteEmail: cliente?.email || undefined,
      itens: itensFormatted,
      ...orderDetails,
      dataEmissao: new Date(ordem.created_at),
      previsaoEntrega: ordem.data_previsao_entrega ? new Date(ordem.data_previsao_entrega + 'T00:00:00') : undefined,
      observacoes: ordem.observacoes || undefined,
      bloco,
      posicao,
      fidelidade: fidelidade ?? undefined,
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
      exibirFidelidade: data.exibir_fidelidade ?? true,
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

function openPrintWindow(html: string, reservedWindow?: Window | null): boolean {
  const printWindow = reservedWindow ?? openPrintDocument(html, 'width=400,height=600,noopener,noreferrer');
  if (!printWindow) return false;
  if (reservedWindow) writePrintDocument(printWindow, html);
  return printDocumentWhenReady(printWindow);
}

export async function printROLFromOS(ordemServicoId: string, reservedWindow?: Window | null): Promise<boolean> {
  const printWindow = reservedWindow ?? reservePrintWindow('width=400,height=600,noopener,noreferrer');
  if (!printWindow) return false;

  const [config, osData] = await Promise.all([
    fetchROLConfig(),
    fetchOSPrintData(ordemServicoId),
  ]);

  if (!config || !osData) {
    printWindow.close();
    return false;
  }

  const html = generateROLHTMLWithData(config, osData);
  return openPrintWindow(html, printWindow);
}

export async function printEtiquetaFromOS(ordemServicoId: string, reservedWindow?: Window | null): Promise<boolean> {
  const printWindow = reservedWindow ?? reservePrintWindow('width=400,height=600,noopener,noreferrer');
  if (!printWindow) return false;

  const [config, osData] = await Promise.all([
    fetchEtiquetaConfig(),
    fetchOSPrintData(ordemServicoId),
  ]);

  if (!config || !osData) {
    printWindow.close();
    return false;
  }

  // Generate one label per item type
  if (osData.itens.length > 0) {
    const html = generateMultipleItemLabelsHTML(config, osData);
    return openPrintWindow(html, printWindow);
  } else {
    const etiquetaData: EtiquetaData = {
      osNumero: osData.numero,
      clienteNome: osData.clienteNome,
      bloco: osData.bloco,
      posicao: osData.posicao,
      data: osData.dataEmissao,
    };
    const html = generateEtiquetaHTMLWithData(config, etiquetaData);
    return openPrintWindow(html, printWindow);
  }
}

export async function printMultipleEtiquetas(ordemServicoId: string, _quantidade: number, reservedWindow?: Window | null): Promise<boolean> {
  const printWindow = reservedWindow ?? reservePrintWindow('width=400,height=600,noopener,noreferrer');
  if (!printWindow) return false;

  const [config, osData] = await Promise.all([
    fetchEtiquetaConfig(),
    fetchOSPrintData(ordemServicoId),
  ]);

  if (!config || !osData) {
    printWindow.close();
    return false;
  }

  // Generate one label per item type (ignoring manual quantidade, using actual items)
  if (osData.itens.length > 0) {
    const html = generateMultipleItemLabelsHTML(config, osData);
    return openPrintWindow(html, printWindow);
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
    return openPrintWindow(html, printWindow);
  }
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
