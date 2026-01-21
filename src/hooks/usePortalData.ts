import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";

export interface OrdemServicoPortal {
  id: string;
  numero: string;
  status: string;
  prioridade: string;
  data_retirada: string;
  data_previsao_entrega: string | null;
  data_entrega: string | null;
  created_at: string;
  updated_at: string;
  historico: HistoricoProducaoPortal[];
  itens: ItemOSPortal[];
}

export interface HistoricoProducaoPortal {
  id: string;
  etapa_anterior: string | null;
  etapa_nova: string;
  created_at: string;
  funcionario?: {
    nome: string;
  } | null;
}

export interface ItemOSPortal {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto?: {
    nome: string;
  } | null;
}

export interface FaturaPortal {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status: string;
  numero_nf: string | null;
  link_pdf_nf: string | null;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  data_vencimento: string | null;
  data_emissao_nf: string | null;
  chave_acesso: string | null;
  created_at: string;
}

export interface AlertaPortal {
  tipo: "os_pronta" | "boleto_vencendo" | "fatura_pendente" | "os_atrasada";
  titulo: string;
  descricao: string;
  data?: string;
  referencia?: string;
}

export function usePortalOrdens(clienteId: string | null) {
  return useQuery({
    queryKey: ["portal-ordens", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          status,
          prioridade,
          data_retirada,
          data_previsao_entrega,
          data_entrega,
          created_at,
          updated_at,
          historico:historico_producao(
            id,
            etapa_anterior,
            etapa_nova,
            created_at,
            funcionario:funcionarios(nome)
          ),
          itens:itens_ordem_servico(
            id,
            quantidade,
            preco_unitario,
            subtotal,
            produto:produtos(nome)
          )
        `)
        .eq("cliente_id", clienteId)
        .not("status", "in", '("cancelada")')
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as OrdemServicoPortal[];
    },
    enabled: !!clienteId,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}

export function usePortalFaturas(clienteId: string | null) {
  return useQuery({
    queryKey: ["portal-faturas", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from("faturas")
        .select(`
          id,
          periodo_inicio,
          periodo_fim,
          valor_total,
          status,
          numero_nf,
          link_pdf_nf,
          boleto_url,
          boleto_linha_digitavel,
          pix_qr_code,
          pix_copia_cola,
          data_vencimento,
          data_emissao_nf,
          chave_acesso,
          created_at
        `)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as FaturaPortal[];
    },
    enabled: !!clienteId,
  });
}

export function usePortalEstatisticas(clienteId: string | null) {
  const inicioMes = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(new Date()), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["portal-estatisticas", clienteId, inicioMes],
    queryFn: async () => {
      if (!clienteId) return null;

      // Buscar OS do mês
      const { data: osDoMes, error: osError } = await supabase
        .from("ordens_servico")
        .select("id, status, valor_total, itens:itens_ordem_servico(quantidade)")
        .eq("cliente_id", clienteId)
        .gte("data_retirada", inicioMes)
        .lte("data_retirada", fimMes);

      if (osError) throw osError;

      // Buscar faturas do mês
      const { data: faturasDoMes, error: faturasError } = await supabase
        .from("faturas")
        .select("id, valor_total, status")
        .eq("cliente_id", clienteId)
        .gte("periodo_inicio", inicioMes)
        .lte("periodo_fim", fimMes);

      if (faturasError) throw faturasError;

      // Calcular estatísticas
      const totalOS = osDoMes?.length || 0;
      const osEntregues = osDoMes?.filter(os => os.status === "entregue").length || 0;
      const osEmProcesso = osDoMes?.filter(os => !["entregue", "cancelada"].includes(os.status)).length || 0;
      
      const totalPecas = osDoMes?.reduce((acc, os) => {
        const pecasOS = os.itens?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;
        return acc + pecasOS;
      }, 0) || 0;

      const valorFaturado = faturasDoMes?.reduce((acc, f) => acc + Number(f.valor_total || 0), 0) || 0;
      const faturaspagas = faturasDoMes?.filter(f => f.status === "pago").length || 0;

      return {
        totalOS,
        osEntregues,
        osEmProcesso,
        totalPecas,
        valorFaturado,
        faturasPagas: faturaspagas,
        totalFaturas: faturasDoMes?.length || 0,
      };
    },
    enabled: !!clienteId,
  });
}

export function usePortalAlertas(
  clienteId: string | null,
  ordens: OrdemServicoPortal[],
  faturas: FaturaPortal[]
): AlertaPortal[] {
  const alertas: AlertaPortal[] = [];
  const hoje = new Date();
  const em3Dias = subDays(hoje, -3);

  // OS prontas para entrega
  const osProntas = ordens.filter(os => os.status === "expedicao");
  osProntas.forEach(os => {
    alertas.push({
      tipo: "os_pronta",
      titulo: "Ordem pronta para entrega",
      descricao: `OS #${os.numero} está pronta para ser entregue`,
      referencia: os.numero,
    });
  });

  // OS atrasadas
  const osAtrasadas = ordens.filter(os => {
    if (!os.data_previsao_entrega || os.status === "entregue") return false;
    return new Date(os.data_previsao_entrega) < hoje;
  });
  osAtrasadas.forEach(os => {
    alertas.push({
      tipo: "os_atrasada",
      titulo: "Entrega em atraso",
      descricao: `OS #${os.numero} estava prevista para ${format(new Date(os.data_previsao_entrega!), "dd/MM")}`,
      data: os.data_previsao_entrega!,
      referencia: os.numero,
    });
  });

  // Boletos vencendo
  const boletosVencendo = faturas.filter(f => {
    if (!f.data_vencimento || f.status === "pago") return false;
    const vencimento = new Date(f.data_vencimento);
    return vencimento >= hoje && vencimento <= em3Dias;
  });
  boletosVencendo.forEach(f => {
    alertas.push({
      tipo: "boleto_vencendo",
      titulo: "Boleto próximo do vencimento",
      descricao: `Fatura de R$ ${Number(f.valor_total).toFixed(2)} vence em ${format(new Date(f.data_vencimento!), "dd/MM")}`,
      data: f.data_vencimento!,
    });
  });

  // Faturas pendentes
  const faturasPendentes = faturas.filter(f => f.status === "pendente" || f.status === "nota_emitida");
  if (faturasPendentes.length > 0) {
    const total = faturasPendentes.reduce((acc, f) => acc + Number(f.valor_total), 0);
    alertas.push({
      tipo: "fatura_pendente",
      titulo: `${faturasPendentes.length} fatura(s) pendente(s)`,
      descricao: `Total de R$ ${total.toFixed(2)} em aberto`,
    });
  }

  return alertas;
}
