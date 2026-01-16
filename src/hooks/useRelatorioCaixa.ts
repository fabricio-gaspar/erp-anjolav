import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";

export interface RelatorioDiario {
  data: string;
  dinheiro: number;
  pix: number;
  cartao_credito: number;
  cartao_debito: number;
  sangrias: number;
  reforcos: number;
  total: number;
}

export interface RelatorioPecas {
  data: string;
  os_entrada: number;
  pecas_entrada: number;
  os_saida: number;
  pecas_saida: number;
  saldo: number;
}

export interface RelatorioOperador {
  operador: string;
  total_vendas: number;
  qtd_caixas: number;
  media_diferenca: number;
  total_diferencas: number;
}

export interface MovimentacaoAgrupada {
  data: string;
  tipo: string;
  forma_pagamento: string;
  total: number;
  quantidade: number;
}

// Hook para relatório de movimentações do caixa
export const useRelatorioMovimentacoes = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["relatorio-movimentacoes", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Buscar todos os caixas fechados no período
      const { data: caixas, error: caixasError } = await supabase
        .from("caixas")
        .select("id, data_fechamento")
        .eq("status", "FECHADO")
        .gte("data_fechamento", startDate.toISOString())
        .lte("data_fechamento", endDate.toISOString());

      if (caixasError) throw caixasError;

      if (!caixas || caixas.length === 0) {
        return [] as RelatorioDiario[];
      }

      const caixaIds = caixas.map((c) => c.id);

      // Buscar todas as movimentações desses caixas
      const { data: movimentacoes, error: movError } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .in("caixa_id", caixaIds)
        .order("created_at", { ascending: true });

      if (movError) throw movError;

      // Criar mapa de data de fechamento por caixa
      const caixaDataMap = new Map<string, string>();
      caixas.forEach((c) => {
        if (c.data_fechamento) {
          caixaDataMap.set(c.id, format(new Date(c.data_fechamento), "yyyy-MM-dd"));
        }
      });

      // Agrupar por dia
      const porDia = new Map<string, RelatorioDiario>();

      movimentacoes?.forEach((mov) => {
        const dataStr = caixaDataMap.get(mov.caixa_id) || format(new Date(mov.created_at), "yyyy-MM-dd");
        
        if (!porDia.has(dataStr)) {
          porDia.set(dataStr, {
            data: dataStr,
            dinheiro: 0,
            pix: 0,
            cartao_credito: 0,
            cartao_debito: 0,
            sangrias: 0,
            reforcos: 0,
            total: 0,
          });
        }

        const dia = porDia.get(dataStr)!;
        const valor = Number(mov.valor) || 0;

        if (mov.tipo === "VENDA") {
          switch (mov.forma_pagamento) {
            case "DINHEIRO":
              dia.dinheiro += valor;
              break;
            case "PIX":
              dia.pix += valor;
              break;
            case "CARTAO_CREDITO":
              dia.cartao_credito += valor;
              break;
            case "CARTAO_DEBITO":
              dia.cartao_debito += valor;
              break;
            default:
              dia.dinheiro += valor;
          }
          dia.total += valor;
        } else if (mov.tipo === "SANGRIA") {
          dia.sangrias += valor;
        } else if (mov.tipo === "REFORCO") {
          dia.reforcos += valor;
        }
      });

      return Array.from(porDia.values()).sort((a, b) => a.data.localeCompare(b.data));
    },
  });
};

// Hook para relatório de peças (entrada e saída)
export const useRelatorioPecas = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["relatorio-pecas", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Buscar OS que ENTRARAM no período (data_retirada = data que cliente trouxe)
      const { data: osEntrada, error: entradaError } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          data_retirada,
          itens_ordem_servico (quantidade)
        `)
        .gte("data_retirada", format(startDate, "yyyy-MM-dd"))
        .lte("data_retirada", format(endDate, "yyyy-MM-dd"));

      if (entradaError) throw entradaError;

      // Buscar OS que SAIRAM no período (data_entrega = data que entregou ao cliente)
      const { data: osSaida, error: saidaError } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          data_entrega,
          itens_ordem_servico (quantidade)
        `)
        .not("data_entrega", "is", null)
        .gte("data_entrega", format(startDate, "yyyy-MM-dd"))
        .lte("data_entrega", format(endDate, "yyyy-MM-dd"));

      if (saidaError) throw saidaError;

      // Agrupar entradas por dia
      const porDia = new Map<string, RelatorioPecas>();

      osEntrada?.forEach((os) => {
        const dataStr = os.data_retirada;
        if (!porDia.has(dataStr)) {
          porDia.set(dataStr, {
            data: dataStr,
            os_entrada: 0,
            pecas_entrada: 0,
            os_saida: 0,
            pecas_saida: 0,
            saldo: 0,
          });
        }
        const dia = porDia.get(dataStr)!;
        dia.os_entrada += 1;
        dia.pecas_entrada += (os.itens_ordem_servico || []).reduce(
          (acc: number, item: { quantidade: number }) => acc + (Number(item.quantidade) || 0),
          0
        );
      });

      // Agrupar saídas por dia
      osSaida?.forEach((os) => {
        const dataStr = os.data_entrega!;
        if (!porDia.has(dataStr)) {
          porDia.set(dataStr, {
            data: dataStr,
            os_entrada: 0,
            pecas_entrada: 0,
            os_saida: 0,
            pecas_saida: 0,
            saldo: 0,
          });
        }
        const dia = porDia.get(dataStr)!;
        dia.os_saida += 1;
        dia.pecas_saida += (os.itens_ordem_servico || []).reduce(
          (acc: number, item: { quantidade: number }) => acc + (Number(item.quantidade) || 0),
          0
        );
      });

      // Calcular saldo
      const resultado = Array.from(porDia.values()).map((dia) => ({
        ...dia,
        saldo: dia.pecas_entrada - dia.pecas_saida,
      }));

      return resultado.sort((a, b) => a.data.localeCompare(b.data));
    },
  });
};

// Hook para relatório por operador
export const useRelatorioOperadores = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["relatorio-operadores", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: caixas, error } = await supabase
        .from("caixas")
        .select("*")
        .eq("status", "FECHADO")
        .gte("data_fechamento", startDate.toISOString())
        .lte("data_fechamento", endDate.toISOString());

      if (error) throw error;

      // Agrupar por operador
      const porOperador = new Map<string, RelatorioOperador>();

      caixas?.forEach((caixa) => {
        const operador = caixa.operador || "Desconhecido";
        
        if (!porOperador.has(operador)) {
          porOperador.set(operador, {
            operador,
            total_vendas: 0,
            qtd_caixas: 0,
            media_diferenca: 0,
            total_diferencas: 0,
          });
        }

        const op = porOperador.get(operador)!;
        op.total_vendas += Number(caixa.valor_vendas) || 0;
        op.qtd_caixas += 1;
        op.total_diferencas += Number(caixa.diferenca) || 0;
      });

      // Calcular média de diferença
      const resultado = Array.from(porOperador.values()).map((op) => ({
        ...op,
        media_diferenca: op.qtd_caixas > 0 ? op.total_diferencas / op.qtd_caixas : 0,
      }));

      return resultado.sort((a, b) => b.total_vendas - a.total_vendas);
    },
  });
};

// Hook para análise de diferenças
export const useRelatorioDiferencas = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["relatorio-diferencas", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: caixas, error } = await supabase
        .from("caixas")
        .select("*")
        .eq("status", "FECHADO")
        .gte("data_fechamento", startDate.toISOString())
        .lte("data_fechamento", endDate.toISOString())
        .order("data_fechamento", { ascending: true });

      if (error) throw error;

      return (caixas || []).map((caixa) => ({
        id: caixa.id,
        data: caixa.data_fechamento ? format(new Date(caixa.data_fechamento), "yyyy-MM-dd") : "",
        operador: caixa.operador,
        valor_esperado: Number(caixa.valor_esperado) || 0,
        valor_contado: Number(caixa.valor_contado) || 0,
        diferenca: Number(caixa.diferenca) || 0,
        valor_vendas: Number(caixa.valor_vendas) || 0,
      }));
    },
  });
};

// Hook para totais gerais do período
export const useTotaisPeriodo = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ["totais-periodo", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // Buscar caixas fechados
      const { data: caixas, error: caixasError } = await supabase
        .from("caixas")
        .select("id, valor_vendas, valor_sangrias, valor_reforcos, diferenca")
        .eq("status", "FECHADO")
        .gte("data_fechamento", startDate.toISOString())
        .lte("data_fechamento", endDate.toISOString());

      if (caixasError) throw caixasError;

      if (!caixas || caixas.length === 0) {
        return {
          totalVendas: 0,
          totalSangrias: 0,
          totalReforcos: 0,
          totalDiferencas: 0,
          qtdCaixas: 0,
          porFormaPagamento: {
            dinheiro: 0,
            pix: 0,
            cartao_credito: 0,
            cartao_debito: 0,
          },
        };
      }

      const caixaIds = caixas.map((c) => c.id);

      // Buscar movimentações
      const { data: movimentacoes, error: movError } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .in("caixa_id", caixaIds);

      if (movError) throw movError;

      let porFormaPagamento = {
        dinheiro: 0,
        pix: 0,
        cartao_credito: 0,
        cartao_debito: 0,
      };

      movimentacoes?.forEach((mov) => {
        if (mov.tipo === "VENDA") {
          const valor = Number(mov.valor) || 0;
          switch (mov.forma_pagamento) {
            case "DINHEIRO":
              porFormaPagamento.dinheiro += valor;
              break;
            case "PIX":
              porFormaPagamento.pix += valor;
              break;
            case "CARTAO_CREDITO":
              porFormaPagamento.cartao_credito += valor;
              break;
            case "CARTAO_DEBITO":
              porFormaPagamento.cartao_debito += valor;
              break;
            default:
              porFormaPagamento.dinheiro += valor;
          }
        }
      });

      return {
        totalVendas: caixas.reduce((acc, c) => acc + (Number(c.valor_vendas) || 0), 0),
        totalSangrias: caixas.reduce((acc, c) => acc + (Number(c.valor_sangrias) || 0), 0),
        totalReforcos: caixas.reduce((acc, c) => acc + (Number(c.valor_reforcos) || 0), 0),
        totalDiferencas: caixas.reduce((acc, c) => acc + (Number(c.diferenca) || 0), 0),
        qtdCaixas: caixas.length,
        porFormaPagamento,
      };
    },
  });
};
