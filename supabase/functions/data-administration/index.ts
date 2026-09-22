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

type Operation = "stats" | "export-page" | "import-page" | "delete-table" | "delete-all";

interface DataAdminRequest {
  operation?: Operation;
  table?: string;
  offset?: number;
  records?: Array<Record<string, unknown>>;
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
          .select("id", { count: "exact", head: true });
        if (error) {
          console.error("Falha ao contar tabela", { table, errorCode: error.code });
          return jsonResponse(req, { error: "Não foi possível calcular os indicadores" }, 500);
        }
        counts[table] = count ?? 0;
      }
      return jsonResponse(req, {
        data: { counts, destructiveEnabled: destructiveOperationsEnabled() },
      });
    }

    if (body.operation === "export-page") {
      if (!validTable(body.table)) return jsonResponse(req, { error: "Tabela inválida" }, 400);
      const offset = Number.isInteger(body.offset) && Number(body.offset) >= 0
        ? Number(body.offset)
        : 0;
      const { data, error } = await supabase
        .from(body.table)
        .select("*")
        .range(offset, offset + 499)
        .order("id", { ascending: true });
      if (error) throw error;
      return jsonResponse(req, { data: data ?? [] });
    }

    if (!destructiveOperationsEnabled()) {
      return jsonResponse(
        req,
        { error: "Operações destrutivas estão desabilitadas neste ambiente" },
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

      const { error } = await supabase
        .from(body.table)
        .upsert(body.records, { onConflict: "id", ignoreDuplicates: false });
      if (error) throw error;
      return jsonResponse(req, { data: { imported: body.records.length } });
    }

    if (body.operation === "delete-table") {
      if (!validTable(body.table) || PROTECTED_FROM_DELETION.has(body.table)) {
        return jsonResponse(req, { error: "Esta tabela não pode ser apagada por esta interface" }, 400);
      }
      if (body.confirmation !== `EXCLUIR:${body.table}`) {
        return jsonResponse(req, { error: "Confirmação inválida" }, 400);
      }

      const { count, error } = await supabase
        .from(body.table)
        .delete({ count: "exact" })
        .not("id", "is", null);
      if (error) throw error;
      return jsonResponse(req, { data: { deleted: count ?? 0 } });
    }

    if (body.operation === "delete-all") {
      if (body.confirmation !== "ZERAR DADOS OPERACIONAIS") {
        return jsonResponse(req, { error: "Confirmação inválida" }, 400);
      }

      let deletedTables = 0;
      const errors: string[] = [];
      for (const table of DELETION_ORDER) {
        const { error } = await supabase.from(table).delete().not("id", "is", null);
        if (error) {
          console.error("Falha ao limpar tabela", { table, errorCode: error.code });
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
