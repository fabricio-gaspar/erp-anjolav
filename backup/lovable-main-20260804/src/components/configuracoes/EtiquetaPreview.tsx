import { generateBarcodePattern } from "@/services/printService";

export interface EtiquetaPreviewConfig {
  tamanhoEtiqueta: string;
  margemSuperior: number;
  margemLateral: number;
  tamanhoFonte: number;
  alturaCodigoBarras: number;
  nomeEmpresa?: string;
}

interface EtiquetaPreviewProps {
  config: EtiquetaPreviewConfig;
  data?: {
    osNumero: string;
    clienteNome: string;
    bloco?: string;
    posicao?: string;
    data?: Date;
  };
}

const getEtiquetaDimensions = (tamanho: string) => {
  switch (tamanho) {
    case '10x15': return { width: 200, height: 300 };
    case '10x10': return { width: 200, height: 200 };
    case '5x2.5': return { width: 200, height: 100 };
    case '10x5': return { width: 200, height: 100 };
    case '3x2': return { width: 150, height: 100 };
    default: return { width: 200, height: 300 };
  }
};

// Real barcode component using Code128 pattern
function BarcodeDisplay({ text, height }: { text: string; height: number }) {
  const pattern = generateBarcodePattern(text);
  const barWidth = 1.5;
  
  return (
    <div className="flex items-end justify-center" style={{ height: `${height}px` }}>
      {pattern.map((bit, idx) => (
        <div
          key={idx}
          style={{
            width: `${barWidth}px`,
            height: bit === 1 ? `${height}px` : '0px',
            backgroundColor: bit === 1 ? 'black' : 'transparent',
          }}
        />
      ))}
    </div>
  );
}

export function EtiquetaPreview({ config, data }: EtiquetaPreviewProps) {
  const dimensions = getEtiquetaDimensions(config.tamanhoEtiqueta);
  
  // Use provided data or sample data
  const osNumero = data?.osNumero || "00001";
  const clienteNome = data?.clienteNome || "Maria Silva";
  const bloco = data?.bloco || "A";
  const posicao = data?.posicao || "15";
  const dataFormatada = data?.data 
    ? data.data.toLocaleDateString('pt-BR') 
    : new Date().toLocaleDateString('pt-BR');

  return (
    <div 
      className="bg-white border-2 border-dashed border-gray-300 mx-auto overflow-hidden flex flex-col"
      style={{ 
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        padding: `${config.margemSuperior}px ${config.margemLateral}px`,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div className="text-center mb-2">
        <p 
          className="font-bold text-gray-800 uppercase"
          style={{ fontSize: `${config.tamanhoFonte}px` }}
        >
          {config.nomeEmpresa || "ANJOLAV LAVANDERIA"}
        </p>
      </div>

      {/* OS Info */}
      <div className="flex-1 flex flex-col justify-center items-center">
        <p 
          className="font-bold text-gray-700 mb-1"
          style={{ fontSize: `${config.tamanhoFonte + 2}px` }}
        >
          OS: {osNumero}
        </p>
        
        <p 
          className="text-gray-600 text-center mb-2"
          style={{ fontSize: `${config.tamanhoFonte - 2}px` }}
        >
          {clienteNome}
        </p>

        {/* Real Barcode */}
        <div className="mb-1">
          <BarcodeDisplay text={osNumero} height={config.alturaCodigoBarras} />
        </div>

        <p 
          className="text-gray-500 font-mono"
          style={{ fontSize: `${config.tamanhoFonte - 4}px` }}
        >
          {osNumero}
        </p>
      </div>

      {/* Footer */}
      <div className="text-center mt-2">
        <p 
          className="text-gray-500"
          style={{ fontSize: `${config.tamanhoFonte - 4}px` }}
        >
          Bloco: {bloco} | Pos: {posicao}
        </p>
        <p 
          className="text-gray-400"
          style={{ fontSize: `${config.tamanhoFonte - 4}px` }}
        >
          {dataFormatada}
        </p>
      </div>
    </div>
  );
}

export const generateEtiquetaHTML = (config: EtiquetaPreviewConfig) => {
  const barcodeLines = Array.from({ length: 40 }, () => Math.random() > 0.5 ? 2 : 4);
  
  const tamanhoMap: Record<string, { w: string; h: string }> = {
    '10x15': { w: '100mm', h: '150mm' },
    '10x10': { w: '100mm', h: '100mm' },
    '5x2.5': { w: '50mm', h: '25mm' },
    '10x5': { w: '100mm', h: '50mm' },
    '3x2': { w: '30mm', h: '20mm' },
  };
  
  const size = tamanhoMap[config.tamanhoEtiqueta] || tamanhoMap['10x15'];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta - ANJOLAV</title>
      <style>
        @page {
          size: ${size.w} ${size.h};
          margin: 0;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: Arial, sans-serif;
          width: ${size.w};
          height: ${size.h};
          padding: ${config.margemSuperior}mm ${config.margemLateral}mm;
          display: flex;
          flex-direction: column;
        }
        .header {
          text-align: center;
          margin-bottom: 3mm;
        }
        .company {
          font-size: ${config.tamanhoFonte}px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .os-number {
          font-size: ${config.tamanhoFonte + 2}px;
          font-weight: bold;
          margin-bottom: 2mm;
        }
        .client {
          font-size: ${config.tamanhoFonte - 2}px;
          color: #444;
          margin-bottom: 3mm;
        }
        .barcode {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 1px;
          height: ${config.alturaCodigoBarras}px;
          margin-bottom: 1mm;
        }
        .barcode-line {
          background: black;
        }
        .barcode-number {
          font-size: ${config.tamanhoFonte - 4}px;
          font-family: monospace;
          color: #666;
        }
        .footer {
          text-align: center;
          margin-top: 2mm;
        }
        .location {
          font-size: ${config.tamanhoFonte - 4}px;
          color: #666;
        }
        .date {
          font-size: ${config.tamanhoFonte - 4}px;
          color: #888;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">ANJOLAV LAVANDERIA</div>
      </div>
      
      <div class="content">
        <div class="os-number">OS: 00001</div>
        <div class="client">Maria Silva</div>
        
        <div class="barcode">
          ${barcodeLines.map((w, i) => `<div class="barcode-line" style="width:${w}px;height:${Math.random() * 20 + 80}%"></div>`).join('')}
        </div>
        <div class="barcode-number">7891234567890</div>
      </div>
      
      <div class="footer">
        <div class="location">Bloco: A | Pos: 15</div>
        <div class="date">${new Date().toLocaleDateString('pt-BR')}</div>
      </div>
    </body>
    </html>
  `;
};

export const printEtiqueta = (config: EtiquetaPreviewConfig) => {
  const html = generateEtiquetaHTML(config);
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };
  }
};
