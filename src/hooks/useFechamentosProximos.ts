import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ClienteFechamento {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  dia_fechamento: number;
  diasRestantes: number;
  condicao_pagamento: string | null;
  dataFechamento: Date;
}

export function useFechamentosProximos(diasAntecedencia: number = 31) {
  return useQuery({
    queryKey: ["fechamentos_proximos", diasAntecedencia],
    queryFn: async () => {
      // Buscar configurações de pagamento que têm dia_fechamento definido
      const { data: configs, error: configsError } = await supabase
        .from("configuracoes_pagamento_cliente")
        .select("cliente_id, dia_fechamento, condicao_pagamento")
        .not("dia_fechamento", "is", null);

      if (configsError) throw configsError;
      if (!configs || configs.length === 0) return [];

      // Buscar dados dos clientes
      const clienteIds = configs.map((c) => c.cliente_id);
      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia, ativo")
        .in("id", clienteIds)
        .eq("ativo", true);

      if (clientesError) throw clientesError;

      // Calcular dias restantes para cada fechamento
      // Normalizar para meia-noite para evitar inconsistências de horário
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diaAtual = hoje.getDate();
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();

      const fechamentos: ClienteFechamento[] = [];

      for (const config of configs) {
        const cliente = clientes?.find((c) => c.id === config.cliente_id);
        if (!cliente || !config.dia_fechamento) continue;

        const diaFechamento = config.dia_fechamento;
        
        // Calcular data do próximo fechamento
        let dataFechamento = new Date(anoAtual, mesAtual, diaFechamento);
        dataFechamento.setHours(0, 0, 0, 0);
        
        // Se o dia de fechamento já passou neste mês, considerar o próximo mês
        if (diaFechamento < diaAtual) {
          dataFechamento = new Date(anoAtual, mesAtual + 1, diaFechamento);
          dataFechamento.setHours(0, 0, 0, 0);
        }

        // Calcular diferença em dias
        const diffTime = dataFechamento.getTime() - hoje.getTime();
        const diasRestantes = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Incluir apenas os que estão dentro da antecedência configurada
        if (diasRestantes >= 0 && diasRestantes <= diasAntecedencia) {
          fechamentos.push({
            id: cliente.id,
            razao_social: cliente.razao_social,
            nome_fantasia: cliente.nome_fantasia,
            dia_fechamento: diaFechamento,
            diasRestantes,
            condicao_pagamento: config.condicao_pagamento,
            dataFechamento,
          });
        }
      }

      // Ordenar por dias restantes (mais urgentes primeiro)
      return fechamentos.sort((a, b) => a.diasRestantes - b.diasRestantes);
    },
  });
}
