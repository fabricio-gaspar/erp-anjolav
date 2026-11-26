import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin } from "../_shared/auth.ts";
import {
  handlePreflight,
  jsonResponse,
  readJsonBody,
  requireJsonPost,
} from "../_shared/http.ts";

const TABLES = [
  "clientes",
  "enderecos_clientes",
  "configuracoes_cliente",
  "configuracoes_pagamento_cliente",
  "produtos",
  "precos_especiais",
  "funcionarios",
  "motoristas",
  "veiculos",
  "fornecedores",
  "estoque_produtos",
  "contratos_aluguel",
  "itens_contrato_aluguel",
  "modulo_permissoes",
  "ordens_servico",
  "itens_ordem_servico",
  "lancamentos",
  "itens_lancamento",
  "lancamentos_cliente",
  "itens_lancamento_cliente",
  "agendamentos",
  "eventos_agenda",
  "rotas_entrega",
  "paradas_rota",
  "movimentacoes_estoque",
  "orcamentos",
  "mensagens_log",
  "notificacoes_enviadas",
  "faturas",
  "lancamentos_fatura",
  "contas_pagar",
  "caixas",
  "caixa_movimentacoes",
  "asaas_charges",
  "asaas_webhook_events",
  "folha_pagamento",
  "folha_beneficios",
  "historico_envios",
  "lotes_producao",
  "lotes_ordens",
  "historico_producao",
] as const;

const TABLE_SET = new Set<string>(TABLES);
const EXPORT_PAGE_SIZE = 500;
const EXPORT_MAX_ROWS_PER_TABLE = 100_000;
const PROTECTED_FROM_DELETION = new Set(["funcionarios", "modulo_permissoes"]);
const DELETION_ORDER = [
  "notificacoes_enviadas",
  "mensagens_log",
  "historico_envios",
  "historico_producao",
  "lotes_ordens",
  "paradas_rota",
  "itens_lancamento",
  "itens_lancamento_cliente",
  "itens_ordem_servico",
  "itens_contrato_aluguel",
  "lancamentos_fatura",
  "asaas_webhook_events",
  "caixa_movimentacoes",
  "movimentacoes_estoque",
  "folha_beneficios",
  "precos_especiais",
  "configuracoes_cliente",
  "configuracoes_pagamento_cliente",
  "enderecos_clientes",
  "lancamentos",
  "lancamentos_cliente",
  "orcamentos",
  "faturas",
  "ordens_servico",
  "rotas_entrega",
  "lotes_producao",
  "agendamentos",
  "eventos_agenda",
  "contratos_aluguel",
  "contas_pagar",
  "folha_pagamento",
  "caixas",
  "asaas_charges",
  "estoque_produtos",
  "motoristas",
  "veiculos",
  "fornecedores",
  "produtos",
  "clientes",
] as const;

// Limpeza explícita do tenant atual para bases de teste. Configurações,
// equipe, permissões, unidades e auditoria ficam preservadas para não bloquear
// o acesso nem desmontar a operação administrativa.
const TEST_DATA_DELETION_ORDER = Array.from(new Set([
  "mensagens_log_eventos",
  "pdv_cash_operation_requests",
  "pdv_pagamentos",
  "pdv_credit_ledger",
  "fidelidade_lancamentos",
  "ordem_anexos",
  "nfse_documentos",
  "cliente_operacoes",
  "estoque_saldos",
  "pdv_capacidades_diarias",
  "produto_operacoes",
  ...DELETION_ORDER,
  "pdv_credit_accounts",
  "fidelidade_configuracoes",
])) as string[];

const DELETE_DEPENDENCIES: Record<string, string[]> = {
  ordens_servico: [
    "mensagens_log_eventos",
    "notificacoes_enviadas",
    "mensagens_log",
    "historico_producao",
    "qualidade_movimentos",
    "lotes_ordens",
    "paradas_rota",
    "ordem_anexos",
    "itens_lancamento",
    "itens_lancamento_cliente",
    "itens_ordem_servico",
    "lancamentos_fatura",
    "pdv_credit_ledger",
    "pdv_pagamentos",
    "caixa_movimentacoes",
    "fidelidade_lancamentos",
    "lancamentos",
    "lancamentos_cliente",
  ],
};

function expandDeletionTables(requested: string[]): string[] {
  const expanded = new Set(requested);
  const visit = (table: string) => {
    for (const dependency of DELETE_DEPENDENCIES[table] ?? []) {
      if (expanded.has(dependency)) continue;
      expanded.add(dependency);
      visit(dependency);
    }
  };
  requested.forEach(visit);
  return TEST_DATA_DELETION_ORDER.filter((table) => expanded.has(table));
}

type Operation = "stats" | "export-manifest" | "export-page" | "import-page" | "delete-table" | "delete-tables" | "delete-test-data" | "delete-all";

interface DataAdminRequest {
  operation?: Operation;
  table?: string;
  offset?: number;
  records?: Array<Record<string, unknown>>;
  tables?: string[];
  confirmation?: string;
}

function destructiveOperationsEnabled(): boolean {
  return Deno.env.get("ENABLE_DESTRUCTIVE_DATA_ADMIN") === "true";
}

function validTable(value: unknown): value is string {
  return typeof value === "string" && TABLE_SET.has(value);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authorization = await requireAdmin(req, supabase);
  if (!authorization.ok) return authorization.response;

  const parsedBody = await readJsonBody(req, 2_000_000);
  if (!parsedBody.ok) return parsedBody.response;
  if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return jsonResponse(req, { error: "JSON inválido" }, 400);
  }
  const body = parsedBody.value as DataAdminRequest;

  try {
    if (body.operation === "stats") {
      const counts: Record<string, number> = {};
      for (const table of TABLES) {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", authorization.tenantId);
        if (error) {
          console.error("Falha ao contar tabela", { table, errorCode: error.code });
          return jsonResponse(req, { error: "Não foi possível calcular os indicadores" }, 500);
        }
        counts[table] = count ?? 0;
      }
      return jsonResponse(req, {
        data: {
          counts,
          destructiveEnabled: destructiveOperationsEnabled(),
          // requireAdmin já confirmou tenant ativo, funcionário ativo e perfil
          // owner/admin. A confirmação textual continua obrigatória na interface.
          canDeleteTestData: true,
        },
      });
    }

    if (body.operation === "export-manifest") {
      return jsonResponse(req, {
        data: {
          formatVersion: 1,
          scope: "tenant-operational-partial",
          tables: TABLES,
          pageSize: EXPORT_PAGE_SIZE,
          maxRowsPerTable: EXPORT_MAX_ROWS_PER_TABLE,
          exclusions: [
            "Outras tabelas public fora desta lista, incluindo compras, PDV e configurações",
            "auth, Storage (metadados e objetos) e outros schemas",
          ],
          consistency: "Leituras sequenciais; não há snapshot transacional entre tabelas",
        },
      });
    }

    if (body.operation === "export-page") {
      if (!validTable(body.table)) return jsonResponse(req, { error: "Tabela inválida" }, 400);
      const offset = body.offset ?? 0;
      if (!Number.isInteger(offset) || offset < 0 || offset > EXPORT_MAX_ROWS_PER_TABLE || offset % EXPORT_PAGE_SIZE !== 0) {
        return jsonResponse(req, { error: "Página de exportação inválida" }, 400);
      }
      const { data, count, error } = await supabase
        .from(body.table)
        .select("*", { count: "exact" })
        .eq("tenant_id", authorization.tenantId)
        .range(offset, offset + EXPORT_PAGE_SIZE - 1)
        .order("id", { ascending: true });
      if (error) throw error;
      if (count === null) throw new Error("Contagem indisponível");
      return jsonResponse(req, { data: { rows: data ?? [], count } });
    }

    const deletionOperation = body.operation === "delete-table" || body.operation === "delete-tables" || body.operation === "delete-test-data";
    if (!destructiveOperationsEnabled() && !deletionOperation) {
      return jsonResponse(
        req,
        { error: "Importação e limpeza total estão desabilitadas neste ambiente" },
        403,
      );
    }

    if (body.operation === "import-page") {
      if (!validTable(body.table)) return jsonResponse(req, { error: "Tabela inválida" }, 400);
      if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 250) {
        return jsonResponse(req, { error: "Lote de importação inválido" }, 400);
      }
      if (body.records.some((record) => !record || Array.isArray(record) || typeof record !== "object")) {
        return jsonResponse(req, { error: "Registros de importação inválidos" }, 400);
      }

      if (body.records.some((record) =>
        typeof record.tenant_id === "string" && record.tenant_id !== authorization.tenantId
      )) {
        return jsonResponse(req, { error: "O lote contém dados de outra empresa" }, 403);
      }
      const tenantRecords: Array<Record<string, unknown> & { tenant_id: string }> = body.records.map((record) => ({
        ...record,
        tenant_id: authorization.tenantId,
      }));
      const importedIds = tenantRecords
        .map((record) => record.id)
        .filter((id): id is string => typeof id === "string");
      if (importedIds.length > 0) {
        const { data: existingRecords, error: existingError } = await supabase
          .from(body.table)
          .select("id, tenant_id")
          .in("id", importedIds);
        if (existingError) throw existingError;
        if ((existingRecords ?? []).some((record) => record.tenant_id !== authorization.tenantId)) {
          return jsonResponse(req, { error: "Um identificador do lote pertence a outra empresa" }, 403);
        }
      }
      const { error } = await supabase
        .from(body.table)
        .upsert(tenantRecords, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw error;
      return jsonResponse(req, { data: { imported: body.records.length } });
    }

    if (body.operation === "delete-table") {
      body.tables = body.table ? [body.table] : [];
    }

    if (body.operation === "delete-table" || body.operation === "delete-tables") {
      const requestedTables = Array.isArray(body.tables) ? [...new Set(body.tables)] : [];
      if (
        requestedTables.length === 0 ||
        requestedTables.length > 50 ||
        requestedTables.some((table) => !validTable(table) || PROTECTED_FROM_DELETION.has(table))
      ) {
        return jsonResponse(req, { error: "Uma ou mais entidades não podem ser apagadas por esta interface" }, 400);
      }
      const expectedConfirmation = body.operation === "delete-table"
        ? `EXCLUIR:${requestedTables[0]}`
        : "EXCLUIR SELECIONADOS";
      if (body.confirmation !== expectedConfirmation) {
        return jsonResponse(req, { error: "Confirmação inválida" }, 400);
      }

      let deletedTables = 0;
      const errors: string[] = [];
      const deletionTables = expandDeletionTables(requestedTables);
      for (const table of deletionTables) {
        const { error } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq("tenant_id", authorization.tenantId)
          .not("id", "is", null);
        if (error) {
          console.error("Falha ao apagar entidade", { table, errorCode: error.code });
          errors.push(table);
        } else {
          deletedTables += 1;
        }
      }
      return jsonResponse(req, {
        data: { deleted: deletedTables, errors, requested: requestedTables, expanded: deletionTables },
      });
    }

    if (body.operation === "delete-all") {
      if (body.confirmation !== "ZERAR DADOS OPERACIONAIS") {
        return jsonResponse(req, { error: "Confirmação inválida" }, 400);
      }

      let deletedTables = 0;
      const errors: string[] = [];
      for (const table of DELETION_ORDER) {
        const { error } = await supabase.from(table).delete()
          .eq("tenant_id", authorization.tenantId).not("id", "is", null);
        if (error) {
          console.error("Falha ao limpar tabela", { table, errorCode: error.code });
          errors.push(table);
        } else {
          deletedTables += 1;
        }
      }
      return jsonResponse(req, { data: { deleted: deletedTables, errors } });
    }

    if (body.operation === "delete-test-data") {
      if (body.confirmation !== "ZERAR DADOS DE TESTE") {
        return jsonResponse(req, { error: "Confirmação inválida" }, 400);
      }

      let deletedTables = 0;
      const errors: string[] = [];
      for (const table of TEST_DATA_DELETION_ORDER) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("tenant_id", authorization.tenantId)
          .not("id", "is", null);
        if (error) {
          console.error("Falha ao limpar dados de teste", { table, errorCode: error.code });
          errors.push(table);
        } else {
          deletedTables += 1;
        }
      }
      return jsonResponse(req, { data: { deleted: deletedTables, errors } });
    }

    return jsonResponse(req, { error: "Operação inválida" }, 400);
  } catch (error) {
    const errorCode =
      typeof error === "object" && error && "code" in error ? String(error.code) : "unexpected";
    console.error("Falha na administração de dados", {
      operation: body.operation,
      table: body.table,
      errorCode,
    });
    return jsonResponse(req, { error: "Não foi possível concluir a operação" }, 500);
  }
});
