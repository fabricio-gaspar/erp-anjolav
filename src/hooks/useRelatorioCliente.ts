import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Kept for the legacy print components while the operational screen consumes
// the canonical statement contract below.
export interface LancamentoComItens {
  id: string;
  cliente_id: string;
  data_lancamento: string;
  data_entrega: string | null;
  valor_total: number;
  status: string;
  observacao: string | null;
  itens: ItemLancamento[];
}

export interface ItemLancamento {
  id: string;
  lancamento_id: string;
  produto_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  subtotal: number;
}

export interface DemonstrativoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface DemonstrativoOrigem {
  id: string;
  numero: string;
  data: string;
  dataEntrega: string | null;
  status: string;
  etapa: string;
  valor: number;
  ajuste: number;
  faturaId: string | null;
  ordemServicoId: string | null;
  observacao: string | null;
  itens: DemonstrativoItem[];
}

export interface DemonstrativoServico {
  descricao: string;
  unidade: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  quantidadeOrigens: number;
}

export interface DemonstrativoFatura {
  id: string;
  numero: string;
  periodoInicio?: string;
  periodoFim?: string;
  status: string;
  statusPagamento: string;
  valor: number;
  valorPago: number;
  saldo: number;
  vencimento: string | null;
  cancelamentoMotivo?: string | null;
}

export interface DemonstrativoContrato {
  id: string;
  descricao: string;
  ativo: boolean;
  periodicidade: string;
  valorFixoReferencia: number;
  autorizaFaturamento: boolean;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

export interface DemonstrativoIndustrial {
  cliente: {
    id: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    documento: string | null;
  };
  periodo: { inicio: string; fim: string };
  escopo: "periodo" | "fatura";
  contratos: DemonstrativoContrato[];
  fatura: DemonstrativoFatura | null;
  totais: {
    quantidadeOrigens: number;
    quantidadeItens: number;
    quantidadeServicos: number;
    valorItens: number;
    valorOrigens: number;
    valorAjustes: number;
    valorFaturado: number;
    valorPago: number;
    saldoFaturado: number;
  };
  servicos: DemonstrativoServico[];
  origens: DemonstrativoOrigem[];
  faturas: DemonstrativoFatura[];
}

function readStatement(data: unknown): DemonstrativoIndustrial {
  if (!data || typeof data !== "object" || !("cliente" in data) || !("totais" in data)) {
    throw new Error("O demonstrativo não retornou um resultado válido");
  }
  return data as DemonstrativoIndustrial;
}

export function useRelatorioCliente(
  clienteId: string | null,
  periodoInicio: string | null,
  periodoFim: string | null,
  faturaId: string | null = null,
) {
  const hasValidPeriod = Boolean(
    clienteId && periodoInicio && periodoFim && periodoFim >= periodoInicio,
  );

  return useQuery({
    queryKey: ["demonstrativo-industrial", clienteId, periodoInicio, periodoFim, faturaId],
    queryFn: async () => {
      if (!clienteId || !periodoInicio || !periodoFim) return null;
      const { data, error } = await supabase.rpc("obter_demonstrativo_industrial", {
        _cliente_id: clienteId,
        _periodo_inicio: periodoInicio,
        _periodo_fim: periodoFim,
        _fatura_id: faturaId,
      });
      if (error) throw error;
      return readStatement(data);
    },
    enabled: hasValidPeriod,
  });
}
