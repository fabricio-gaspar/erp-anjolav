import { addDays, addWeeks, startOfDay, getDay, format } from "date-fns";

export type Frequencia = "diaria" | "semanal" | "quinzenal" | "mensal";

interface ConfiguracaoAgendamento {
  frequencia: Frequencia;
  dias_retirada: string[];
  dias_entrega: string[];
  horario_retirada: string | null;
  horario_entrega: string | null;
}

export interface AgendamentoGerado {
  cliente_id: string;
  tipo: "retirada" | "entrega";
  data: string;
  horario: string | null;
  status: string;
  recorrente: boolean;
  frequencia: string;
}

// Converte dia da semana (seg, ter...) para número do JavaScript (0=dom, 1=seg...)
export function diaSemanaToNumber(dia: string): number {
  const mapa: Record<string, number> = {
    dom: 0,
    seg: 1,
    ter: 2,
    qua: 3,
    qui: 4,
    sex: 5,
    sab: 6,
  };
  return mapa[dia] ?? -1;
}

// Calcula próximas datas baseado na frequência e dias selecionados
export function calcularProximasDatas(
  diasSelecionados: string[],
  frequencia: Frequencia,
  diasAFrente: number = 60
): Date[] {
  const datas: Date[] = [];
  const hoje = startOfDay(new Date());
  const dataFim = addDays(hoje, diasAFrente);

  // Converte dias selecionados para números
  const diasNumeros = diasSelecionados
    .map(diaSemanaToNumber)
    .filter((n) => n !== -1);

  if (diasNumeros.length === 0) return datas;

  let dataAtual = hoje;
  let semanaAtual = 0;

  while (dataAtual <= dataFim) {
    const diaSemanaAtual = getDay(dataAtual);

    if (diasNumeros.includes(diaSemanaAtual)) {
      let incluir = false;

      switch (frequencia) {
        case "diaria":
          // Para diária, inclui todos os dias selecionados
          incluir = true;
          break;
        case "semanal":
          // Para semanal, inclui todas as semanas
          incluir = true;
          break;
        case "quinzenal":
          // Para quinzenal, inclui semanas alternadas (0, 2, 4...)
          incluir = semanaAtual % 2 === 0;
          break;
        case "mensal":
          // Para mensal, inclui apenas a primeira ocorrência do dia no mês
          const primeiraOcorrencia = encontrarPrimeiraOcorrenciaNoMes(
            dataAtual,
            diaSemanaAtual
          );
          incluir = dataAtual.getTime() === primeiraOcorrencia.getTime();
          break;
      }

      if (incluir) {
        datas.push(new Date(dataAtual));
      }
    }

    // Avança para o próximo dia
    dataAtual = addDays(dataAtual, 1);

    // Atualiza contador de semana (quando chega no domingo)
    if (getDay(dataAtual) === 0) {
      semanaAtual++;
    }
  }

  return datas;
}

// Encontra a primeira ocorrência de um dia da semana no mês de uma data
function encontrarPrimeiraOcorrenciaNoMes(data: Date, diaSemana: number): Date {
  const primeiroDiaMes = new Date(data.getFullYear(), data.getMonth(), 1);
  let dataIteracao = primeiroDiaMes;

  while (getDay(dataIteracao) !== diaSemana) {
    dataIteracao = addDays(dataIteracao, 1);
  }

  return startOfDay(dataIteracao);
}

// Gera todos os agendamentos para um cliente baseado na configuração
export function gerarAgendamentosDoCliente(
  clienteId: string,
  config: ConfiguracaoAgendamento,
  diasAFrente: number = 60
): AgendamentoGerado[] {
  const agendamentos: AgendamentoGerado[] = [];

  // Gerar agendamentos de retirada
  if (config.dias_retirada && config.dias_retirada.length > 0) {
    const datasRetirada = calcularProximasDatas(
      config.dias_retirada,
      config.frequencia,
      diasAFrente
    );

    for (const data of datasRetirada) {
      agendamentos.push({
        cliente_id: clienteId,
        tipo: "retirada",
        data: format(data, "yyyy-MM-dd"),
        horario: config.horario_retirada,
        status: "agendado",
        recorrente: true,
        frequencia: config.frequencia,
      });
    }
  }

  // Gerar agendamentos de entrega
  if (config.dias_entrega && config.dias_entrega.length > 0) {
    const datasEntrega = calcularProximasDatas(
      config.dias_entrega,
      config.frequencia,
      diasAFrente
    );

    for (const data of datasEntrega) {
      agendamentos.push({
        cliente_id: clienteId,
        tipo: "entrega",
        data: format(data, "yyyy-MM-dd"),
        horario: config.horario_entrega,
        status: "agendado",
        recorrente: true,
        frequencia: config.frequencia,
      });
    }
  }

  return agendamentos;
}
