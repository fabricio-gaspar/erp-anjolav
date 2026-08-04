import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMetricasFinanceirasResumo = () => {
  return useQuery({
    queryKey: ["metricas_financeiras_resumo"],
    queryFn: async () => {
      const hoje = new Date();
      const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
      const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString();

      // Receitas (Faturas pagas ou enviadas no mês)
      const { data: faturas } = await supabase
        .from("faturas")
        .select("valor_total")
        .gte("data_vencimento", primeiroDiaMes)
        .lte("data_vencimento", ultimoDiaMes);

      // Despesas (Contas pagar pagas ou pendentes no mês)
      const { data: contasPagar } = await supabase
        .from("contas_pagar")
        .select("valor")
        .gte("data_vencimento", primeiroDiaMes)
        .lte("data_vencimento", ultimoDiaMes);

      const receitas = faturas?.reduce((acc, f) => acc + Number(f.valor_total), 0) || 0;
      const despesas = contasPagar?.reduce((acc, c) => acc + Number(c.valor), 0) || 0;
      const lucro = receitas - despesas;
      const margem = receitas > 0 ? Math.round((lucro / receitas) * 100) : 0;

      return {
        receitas,
        despesas,
        lucro,
        margem,
        mes: formatarMes(hoje)
      };
    }
  });
};

function formatarMes(data: Date) {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return meses[data.getMonth()];
}
