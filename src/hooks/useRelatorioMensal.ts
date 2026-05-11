import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export type SetorRelatorio = "todos" | "industrial" | "loja";

export interface RelatorioMensalData {
  // Receitas
  receitasFaturas: number;
  receitasFaturasCount: number;
  receitasLoja: number;
  receitasLojaCount: number;
  receitasTotais: number;

  // Despesas
  despesasFolha: number;
  despesasProdutos: number;
  despesasContasMensais: number;
  despesasImpostos: number;
  despesasOutras: number;
  despesasTotais: number;

  // Resultado
  lucro: number;
  margem: number;

  // Detalhes
  folhaItens: Array<{
    funcionario: string;
    cargo: string;
    salario: number;
    beneficios: number;
    descontos: number;
    liquido: number;
    custoTotal: number;
  }>;
  contasItens: Array<{
    id: string;
    descricao: string;
    fornecedor: string;
    categoria: string;
    valor: number;
    vencimento: string;
    status: string;
  }>;
}

const CAT_PRODUTOS = ["produtos_insumos", "Insumos", "produtos"];
const CAT_CONTAS_MENSAIS = ["contas_mensais", "Utilidades", "Aluguel", "Manutenção", "Transporte"];
const CAT_IMPOSTOS = ["impostos", "Impostos"];
const CAT_FOLHA = ["folha_pagamento", "Salários"];

export function useRelatorioMensal(mesRef: Date, setor: SetorRelatorio = "todos") {
  const inicio = startOfMonth(mesRef);
  const fim = endOfMonth(mesRef);
  const inicioStr = format(inicio, "yyyy-MM-dd");
  const fimStr = format(fim, "yyyy-MM-dd");
  const competencia = format(inicio, "yyyy-MM-dd");

  return useQuery<RelatorioMensalData>({
    queryKey: ["relatorio-mensal", inicioStr, fimStr, setor],
    queryFn: async () => {
      // 1. Faturas pagas no período
      const incluiIndustrial = setor === "todos" || setor === "industrial";
      const incluiLoja = setor === "todos" || setor === "loja";

      const faturasQuery = supabase
        .from("faturas")
        .select("id, valor_total, status, created_at, cliente:clientes(razao_social, classificacao)")
        .eq("status", "pago")
        .gte("created_at", inicioStr + "T00:00:00")
        .lte("created_at", fimStr + "T23:59:59");

      // 2. Vendas caixa (loja)
      const vendasQuery = supabase
        .from("caixa_movimentacoes")
        .select("id, valor, created_at")
        .eq("tipo", "VENDA")
        .gte("created_at", inicioStr + "T00:00:00")
        .lte("created_at", fimStr + "T23:59:59");

      // 3. Folha do mês
      const folhaQuery = supabase
        .from("folha_pagamento" as any)
        .select("*, funcionario:funcionarios(nome, cargo)")
        .eq("competencia", competencia);

      // 4. Contas a pagar do mês (por vencimento)
      const contasQuery = supabase
        .from("contas_pagar")
        .select("*")
        .gte("vencimento", inicioStr)
        .lte("vencimento", fimStr);

      const [fr, vr, flr, cr] = await Promise.all([
        faturasQuery,
        vendasQuery,
        folhaQuery,
        contasQuery,
      ]);

      if (fr.error) throw fr.error;
      if (vr.error) throw vr.error;
      if (flr.error) throw flr.error;
      if (cr.error) throw cr.error;

      const faturasFiltered = (fr.data || []).filter((f: any) => {
        if (!incluiIndustrial) return false;
        if (setor === "industrial") return f.cliente?.classificacao === "industrial";
        return true;
      });
      const receitasFaturas = faturasFiltered.reduce((s: number, f: any) => s + Number(f.valor_total), 0);

      const receitasLoja = incluiLoja
        ? (vr.data || []).reduce((s: number, v: any) => s + Number(v.valor), 0)
        : 0;
      const receitasLojaCount = incluiLoja ? (vr.data || []).length : 0;

      const receitasTotais = receitasFaturas + receitasLoja;

      // Folha
      const folhaItens = (flr.data || []).map((f: any) => ({
        funcionario: f.funcionario?.nome || "—",
        cargo: f.funcionario?.cargo || "—",
        salario: Number(f.salario_base || 0) + Number(f.horas_extras || 0) + Number(f.comissoes || 0) + Number(f.gratificacao || 0),
        beneficios:
          Number(f.vale_transporte || 0) +
          Number(f.vale_alimentacao || 0) +
          Number(f.vale_refeicao || 0) +
          Number(f.plano_saude || 0) +
          Number(f.plano_odontologico || 0) +
          Number(f.outros_beneficios || 0),
        descontos: Number(f.total_descontos || 0),
        liquido: Number(f.liquido || 0),
        custoTotal: Number(f.custo_total_empresa || 0),
      }));
      const despesasFolha = folhaItens.reduce((s, x) => s + x.custoTotal, 0);

      // Contas
      const contas = cr.data || [];
      const isCat = (c: string | null, list: string[]) =>
        c ? list.some((x) => x.toLowerCase() === c.toLowerCase()) : false;

      const despesasProdutos = contas
        .filter((c: any) => isCat(c.categoria, CAT_PRODUTOS))
        .reduce((s: number, c: any) => s + Number(c.valor), 0);

      const despesasContasMensais = contas
        .filter((c: any) => isCat(c.categoria, CAT_CONTAS_MENSAIS))
        .reduce((s: number, c: any) => s + Number(c.valor), 0);

      const despesasImpostos = contas
        .filter((c: any) => isCat(c.categoria, CAT_IMPOSTOS))
        .reduce((s: number, c: any) => s + Number(c.valor), 0);

      // Outros = não folha (folha já está em folha_pagamento) e não nas demais
      const despesasOutras = contas
        .filter(
          (c: any) =>
            !isCat(c.categoria, CAT_FOLHA) &&
            !isCat(c.categoria, CAT_PRODUTOS) &&
            !isCat(c.categoria, CAT_CONTAS_MENSAIS) &&
            !isCat(c.categoria, CAT_IMPOSTOS),
        )
        .reduce((s: number, c: any) => s + Number(c.valor), 0);

      const despesasTotais =
        despesasFolha + despesasProdutos + despesasContasMensais + despesasImpostos + despesasOutras;

      const lucro = receitasTotais - despesasTotais;
      const margem = receitasTotais > 0 ? (lucro / receitasTotais) * 100 : 0;

      return {
        receitasFaturas,
        receitasFaturasCount: faturasFiltered.length,
        receitasLoja,
        receitasLojaCount,
        receitasTotais,
        despesasFolha,
        despesasProdutos,
        despesasContasMensais,
        despesasImpostos,
        despesasOutras,
        despesasTotais,
        lucro,
        margem,
        folhaItens,
        contasItens: contas
          .filter((c: any) => !isCat(c.categoria, CAT_FOLHA))
          .map((c: any) => ({
            id: c.id,
            descricao: c.descricao,
            fornecedor: c.fornecedor || "—",
            categoria: c.categoria || "Sem categoria",
            valor: Number(c.valor),
            vencimento: c.vencimento,
            status: c.status,
          })),
      };
    },
  });
}
