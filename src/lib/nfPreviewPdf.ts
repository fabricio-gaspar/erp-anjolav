import { formatCurrency, formatDate } from "./faturamentoUtils";

interface EmitenteDados {
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  } | null;
  codigo_servico?: string | null;
  aliquota_iss?: number | null;
}

interface TomadorDados {
  razao_social?: string | null;
  cpf_cnpj?: string | null;
  tipo_pessoa?: string;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  } | null;
}

interface ItemServico {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

interface NFPreviewData {
  emitente: EmitenteDados;
  tomador: TomadorDados;
  itens: ItemServico[];
  valorTotal: number;
  periodoInicio: string;
  periodoFim: string;
  ambiente?: "producao" | "homologacao";
}

export function gerarPreviewNFHtml(data: NFPreviewData): string {
  const { emitente, tomador, itens, valorTotal, periodoInicio, periodoFim, ambiente } = data;
  
  const aliquotaIss = emitente.aliquota_iss || 5;
  const valorIss = valorTotal * (aliquotaIss / 100);
  const codigoServico = emitente.codigo_servico || "14.10";
  
  const enderecoEmitente = emitente.endereco;
  const enderecoTomador = tomador.endereco;

  const chaveAcessoSimulada = "00000000000000000000000000000000000000000000";
  const numeroPrevia = "PRÉVIA";
  
  const isHomologacao = ambiente !== "producao";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prévia NFS-e</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      padding: 20px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #000;
      position: relative;
    }
    ${isHomologacao ? `
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80px;
      color: rgba(255, 0, 0, 0.15);
      font-weight: bold;
      pointer-events: none;
      z-index: 1000;
      white-space: nowrap;
    }
    ` : ''}
    .header {
      background: #1a365d;
      color: #fff;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title {
      font-size: 14px;
      font-weight: bold;
    }
    .header-number {
      font-size: 12px;
    }
    .section {
      border-bottom: 1px solid #000;
      padding: 10px 15px;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-weight: bold;
      font-size: 11px;
      color: #1a365d;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-row {
      margin-bottom: 3px;
    }
    .info-label {
      color: #666;
    }
    .info-value {
      font-weight: 500;
    }
    .company-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #1a365d;
    }
    .chave-acesso {
      background: #f5f5f5;
      padding: 8px;
      font-family: monospace;
      font-size: 9px;
      word-break: break-all;
      text-align: center;
      border: 1px solid #ddd;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th {
      background: #e2e8f0;
      padding: 6px 8px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      border: 1px solid #cbd5e0;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #cbd5e0;
      font-size: 10px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .total-row {
      background: #f0f9ff;
      font-weight: bold;
    }
    .fiscal-info {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    .fiscal-box {
      background: #f8fafc;
      padding: 8px;
      border: 1px solid #e2e8f0;
    }
    .fiscal-box-label {
      font-size: 8px;
      color: #666;
      text-transform: uppercase;
    }
    .fiscal-box-value {
      font-size: 11px;
      font-weight: bold;
      margin-top: 2px;
    }
    .footer {
      background: #f8fafc;
      padding: 10px 15px;
      font-size: 9px;
      color: #666;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 9px;
      font-weight: bold;
      border-radius: 3px;
    }
    .badge-warning {
      background: #fef3c7;
      color: #92400e;
    }
    .badge-success {
      background: #d1fae5;
      color: #065f46;
    }
    .preview-banner {
      background: #fef2f2;
      border: 2px dashed #ef4444;
      color: #dc2626;
      padding: 10px;
      text-align: center;
      font-weight: bold;
      font-size: 12px;
    }
    @media print {
      body { padding: 0; }
      .container { border: 1px solid #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    ${isHomologacao ? '<div class="watermark">PRÉVIA - SEM VALOR FISCAL</div>' : ''}
    
    <div class="preview-banner">
      ⚠️ DOCUMENTO DE PRÉVIA - SEM VALOR FISCAL - NÃO É NOTA FISCAL VÁLIDA
    </div>

    <div class="header">
      <div>
        <div class="header-title">NFS-e Nota Fiscal de Serviço Eletrônica</div>
        <div style="font-size: 10px; margin-top: 4px;">
          <span class="badge ${isHomologacao ? 'badge-warning' : 'badge-success'}">
            ${isHomologacao ? 'HOMOLOGAÇÃO' : 'PRODUÇÃO'}
          </span>
        </div>
      </div>
      <div class="header-number">
        Número: ${numeroPrevia}
      </div>
    </div>

    <!-- Emitente -->
    <div class="section">
      <div class="section-title">Prestador de Serviços (Emitente)</div>
      <div class="company-name">${emitente.razao_social || 'Razão Social não informada'}</div>
      <div class="grid-2">
        <div>
          <div class="info-row">
            <span class="info-label">CNPJ:</span>
            <span class="info-value">${emitente.cnpj || 'Não informado'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Inscrição Municipal:</span>
            <span class="info-value">${emitente.inscricao_municipal || 'Não informada'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Inscrição Estadual:</span>
            <span class="info-value">${emitente.inscricao_estadual || 'Isento'}</span>
          </div>
        </div>
        <div>
          ${enderecoEmitente ? `
          <div class="info-row">
            <span class="info-label">Endereço:</span>
            <span class="info-value">${enderecoEmitente.logradouro || ''}, ${enderecoEmitente.numero || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Bairro:</span>
            <span class="info-value">${enderecoEmitente.bairro || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Cidade/UF:</span>
            <span class="info-value">${enderecoEmitente.cidade || ''}/${enderecoEmitente.uf || ''} - CEP: ${enderecoEmitente.cep || ''}</span>
          </div>
          ` : '<div class="info-row"><span class="info-label">Endereço não informado</span></div>'}
          <div class="info-row">
            <span class="info-label">E-mail:</span>
            <span class="info-value">${emitente.email || 'Não informado'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chave de Acesso -->
    <div class="section">
      <div class="section-title">Chave de Acesso da NFS-e (Simulada)</div>
      <div class="chave-acesso">${chaveAcessoSimulada}</div>
      <div style="margin-top: 8px; font-size: 9px; color: #666;">
        Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} | 
        Período: ${formatDate(periodoInicio)} a ${formatDate(periodoFim)}
      </div>
    </div>

    <!-- Tomador -->
    <div class="section">
      <div class="section-title">Tomador do Serviço</div>
      <div class="company-name">${tomador.razao_social || 'Razão Social não informada'}</div>
      <div class="grid-2">
        <div>
          <div class="info-row">
            <span class="info-label">${tomador.tipo_pessoa === 'cnpj' ? 'CNPJ' : 'CPF'}:</span>
            <span class="info-value">${tomador.cpf_cnpj || 'Não informado'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Inscrição Municipal:</span>
            <span class="info-value">${tomador.inscricao_municipal || 'Não informada'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">E-mail:</span>
            <span class="info-value">${tomador.email || 'Não informado'}</span>
          </div>
        </div>
        <div>
          ${enderecoTomador ? `
          <div class="info-row">
            <span class="info-label">Endereço:</span>
            <span class="info-value">${enderecoTomador.logradouro || ''}, ${enderecoTomador.numero || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Bairro:</span>
            <span class="info-value">${enderecoTomador.bairro || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Cidade/UF:</span>
            <span class="info-value">${enderecoTomador.cidade || ''}/${enderecoTomador.uf || ''} - CEP: ${enderecoTomador.cep || ''}</span>
          </div>
          ` : '<div class="info-row"><span class="info-label">Endereço não informado</span></div>'}
        </div>
      </div>
    </div>

    <!-- Serviços -->
    <div class="section">
      <div class="section-title">Descrição dos Serviços</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50%">Descrição</th>
            <th class="text-center">Qtd</th>
            <th class="text-center">Unid.</th>
            <th class="text-right">Valor Unit.</th>
            <th class="text-right">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(item => `
          <tr>
            <td>${item.produto}</td>
            <td class="text-center">${item.quantidade}</td>
            <td class="text-center">${item.unidade}</td>
            <td class="text-right">${formatCurrency(item.valorUnitario)}</td>
            <td class="text-right">${formatCurrency(item.valorTotal)}</td>
          </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="4" class="text-right">VALOR TOTAL DOS SERVIÇOS</td>
            <td class="text-right">${formatCurrency(valorTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Informações Fiscais -->
    <div class="section">
      <div class="section-title">Informações Fiscais</div>
      <div style="margin-bottom: 8px;">
        <span class="info-label">Código do Serviço:</span>
        <span class="info-value">${codigoServico} - Tinturaria e lavanderia</span>
      </div>
      <div class="fiscal-info">
        <div class="fiscal-box">
          <div class="fiscal-box-label">Base Cálculo ISSQN</div>
          <div class="fiscal-box-value">${formatCurrency(valorTotal)}</div>
        </div>
        <div class="fiscal-box">
          <div class="fiscal-box-label">Alíquota ISS</div>
          <div class="fiscal-box-value">${aliquotaIss.toFixed(2)}%</div>
        </div>
        <div class="fiscal-box">
          <div class="fiscal-box-label">Valor ISS</div>
          <div class="fiscal-box-value">${formatCurrency(valorIss)}</div>
        </div>
        <div class="fiscal-box">
          <div class="fiscal-box-label">Valor Líquido NFS-e</div>
          <div class="fiscal-box-value">${formatCurrency(valorTotal)}</div>
        </div>
      </div>
    </div>

    <!-- Rodapé -->
    <div class="footer">
      <div style="text-align: center; margin-bottom: 8px;">
        <strong>⚠️ ESTE DOCUMENTO É APENAS UMA PRÉVIA E NÃO POSSUI VALOR FISCAL ⚠️</strong>
      </div>
      <div>
        Este documento foi gerado para fins de conferência e aprovação antes da emissão oficial da NFS-e.
        A nota fiscal eletrônica válida será emitida após confirmação no sistema.
      </div>
    </div>
  </div>
</body>
</html>
`;
}

export function downloadNFPreviewPdf(htmlContent: string, filename: string = "previa-nfse.html") {
  // Criar blob com o HTML
  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  
  // Abrir em nova janela para impressão/download
  const printWindow = window.open(url, "_blank");
  
  if (printWindow) {
    printWindow.onload = () => {
      // Auto-focus para impressão
      printWindow.focus();
    };
  }
  
  // Limpar URL após um tempo
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  
  return printWindow;
}

export function printNFPreview(htmlContent: string) {
  const printWindow = window.open("", "_blank");
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Esperar carregar e imprimir
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
  
  return printWindow;
}
