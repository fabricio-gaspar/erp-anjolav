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
  type PrintOSData,
  type EtiquetaData,
} from "@/services/printService";
import { openPrintDocument, reservePrintWindow } from "@/lib/safePrint";

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
      const printWindow = reservePrintWindow('width=400,height=600,noopener,noreferrer');
      if (!printWindow) {
        toast({ title: "Impressão bloqueada", description: "Permita janelas pop-up para este sistema e tente novamente.", variant: "destructive" });
        return false;
      }
      const success = await printROLFromOS(targetId, printWindow);
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
      const printWindow = reservePrintWindow('width=400,height=600,noopener,noreferrer');
      if (!printWindow) {
        toast({ title: "Impressão bloqueada", description: "Permita janelas pop-up para este sistema e tente novamente.", variant: "destructive" });
        return false;
      }
      const success = await printEtiquetaFromOS(targetId, printWindow);
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
      const printWindow = reservePrintWindow('width=400,height=600,noopener,noreferrer');
      if (!printWindow) {
        toast({ title: "Impressão bloqueada", description: "Permita janelas pop-up para este sistema e tente novamente.", variant: "destructive" });
        return false;
      }
      const success = await printMultipleEtiquetas(targetId, quantidade, printWindow);
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
  numeroRol?: string;
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

      // Use numero_rol if provided, otherwise generate temporary
      const tempNumero = data.numeroRol || `L${Date.now().toString().slice(-6)}`;

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
      
      const printWindow = openPrintDocument(html, 'width=400,height=600,noopener,noreferrer');
      if (printWindow) {
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

  const printEtiquetaFromData = useCallback(async (data: LancamentosPrintData, _quantidade: number = 1) => {
    setIsLoading(true);
    try {
      const config = await fetchEtiquetaConfig();
      if (!config) {
        toast({ title: "Erro", description: "Configurações de etiqueta não encontradas", variant: "destructive" });
        return false;
      }

      const tempNumero = data.numeroRol || `L${Date.now().toString().slice(-6)}`;

      // Generate one label per item type
      if (data.itens.length > 0) {
        const labels = data.itens.map(item => {
          const etiquetaData: EtiquetaData = {
            osNumero: tempNumero,
            clienteNome: data.clienteNome,
            data: data.dataEmissao,
            produtoNome: item.nome,
            quantidade: item.quantidade,
          };
          return generateEtiquetaHTMLWithData(config, etiquetaData);
        });

        // Extract body content from each label and combine into one page
        const bodyContents = labels.map(html => {
          const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
          return match ? match[1] : '';
        }).join('');

        // Use first label's head
        const headMatch = labels[0].match(/<head[^>]*>([\s\S]*)<\/head>/i);
        const head = headMatch ? headMatch[1] : '';

        const combinedHTML = `<!DOCTYPE html><html><head>${head}</head><body>${bodyContents}</body></html>`;
        
        const printWindow = openPrintDocument(combinedHTML, 'width=400,height=600,noopener,noreferrer');
        if (printWindow) {
          printWindow.onload = () => { setTimeout(() => { printWindow.print(); printWindow.close(); }, 250); };
        }
      } else {
        const etiquetaData: EtiquetaData = {
          osNumero: tempNumero,
          clienteNome: data.clienteNome,
          data: data.dataEmissao,
        };
        const singleLabel = generateEtiquetaHTMLWithData(config, etiquetaData);
        const printWindow = openPrintDocument(singleLabel, 'width=400,height=600,noopener,noreferrer');
        if (printWindow) {
          printWindow.onload = () => { setTimeout(() => { printWindow.print(); printWindow.close(); }, 250); };
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
