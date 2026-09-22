import { escapeHtml, openPrintDocument, safeHttpsUrl } from "@/lib/safePrint";

export interface ROLPreviewConfig {
  nomeCurto: string;
  slogan: string;
  nomeCompleto: string;
  corPrimaria: string;
  corSecundaria: string;
  telefone: string;
  email: string;
  cnpj: string;
  endereco: string;
  exibirLogo: boolean;
  logoUrl: string;
  larguraPapel: string;
  fontePrincipal: string;
  tamanhoNome: number;
  tamanhoItem: number;
  tamanhoTotal: number;
  previsaoEntrega: boolean;
  bloco: boolean;
  observacoes: boolean;
  assinaturaCliente: boolean;
  tipoPreco: boolean;
  linhaDesconto: boolean;
  textoRodape: string;
  margemSuperior: number;
  margemLateral: number;
}

interface ROLPreviewProps {
  config: ROLPreviewConfig;
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

const boundedNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.min(max, Math.max(min, numericValue))
    : fallback;
};

const safeColor = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)
    ? value
    : fallback;

export const generateROLHTML = (config: ROLPreviewConfig) => {
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
  const sampleDate = new Date();
  const sampleDelivery = new Date(sampleDate);
  sampleDelivery.setDate(sampleDelivery.getDate() + 3);

  const sampleItems = [
    { qty: 5, name: 'Camisa Social', unit: 8.50, total: 42.50 },
    { qty: 3, name: 'Calça Jeans', unit: 12.00, total: 36.00 },
    { qty: 2, name: 'Vestido', unit: 18.00, total: 36.00 },
  ];
  const subtotal = 114.50;
  const desconto = 11.45;
  const total = 103.05;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ROL de amostra - ${escapeHtml(config.nomeCompleto || config.nomeCurto)}</title>
      <style>
        @page {
          size: ${width} auto;
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: ${fontFamily};
          width: ${width};
          padding: ${margemSuperior}px ${margemLateral}px;
          font-size: 10px;
          line-height: 1.3;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed #666;
          padding-bottom: 8px;
          margin-bottom: 8px;
        }
        .logo {
          max-height: 40px;
          margin-bottom: 8px;
        }
        .company-name {
          font-size: ${tamanhoNome}px;
          font-weight: bold;
          color: ${corPrimaria};
          text-transform: uppercase;
        }
        .cnpj, .address, .contact {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }
        .rol-info {
          text-align: center;
          margin-bottom: 8px;
        }
        .rol-title {
          font-size: 10px;
          font-weight: bold;
          color: ${corSecundaria};
        }
        .rol-number {
          font-size: 9px;
          color: #666;
        }
        .section {
          border-top: 1px dashed #666;
          padding-top: 8px;
          margin-bottom: 8px;
        }
        .client-info {
          font-size: 10px;
        }
        .previsao {
          color: #d97706;
          font-weight: 500;
        }
        .items-header {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          font-weight: bold;
          color: ${corPrimaria};
          margin-bottom: 4px;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          font-size: ${tamanhoItem}px;
          padding: 2px 0;
        }
        .item-qty { width: 25px; }
        .item-name { flex: 1; text-align: left; }
        .item-unit { width: 45px; text-align: right; }
        .item-total { width: 50px; text-align: right; }
        .totals {
          border-top: 1px dashed #666;
          padding-top: 8px;
          margin-bottom: 8px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        .discount {
          color: #059669;
        }
        .grand-total {
          font-size: ${tamanhoTotal}px;
          font-weight: bold;
          color: ${corPrimaria};
          margin-top: 4px;
        }
        .obs {
          font-size: 9px;
          color: #666;
        }
        .bloco {
          font-size: 9px;
          text-align: center;
          color: #888;
        }
        .signature {
          padding-top: 20px;
          margin-bottom: 8px;
        }
        .signature-line {
          border-bottom: 1px solid #666;
          margin: 0 20px 4px 20px;
        }
        .signature-label {
          font-size: 9px;
          text-align: center;
          color: #888;
        }
        .footer {
          border-top: 1px dashed #666;
          padding-top: 8px;
          text-align: center;
        }
        .footer-text {
          font-size: 9px;
          color: #888;
        }
        .footer-slogan {
          font-size: 8px;
          color: #aaa;
          margin-top: 4px;
        }
        .sample-warning {
          color: #b91c1c;
          font-size: 8px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 6px;
        }
      </style>
    </head>
    <body>
      <div class="sample-warning">AMOSTRA — NÃO USAR COMO COMPROVANTE</div>
      <div class="header">
        ${config.exibirLogo && logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />` : ''}
        <div class="company-name">${escapeHtml(config.nomeCompleto || config.nomeCurto)}</div>
        ${config.cnpj ? `<div class="cnpj">CNPJ: ${escapeHtml(config.cnpj)}</div>` : ''}
        ${config.endereco ? `<div class="address">${escapeHtml(config.endereco)}</div>` : ''}
        ${config.telefone || config.email ? `<div class="contact">${escapeHtml(config.telefone)}${config.telefone && config.email ? ' | ' : ''}${escapeHtml(config.email)}</div>` : ''}
      </div>

      <div class="rol-info">
        <div class="rol-title">RECIBO DE LAVANDERIA</div>
        <div class="rol-number">Nº AMOSTRA-00001 - ${sampleDate.toLocaleDateString('pt-BR')} ${sampleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      <div class="section">
        <div class="client-info"><strong>Cliente:</strong> CLIENTE DE EXEMPLO</div>
        ${config.previsaoEntrega ? `<div class="client-info previsao"><strong>Previsão:</strong> ${sampleDelivery.toLocaleDateString('pt-BR')}</div>` : ''}
      </div>

      <div class="section">
        <div class="items-header">
          <span class="item-qty">QTD</span>
          <span class="item-name">ITEM</span>
          ${config.tipoPreco ? '<span class="item-unit">UNIT</span><span class="item-total">TOTAL</span>' : ''}
        </div>
        ${sampleItems.map(item => `
          <div class="item-row">
            <span class="item-qty">${item.qty}x</span>
            <span class="item-name">${item.name}</span>
            ${config.tipoPreco ? `<span class="item-unit">${item.unit.toFixed(2)}</span><span class="item-total">${item.total.toFixed(2)}</span>` : ''}
          </div>
        `).join('')}
      </div>

      ${config.tipoPreco ? `
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>R$ ${subtotal.toFixed(2)}</span>
          </div>
          ${config.linhaDesconto ? `
            <div class="total-row discount">
              <span>Desconto (10%):</span>
              <span>- R$ ${desconto.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>R$ ${total.toFixed(2)}</span>
          </div>
        </div>
      ` : ''}

      ${config.observacoes ? `
        <div class="section">
          <div class="obs"><strong>Obs:</strong> OBSERVAÇÃO DE EXEMPLO.</div>
        </div>
      ` : ''}

      ${config.bloco ? `
        <div class="section">
          <div class="bloco">Bloco: A | Posição: 15</div>
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
};

export const printROL = (config: ROLPreviewConfig) => {
  const html = generateROLHTML(config);
  const printWindow = openPrintDocument(html, 'width=400,height=600,noopener,noreferrer');
  
  if (printWindow) {
    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }
};

export function ROLPreview({ config }: ROLPreviewProps) {
  const width = config.larguraPapel === '58mm' ? '220px' : '300px';
  const fontFamily = getFontFamily(config.fontePrincipal);
  const margemSuperior = boundedNumber(config.margemSuperior, 10, 0, 100);
  const margemLateral = boundedNumber(config.margemLateral, 8, 0, 100);
  const tamanhoNome = boundedNumber(config.tamanhoNome, 14, 6, 72);
  const tamanhoItem = boundedNumber(config.tamanhoItem, 11, 6, 72);
  const tamanhoTotal = boundedNumber(config.tamanhoTotal, 14, 6, 72);
  const corPrimaria = safeColor(config.corPrimaria, "#3c62f6");
  const corSecundaria = safeColor(config.corSecundaria, "#2583eb");
  const logoUrl = safeHttpsUrl(config.logoUrl);
  const sampleDate = new Date();
  const sampleDelivery = new Date(sampleDate);
  sampleDelivery.setDate(sampleDelivery.getDate() + 3);

  // Sample data for preview
  const sampleItems = [
    { qty: 5, name: 'Camisa Social', unit: 8.50, total: 42.50 },
    { qty: 3, name: 'Calça Jeans', unit: 12.00, total: 36.00 },
    { qty: 2, name: 'Vestido', unit: 18.00, total: 36.00 },
  ];
  const subtotal = 114.50;
  const desconto = 11.45;
  const total = 103.05;

  return (
    <div 
      className="bg-white border-2 border-dashed border-gray-300 mx-auto overflow-hidden"
      style={{ 
        width,
        fontFamily,
        padding: `${margemSuperior}px ${margemLateral}px`,
      }}
    >
      <p className="mb-1 text-center text-[8px] font-bold text-red-700">
        AMOSTRA — NÃO USAR COMO COMPROVANTE
      </p>
      {/* Header */}
      <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
        {config.exibirLogo && logoUrl && (
          <div className="flex justify-center mb-2">
            <img 
              src={logoUrl}
              alt="Logo" 
              className="h-12 object-contain"
            />
          </div>
        )}
        <p 
          className="font-bold uppercase"
          style={{ 
            fontSize: `${tamanhoNome}px`,
            color: corPrimaria
          }}
        >
          {config.nomeCompleto || config.nomeCurto}
        </p>
        {config.cnpj && (
          <p className="text-[10px] text-gray-600">CNPJ: {config.cnpj}</p>
        )}
        {config.endereco && (
          <p className="text-[9px] text-gray-500 mt-1">{config.endereco}</p>
        )}
        {(config.telefone || config.email) && (
          <p className="text-[9px] text-gray-500">
            {config.telefone}{config.telefone && config.email && ' | '}{config.email}
          </p>
        )}
      </div>

      {/* ROL Info */}
      <div className="text-center mb-2">
        <p className="text-[10px] font-bold" style={{ color: corSecundaria }}>
          RECIBO DE LAVANDERIA
        </p>
        <p className="text-[9px] text-gray-600">
          Nº AMOSTRA-00001 - {sampleDate.toLocaleDateString("pt-BR")} {sampleDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Cliente */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        <p className="text-[10px]"><strong>Cliente:</strong> CLIENTE DE EXEMPLO</p>
        {config.previsaoEntrega && (
          <p className="text-[10px] text-amber-600 font-medium">
            <strong>Previsão:</strong> {sampleDelivery.toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      {/* Items */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        <div className="text-[9px] font-bold flex justify-between mb-1" style={{ color: corPrimaria }}>
          <span>QTD</span>
          <span className="flex-1 text-left ml-2">ITEM</span>
          {config.tipoPreco && (
            <>
              <span className="w-12 text-right">UNIT</span>
              <span className="w-14 text-right">TOTAL</span>
            </>
          )}
        </div>
        {sampleItems.map((item, idx) => (
          <div 
            key={idx} 
            className="flex justify-between text-[9px] py-0.5"
            style={{ fontSize: `${tamanhoItem}px` }}
          >
            <span className="w-6">{item.qty}x</span>
            <span className="flex-1 text-left truncate">{item.name}</span>
            {config.tipoPreco && (
              <>
                <span className="w-12 text-right">{item.unit.toFixed(2)}</span>
                <span className="w-14 text-right">{item.total.toFixed(2)}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
        {config.tipoPreco && (
          <div className="flex justify-between text-[10px]">
            <span>Subtotal:</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
        )}
        {config.linhaDesconto && config.tipoPreco && (
          <div className="flex justify-between text-[10px] text-emerald-600">
            <span>Desconto (10%):</span>
            <span>- R$ {desconto.toFixed(2)}</span>
          </div>
        )}
        {config.tipoPreco && (
          <div 
            className="flex justify-between font-bold mt-1"
            style={{ 
              fontSize: `${tamanhoTotal}px`,
              color: corPrimaria
            }}
          >
            <span>TOTAL:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Observações */}
      {config.observacoes && (
        <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
          <p className="text-[9px] text-gray-600">
            <strong>Obs:</strong> OBSERVAÇÃO DE EXEMPLO.
          </p>
        </div>
      )}

      {/* Bloco */}
      {config.bloco && (
        <div className="border-t border-dashed border-gray-400 pt-2 mb-2">
          <p className="text-[9px] text-center text-gray-500">
            Bloco: A | Posição: 15
          </p>
        </div>
      )}

      {/* Assinatura */}
      {config.assinaturaCliente && (
        <div className="border-t border-dashed border-gray-400 pt-4 mb-2">
          <div className="border-b border-gray-400 mx-4 mb-1"></div>
          <p className="text-[9px] text-center text-gray-500">
            Assinatura do Cliente
          </p>
        </div>
      )}

      {/* Rodapé */}
      <div className="border-t border-dashed border-gray-400 pt-2 text-center">
        <p className="text-[9px] text-gray-500">
          {config.textoRodape || 'Obrigado pela preferência!'}
        </p>
        <p className="text-[8px] text-gray-400 mt-1">
          {config.slogan}
        </p>
      </div>
    </div>
  );
}
