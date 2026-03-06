import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DadosClienteCompletos {
  cliente: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cpf_cnpj: string | null;
    email: string | null;
    telefone: string | null;
    telefone2: string | null;
    tipo_pessoa: string;
    inscricao_municipal: string | null;
    inscricao_estadual: string | null;
    regime_tributario: string | null;
    classificacao: string;
    contato: string | null;
  } | null;
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    cep: string | null;
  } | null;
  configPagamento: {
    forma_pagamento: string | null;
    dia_fechamento: number | null;
    dia_vencimento: number | null;
    condicao_pagamento: string | null;
    tipo_faturamento: string | null;
    cnpj_emissor_id: string | null;
    descricao_nf_id: string | null;
    listar_itens_detalhados: boolean | null;
  } | null;
  configCliente: {
    tipo_relatorio: string | null;
    codigo_acesso: string | null;
    link_acesso: string | null;
    frequencia: string | null;
  } | null;
}

export function useDadosFaturamentoCompletos(clienteId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dados_faturamento_completos", clienteId],
    queryFn: async (): Promise<DadosClienteCompletos> => {
      if (!clienteId) return { cliente: null, endereco: null, configPagamento: null, configCliente: null };

      // Batch all queries in parallel
      const [clienteRes, enderecoRes, configPagRes, configCliRes] = await Promise.all([
        supabase.from("clientes").select("id, razao_social, nome_fantasia, cpf_cnpj, email, telefone, telefone2, tipo_pessoa, inscricao_municipal, inscricao_estadual, regime_tributario, classificacao, contato").eq("id", clienteId).single(),
        supabase.from("enderecos_clientes").select("logradouro, numero, complemento, bairro, cidade, uf, cep").eq("cliente_id", clienteId).maybeSingle(),
        supabase.from("configuracoes_pagamento_cliente").select("forma_pagamento, dia_fechamento, dia_vencimento, condicao_pagamento, tipo_faturamento, cnpj_emissor_id, descricao_nf_id, listar_itens_detalhados, observacao_faturamento").eq("cliente_id", clienteId).maybeSingle(),
        supabase.from("configuracoes_cliente").select("tipo_relatorio, codigo_acesso, link_acesso, frequencia").eq("cliente_id", clienteId).maybeSingle(),
      ]);

      return {
        cliente: clienteRes.data || null,
        endereco: enderecoRes.data || null,
        configPagamento: configPagRes.data || null,
        configCliente: configCliRes.data || null,
      };
    },
    enabled: !!clienteId,
  });

  return { dados: data || { cliente: null, endereco: null, configPagamento: null, configCliente: null }, isLoading, error };
}
