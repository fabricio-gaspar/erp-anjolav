import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DadosProducao {
  quantidadePecas: number;
  pesoTotal: number;
  pesoFinal: number;
  quantidadeVolumes: number;
  etiquetaAplicada: boolean;
  conferenciaFinal: boolean;
  itensDanificados?: string;
  observacoesSeparacao?: string;
  observacoesEmbalagem?: string;
}

export interface ItemOS {
  id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto: {
    nome: string;
    unidade: string | null;
  } | null;
}

export interface OSConferencia {
  id: string;
  numero: string;
  cliente: {
    id: string;
    razao_social: string;
    telefone: string | null;
    cpf_cnpj: string | null;
  };
  dataRetirada: string;
  dataPrevisaoEntrega: string | null;
  status: string;
  observacoes: string | null;
  dadosProducao: DadosProducao;
  statusConferencia: "pendente" | "conferido" | "divergencia" | "lancado";
  historicoProducao: Array<{
    id: string;
    etapa_nova: string;
    etapa_anterior: string | null;
    created_at: string;
    dados_formulario: Record<string, unknown> | null;
    observacoes: string | null;
  }>;
  itensOS: ItemOS[];
}

function extrairDadosProducao(historico: Array<{ etapa_nova: string; dados_formulario: Record<string, unknown> | null }>): DadosProducao {
  const dados: DadosProducao = {
    quantidadePecas: 0,
    pesoTotal: 0,
    pesoFinal: 0,
    quantidadeVolumes: 0,
    etiquetaAplicada: false,
    conferenciaFinal: false,
  };

  for (const h of historico) {
    const form = h.dados_formulario;
    if (!form) continue;

    if (h.etapa_nova === "em_lavagem" || h.etapa_nova === "separacao") {
      // Dados da Separação
      if (form.quantidade_pecas) dados.quantidadePecas = Number(form.quantidade_pecas);
      if (form.peso_total_kg) dados.pesoTotal = Number(form.peso_total_kg);
      if (form.itens_danificados) dados.itensDanificados = String(form.itens_danificados);
      if (form.observacoes) dados.observacoesSeparacao = String(form.observacoes);
    }

    if (h.etapa_nova === "pronto_entrega" || h.etapa_nova === "embalagem") {
      // Dados da Embalagem
      if (form.peso_final_kg) dados.pesoFinal = Number(form.peso_final_kg);
      if (form.quantidade_volumes) dados.quantidadeVolumes = Number(form.quantidade_volumes);
      if (form.etiqueta_aplicada) dados.etiquetaAplicada = Boolean(form.etiqueta_aplicada);
      if (form.conferencia_final) dados.conferenciaFinal = Boolean(form.conferencia_final);
      if (form.observacoes) dados.observacoesEmbalagem = String(form.observacoes);
    }
  }

  return dados;
}

function determinarStatusConferencia(
  os: { status: string },
  temItens: boolean,
  dadosProducao: DadosProducao
): "pendente" | "conferido" | "divergencia" | "lancado" {
  if (temItens) return "lancado";
  if (dadosProducao.itensDanificados) return "divergencia";
  if (dadosProducao.conferenciaFinal) return "conferido";
  return "pendente";
}

export function useConferenciaProducao(periodo?: { inicio: Date; fim: Date }, statusFiltro?: string) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ["conferencia-producao", periodo?.inicio?.toISOString(), periodo?.fim?.toISOString(), statusFiltro],
    queryFn: async (): Promise<OSConferencia[]> => {
      // Buscar OS que passaram por etapas de produção (não apenas "retirada")
      let query = supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          status,
          observacoes,
          data_retirada,
          data_previsao_entrega,
          cliente:clientes(id, razao_social, telefone, cpf_cnpj),
          historico_producao(id, etapa_nova, etapa_anterior, created_at, dados_formulario, observacoes),
          itens_ordem_servico(
            id,
            produto_id,
            quantidade,
            preco_unitario,
            subtotal,
            produto:produtos(nome, unidade)
          )
        `)
        .neq("status", "retirada")
        .order("created_at", { ascending: false });

      if (periodo?.inicio) {
        query = query.gte("data_retirada", periodo.inicio.toISOString().split("T")[0]);
      }
      if (periodo?.fim) {
        query = query.lte("data_retirada", periodo.fim.toISOString().split("T")[0]);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching conferencia data:", error);
        throw error;
      }

      if (!data) return [];

      // Processar e mapear os dados
      const osConferencias: OSConferencia[] = data
        .filter((os) => os.cliente && os.historico_producao && os.historico_producao.length > 0)
        .map((os) => {
          const cliente = Array.isArray(os.cliente) ? os.cliente[0] : os.cliente;
          const historico = os.historico_producao || [];
          const temItens = (os.itens_ordem_servico?.length || 0) > 0;
          
          const dadosProducao = extrairDadosProducao(
            historico.map((h) => ({
              etapa_nova: h.etapa_nova,
              dados_formulario: h.dados_formulario as Record<string, unknown> | null,
            }))
          );

          const statusConferencia = determinarStatusConferencia(os, temItens, dadosProducao);

          return {
            id: os.id,
            numero: os.numero,
            cliente: {
              id: cliente?.id || "",
              razao_social: cliente?.razao_social || "Cliente não encontrado",
              telefone: cliente?.telefone || null,
              cpf_cnpj: cliente?.cpf_cnpj || null,
            },
            dataRetirada: os.data_retirada,
            dataPrevisaoEntrega: os.data_previsao_entrega,
            status: os.status,
            observacoes: os.observacoes,
            dadosProducao,
            statusConferencia,
            historicoProducao: historico.map((h) => ({
              id: h.id,
              etapa_nova: h.etapa_nova,
              etapa_anterior: h.etapa_anterior,
              created_at: h.created_at,
              dados_formulario: h.dados_formulario as Record<string, unknown> | null,
              observacoes: h.observacoes,
            })),
            itensOS: (os.itens_ordem_servico || []).map((item: any) => ({
              id: item.id,
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              subtotal: item.subtotal,
              produto: item.produto,
            })),
          };
        });

      // Filtrar por status se especificado
      if (statusFiltro && statusFiltro !== "todos") {
        return osConferencias.filter((os) => os.statusConferencia === statusFiltro);
      }

      return osConferencias;
    },
    refetchInterval: 30000,
  });
}

export function useGerarLancamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      ordemServicoId,
      itens,
    }: {
      ordemServicoId: string;
      itens: Array<{
        produto_id: string;
        quantidade: number;
        preco_unitario: number;
        subtotal: number;
        observacoes?: string;
      }>;
    }) => {
      // Verificar se já existem itens para esta OS
      const { data: existingItems } = await supabase
        .from("itens_ordem_servico")
        .select("id")
        .eq("ordem_servico_id", ordemServicoId);

      if (existingItems && existingItems.length > 0) {
        throw new Error("Esta OS já possui itens lançados");
      }

      // Inserir os itens
      const { data, error } = await supabase
        .from("itens_ordem_servico")
        .insert(
          itens.map((item) => ({
            ordem_servico_id: ordemServicoId,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            subtotal: item.subtotal,
            observacoes: item.observacoes || null,
          }))
        )
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conferencia-producao"] });
      queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] });
      toast({
        title: "Lançamento gerado",
        description: "Os itens foram registrados com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar lançamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
