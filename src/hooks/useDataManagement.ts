import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EntityStats {
  key: string;
  name: string;
  table: string;
  description: string;
  count: number;
  category: "cadastros" | "operacional" | "financeiro" | "producao";
}

export interface DataOverview {
  totalRecords: number;
  categories: {
    cadastros: number;
    operacional: number;
    financeiro: number;
    producao: number;
  };
  entities: EntityStats[];
  lastUpdated: Date;
}

const entityDefinitions = [
  { key: "clientes", name: "Clientes", table: "clientes", description: "Cadastro de clientes", category: "cadastros" as const },
  { key: "produtos", name: "Produtos e Serviços", table: "produtos", description: "Catálogo de produtos e serviços", category: "cadastros" as const },
  { key: "funcionarios", name: "Funcionários", table: "funcionarios", description: "Cadastro de funcionários", category: "cadastros" as const },
  { key: "motoristas", name: "Motoristas", table: "motoristas", description: "Cadastro de motoristas", category: "cadastros" as const },
  { key: "veiculos", name: "Veículos", table: "veiculos", description: "Cadastro de veículos", category: "cadastros" as const },
  { key: "ordens_servico", name: "Ordens de Serviço", table: "ordens_servico", description: "Ordens de serviço registradas", category: "operacional" as const },
  { key: "lancamentos", name: "Lançamentos", table: "lancamentos", description: "Lançamentos de consumo", category: "operacional" as const },
  { key: "agendamentos", name: "Agendamentos", table: "agendamentos", description: "Agendamentos de coleta/entrega", category: "operacional" as const },
  { key: "faturas", name: "Faturas", table: "faturas", description: "Faturas emitidas", category: "financeiro" as const },
  { key: "contas_pagar", name: "Contas a Pagar", table: "contas_pagar", description: "Contas a pagar", category: "financeiro" as const },
  { key: "caixas", name: "Caixas", table: "caixas", description: "Caixas abertos/fechados", category: "financeiro" as const },
  { key: "caixa_movimentacoes", name: "Movimentações", table: "caixa_movimentacoes", description: "Movimentações financeiras", category: "financeiro" as const },
  { key: "asaas_charges", name: "Cobranças Asaas", table: "asaas_charges", description: "Cobranças via Asaas", category: "financeiro" as const },
  { key: "historico_producao", name: "Histórico Produção", table: "historico_producao", description: "Histórico de produção", category: "producao" as const },
  { key: "precos_especiais", name: "Preços Especiais", table: "precos_especiais", description: "Preços personalizados por cliente", category: "cadastros" as const },
  { key: "itens_lancamento", name: "Itens Lançamento", table: "itens_lancamento", description: "Itens dos lançamentos", category: "operacional" as const },
  { key: "itens_ordem_servico", name: "Itens OS", table: "itens_ordem_servico", description: "Itens das ordens de serviço", category: "operacional" as const },
];

async function fetchEntityCount(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table as any)
    .select("*", { count: "exact", head: true });
  
  if (error) {
    console.error(`Error fetching count for ${table}:`, error);
    return 0;
  }
  
  return count || 0;
}

export function useDataManagement() {
  return useQuery({
    queryKey: ["data-management-stats"],
    queryFn: async (): Promise<DataOverview> => {
      const entityPromises = entityDefinitions.map(async (def) => {
        const count = await fetchEntityCount(def.table);
        return {
          ...def,
          count,
        };
      });

      const entities = await Promise.all(entityPromises);
      
      const categories = {
        cadastros: entities.filter(e => e.category === "cadastros").reduce((sum, e) => sum + e.count, 0),
        operacional: entities.filter(e => e.category === "operacional").reduce((sum, e) => sum + e.count, 0),
        financeiro: entities.filter(e => e.category === "financeiro").reduce((sum, e) => sum + e.count, 0),
        producao: entities.filter(e => e.category === "producao").reduce((sum, e) => sum + e.count, 0),
      };

      const totalRecords = entities.reduce((sum, e) => sum + e.count, 0);

      return {
        totalRecords,
        categories,
        entities,
        lastUpdated: new Date(),
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export async function exportEntityData(table: string): Promise<any[]> {
  const { data, error } = await supabase
    .from(table as any)
    .select("*");
  
  if (error) {
    throw new Error(`Erro ao exportar dados: ${error.message}`);
  }
  
  return data || [];
}

export async function exportAllData(): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  
  for (const entity of entityDefinitions) {
    try {
      const data = await exportEntityData(entity.table);
      result[entity.table] = data;
    } catch (error) {
      console.error(`Error exporting ${entity.table}:`, error);
      result[entity.table] = [];
    }
  }
  
  return result;
}

export async function deleteEntityData(table: string): Promise<number> {
  const { error, count } = await supabase
    .from(table as any)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (workaround)
  
  if (error) {
    throw new Error(`Erro ao excluir dados: ${error.message}`);
  }
  
  return count || 0;
}

// Ordem de exclusão respeitando dependências de FK
const deletionOrder = [
  // Primeiro: tabelas dependentes (filhas)
  "historico_envios",
  "historico_producao",
  "itens_lancamento",
  "itens_ordem_servico",
  "itens_contrato_aluguel",
  "lancamentos_fatura",
  "asaas_webhook_events",
  "caixa_movimentacoes",
  "modulo_permissoes",
  "precos_especiais",
  "configuracoes_cliente",
  "configuracoes_pagamento_cliente",
  "enderecos_clientes",
  // Segundo: tabelas intermediárias
  "lancamentos",
  "faturas",
  "ordens_servico",
  "agendamentos",
  "contratos_aluguel",
  "contas_pagar",
  "caixas",
  "asaas_charges",
  // Terceiro: tabelas principais
  "motoristas",
  "veiculos",
  "funcionarios",
  "produtos",
  "clientes",
];

export async function deleteAllData(): Promise<{ deleted: number; errors: string[] }> {
  let totalDeleted = 0;
  const errors: string[] = [];

  for (const table of deletionOrder) {
    try {
      const { error } = await supabase
        .from(table as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        errors.push(`${table}: ${error.message}`);
      } else {
        totalDeleted++;
      }
    } catch (err) {
      errors.push(`${table}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    }
  }

  return { deleted: totalDeleted, errors };
}
