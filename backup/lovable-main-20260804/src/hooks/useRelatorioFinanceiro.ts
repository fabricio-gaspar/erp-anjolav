import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface ReceitaItem {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  cliente_nome: string;
  cliente_id: string;
  tipo: "lancamento" | "fatura";
  status: string;
}

export interface DespesaItem {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string | null;
  fornecedor: string | null;
  status: string;
}

export interface ProdutoVendido {
  produto_nome: string;
  quantidade: number;
  valor_total: number;
  preco_medio: number;
}

export interface ResumoCategoria {
  categoria: string;
  valor: number;
  quantidade: number;
}

export interface ResumoCliente {
  cliente_id: string;
  cliente_nome: string;
  valor_total: number;
  quantidade_lancamentos: number;
}

export interface ResumoMensal {
  mes: string;
  receitas: number;
  despesas: number;
  resultado: number;
}

export function useRelatorioFinanceiro(
  dataInicio: Date,
  dataFim: Date,
  clienteId: string | null
) {
  const inicioStr = format(dataInicio, "yyyy-MM-dd");
  const fimStr = format(dataFim, "yyyy-MM-dd");

  // Buscar receitas (lançamentos faturados)
  const receitasQuery = useQuery({
    queryKey: ["relatorio_receitas", inicioStr, fimStr, clienteId],
    queryFn: async () => {
      let query = supabase
        .from("lancamentos")
        .select(`
          id,
          data_lancamento,
          valor_total,
          status,
          cliente_id,
          clientes(razao_social)
        `)
        .gte("data_lancamento", inicioStr)
        .lte("data_lancamento", fimStr)
        .order("data_lancamento", { ascending: false });

      if (clienteId && clienteId !== "todos") {
        query = query.eq("cliente_id", clienteId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        descricao: `Lançamento - ${item.clientes?.razao_social || "Cliente"}`,
        valor: item.valor_total || 0,
        data: item.data_lancamento,
        cliente_nome: item.clientes?.razao_social || "N/A",
        cliente_id: item.cliente_id,
        tipo: "lancamento" as const,
        status: item.status,
      }));
    },
  });

  // Buscar despesas (contas a pagar)
  const despesasQuery = useQuery({
    queryKey: ["relatorio_despesas", inicioStr, fimStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .gte("vencimento", inicioStr)
        .lte("vencimento", fimStr)
        .order("vencimento", { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        id: item.id,
        descricao: item.descricao,
        valor: item.valor || 0,
        data: item.vencimento,
        categoria: item.categoria,
        fornecedor: item.fornecedor,
        status: item.status,
      }));
    },
  });

  // Buscar produtos vendidos
  const produtosQuery = useQuery({
    queryKey: ["relatorio_produtos", inicioStr, fimStr, clienteId],
    queryFn: async () => {
      // Primeiro buscar os lançamentos do período
      let lancQuery = supabase
        .from("lancamentos")
        .select("id")
        .gte("data_lancamento", inicioStr)
        .lte("data_lancamento", fimStr);

      if (clienteId && clienteId !== "todos") {
        lancQuery = lancQuery.eq("cliente_id", clienteId);
      }

      const { data: lancamentos, error: lancError } = await lancQuery;
      if (lancError) throw lancError;
      if (!lancamentos || lancamentos.length === 0) return [];

      const lancIds = lancamentos.map((l) => l.id);

      // Buscar itens dos lançamentos
      const { data: itens, error: itensError } = await supabase
        .from("itens_lancamento")
        .select("produto_nome, quantidade, preco_unitario, subtotal")
        .in("lancamento_id", lancIds);

      if (itensError) throw itensError;

      // Agrupar por produto
      const produtosMap = new Map<string, ProdutoVendido>();
      (itens || []).forEach((item) => {
        const existing = produtosMap.get(item.produto_nome);
        if (existing) {
          existing.quantidade += item.quantidade;
          existing.valor_total += item.subtotal;
          existing.preco_medio =
            existing.valor_total / existing.quantidade;
        } else {
          produtosMap.set(item.produto_nome, {
            produto_nome: item.produto_nome,
            quantidade: item.quantidade,
            valor_total: item.subtotal,
            preco_medio: item.preco_unitario,
          });
        }
      });

      return Array.from(produtosMap.values()).sort(
        (a, b) => b.valor_total - a.valor_total
      );
    },
  });

  // Buscar resumo por categoria de despesas
  const categoriasQuery = useQuery({
    queryKey: ["relatorio_categorias", inicioStr, fimStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("categoria, valor")
        .gte("vencimento", inicioStr)
        .lte("vencimento", fimStr);

      if (error) throw error;

      const categoriasMap = new Map<string, ResumoCategoria>();
      (data || []).forEach((item) => {
        const cat = item.categoria || "Sem categoria";
        const existing = categoriasMap.get(cat);
        if (existing) {
          existing.valor += item.valor || 0;
          existing.quantidade += 1;
        } else {
          categoriasMap.set(cat, {
            categoria: cat,
            valor: item.valor || 0,
            quantidade: 1,
          });
        }
      });

      return Array.from(categoriasMap.values()).sort(
        (a, b) => b.valor - a.valor
      );
    },
  });

  // Buscar resumo por cliente
  const clientesResumoQuery = useQuery({
    queryKey: ["relatorio_clientes_resumo", inicioStr, fimStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select(`
          cliente_id,
          valor_total,
          clientes(razao_social)
        `)
        .gte("data_lancamento", inicioStr)
        .lte("data_lancamento", fimStr);

      if (error) throw error;

      const clientesMap = new Map<string, ResumoCliente>();
      (data || []).forEach((item: any) => {
        const existing = clientesMap.get(item.cliente_id);
        if (existing) {
          existing.valor_total += item.valor_total || 0;
          existing.quantidade_lancamentos += 1;
        } else {
          clientesMap.set(item.cliente_id, {
            cliente_id: item.cliente_id,
            cliente_nome: item.clientes?.razao_social || "N/A",
            valor_total: item.valor_total || 0,
            quantidade_lancamentos: 1,
          });
        }
      });

      return Array.from(clientesMap.values()).sort(
        (a, b) => b.valor_total - a.valor_total
      );
    },
  });

  return {
    receitas: receitasQuery.data || [],
    despesas: despesasQuery.data || [],
    produtos: produtosQuery.data || [],
    categorias: categoriasQuery.data || [],
    clientesResumo: clientesResumoQuery.data || [],
    isLoading:
      receitasQuery.isLoading ||
      despesasQuery.isLoading ||
      produtosQuery.isLoading ||
      categoriasQuery.isLoading ||
      clientesResumoQuery.isLoading,
  };
}
