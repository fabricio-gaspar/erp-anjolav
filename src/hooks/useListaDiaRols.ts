import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  correspondeSituacaoListaDia,
  criarLinhaListaDia,
  usaPeriodoDePrevisao,
  type ListaDiaFiltros,
  type ListaDiaRol,
  type ListaDiaRolOrigem,
} from "@/lib/listaDiaRols";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import { clientClassificationValuesForArea } from "@/lib/operations";

const LISTA_DIA_PAGE_SIZE = 1000;

export interface ListaDiaConsulta {
  rols: ListaDiaRol[];
  totalEncontrado: number;
  resultadoLimitado: boolean;
  exigeCliente: boolean;
}

function normalizarNumeroRol(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9-]/g, "").trim();
}

/**
 * Consulta consolidada da Lista do Dia. O escopo de empresa e operação é
 * aplicado antes dos filtros visuais; as políticas RLS continuam sendo a
 * proteção definitiva no banco.
 */
export function useListaDiaRols(filtros: ListaDiaFiltros, enabled = true) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const exigeCliente = filtros.tipoRelatorio === "extrato" && !filtros.clienteId;

  return useQuery({
    queryKey: [
      "lista-dia-rols",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      filtros.tipoRelatorio,
      filtros.dataEntradaInicio,
      filtros.dataEntradaFim,
      filtros.previsaoInicio,
      filtros.previsaoFim,
      filtros.situacao,
      filtros.numeroRol,
      filtros.clienteId,
    ],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<ListaDiaConsulta> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar a lista do dia");
      }
      if (exigeCliente) {
        return { rols: [], totalEncontrado: 0, resultadoLimitado: false, exigeCliente: true };
      }

      let query = supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          status,
          status_logistica,
          status_pagamento,
          data_retirada,
          data_previsao_entrega,
          valor_total,
          valor_pago,
          cliente:clientes!ordens_servico_cliente_id_fkey!inner(
            id,
            razao_social,
            nome_fantasia,
            telefone,
            classificacao,
            tenant_id
          ),
          itens:itens_ordem_servico!itens_ordem_servico_ordem_servico_id_fkey(
            quantidade,
            quantidade_entregue
          )
        `, { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .neq("status", "cancelada")
        .limit(LISTA_DIA_PAGE_SIZE);

      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      if (activeArea !== "central") query = query.in("cliente.classificacao", clientClassificationValuesForArea(activeArea));

      if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);

      const numeroRol = normalizarNumeroRol(filtros.numeroRol);
      if (numeroRol) query = query.ilike("numero", `%${numeroRol}%`);

      if (filtros.tipoRelatorio === "entrega") {
        query = query.in("status_logistica", ["aguardando_entrega", "entrega_parcial", "tentativa_falha", "em_rota"]);
      }
      if (filtros.tipoRelatorio === "passadoria") query = query.eq("status", "passadoria");
      if (filtros.tipoRelatorio === "coleta") query = query.eq("status_logistica", "aguardando_coleta");

      // Os dois intervalos são independentes, como no relatório de referência:
      // o usuário pode consultar por entrada, por previsão ou combinar ambos.
      if (filtros.dataEntradaInicio) query = query.gte("data_retirada", filtros.dataEntradaInicio);
      if (filtros.dataEntradaFim) query = query.lte("data_retirada", filtros.dataEntradaFim);
      if (filtros.previsaoInicio) query = query.gte("data_previsao_entrega", filtros.previsaoInicio);
      if (filtros.previsaoFim) query = query.lte("data_previsao_entrega", filtros.previsaoFim);

      query = usaPeriodoDePrevisao(filtros.tipoRelatorio)
        ? query.order("data_previsao_entrega", { ascending: true })
        : query.order("data_retirada", { ascending: true });

      const { data, error, count } = await query.order("numero", { ascending: true });
      if (error) throw error;

      const rols = ((data ?? []) as unknown as ListaDiaRolOrigem[])
        .map(criarLinhaListaDia)
        .filter((rol) => correspondeSituacaoListaDia(rol, filtros.situacao));

      return {
        rols,
        totalEncontrado: count ?? data?.length ?? 0,
        resultadoLimitado: (count ?? 0) > (data?.length ?? 0),
        exigeCliente: false,
      };
    },
  });
}
