import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import type { FolhaPagamento } from "@/hooks/useFolhaPagamento";
import type { FolhaBeneficio } from "@/hooks/useFolhaBeneficios";

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
  despesasBeneficiosExtras: number;
  despesasTotais: number;

  // Resultado
  lucro: number;
  margem: number;

  // Detalhes
  folhaItens: Array<{
    funcionario: string;
    cargo: string;
    empregadorCnpj: string;
    empregadorNome: string;
    salario: number;
    beneficios: number;
    descontos: number;
    liquido: number;
    custoTotal: number;
  }>;
  folhaPorEmpregador: Array<{ cnpj: string; nome: string; total: number; count: number }>;
  beneficiosExtrasItens: Array<{
    id: string;
    funcionario: string;
    empregador: string;
    nome: string;
    categoria: string;
    tipo: "beneficio" | "desconto";
    valor: number;
  }>;
  beneficiosExtrasPorCategoria: Array<{ categoria: string; total: number; count: number }>;
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
  const { activeTenant, user } = useAuth();
  const inicio = startOfMonth(mesRef);
  const fim = endOfMonth(mesRef);
  const inicioStr = format(inicio, "yyyy-MM-dd");
  const fimStr = format(fim, "yyyy-MM-dd");
  const competencia = format(inicio, "yyyy-MM-dd");

  return useQuery<RelatorioMensalData>({
    queryKey: ["relatorio-mensal", activeTenant?.id, user?.id, inicioStr, fimStr, setor],
    queryFn: async () => {
      if (!activeTenant) throw new Error("Empresa ativa não identificada");
      // 1. Faturas pagas no período
      const incluiIndustrial = setor === "todos" || setor === "industrial";
      const incluiLoja = setor === "todos" || setor === "loja";

      const faturasQuery = supabase
        .from("faturas")
        .select("id, valor_total, status, created_at, cliente:clientes!faturas_cliente_id_fkey(razao_social, classificacao)")
        .eq("tenant_id", activeTenant.id)
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
        .from("folha_pagamento")
        .select("*, funcionario:funcionarios!folha_pagamento_funcionario_id_fkey(nome, cargo, empregador_cnpj, empregador_nome)")
        .eq("tenant_id", activeTenant.id)
        .eq("competencia", competencia)
        .neq("status", "cancelado");

      // 4. Contas a pagar do mês (por vencimento)
      const contasQuery = supabase
        .from("contas_pagar")
        .select("*")
        .eq("tenant_id", activeTenant.id)
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

      // 5. Benefícios extras vinculados às folhas do mês
      const payrollRows = (flr.data ?? []) as unknown as FolhaPagamento[];
      const folhaIds = payrollRows.map((payroll) => payroll.id);
      let beneficiosExtras: FolhaBeneficio[] = [];
      if (folhaIds.length) {
        const { data: bx, error: ebx } = await supabase
          .from("folha_beneficios")
          .select("*")
          .eq("tenant_id", activeTenant.id)
          .eq("ativo", true)
          .in("folha_id", folhaIds);
        if (ebx) throw ebx;
        beneficiosExtras = (bx ?? []) as unknown as FolhaBeneficio[];
      }

      const faturasFiltered = (fr.data || []).filter((f) => {
        if (!incluiIndustrial) return false;
        if (setor === "industrial") return f.cliente?.classificacao === "industrial";
        return true;
      });
      const receitasFaturas = faturasFiltered.reduce((sum, invoice) => sum + Number(invoice.valor_total), 0);

      const receitasLoja = incluiLoja
        ? (vr.data || []).reduce((sum, sale) => sum + Number(sale.valor), 0)
        : 0;
      const receitasLojaCount = incluiLoja ? (vr.data || []).length : 0;

      const receitasTotais = receitasFaturas + receitasLoja;

      // Folha
      const benefitsByPayroll = new Map<string, number>();
      beneficiosExtras.forEach((benefit) => {
        benefitsByPayroll.set(
          benefit.folha_id,
          (benefitsByPayroll.get(benefit.folha_id) || 0) + Number(benefit.valor || 0),
        );
      });
      const folhaItens = payrollRows.map((f) => ({
        funcionario: f.funcionario?.nome || "—",
        cargo: f.funcionario?.cargo || "—",
        empregadorCnpj: f.funcionario?.empregador_cnpj || "",
        empregadorNome: f.funcionario?.empregador_nome || "—",
        salario: Number(f.salario_base || 0),
        beneficios: benefitsByPayroll.get(f.id) || 0,
        descontos: Number(f.total_descontos || 0),
        liquido: Number(f.liquido || 0),
        custoTotal: Number(f.salario_base || 0) + (benefitsByPayroll.get(f.id) || 0),
      }));
      const despesasFolha = folhaItens.reduce((sum, item) => sum + item.salario, 0);

      const folhaPorEmpregadorMap = new Map<string, { cnpj: string; nome: string; total: number; count: number }>();
      folhaItens.forEach((it) => {
        const key = it.empregadorCnpj || "sem_cnpj";
        const cur = folhaPorEmpregadorMap.get(key) || { cnpj: it.empregadorCnpj, nome: it.empregadorNome, total: 0, count: 0 };
        cur.total += it.custoTotal;
        cur.count += 1;
        folhaPorEmpregadorMap.set(key, cur);
      });
      const folhaPorEmpregador = Array.from(folhaPorEmpregadorMap.values());

      // Contas
      const contas = cr.data || [];
      const isCat = (c: string | null, list: string[]) =>
        c ? list.some((x) => x.toLowerCase() === c.toLowerCase()) : false;

      const despesasProdutos = contas
        .filter((account) => isCat(account.categoria, CAT_PRODUTOS))
        .reduce((sum, account) => sum + Number(account.valor), 0);

      const despesasContasMensais = contas
        .filter((account) => isCat(account.categoria, CAT_CONTAS_MENSAIS))
        .reduce((sum, account) => sum + Number(account.valor), 0);

      const despesasImpostos = contas
        .filter((account) => isCat(account.categoria, CAT_IMPOSTOS))
        .reduce((sum, account) => sum + Number(account.valor), 0);

      // Outros = não folha (folha já está em folha_pagamento) e não nas demais
      const despesasOutras = contas
        .filter(
          (account) =>
            !isCat(account.categoria, CAT_FOLHA) &&
            !isCat(account.categoria, CAT_PRODUTOS) &&
            !isCat(account.categoria, CAT_CONTAS_MENSAIS) &&
            !isCat(account.categoria, CAT_IMPOSTOS),
        )
        .reduce((sum, account) => sum + Number(account.valor), 0);

      // Benefícios extras
      const folhaMap = new Map(payrollRows.map((payroll) => [payroll.id, payroll]));
      const beneficiosExtrasItens = beneficiosExtras.map((b) => {
        const fol = folhaMap.get(b.folha_id);
        return {
          id: b.id,
          funcionario: fol?.funcionario?.nome || "—",
          empregador: fol?.funcionario?.empregador_nome || "—",
          nome: b.nome,
          categoria: b.categoria || "Outros",
          tipo: (b.tipo || "beneficio") as "beneficio" | "desconto",
          valor: Number(b.valor || 0),
        };
      });
      const despesasBeneficiosExtras = beneficiosExtrasItens.reduce(
        (sum, benefit) => sum + benefit.valor,
        0,
      );
      const catMap = new Map<string, { categoria: string; total: number; count: number }>();
      beneficiosExtrasItens.forEach((b) => {
        const sign = b.tipo === "beneficio" ? 1 : -1;
        const cur = catMap.get(b.categoria) || { categoria: b.categoria, total: 0, count: 0 };
        cur.total += sign * b.valor;
        cur.count += 1;
        catMap.set(b.categoria, cur);
      });
      const beneficiosExtrasPorCategoria = Array.from(catMap.values());

      const despesasTotais =
        despesasFolha + despesasProdutos + despesasContasMensais + despesasImpostos + despesasOutras + despesasBeneficiosExtras;

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
        despesasBeneficiosExtras,
        despesasTotais,
        lucro,
        margem,
        folhaItens,
        folhaPorEmpregador,
        beneficiosExtrasItens,
        beneficiosExtrasPorCategoria,
        contasItens: contas
          .filter((account) => !isCat(account.categoria, CAT_FOLHA))
          .map((account) => ({
            id: account.id,
            descricao: account.descricao,
            fornecedor: account.fornecedor || "—",
            categoria: account.categoria || "Sem categoria",
            valor: Number(account.valor),
            vencimento: account.vencimento,
            status: account.status,
          })),
      };
    },
    enabled: Boolean(activeTenant && user),
  });
}
