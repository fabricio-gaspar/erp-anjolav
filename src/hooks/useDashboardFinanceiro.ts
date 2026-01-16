import { useMemo } from "react";
import { useContasPagar } from "./useContasPagar";
import { useFaturas } from "./useFaturas";
import { startOfDay, endOfDay, addDays, isBefore, isEqual, isAfter, parseISO } from "date-fns";

interface MovimentacaoVencida {
  id: string;
  tipo: "fatura" | "despesa";
  descricao: string;
  cliente: string;
  dataVencimento: string;
  valor: number;
}

interface DashboardFinanceiroData {
  // KPIs
  saldoAtual: number;
  receitasTotais: number;
  receitasCount: number;
  despesasTotais: number;
  despesasCount: number;
  margemLucro: number;
  
  // A Receber
  aReceberVencido: number;
  aReceberHoje: number;
  aReceberProximos7Dias: number;
  
  // A Pagar
  aPagarVencido: number;
  aPagarHoje: number;
  aPagarProximos7Dias: number;
  
  // Resumo
  vencidasTotal: number;
  vencidasCount: number;
  vencemHoje: number;
  vencemHojeCount: number;
  proximos7Dias: number;
  proximos7DiasCount: number;
  
  // Lista
  movimentacoesVencidas: MovimentacaoVencida[];
  
  isLoading: boolean;
}

export function useDashboardFinanceiro(): DashboardFinanceiroData {
  const { contas, isLoading: isLoadingContas } = useContasPagar();
  const { faturas, isLoading: isLoadingFaturas } = useFaturas();

  const data = useMemo(() => {
    const hoje = startOfDay(new Date());
    const hojeEnd = endOfDay(new Date());
    const proximos7 = addDays(hoje, 7);

    // === Despesas (Contas a Pagar) ===
    const despesasPagas = contas.filter(c => c.status === "pago");
    const despesasPendentes = contas.filter(c => c.status === "pendente");

    const despesasTotais = despesasPagas.reduce((sum, c) => sum + Number(c.valor), 0);
    
    // Vencidas (vencimento < hoje e pendente)
    const despesasVencidas = despesasPendentes.filter(c => {
      const venc = parseISO(c.vencimento);
      return isBefore(venc, hoje);
    });
    const aPagarVencido = despesasVencidas.reduce((sum, c) => sum + Number(c.valor), 0);

    // Vence hoje
    const despesasHoje = despesasPendentes.filter(c => {
      const venc = startOfDay(parseISO(c.vencimento));
      return isEqual(venc, hoje);
    });
    const aPagarHoje = despesasHoje.reduce((sum, c) => sum + Number(c.valor), 0);

    // Próximos 7 dias (amanhã até +7)
    const amanha = addDays(hoje, 1);
    const despesasProximos = despesasPendentes.filter(c => {
      const venc = startOfDay(parseISO(c.vencimento));
      return isAfter(venc, hoje) && (isBefore(venc, proximos7) || isEqual(venc, proximos7));
    });
    const aPagarProximos7Dias = despesasProximos.reduce((sum, c) => sum + Number(c.valor), 0);

    // === Receitas (Faturas) ===
    const faturasPagas = faturas.filter(f => f.status === "pago");
    const faturasPendentes = faturas.filter(f => f.status !== "pago");

    const receitasTotais = faturasPagas.reduce((sum, f) => sum + Number(f.valor_total), 0);

    // Faturas vencidas
    const faturasVencidas = faturasPendentes.filter(f => {
      if (!f.data_vencimento) return false;
      const venc = parseISO(f.data_vencimento);
      return isBefore(venc, hoje);
    });
    const aReceberVencido = faturasVencidas.reduce((sum, f) => sum + Number(f.valor_total), 0);

    // Faturas vence hoje
    const faturasHoje = faturasPendentes.filter(f => {
      if (!f.data_vencimento) return false;
      const venc = startOfDay(parseISO(f.data_vencimento));
      return isEqual(venc, hoje);
    });
    const aReceberHoje = faturasHoje.reduce((sum, f) => sum + Number(f.valor_total), 0);

    // Faturas próximos 7 dias
    const faturasProximos = faturasPendentes.filter(f => {
      if (!f.data_vencimento) return false;
      const venc = startOfDay(parseISO(f.data_vencimento));
      return isAfter(venc, hoje) && (isBefore(venc, proximos7) || isEqual(venc, proximos7));
    });
    const aReceberProximos7Dias = faturasProximos.reduce((sum, f) => sum + Number(f.valor_total), 0);

    // === Totais combinados ===
    const saldoAtual = receitasTotais - despesasTotais;
    const margemLucro = receitasTotais > 0 ? Math.round((saldoAtual / receitasTotais) * 100) : 0;

    const vencidasTotal = aReceberVencido + aPagarVencido;
    const vencidasCount = faturasVencidas.length + despesasVencidas.length;

    const vencemHoje = aReceberHoje + aPagarHoje;
    const vencemHojeCount = faturasHoje.length + despesasHoje.length;

    const proximos7DiasTotal = aReceberProximos7Dias + aPagarProximos7Dias;
    const proximos7DiasCount = faturasProximos.length + despesasProximos.length;

    // === Movimentações vencidas ===
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
      receitasCount: faturasPagas.length,
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
    };
  }, [contas, faturas]);

  return {
    ...data,
    isLoading: isLoadingContas || isLoadingFaturas,
  };
}
