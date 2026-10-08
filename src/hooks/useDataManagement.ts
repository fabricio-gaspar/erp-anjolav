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
  destructiveEnabled: boolean;
  lastUpdated: Date;
}

const entityDefinitions = [
  { key: "clientes", name: "Clientes", table: "clientes", description: "Cadastro de clientes", category: "cadastros" as const },
  { key: "enderecos_clientes", name: "Endereços de Clientes", table: "enderecos_clientes", description: "Endereços vinculados aos clientes", category: "cadastros" as const },
  { key: "configuracoes_cliente", name: "Config. Cliente", table: "configuracoes_cliente", description: "Configurações por cliente", category: "cadastros" as const },
  { key: "configuracoes_pagamento_cliente", name: "Config. Pagamento Cliente", table: "configuracoes_pagamento_cliente", description: "Configurações de pagamento por cliente", category: "cadastros" as const },
  { key: "produtos", name: "Produtos e Serviços", table: "produtos", description: "Catálogo de produtos e serviços", category: "cadastros" as const },
  { key: "precos_especiais", name: "Preços Especiais", table: "precos_especiais", description: "Preços personalizados por cliente", category: "cadastros" as const },
  { key: "funcionarios", name: "Funcionários", table: "funcionarios", description: "Cadastro de funcionários", category: "cadastros" as const },
  { key: "motoristas", name: "Motoristas", table: "motoristas", description: "Cadastro de motoristas", category: "cadastros" as const },
  { key: "veiculos", name: "Veículos", table: "veiculos", description: "Cadastro de veículos", category: "cadastros" as const },
  { key: "fornecedores", name: "Fornecedores", table: "fornecedores", description: "Cadastro de fornecedores", category: "cadastros" as const },
  { key: "estoque_produtos", name: "Estoque", table: "estoque_produtos", description: "Itens em estoque", category: "cadastros" as const },
  { key: "contratos_aluguel", name: "Contratos de Aluguel", table: "contratos_aluguel", description: "Contratos de locação", category: "cadastros" as const },
  { key: "itens_contrato_aluguel", name: "Itens Contrato Aluguel", table: "itens_contrato_aluguel", description: "Itens dos contratos de aluguel", category: "cadastros" as const },
  { key: "modulo_permissoes", name: "Permissões de Módulos", table: "modulo_permissoes", description: "Permissões granulares por usuário", category: "cadastros" as const },
  { key: "ordens_servico", name: "Ordens de Serviço", table: "ordens_servico", description: "Ordens de serviço registradas", category: "operacional" as const },
  { key: "itens_ordem_servico", name: "Itens OS", table: "itens_ordem_servico", description: "Itens das ordens de serviço", category: "operacional" as const },
  { key: "lancamentos", name: "Lançamentos (ROLs)", table: "lancamentos", description: "Lançamentos de consumo", category: "operacional" as const },
  { key: "itens_lancamento", name: "Itens Lançamento", table: "itens_lancamento", description: "Itens dos lançamentos", category: "operacional" as const },
  { key: "lancamentos_cliente", name: "Lançamentos Cliente", table: "lancamentos_cliente", description: "Lançamentos via portal do cliente", category: "operacional" as const },
  { key: "itens_lancamento_cliente", name: "Itens Lançamento Cliente", table: "itens_lancamento_cliente", description: "Itens lançados pelo cliente", category: "operacional" as const },
  { key: "agendamentos", name: "Agendamentos", table: "agendamentos", description: "Agendamentos de coleta/entrega", category: "operacional" as const },
  { key: "eventos_agenda", name: "Eventos da Agenda", table: "eventos_agenda", description: "Eventos e lembretes", category: "operacional" as const },
  { key: "rotas_entrega", name: "Rotas de Entrega", table: "rotas_entrega", description: "Rotas planejadas", category: "operacional" as const },
  { key: "paradas_rota", name: "Paradas de Rota", table: "paradas_rota", description: "Paradas das rotas de entrega", category: "operacional" as const },
  { key: "movimentacoes_estoque", name: "Movimentações Estoque", table: "movimentacoes_estoque", description: "Entradas e saídas de estoque", category: "operacional" as const },
  { key: "orcamentos", name: "Orçamentos", table: "orcamentos", description: "Orçamentos formais", category: "operacional" as const },
  { key: "mensagens_log", name: "Log de Mensagens", table: "mensagens_log", description: "Histórico de mensagens enviadas", category: "operacional" as const },
  { key: "notificacoes_enviadas", name: "Notificações Enviadas", table: "notificacoes_enviadas", description: "Notificações automáticas", category: "operacional" as const },
  { key: "faturas", name: "Faturas", table: "faturas", description: "Faturas emitidas", category: "financeiro" as const },
  { key: "lancamentos_fatura", name: "Lançamentos × Fatura", table: "lancamentos_fatura", description: "Vínculo de ROLs com faturas", category: "financeiro" as const },
  { key: "contas_pagar", name: "Contas a Pagar", table: "contas_pagar", description: "Contas a pagar", category: "financeiro" as const },
  { key: "caixas", name: "Caixas", table: "caixas", description: "Caixas abertos/fechados", category: "financeiro" as const },
  { key: "caixa_movimentacoes", name: "Movimentações Caixa", table: "caixa_movimentacoes", description: "Movimentações financeiras do caixa", category: "financeiro" as const },
  { key: "asaas_charges", name: "Cobranças Asaas", table: "asaas_charges", description: "Cobranças via Asaas", category: "financeiro" as const },
  { key: "asaas_webhook_events", name: "Webhooks Asaas", table: "asaas_webhook_events", description: "Eventos recebidos do Asaas", category: "financeiro" as const },
  { key: "folha_pagamento", name: "Folha de Pagamento", table: "folha_pagamento", description: "Folhas de pagamento dos funcionários", category: "financeiro" as const },
  { key: "folha_beneficios", name: "Benefícios/Descontos", table: "folha_beneficios", description: "Benefícios e descontos extras", category: "financeiro" as const },
  { key: "historico_envios", name: "Histórico de Envios", table: "historico_envios", description: "Envios de faturas/NFs", category: "financeiro" as const },
  { key: "lotes_producao", name: "Lotes de Produção", table: "lotes_producao", description: "Lotes de processamento", category: "producao" as const },
  { key: "lotes_ordens", name: "Lotes × OS", table: "lotes_ordens", description: "Vínculo de OS aos lotes", category: "producao" as const },
  { key: "historico_producao", name: "Histórico Produção", table: "historico_producao", description: "Histórico de produção", category: "producao" as const },
] satisfies Array<Omit<EntityStats, "count">>;

const knownTables = new Set(entityDefinitions.map((entity) => entity.table));
const insertionOrder = [
  "clientes", "produtos", "funcionarios", "veiculos", "motoristas", "fornecedores",
  "estoque_produtos", "enderecos_clientes", "configuracoes_cliente",
  "configuracoes_pagamento_cliente", "precos_especiais", "modulo_permissoes",
  "contratos_aluguel", "itens_contrato_aluguel", "agendamentos", "eventos_agenda",
  "ordens_servico", "itens_ordem_servico", "lotes_producao", "lotes_ordens",
  "rotas_entrega", "paradas_rota", "lancamentos", "itens_lancamento",
  "lancamentos_cliente", "itens_lancamento_cliente", "orcamentos", "faturas",
  "lancamentos_fatura", "contas_pagar", "folha_pagamento", "folha_beneficios",
  "caixas", "caixa_movimentacoes", "asaas_charges", "asaas_webhook_events",
  "movimentacoes_estoque", "historico_producao", "historico_envios", "mensagens_log",
  "notificacoes_enviadas",
];

interface DataAdminEnvelope<T> {
  data?: T;
  error?: string;
}

async function dataAdminRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<DataAdminEnvelope<T>>(
    "data-administration",
    { body },
  );
  if (error || data?.data === undefined) {
    throw new Error(data?.error || "Não foi possível concluir a operação administrativa");
  }
  return data.data;
}

export function useDataManagement() {
  return useQuery({
    queryKey: ["data-management-stats"],
    queryFn: async (): Promise<DataOverview> => {
      const result = await dataAdminRequest<{
        counts: Record<string, number>;
        destructiveEnabled: boolean;
      }>({ operation: "stats" });
      const entities = entityDefinitions.map((definition) => ({
        ...definition,
        count: result.counts[definition.table] ?? 0,
      }));
      const categories = {
        cadastros: entities.filter((entity) => entity.category === "cadastros").reduce((sum, entity) => sum + entity.count, 0),
        operacional: entities.filter((entity) => entity.category === "operacional").reduce((sum, entity) => sum + entity.count, 0),
        financeiro: entities.filter((entity) => entity.category === "financeiro").reduce((sum, entity) => sum + entity.count, 0),
        producao: entities.filter((entity) => entity.category === "producao").reduce((sum, entity) => sum + entity.count, 0),
      };

      return {
        totalRecords: entities.reduce((sum, entity) => sum + entity.count, 0),
        categories,
        entities,
        destructiveEnabled: result.destructiveEnabled,
        lastUpdated: new Date(),
      };
    },
    refetchInterval: 30_000,
  });
}

export async function exportEntityData(table: string): Promise<Array<Record<string, unknown>>> {
  if (!knownTables.has(table)) throw new Error("Tabela não autorizada para exportação");

  const result: Array<Record<string, unknown>> = [];
  for (let offset = 0; ; offset += 500) {
    const page = await dataAdminRequest<Array<Record<string, unknown>>>({
      operation: "export-page",
      table,
      offset,
    });
    result.push(...page);
    if (page.length < 500) return result;
    if (result.length >= 100_000) {
      throw new Error("A exportação excede o limite da interface; utilize pg_dump");
    }
  }
}

export async function exportAllData(): Promise<Record<string, Array<Record<string, unknown>>>> {
  const result: Record<string, Array<Record<string, unknown>>> = {};
  for (const entity of entityDefinitions) result[entity.table] = await exportEntityData(entity.table);
  return result;
}

export async function deleteEntityData(table: string): Promise<number> {
  if (!knownTables.has(table)) throw new Error("Tabela não autorizada para exclusão");
  const result = await dataAdminRequest<{ deleted: number }>({
    operation: "delete-table",
    table,
    confirmation: `EXCLUIR:${table}`,
  });
  return result.deleted;
}

export async function deleteAllData(): Promise<{ deleted: number; errors: string[] }> {
  return dataAdminRequest({
    operation: "delete-all",
    confirmation: "ZERAR DADOS OPERACIONAIS",
  });
}

export async function importAllData(
  backupData: Record<string, unknown>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const table of insertionOrder) {
    const value = backupData[table];
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      errors.push(table);
      continue;
    }

    const records = value.filter(
      (record): record is Record<string, unknown> =>
        Boolean(record) && typeof record === "object" && !Array.isArray(record),
    );
    skipped += value.length - records.length;

    for (let offset = 0; offset < records.length; offset += 250) {
      const batch = records.slice(offset, offset + 250);
      try {
        const result = await dataAdminRequest<{ imported: number }>({
          operation: "import-page",
          table,
          records: batch,
        });
        imported += result.imported;
      } catch {
        skipped += batch.length;
        errors.push(table);
      }
    }
  }

  const unknownTables = Object.keys(backupData).filter((table) => !knownTables.has(table));
  errors.push(...unknownTables);
  return { imported, skipped, errors: [...new Set(errors)] };
}
