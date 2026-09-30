import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  isStrongPortalAccessCode,
  normalizePortalAccessCode,
} from "@/lib/portalCode";

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
}

export interface ItemOSPortal {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto?: { nome: string } | null;
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

export interface LancamentoClientePortal {
  id: string;
  cliente_id: string;
  ordem_servico_id: string | null;
  status: "pendente" | "conferido" | "divergente";
  data_lancamento: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  itens: Array<{
    id: string;
    lancamento_id: string;
    produto_id: string;
    quantidade: number;
    observacoes: string | null;
    created_at: string;
    produto?: { id: string; nome: string; unidade: string | null } | null;
  }>;
}

export interface ProdutoPortal {
  id: string;
  nome: string;
  unidade: string | null;
}

export interface AgendamentoPortal {
  id: string;
  tipo: string;
  data: string;
  horario: string | null;
  status: string | null;
}

export interface EstatisticasPortal {
  totalOS: number;
  osEntregues: number;
  osEmProcesso: number;
  totalPecas: number;
  valorFaturado: number;
  faturasPagas: number;
  totalFaturas: number;
}

export interface PortalBootstrap {
  cliente: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
  };
  config: {
    cliente_id: string;
    frequencia: string | null;
    dias_retirada: string[] | null;
    dias_entrega: string[] | null;
    horario_retirada: string | null;
    horario_entrega: string | null;
    tipo_relatorio: string | null;
  };
  empresa: {
    nome_empresa: string | null;
    logo_url: string | null;
    whatsapp_numero: string | null;
  } | null;
  ordens: OrdemServicoPortal[];
  faturas: FaturaPortal[];
  agendamentos: AgendamentoPortal[];
  lancamentos: LancamentoClientePortal[];
  produtos: ProdutoPortal[];
  estatisticas: EstatisticasPortal;
}

export interface LancamentoComItensPortal {
  id: string;
  data_lancamento: string;
  data_entrega: string | null;
  valor_total: number;
  itens: Array<{
    id: string;
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
    subtotal: number;
    unidade: string;
  }>;
}

interface PortalEnvelope<T> {
  data?: T;
  error?: string;
}

async function portalRequest<T>(
  accessCode: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const code = normalizePortalAccessCode(accessCode);
  if (!isStrongPortalAccessCode(code)) throw new Error("Acesso inválido ou expirado");

  const { data, error } = await supabase.functions.invoke<PortalEnvelope<T>>("portal-customer", {
    body: { ...payload, code },
  });

  if (error || !data?.data) {
    throw new Error(data?.error || "Não foi possível acessar o portal");
  }

  return data.data;
}

export function usePortalBootstrap(accessCode: string | undefined) {
  const normalizedCode = normalizePortalAccessCode(accessCode ?? "");

  return useQuery({
    queryKey: ["portal-bootstrap", normalizedCode],
    queryFn: () => portalRequest<PortalBootstrap>(normalizedCode, { action: "bootstrap" }),
    enabled: Boolean(normalizedCode),
    retry: false,
    refetchInterval: 60_000,
  });
}

export function usePortalAlertas(
  ordens: OrdemServicoPortal[],
  faturas: FaturaPortal[],
): AlertaPortal[] {
  const alertas: AlertaPortal[] = [];
  const hoje = new Date();
  const em3Dias = subDays(hoje, -3);

  for (const ordem of ordens.filter((item) => item.status === "expedicao")) {
    alertas.push({
      tipo: "os_pronta",
      titulo: "Ordem pronta para entrega",
      descricao: `OS #${ordem.numero} está pronta para ser entregue`,
      referencia: ordem.numero,
    });
  }

  for (const ordem of ordens.filter((item) => {
    if (!item.data_previsao_entrega || item.status === "entregue") return false;
    return new Date(item.data_previsao_entrega) < hoje;
  })) {
    alertas.push({
      tipo: "os_atrasada",
      titulo: "Entrega em atraso",
      descricao: `OS #${ordem.numero} estava prevista para ${format(new Date(ordem.data_previsao_entrega!), "dd/MM")}`,
      data: ordem.data_previsao_entrega!,
      referencia: ordem.numero,
    });
  }

  for (const fatura of faturas.filter((item) => {
    if (!item.data_vencimento || item.status === "pago") return false;
    const vencimento = new Date(item.data_vencimento);
    return vencimento >= hoje && vencimento <= em3Dias;
  })) {
    alertas.push({
      tipo: "boleto_vencendo",
      titulo: "Boleto próximo do vencimento",
      descricao: `Fatura de R$ ${Number(fatura.valor_total).toFixed(2)} vence em ${format(new Date(fatura.data_vencimento!), "dd/MM")}`,
      data: fatura.data_vencimento!,
    });
  }

  const faturasPendentes = faturas.filter(
    (fatura) => fatura.status === "pendente" || fatura.status === "nota_emitida",
  );
  if (faturasPendentes.length) {
    const total = faturasPendentes.reduce(
      (accumulator, fatura) => accumulator + Number(fatura.valor_total),
      0,
    );
    alertas.push({
      tipo: "fatura_pendente",
      titulo: `${faturasPendentes.length} fatura(s) pendente(s)`,
      descricao: `Total de R$ ${total.toFixed(2)} em aberto`,
    });
  }

  return alertas;
}

export function usePortalRelatorio(accessCode: string, faturaId: string | null) {
  return useQuery({
    queryKey: ["portal-relatorio", accessCode, faturaId],
    queryFn: () =>
      portalRequest<LancamentoComItensPortal[]>(accessCode, {
        action: "report",
        faturaId,
      }),
    enabled: Boolean(accessCode && faturaId),
    retry: false,
  });
}

export interface CreatePortalLaunchInput {
  observacoes?: string;
  itens: Array<{
    produto_id: string;
    quantidade: number;
    observacoes?: string;
  }>;
}

export function useCreatePortalLancamento(accessCode: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePortalLaunchInput) =>
      portalRequest<LancamentoClientePortal>(accessCode, {
        action: "create-launch",
        idempotencyKey: `portal:${crypto.randomUUID()}`,
        ...input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portal-bootstrap", normalizePortalAccessCode(accessCode)],
      });
      toast.success("Lançamento enviado com sucesso!");
    },
    onError: () => toast.error("Não foi possível enviar o lançamento"),
  });
}
