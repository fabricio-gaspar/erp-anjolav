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

  return {
    printROLFromData,
    isLoading,
  };
}
