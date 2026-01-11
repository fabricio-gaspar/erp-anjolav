import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  printROLFromOS,
  printEtiquetaFromOS,
  printMultipleEtiquetas,
  fetchROLConfig,
  fetchEtiquetaConfig,
  fetchOSPrintData,
  generateROLHTMLWithData,
  generateEtiquetaHTMLWithData,
  generateBarcodeSVG,
  type PrintOSData,
  type EtiquetaData,
  type EtiquetaConfig,
} from "@/services/printService";
import type { ROLPreviewConfig } from "@/components/configuracoes/ROLPreview";

export function usePrintOS(ordemServicoId?: string) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const printROL = useCallback(async (osId?: string) => {
    const targetId = osId || ordemServicoId;
    if (!targetId) {
      toast({ title: "Erro", description: "ID da OS não informado", variant: "destructive" });
      return false;
    }

    setIsLoading(true);
    try {
      const success = await printROLFromOS(targetId);
      if (!success) {
        toast({ title: "Erro", description: "Não foi possível gerar o ROL", variant: "destructive" });
      }
      return success;
    } catch (error) {
      console.error("Print ROL error:", error);
      toast({ title: "Erro", description: "Erro ao imprimir ROL", variant: "destructive" });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ordemServicoId, toast]);

  const printEtiqueta = useCallback(async (osId?: string) => {
    const targetId = osId || ordemServicoId;
    if (!targetId) {
      toast({ title: "Erro", description: "ID da OS não informado", variant: "destructive" });
      return false;
    }

    setIsLoading(true);
    try {
      const success = await printEtiquetaFromOS(targetId);
      if (!success) {
        toast({ title: "Erro", description: "Não foi possível gerar a etiqueta", variant: "destructive" });
      }
      return success;
    } catch (error) {
      console.error("Print Etiqueta error:", error);
      toast({ title: "Erro", description: "Erro ao imprimir etiqueta", variant: "destructive" });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ordemServicoId, toast]);

  const printEtiquetas = useCallback(async (quantidade: number, osId?: string) => {
    const targetId = osId || ordemServicoId;
    if (!targetId) {
      toast({ title: "Erro", description: "ID da OS não informado", variant: "destructive" });
      return false;
    }

    setIsLoading(true);
    try {
      const success = await printMultipleEtiquetas(targetId, quantidade);
      if (!success) {
        toast({ title: "Erro", description: "Não foi possível gerar as etiquetas", variant: "destructive" });
      }
      return success;
    } catch (error) {
      console.error("Print Etiquetas error:", error);
      toast({ title: "Erro", description: "Erro ao imprimir etiquetas", variant: "destructive" });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [ordemServicoId, toast]);

  const getPreviewROL = useCallback(async (osId?: string): Promise<string | null> => {
    const targetId = osId || ordemServicoId;
    if (!targetId) return null;

    try {
      const [config, osData] = await Promise.all([
        fetchROLConfig(),
        fetchOSPrintData(targetId),
      ]);

      if (!config || !osData) return null;
      return generateROLHTMLWithData(config, osData);
    } catch {
      return null;
    }
  }, [ordemServicoId]);

  const getPreviewEtiqueta = useCallback(async (osId?: string): Promise<string | null> => {
    const targetId = osId || ordemServicoId;
    if (!targetId) return null;

    try {
      const [config, osData] = await Promise.all([
        fetchEtiquetaConfig(),
        fetchOSPrintData(targetId),
      ]);

      if (!config || !osData) return null;

      const etiquetaData: EtiquetaData = {
        osNumero: osData.numero,
        clienteNome: osData.clienteNome,
        bloco: osData.bloco,
        posicao: osData.posicao,
        data: osData.dataEmissao,
      };

      return generateEtiquetaHTMLWithData(config, etiquetaData);
    } catch {
      return null;
    }
  }, [ordemServicoId]);

  return {
    printROL,
    printEtiqueta,
    printEtiquetas,
    getPreviewROL,
    getPreviewEtiqueta,
    isLoading,
  };
}

// Hook for printing from Lancamentos with custom data
export interface LancamentosPrintData {
  clienteNome: string;
  clienteTelefone?: string;
  itens: { nome: string; quantidade: number; precoUnitario: number; subtotal: number }[];
  valorTotal: number;
  dataEmissao: Date;
  previsaoEntrega?: Date;
  observacoes?: string;
}

export function usePrintLancamento() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const printROLFromData = useCallback(async (data: LancamentosPrintData) => {
    setIsLoading(true);
    try {
      const config = await fetchROLConfig();
      if (!config) {
        toast({ title: "Erro", description: "Configurações do ROL não encontradas", variant: "destructive" });
        return false;
      }

      // Generate a temporary OS number
      const tempNumero = `L${Date.now().toString().slice(-6)}`;

      const osData: PrintOSData = {
        numero: tempNumero,
        clienteNome: data.clienteNome,
        clienteTelefone: data.clienteTelefone,
        itens: data.itens,
        valorTotal: data.valorTotal,
        dataEmissao: data.dataEmissao,
        previsaoEntrega: data.previsaoEntrega,
        observacoes: data.observacoes,
      };

      const html = generateROLHTMLWithData(config, osData);
      
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

      return true;
    } catch (error) {
      console.error("Print ROL error:", error);
      toast({ title: "Erro", description: "Erro ao imprimir ROL", variant: "destructive" });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const printEtiquetaFromData = useCallback(async (data: LancamentosPrintData, quantidade: number = 1) => {
    setIsLoading(true);
    try {
      const config = await fetchEtiquetaConfig();
      if (!config) {
        toast({ title: "Erro", description: "Configurações de etiqueta não encontradas", variant: "destructive" });
        return false;
      }

      // Generate a temporary OS number
      const tempNumero = `L${Date.now().toString().slice(-6)}`;

      const etiquetaData: EtiquetaData = {
        osNumero: tempNumero,
        clienteNome: data.clienteNome,
        data: data.dataEmissao,
      };

      // Generate HTML for multiple labels
      const singleLabel = generateEtiquetaHTMLWithData(config, etiquetaData);
      
      // For multiple labels, we need to generate a page with all of them
      if (quantidade > 1) {
        const labelsHtml = generateMultipleLabelsHTML(config, etiquetaData, quantidade);
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(labelsHtml);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              printWindow.close();
            }, 250);
          };
        }
      } else {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(singleLabel);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
              printWindow.close();
            }, 250);
          };
        }
      }

      return true;
    } catch (error) {
      console.error("Print Etiqueta error:", error);
      toast({ title: "Erro", description: "Erro ao imprimir etiqueta", variant: "destructive" });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    printROLFromData,
    printEtiquetaFromData,
    isLoading,
  };
}

// Helper function to generate multiple labels on one page
function generateMultipleLabelsHTML(config: EtiquetaConfig, data: EtiquetaData, quantidade: number): string {
  const barcodeSVG = generateBarcodeSVG(data.osNumero, config.alturaCodigoBarras);
  
  const labelContent = `
    <div class="label">
      <div class="header">
        <div class="company">${config.nomeEmpresa || 'ANJOLAV LAVANDERIA'}</div>
      </div>
      <div class="content">
        <div class="os-number">OS: ${data.osNumero}</div>
        <div class="client">${data.clienteNome}</div>
        <div class="barcode">${barcodeSVG}</div>
        <div class="barcode-number">${data.osNumero}</div>
      </div>
      <div class="footer">
        ${(data.bloco || data.posicao) ? `<div class="location">${data.bloco ? `Bloco: ${data.bloco}` : ''} ${data.bloco && data.posicao ? '|' : ''} ${data.posicao ? `Pos: ${data.posicao}` : ''}</div>` : ''}
        <div class="date">${data.data.toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
  `;

  const labels = Array(quantidade).fill(labelContent).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiquetas - ${data.osNumero}</title>
      <style>
        @page { margin: 5mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
        }
        .label {
          width: 100mm;
          height: 50mm;
          padding: ${config.margemSuperior}mm ${config.margemLateral}mm;
          display: flex;
          flex-direction: column;
          border: 1px dashed #ccc;
          margin-bottom: 2mm;
          page-break-inside: avoid;
        }
        .header { text-align: center; margin-bottom: 2mm; }
        .company { font-size: ${config.tamanhoFonte}px; font-weight: bold; text-transform: uppercase; }
        .content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .os-number { font-size: ${config.tamanhoFonte + 2}px; font-weight: bold; margin-bottom: 2mm; }
        .client { font-size: ${config.tamanhoFonte - 2}px; color: #444; margin-bottom: 2mm; text-align: center; }
        .barcode { display: flex; justify-content: center; margin-bottom: 1mm; }
        .barcode-number { font-size: ${config.tamanhoFonte - 4}px; font-family: monospace; color: #666; }
        .footer { text-align: center; margin-top: 1mm; }
        .location { font-size: ${config.tamanhoFonte - 4}px; color: #666; }
        .date { font-size: ${config.tamanhoFonte - 4}px; color: #888; }
        @media print {
          .label { border: none; }
        }
      </style>
    </head>
    <body>
      ${labels}
    </body>
    </html>
  `;
}
