import { useMemo } from "react";
import { useContasPagar } from "./useContasPagar";
import { useFaturas } from "./useFaturas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, addDays, isBefore, isEqual, isAfter, parseISO } from "date-fns";

export type SetorFinanceiro = "todos" | "industrial" | "loja";

interface MovimentacaoVencida {
  id: string;
  tipo: "fatura" | "despesa";
  descricao: string;
  cliente: string;
  dataVencimento: string;
  valor: number;
}

interface DashboardFinanceiroData {
  saldoAtual: number;
  receitasTotais: number;
  receitasCount: number;
  despesasTotais: number;
  despesasCount: number;
  margemLucro: number;
  aReceberVencido: number;
  aReceberHoje: number;
  aReceberProximos7Dias: number;
  aPagarVencido: number;
  aPagarHoje: number;
  aPagarProximos7Dias: number;
  vencidasTotal: number;
  vencidasCount: number;
  vencemHoje: number;
  vencemHojeCount: number;
  proximos7Dias: number;
  proximos7DiasCount: number;
  movimentacoesVencidas: MovimentacaoVencida[];
  // Loja-specific
  receitasLoja: number;
  receitasLojaCount: number;
  isLoading: boolean;
}

export function useDashboardFinanceiro(setor: SetorFinanceiro = "todos"): DashboardFinanceiroData {
  const { contas, isLoading: isLoadingContas } = useContasPagar();
  const { faturas, isLoading: isLoadingFaturas } = useFaturas();

  // Fetch caixa sales (Loja revenue)
  const { data: vendasCaixa = [], isLoading: isLoadingCaixa } = useQuery({
    queryKey: ["dashboard-vendas-caixa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_movimentacoes")
        .select("id, valor, created_at, caixa_id")
        .eq("tipo", "VENDA");
      if (error) throw error;
      return data || [];
    },
    enabled: setor === "todos" || setor === "loja",
  });

  const data = useMemo(() => {
    const hoje = startOfDay(new Date());
    const proximos7 = addDays(hoje, 7);

    // === Despesas (Contas a Pagar) — always shared ===
    const despesasPagas = contas.filter(c => c.status === "pago");
    const despesasPendentes = contas.filter(c => c.status === "pendente");
    const despesasTotais = despesasPagas.reduce((sum, c) => sum + Number(c.valor), 0);

    const despesasVencidas = despesasPendentes.filter(c => isBefore(parseISO(c.vencimento), hoje));
    const aPagarVencido = despesasVencidas.reduce((sum, c) => sum + Number(c.valor), 0);

    const despesasHoje = despesasPendentes.filter(c => isEqual(startOfDay(parseISO(c.vencimento)), hoje));
    const aPagarHoje = despesasHoje.reduce((sum, c) => sum + Number(c.valor), 0);

    const despesasProximos = despesasPendentes.filter(c => {
      const venc = startOfDay(parseISO(c.vencimento));
      return isAfter(venc, hoje) && (isBefore(venc, proximos7) || isEqual(venc, proximos7));
    });
    const aPagarProximos7Dias = despesasProximos.reduce((sum, c) => sum + Number(c.valor), 0);

    // === Filter faturas by sector ===
    const faturasDoSetor = setor === "loja"
      ? [] // Loja doesn't use faturas
      : setor === "industrial"
        ? faturas.filter(f => f.cliente?.classificacao === "industrial")
        : faturas; // todos

    const faturasPagas = faturasDoSetor.filter(f => f.status === "pago");
    const faturasPendentes = faturasDoSetor.filter(f => f.status !== "pago");
    const receitasFaturas = faturasPagas.reduce((sum, f) => sum + Number(f.valor_total), 0);

    // === Loja revenue (caixa sales) ===
    const incluirLoja = setor === "todos" || setor === "loja";
    const receitasLoja = incluirLoja
      ? vendasCaixa.reduce((sum, v) => sum + Number(v.valor), 0)
      : 0;
    const receitasLojaCount = incluirLoja ? vendasCaixa.length : 0;

    const receitasTotais = receitasFaturas + receitasLoja;
    const receitasCount = faturasPagas.length + receitasLojaCount;

    // Faturas vencidas
    const faturasVencidas = faturasPendentes.filter(f => {
      if (!f.data_vencimento) return false;
      return isBefore(parseISO(f.data_vencimento), hoje);
    });
    const aReceberVencido = faturasVencidas.reduce((sum, f) => sum + Number(f.valor_total), 0);

    const faturasHoje = faturasPendentes.filter(f => {
      if (!f.data_vencimento) return false;
      return isEqual(startOfDay(parseISO(f.data_vencimento)), hoje);
    });
    const aReceberHoje = faturasHoje.reduce((sum, f) => sum + Number(f.valor_total), 0);

    const faturasProximos = faturasPendentes.filter(f => {
      if (!f.data_vencimento) return false;
      const venc = startOfDay(parseISO(f.data_vencimento));
      return isAfter(venc, hoje) && (isBefore(venc, proximos7) || isEqual(venc, proximos7));
    });
    const aReceberProximos7Dias = faturasProximos.reduce((sum, f) => sum + Number(f.valor_total), 0);

    // === Totals ===
    const saldoAtual = receitasTotais - despesasTotais;
    const margemLucro = receitasTotais > 0 ? Math.round((saldoAtual / receitasTotais) * 100) : 0;

    const vencidasTotal = aReceberVencido + aPagarVencido;
    const vencidasCount = faturasVencidas.length + despesasVencidas.length;
    const vencemHoje = aReceberHoje + aPagarHoje;
    const vencemHojeCount = faturasHoje.length + despesasHoje.length;
    const proximos7DiasTotal = aReceberProximos7Dias + aPagarProximos7Dias;
    const proximos7DiasCount = faturasProximos.length + despesasProximos.length;

    const movimentacoesVencidas: MovimentacaoVencida[] = [
      ...faturasVencidas.map(f => ({
        id: f.id,
        tipo: "fatura" as const,
        descricao: `Fatura ${f.numero_nf || f.id.slice(0, 8)} - ${f.cliente?.razao_social || "Cliente"}`,
        cliente: f.cliente?.razao_social || "Cliente",
        dataVencimento: f.data_vencimento || "",
        valor: Number(f.valor_total),
      })),
      ...despesasVencidas.map(c => ({
        id: c.id,
        tipo: "despesa" as const,
        descricao: c.descricao,
        cliente: c.fornecedor || "Fornecedor",
        dataVencimento: c.vencimento,
        valor: Number(c.valor),
      })),
    ].sort((a, b) => parseISO(a.dataVencimento).getTime() - parseISO(b.dataVencimento).getTime());

    return {
      saldoAtual,
      receitasTotais,
      receitasCount,
      despesasTotais,
      despesasCount: despesasPagas.length,
      margemLucro,
      aReceberVencido,
      aReceberHoje,
      aReceberProximos7Dias,
      aPagarVencido,
      aPagarHoje,
      aPagarProximos7Dias,
      vencidasTotal,
      vencidasCount,
      vencemHoje,
      vencemHojeCount,
      proximos7Dias: proximos7DiasTotal,
      proximos7DiasCount,
      movimentacoesVencidas,
      receitasLoja,
      receitasLojaCount,
    };
  }, [contas, faturas, vendasCaixa, setor]);

  return {
    ...data,
    isLoading: isLoadingContas || isLoadingFaturas || isLoadingCaixa,
  };
}
