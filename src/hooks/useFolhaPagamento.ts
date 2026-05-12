import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface FolhaPagamento {
  id: string;
  funcionario_id: string;
  competencia: string;
  salario_base: number;
  horas_extras: number;
  horas_extras_50?: number;
  horas_extras_70?: number;
  horas_extras_100?: number;
  reflexo_dsr?: number;
  comissoes: number;
  gratificacao: number;
  vale_transporte: number;
  vale_alimentacao: number;
  vale_refeicao: number;
  plano_saude: number;
  plano_odontologico: number;
  outros_beneficios: number;
  desconto_inss: number;
  desconto_irrf: number;
  desconto_vt: number;
  outros_descontos: number;
  adiantamento_salarial?: number;
  desconto_emprestimo?: number;
  desconto_cesta_basica?: number;
  contribuicao_assistencial?: number;
  troco_mes?: number;
  troco_mes_anterior?: number;
  estorno_provisao?: number;
  base_fgts?: number;
  valor_fgts?: number;
  base_irrf?: number;
  faixa_irrf?: number;
  salario_contrib_inss?: number;
  dias_trabalhados?: number;
  total_proventos: number;
  total_descontos: number;
  liquido: number;
  custo_total_empresa: number;
  status: string;
  data_pagamento: string | null;
  conta_pagar_id: string | null;
  observacoes: string | null;
  funcionario?: { id: string; nome: string; cargo: string; empregador_cnpj?: string; empregador_nome?: string };
}

export function calcularTotaisFolha(f: Partial<FolhaPagamento>) {
  const proventos =
    Number(f.salario_base || 0) +
    Number(f.horas_extras || 0) +
    Number(f.horas_extras_50 || 0) +
    Number(f.horas_extras_70 || 0) +
    Number(f.horas_extras_100 || 0) +
    Number(f.reflexo_dsr || 0) +
    Number(f.comissoes || 0) +
    Number(f.gratificacao || 0) +
    Number(f.estorno_provisao || 0) +
    Number(f.troco_mes || 0);
  const beneficios =
    Number(f.vale_transporte || 0) +
    Number(f.vale_alimentacao || 0) +
    Number(f.vale_refeicao || 0) +
    Number(f.plano_saude || 0) +
    Number(f.plano_odontologico || 0) +
    Number(f.outros_beneficios || 0);
  const descontos =
    Number(f.desconto_inss || 0) +
    Number(f.desconto_irrf || 0) +
    Number(f.desconto_vt || 0) +
    Number(f.outros_descontos || 0) +
    Number(f.adiantamento_salarial || 0) +
    Number(f.desconto_emprestimo || 0) +
    Number(f.desconto_cesta_basica || 0) +
    Number(f.contribuicao_assistencial || 0) +
    Number(f.troco_mes_anterior || 0);
  const liquido = proventos - descontos;
  const encargos = Number(f.salario_base || 0) * 0.36;
  const custoTotal = proventos + beneficios + encargos;
  return {
    total_proventos: proventos,
    total_descontos: descontos,
    liquido,
    custo_total_empresa: custoTotal,
  };
}

export const useFolhaPagamento = (competencia: string) => {
  return useQuery({
    queryKey: ["folha_pagamento", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folha_pagamento" as any)
        .select("*, funcionario:funcionarios(id, nome, cargo, empregador_cnpj, empregador_nome)")
        .eq("competencia", competencia)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FolhaPagamento[];
    },
    enabled: !!competencia,
  });
};

export const useGerarFolhaMes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (competencia: string) => {
      // Verifica funcionários ativos
      const { data: funcs, error: e1 } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("ativo", true);
      if (e1) throw e1;
      if (!funcs?.length) throw new Error("Nenhum funcionário ativo");

      // Verifica já existentes
      const { data: existentes } = await supabase
        .from("folha_pagamento" as any)
        .select("funcionario_id")
        .eq("competencia", competencia);
      const jaTem = new Set((existentes || []).map((x: any) => x.funcionario_id));

      const novos = funcs
        .filter((f: any) => !jaTem.has(f.id))
        .map((f: any) => {
          const base = {
            funcionario_id: f.id,
            competencia,
            salario_base: Number(f.salario_base || 0),
            horas_extras: 0,
            comissoes: 0,
            gratificacao: Number(f.gratificacao || 0),
            vale_transporte: Number(f.vale_transporte || 0),
            vale_alimentacao: Number(f.vale_alimentacao || 0),
            vale_refeicao: Number(f.vale_refeicao || 0),
            plano_saude: Number(f.plano_saude || 0),
            plano_odontologico: Number(f.plano_odontologico || 0),
            outros_beneficios: Number(f.outros_beneficios || 0),
            desconto_inss: 0,
            desconto_irrf: 0,
            desconto_vt:
              Number(f.salario_base || 0) * (Number(f.desconto_vt_percentual || 0) / 100),
            outros_descontos: Number(f.outros_descontos || 0),
            status: "aberto",
          };
          const tot = calcularTotaisFolha(base);
          return { ...base, ...tot };
        });

      if (novos.length === 0) {
        return { inserted: 0, skipped: funcs.length };
      }
      const { error } = await supabase.from("folha_pagamento" as any).insert(novos);
      if (error) throw error;
      return { inserted: novos.length, skipped: funcs.length - novos.length };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["folha_pagamento"] });
      toast.success(`Folha gerada: ${r.inserted} novos, ${r.skipped} já existiam`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateFolha = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<FolhaPagamento> & { id: string }) => {
      const { id, funcionario, ...rest } = data as any;
      const tot = calcularTotaisFolha(rest);
      const { data: r, error } = await supabase
        .from("folha_pagamento" as any)
        .update({ ...rest, ...tot })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return r;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folha_pagamento"] });
      toast.success("Folha atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useFecharFolhaMes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ competencia, dataPagamento }: { competencia: string; dataPagamento: string }) => {
      // Busca folhas abertas do mês
      const { data: folhas, error: e1 } = await supabase
        .from("folha_pagamento" as any)
        .select("*, funcionario:funcionarios(nome)")
        .eq("competencia", competencia)
        .eq("status", "aberto");
      if (e1) throw e1;
      if (!folhas?.length) throw new Error("Nenhuma folha em aberto neste mês");

      const competenciaLabel = format(new Date(competencia), "MM/yyyy");

      // Busca somatório de benefícios do catálogo por folha
      const folhaIds = (folhas as any[]).map((f) => f.id);
      const { data: bens } = await supabase
        .from("folha_beneficios" as any)
        .select("folha_id, valor, beneficio_id")
        .in("folha_id", folhaIds);
      const benMap = new Map<string, number>();
      (bens || []).forEach((b: any) => {
        if (!b.beneficio_id) return;
        benMap.set(b.folha_id, (benMap.get(b.folha_id) || 0) + Number(b.valor || 0));
      });

      // Cria conta a pagar por funcionário (salário cheio + benefícios do catálogo)
      for (const f of folhas as any[]) {
        const valorPagar = Number(f.salario_base || 0) + (benMap.get(f.id) || 0);
        const { data: conta, error: e2 } = await supabase
          .from("contas_pagar")
          .insert({
            descricao: `Folha ${competenciaLabel} - ${f.funcionario?.nome || "Funcionário"}`,
            valor: valorPagar,
            vencimento: dataPagamento,
            categoria: "folha_pagamento",
            status: "pendente",
            fornecedor: f.funcionario?.nome || null,
          })
          .select()
          .single();
        if (e2) throw e2;
        await supabase
          .from("folha_pagamento" as any)
          .update({ status: "fechado", data_pagamento: dataPagamento, conta_pagar_id: conta.id })
          .eq("id", f.id);
      }
      return folhas.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["folha_pagamento"] });
      qc.invalidateQueries({ queryKey: ["contas_pagar"] });
      toast.success(`${n} folhas fechadas e lançadas em Contas a Pagar`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteFolha = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folha_pagamento" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folha_pagamento"] });
      toast.success("Lançamento removido");
    },
  });
};

// Helper para o relatório mensal
export const useFolhaMesPorIntervalo = (inicio: Date, fim: Date) => {
  const compInicio = format(startOfMonth(inicio), "yyyy-MM-dd");
  const compFim = format(endOfMonth(fim), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["folha_intervalo", compInicio, compFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folha_pagamento" as any)
        .select("*, funcionario:funcionarios(id, nome, cargo, empregador_cnpj, empregador_nome)")
        .gte("competencia", compInicio)
        .lte("competencia", compFim);
      if (error) throw error;
      return (data || []) as unknown as FolhaPagamento[];
    },
  });
};
