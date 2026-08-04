import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeriaProxima {
  id: string;
  nome: string;
  data_admissao: string;
  anos_completos: number;
  data_ferias_devidas: string;
  dias_restantes: number;
}

export const useFeriasProximas = () => {
  return useQuery({
    queryKey: ["ferias_proximas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, data_admissao")
        .eq("ativo", true)
        .not("data_admissao", "is", null);

      if (error) throw error;

      const hoje = new Date();
      const proximas: FeriaProxima[] = [];

      (data || []).forEach((f: any) => {
        if (!f.data_admissao) return;
        
        const admissao = new Date(f.data_admissao + "T00:00:00");
        const diffMs = hoje.getTime() - admissao.getTime();
        const anosCompletos = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
        
        if (anosCompletos < 1) return;

        // Next vacation anniversary
        const proximoAniversario = new Date(admissao);
        proximoAniversario.setFullYear(admissao.getFullYear() + anosCompletos + 1);
        
        const diasRestantes = Math.ceil((proximoAniversario.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        // Show if vacation is due (past anniversary) or coming within 30 days
        const dataFeriasDevidas = new Date(admissao);
        dataFeriasDevidas.setFullYear(admissao.getFullYear() + anosCompletos);
        
        const diasDesdeFerias = Math.ceil((hoje.getTime() - dataFeriasDevidas.getTime()) / (1000 * 60 * 60 * 24));

        // Alert if within 30 days of anniversary or overdue
        if (diasRestantes <= 30 || diasDesdeFerias <= 30) {
          proximas.push({
            id: f.id,
            nome: f.nome,
            data_admissao: f.data_admissao,
            anos_completos: anosCompletos,
            data_ferias_devidas: dataFeriasDevidas.toISOString().split("T")[0],
            dias_restantes: diasDesdeFerias > 0 ? -diasDesdeFerias : diasRestantes,
          });
        }
      });

      return proximas.sort((a, b) => a.dias_restantes - b.dias_restantes);
    },
  });
};
