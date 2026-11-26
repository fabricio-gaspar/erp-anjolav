import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin, requireModule } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";
import { buildNfseBridgeUrl, readNfseBridgeConfig } from "../_shared/nfse-config.ts";

type NfseAction = "health" | "prepare" | "issue" | "query" | "cancel";
type JsonRecord = Record<string, unknown>;
type FiscalSupabaseClient = SupabaseClient<any, "public", "public", any, any>;

interface FiscalContext {
  document: JsonRecord;
  invoice: JsonRecord;
  emitter: JsonRecord;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_BUCKET = "fiscal-documentos";

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNamedKey(jsonName: string): string | null {
  const raw = Deno.env.get(jsonName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return stringValue(parsed.default);
  } catch {
    return null;
  }
}

function publishableKey(): string | null {
  return Deno.env.get("SUPABASE_ANON_KEY")?.trim()
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim()
    || readNamedKey("SUPABASE_PUBLISHABLE_KEYS");
}

function secretKey(): string | null {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()
    || Deno.env.get("SUPABASE_SECRET_KEY")?.trim()
    || readNamedKey("SUPABASE_SECRET_KEYS");
}

function onlyDigits(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function validatesCpf(value: string): boolean {
  if (value.length !== 11 || hasRepeatedDigits(value)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(value[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function validatesCnpj(value: string): boolean {
  if (value.length !== 14 || hasRepeatedDigits(value)) return false;
  const calculate = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(value[12]) && calculate(13) === Number(value[13]);
}

function validDocument(value: unknown): boolean {
  const digits = onlyDigits(value);
  return digits.length === 11 ? validatesCpf(digits) : validatesCnpj(digits);
}

function emitterReadiness(emitter: JsonRecord, bridgeIssues: string[], productionEnabled: boolean) {
  const issues = [...bridgeIssues];
  const environment = stringValue(emitter.ambiente) || "homologacao";
  const mode = stringValue(emitter.modo_emissao) || "simulacao";
  const credentialStatus = stringValue(emitter.credencial_status) || "nao_configurada";

  if (!validatesCnpj(onlyDigits(emitter.cnpj))) issues.push("CNPJ do emitente é inválido.");
  if (!stringValue(emitter.credencial_ref)) issues.push("Credencial segura do emitente não vinculada.");
  if (mode === "simulacao") issues.push("Modo de emissão ainda está em simulação.");
  if (environment === "homologacao" && !["configurada", "homologada"].includes(credentialStatus)) {
    issues.push("Credencial do emitente ainda não está configurada para homologação.");
  }
  if (environment === "producao" && credentialStatus !== "homologada") {
    issues.push("Credencial do emitente ainda não foi homologada para produção.");
  }
  if (environment === "producao" && mode !== "producao") {
    issues.push("Emitente de produção precisa estar no modo Produção.");
  }
  if (environment === "producao" && !productionEnabled) {
    issues.push("Emissão fiscal de produção está bloqueada no backend.");
  }

  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
    environment,
    mode,
    credentialStatus,
  };
}

async function prepareDocument(
  userClient: FiscalSupabaseClient,
  body: JsonRecord,
): Promise<JsonRecord> {
  const invoiceId = stringValue(body.faturaId);
  const emitterId = stringValue(body.configuracaoFiscalId);
  if (!invoiceId || !UUID_PATTERN.test(invoiceId)) throw new Error("Fatura inválida");
  if (emitterId && !UUID_PATTERN.test(emitterId)) throw new Error("CNPJ emissor inválido");
  const description = stringValue(body.descricaoServico);
  if (description && description.length > 2000) throw new Error("Descrição do serviço muito longa");
  const nature = stringValue(body.naturezaOperacao) || "tributacao_municipio";

  const { data, error } = await userClient.rpc("preparar_documento_nfse", {
    _fatura_id: invoiceId,
    _configuracao_fiscal_id: emitterId,
    _descricao_servico: description,
    _natureza_operacao: nature,
  });
  if (error) throw new Error(error.message || "Não foi possível preparar a NFS-e");
  const result = asRecord(data);
  if (!result) throw new Error("Preparação fiscal sem confirmação do servidor");
  return result;
}

async function requireInvoiceArea(
  req: Request,
  adminClient: FiscalSupabaseClient,
  tenantId: string,
  userId: string,
  invoiceId: string,
): Promise<Response | null> {
  const { data: invoice, error: invoiceError } = await adminClient.from("faturas")
    .select("operation_type")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceError) return jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500);
  const area = invoice?.operation_type === "domestico" ? "residencial"
    : invoice?.operation_type === "industrial" ? "industrial" : null;
  if (!area) return jsonResponse(req, { error: "Fatura fiscal indisponível" }, 403);

  const { data: adminMembership, error: roleError } = await adminClient.from("tenant_memberships")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("enabled", true)
    .eq("is_active", true)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (roleError) return jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500);
  if (adminMembership) return null;

  const { data: areaPermission, error: areaError } = await adminClient.from("area_permissoes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .in("area", ["central", area])
    .limit(1)
    .maybeSingle();
  if (areaError) return jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500);
  return areaPermission ? null : jsonResponse(req, { error: "Acesso negado" }, 403);
}

async function loadContext(
  adminClient: FiscalSupabaseClient,
  tenantId: string,
  invoiceId: string,
): Promise<FiscalContext> {
  const { data: invoice, error: invoiceError } = await adminClient
    .from("faturas")
    .select("id, tenant_id, cliente_id, periodo_inicio, periodo_fim, valor_total, status, nfse_status, configuracao_fiscal_id, operation_type, unidade_id, itens_snapshot, snapshot_cliente, snapshot_emitente, descricao_servico, natureza_operacao")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .single();
  if (invoiceError || !invoice) throw new Error("Fatura fiscal não encontrada");

  const { data: document, error: documentError } = await adminClient
    .from("nfse_documentos")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("fatura_id", invoiceId)
    .single();
  if (documentError || !document) throw new Error("Documento fiscal não preparado");

  const { data: emitter, error: emitterError } = await adminClient
    .from("configuracoes_fiscais")
    .select("id, tenant_id, nome, cnpj, razao_social, inscricao_municipal, endereco, aliquota_iss, codigo_servico, codigo_municipio_ibge, regime_tributario, ambiente, modo_emissao, ativo, provedor_nfse, operation_type, credencial_status, credencial_ref")
    .eq("tenant_id", tenantId)
    .eq("id", document.configuracao_fiscal_id)
    .single();
  if (emitterError || !emitter || !emitter.ativo) throw new Error("CNPJ emissor indisponível");

  return { document, invoice, emitter };
}

async function updateWaitingStatus(
  adminClient: FiscalSupabaseClient,
  context: FiscalContext,
  ready: boolean,
  issues: string[],
) {
  if (["autorizada", "cancelada", "processando"].includes(String(context.document.status))) return;
  const status = ready ? "validada" : "aguardando_configuracao";
  await Promise.all([
    adminClient.from("nfse_documentos").update({ status, erros: ready ? [] : issues })
      .eq("id", context.document.id).eq("tenant_id", context.document.tenant_id),
    adminClient.from("faturas").update({ nfse_status: status, status_sefaz: status, erros_sefaz: ready ? [] : issues })
      .eq("id", context.invoice.id).eq("tenant_id", context.invoice.tenant_id),
  ]);
  context.document.status = status;
  context.document.erros = ready ? [] : issues;
  context.invoice.nfse_status = status;
}

function publicDocument(context: FiscalContext) {
  return {
    id: context.document.id,
    faturaId: context.document.fatura_id,
    status: context.document.status,
    ambiente: context.document.ambiente,
    numero: context.document.numero,
    chaveAcesso: context.document.chave_acesso,
    protocolo: context.document.protocolo,
    tentativas: context.document.tentativas,
    autorizadoEm: context.document.autorizado_em,
    canceladoEm: context.document.cancelado_em,
    erros: Array.isArray(context.document.erros) ? context.document.erros : [],
    emitente: {
      id: context.emitter.id,
      nome: context.emitter.nome,
      razaoSocial: context.emitter.razao_social,
      cnpjFinal: onlyDigits(context.emitter.cnpj).slice(-4),
      ambiente: context.emitter.ambiente,
      operationType: context.emitter.operation_type,
      credencialStatus: context.emitter.credencial_status,
    },
  };
}

async function createSignedDocumentUrls(
  adminClient: FiscalSupabaseClient,
  context: FiscalContext,
) {
  const result: { xmlUrl?: string; danfseUrl?: string } = {};
  const xmlPath = stringValue(context.document.xml_storage_path);
  const pdfPath = stringValue(context.document.danfse_storage_path);
  if (xmlPath) {
    const { data } = await adminClient.storage.from(STORAGE_BUCKET).createSignedUrl(xmlPath, 900, {
      download: `nfse-${context.document.numero || context.document.id}.xml`,
    });
    if (data?.signedUrl) result.xmlUrl = data.signedUrl;
  }
  if (pdfPath) {
    const { data } = await adminClient.storage.from(STORAGE_BUCKET).createSignedUrl(pdfPath, 900, {
      download: `danfse-${context.document.numero || context.document.id}.pdf`,
    });
    if (data?.signedUrl) result.danfseUrl = data.signedUrl;
  }
  return result;
}

async function readBridgeResponse(response: Response): Promise<JsonRecord> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 15_000_000) {
    throw new Error("Resposta fiscal excedeu o limite permitido");
  }
  const text = await response.text();
  if (text.length > 15_000_000) throw new Error("Resposta fiscal excedeu o limite permitido");
  try {
    return asRecord(JSON.parse(text)) || {};
  } catch {
    throw new Error("Bridge fiscal retornou uma resposta inválida");
  }
}

async function callBridge(
  url: URL,
  token: string,
  payload: JsonRecord,
): Promise<{ response: Response; data: JsonRecord }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": String(payload.idempotencyKey || ""),
        "X-Request-Id": crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return { response, data: await readBridgeResponse(response) };
  } finally {
    clearTimeout(timeout);
  }
}

function base64Bytes(value: unknown, maxBytes: number): Uint8Array | null {
  const input = stringValue(value)?.replace(/^data:[^;]+;base64,/, "");
  if (!input) return null;
  if (input.length > Math.ceil(maxBytes * 4 / 3) + 16) throw new Error("Documento fiscal excedeu o limite permitido");
  try {
    const binary = atob(input);
    if (binary.length > maxBytes) throw new Error("Documento fiscal excedeu o limite permitido");
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (error) {
    if (error instanceof Error && error.message.includes("limite")) throw error;
    throw new Error("Documento fiscal em formato inválido");
  }
}

async function storeAuthorizedFiles(
  adminClient: FiscalSupabaseClient,
  context: FiscalContext,
  bridgeData: JsonRecord,
) {
  const year = new Date().getUTCFullYear();
  const basePath = `${context.invoice.tenant_id}/${context.emitter.id}/${year}/${context.invoice.id}`;
  let xmlPath: string | null = null;
  let pdfPath: string | null = null;
  const xmlBytes = base64Bytes(bridgeData.xmlBase64, 5_000_000)
    || (stringValue(bridgeData.xml) ? new TextEncoder().encode(String(bridgeData.xml)) : null);
  const pdfBytes = base64Bytes(bridgeData.danfsePdfBase64, 10_000_000);

  if (xmlBytes) {
    xmlPath = `${basePath}.xml`;
    const { error } = await adminClient.storage.from(STORAGE_BUCKET).upload(xmlPath, xmlBytes, {
      contentType: "application/xml", upsert: true,
    });
    if (error) throw new Error("Não foi possível arquivar o XML autorizado");
  }
  if (pdfBytes) {
    pdfPath = `${basePath}.pdf`;
    const { error } = await adminClient.storage.from(STORAGE_BUCKET).upload(pdfPath, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (error) throw new Error("Não foi possível arquivar o DANFSe autorizado");
  }
  return { xmlPath, pdfPath };
}

function fiscalPayload(context: FiscalContext): JsonRecord {
  return {
    idempotencyKey: context.document.idempotency_key,
    environment: context.document.ambiente,
    credentialRef: context.emitter.credencial_ref,
    provider: "nfse-nacional",
    invoice: {
      id: context.invoice.id,
      periodStart: context.invoice.periodo_inicio,
      periodEnd: context.invoice.periodo_fim,
      total: context.invoice.valor_total,
      operationType: context.invoice.operation_type,
      serviceDescription: context.invoice.descricao_servico,
      operationNature: context.invoice.natureza_operacao,
      issuer: context.invoice.snapshot_emitente,
      customer: context.invoice.snapshot_cliente,
      items: context.invoice.itens_snapshot,
    },
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const adminKey = secretKey();
  const publicKey = publishableKey();
  if (!supabaseUrl || !adminKey || !publicKey) {
    return jsonResponse(req, { error: "Serviço fiscal indisponível", code: "NFSE_SERVICE_UNAVAILABLE" }, 503);
  }
  const adminClient = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const parsed = await readJsonBody(req, 65_536);
  if (!parsed.ok) return parsed.response;
  const body = asRecord(parsed.value);
  const action = stringValue(body?.action) as NfseAction | null;
  if (!body || !action || !["health", "prepare", "issue", "query", "cancel"].includes(action)) {
    return jsonResponse(req, { error: "Ação fiscal inválida", code: "NFSE_INVALID_ACTION" }, 400);
  }

  const authorization = action === "cancel"
    ? await requireAdmin(req, adminClient)
    : await requireModule(req, adminClient, "faturamento");
  if (!authorization.ok) return authorization.response;

  const authorizationHeader = req.headers.get("authorization") || "";
  const userClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorizationHeader } },
  });
  const bridge = readNfseBridgeConfig((name) => Deno.env.get(name));

  try {
    if (action === "health") {
      const emitterId = stringValue(body.configuracaoFiscalId);
      let query = adminClient.from("configuracoes_fiscais")
        .select("id, nome, cnpj, ambiente, modo_emissao, ativo, operation_type, credencial_status, credencial_ref")
        .eq("tenant_id", authorization.tenantId)
        .eq("ativo", true)
        .order("nome");
      if (emitterId) query = query.eq("id", emitterId);
      const { data, error } = await query;
      if (error) throw new Error("Não foi possível consultar os emitentes fiscais");
      const emitters = (data || []).map((emitter) => {
        const readiness = emitterReadiness(emitter, bridge.issues, bridge.productionEnabled);
        return {
          id: emitter.id,
          nome: emitter.nome,
          cnpjFinal: onlyDigits(emitter.cnpj).slice(-4),
          ambiente: readiness.environment,
          operationType: emitter.operation_type,
          credencialStatus: readiness.credentialStatus,
          ready: readiness.ready,
          issues: readiness.issues,
        };
      });
      return jsonResponse(req, {
        success: true,
        enabled: bridge.enabled,
        ready: emitters.length > 0 && emitters.every((emitter) => emitter.ready),
        productionEnabled: bridge.productionEnabled,
        emitters,
      });
    }

    const invoiceId = stringValue(body.faturaId);
    if (!invoiceId || !UUID_PATTERN.test(invoiceId)) {
      return jsonResponse(req, { error: "Fatura inválida", code: "NFSE_INVALID_INVOICE" }, 400);
    }
    const denied = await requireInvoiceArea(
      req, adminClient, authorization.tenantId, authorization.user.id, invoiceId,
    );
    if (denied) return denied;

    if (action === "query") {
      const { data: visibleDocument, error: visibilityError } = await userClient
        .from("nfse_documentos")
        .select("id")
        .eq("tenant_id", authorization.tenantId)
        .eq("fatura_id", invoiceId)
        .maybeSingle();
      if (visibilityError) return jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500);
      if (!visibleDocument) return jsonResponse(req, { error: "Acesso negado" }, 403);
      const context = await loadContext(adminClient, authorization.tenantId, invoiceId);
      const readiness = emitterReadiness(context.emitter, bridge.issues, bridge.productionEnabled);
      const urls = await createSignedDocumentUrls(adminClient, context);
      return jsonResponse(req, { success: true, document: publicDocument(context), readiness, ...urls });
    }

    if (action === "cancel") {
      if (body.confirmation !== "CANCELAR_NFSE") {
        return jsonResponse(req, { error: "Confirmação de cancelamento inválida", code: "NFSE_CONFIRMATION_REQUIRED" }, 400);
      }
      const reason = stringValue(body.motivo);
      if (!reason || reason.length < 15 || reason.length > 500) {
        return jsonResponse(req, { error: "Informe uma justificativa entre 15 e 500 caracteres", code: "NFSE_INVALID_REASON" }, 400);
      }
      const context = await loadContext(adminClient, authorization.tenantId, invoiceId);
      if (context.document.status !== "autorizada") {
        return jsonResponse(req, { error: "Somente NFS-e autorizada pode ser cancelada", code: "NFSE_NOT_AUTHORIZED" }, 409);
      }
      const readiness = emitterReadiness(context.emitter, bridge.issues, bridge.productionEnabled);
      if (!readiness.ready || !bridge.token) {
        return jsonResponse(req, { error: "Integração fiscal indisponível", code: "NFSE_NOT_READY", issues: readiness.issues }, 503);
      }
      const { response, data } = await callBridge(
        buildNfseBridgeUrl(bridge, "v1/nfse/cancelar"), bridge.token,
        {
          idempotencyKey: `${context.document.idempotency_key}:cancel`,
          environment: context.document.ambiente,
          credentialRef: context.emitter.credencial_ref,
          accessKey: context.document.chave_acesso,
          reason,
        },
      );
      if (!response.ok || data.status !== "cancelada") {
        return jsonResponse(req, {
          error: stringValue(data.message) || "O cancelamento não foi confirmado pelo sistema fiscal",
          code: "NFSE_CANCEL_REJECTED",
        }, response.status >= 400 && response.status < 500 ? 422 : 503);
      }
      const { data: result, error } = await adminClient.rpc("registrar_nfse_cancelada", {
        _tenant_id: authorization.tenantId,
        _fatura_id: invoiceId,
        _motivo: reason,
        _protocolo: stringValue(data.protocolo),
      });
      if (error) throw new Error("Cancelamento confirmado, mas não foi possível atualizar o ERP");
      return jsonResponse(req, { success: true, document: result });
    }

    await prepareDocument(userClient, body);
    const context = await loadContext(adminClient, authorization.tenantId, invoiceId);
    const readiness = emitterReadiness(context.emitter, bridge.issues, bridge.productionEnabled);
    await updateWaitingStatus(adminClient, context, readiness.ready, readiness.issues);

    if (action === "prepare") {
      return jsonResponse(req, {
        success: true,
        document: publicDocument(context),
        readiness,
      });
    }

    if (body.confirmation !== "EMITIR_NFSE") {
      return jsonResponse(req, { error: "Confirmação de emissão inválida", code: "NFSE_CONFIRMATION_REQUIRED" }, 400);
    }
    if (context.document.status === "autorizada") {
      const urls = await createSignedDocumentUrls(adminClient, context);
      return jsonResponse(req, { success: true, idempotent: true, document: publicDocument(context), ...urls });
    }
    if (!readiness.ready || !bridge.token) {
      return jsonResponse(req, {
        error: "Emissão bloqueada até concluir a configuração do CNPJ emissor",
        code: "NFSE_NOT_READY",
        issues: readiness.issues,
        document: publicDocument(context),
      }, 409);
    }

    const nextAttempt = Number(context.document.tentativas || 0) + 1;
    const { data: locked, error: lockError } = await adminClient
      .from("nfse_documentos")
      .update({ status: "processando", tentativas: nextAttempt, solicitado_em: new Date().toISOString(), erros: [] })
      .eq("id", context.document.id)
      .eq("tenant_id", authorization.tenantId)
      .in("status", ["validada", "aguardando_configuracao", "rejeitada", "erro_temporario"])
      .select("id")
      .maybeSingle();
    if (lockError) throw new Error("Não foi possível iniciar a emissão fiscal");
    if (!locked) {
      return jsonResponse(req, { error: "A emissão desta fatura já está em processamento", code: "NFSE_ALREADY_PROCESSING" }, 409);
    }
    await adminClient.from("faturas").update({ nfse_status: "processando", status_sefaz: "processando" })
      .eq("id", invoiceId).eq("tenant_id", authorization.tenantId);

    try {
      const { response, data } = await callBridge(
        buildNfseBridgeUrl(bridge, "v1/nfse/emitir"), bridge.token,
        fiscalPayload(context),
      );
      const number = stringValue(data.numero);
      const accessKey = stringValue(data.chaveAcesso);
      if (!response.ok || data.status !== "autorizada" || !number || !accessKey) {
        const message = stringValue(data.message) || "A NFS-e foi rejeitada pelo sistema fiscal";
        await Promise.all([
          adminClient.from("nfse_documentos").update({ status: "rejeitada", erros: [message] })
            .eq("id", context.document.id).eq("tenant_id", authorization.tenantId),
          adminClient.from("faturas").update({ nfse_status: "rejeitada", status_sefaz: "rejeitada", erros_sefaz: [message] })
            .eq("id", invoiceId).eq("tenant_id", authorization.tenantId),
        ]);
        return jsonResponse(req, { error: message, code: "NFSE_REJECTED" }, 422);
      }

      const files = await storeAuthorizedFiles(adminClient, context, data);
      const { data: registered, error: registerError } = await adminClient.rpc("registrar_nfse_autorizada", {
        _tenant_id: authorization.tenantId,
        _fatura_id: invoiceId,
        _configuracao_fiscal_id: context.emitter.id,
        _idempotency_key: context.document.idempotency_key,
        _numero: number,
        _chave_acesso: accessKey,
        _protocolo: stringValue(data.protocolo),
        _xml_storage_path: files.xmlPath,
        _danfse_storage_path: files.pdfPath,
      });
      if (registerError) throw new Error("NFS-e autorizada, mas o retorno não foi consolidado no ERP");
      const updatedContext = await loadContext(adminClient, authorization.tenantId, invoiceId);
      const urls = await createSignedDocumentUrls(adminClient, updatedContext);
      return jsonResponse(req, { success: true, document: registered, ...urls });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha temporária na emissão fiscal";
      await Promise.all([
        adminClient.from("nfse_documentos").update({ status: "erro_temporario", erros: [message] })
          .eq("id", context.document.id).eq("tenant_id", authorization.tenantId),
        adminClient.from("faturas").update({ nfse_status: "erro_temporario", status_sefaz: "erro_temporario", erros_sefaz: [message] })
          .eq("id", invoiceId).eq("tenant_id", authorization.tenantId),
      ]);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível processar a operação fiscal";
    console.error("Falha controlada no adaptador NFS-e", { action, tenantId: authorization.tenantId, message });
    return jsonResponse(req, { error: message, code: "NFSE_OPERATION_FAILED" }, 400);
  }
});
