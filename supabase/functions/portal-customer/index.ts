import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  handlePreflight,
  jsonResponse,
  readJsonBody,
  requireJsonPost,
} from "../_shared/http.ts";

const PORTAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{32}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PortalAction = "bootstrap" | "create-launch" | "report";

interface PortalRequest {
  action?: PortalAction;
  code?: string;
  faturaId?: string;
  observacoes?: string;
  itens?: Array<{
    produto_id?: string;
    quantidade?: number;
    observacoes?: string;
  }>;
}

interface PortalClient {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  ativo: boolean;
}

interface PortalContext {
  cliente: PortalClient;
  config: {
    cliente_id: string;
    frequencia: string | null;
    dias_retirada: string[] | null;
    dias_entrega: string[] | null;
    horario_retirada: string | null;
    horario_entrega: string | null;
    tipo_relatorio: string | null;
  };
}

function normalizeCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function cleanOptionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Portal indisponível: configuração do Supabase ausente");
    return jsonResponse(req, { error: "Portal temporariamente indisponível" }, 503);
  }

  const parsedBody = await readJsonBody(req, 131_072);
  if (!parsedBody.ok) return parsedBody.response;
  if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return jsonResponse(req, { error: "JSON inválido" }, 400);
  }
  const body = parsedBody.value as PortalRequest;

  const code = normalizeCode(body.code);
  if (!PORTAL_CODE_PATTERN.test(code)) {
    return jsonResponse(req, { error: "Acesso inválido ou expirado" }, 404);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const resolveContext = async (): Promise<PortalContext | null> => {
    const { data, error } = await supabase
      .from("configuracoes_cliente")
      .select(`
        cliente_id,
        frequencia,
        dias_retirada,
        dias_entrega,
        horario_retirada,
        horario_entrega,
        tipo_relatorio,
        cliente:clientes(id, razao_social, nome_fantasia, ativo)
      `)
      .eq("codigo_acesso", code)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Falha ao validar acesso ao portal", { errorCode: error.code });
      throw new Error("portal_lookup_failed");
    }

    const cliente = relationOne(data?.cliente as PortalClient | PortalClient[] | null);
    if (!data || !cliente?.ativo || cliente.id !== data.cliente_id) return null;

    return {
      cliente,
      config: {
        cliente_id: data.cliente_id,
        frequencia: data.frequencia,
        dias_retirada: data.dias_retirada,
        dias_entrega: data.dias_entrega,
        horario_retirada: data.horario_retirada,
        horario_entrega: data.horario_entrega,
        tipo_relatorio: data.tipo_relatorio,
      },
    };
  };

  try {
    const context = await resolveContext();
    if (!context) return jsonResponse(req, { error: "Acesso inválido ou expirado" }, 404);

    const action = body.action ?? "bootstrap";

    if (action === "bootstrap") {
      const now = new Date();
      const hoje = now.toISOString().slice(0, 10);
      const inicioMes = `${hoje.slice(0, 7)}-01`;
      const fimMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
        .toISOString()
        .slice(0, 10);
      const [
        empresaResult,
        ordensResult,
        faturasResult,
        agendamentosResult,
        lancamentosResult,
        precosResult,
        ordensMesResult,
        faturasMesResult,
      ] =
        await Promise.all([
          supabase
            .from("configuracoes_gerais")
            .select("nome_empresa, logo_url, whatsapp_numero")
            .limit(1)
            .maybeSingle(),
          supabase
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
              historico:historico_producao(id, etapa_anterior, etapa_nova, created_at),
              itens:itens_ordem_servico(
                id,
                quantidade,
                preco_unitario,
                subtotal,
                produto:produtos(nome)
              )
            `)
            .eq("cliente_id", context.cliente.id)
            .neq("status", "cancelada")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
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
            .eq("cliente_id", context.cliente.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("agendamentos")
            .select("id, tipo, data, horario, status")
            .eq("cliente_id", context.cliente.id)
            .gte("data", hoje)
            .order("data", { ascending: true })
            .limit(4),
          supabase
            .from("lancamentos_cliente")
            .select("id, cliente_id, ordem_servico_id, status, data_lancamento, observacoes, created_at, updated_at")
            .eq("cliente_id", context.cliente.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("precos_especiais")
            .select("produto_id")
            .eq("cliente_id", context.cliente.id),
          supabase
            .from("ordens_servico")
            .select("id, status, itens:itens_ordem_servico(quantidade)")
            .eq("cliente_id", context.cliente.id)
            .gte("data_retirada", inicioMes)
            .lte("data_retirada", fimMes),
          supabase
            .from("faturas")
            .select("id, valor_total, status")
            .eq("cliente_id", context.cliente.id)
            .gte("periodo_inicio", inicioMes)
            .lte("periodo_fim", fimMes),
        ]);

      const results = [
        empresaResult,
        ordensResult,
        faturasResult,
        agendamentosResult,
        lancamentosResult,
        precosResult,
        ordensMesResult,
        faturasMesResult,
      ];
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        console.error("Falha ao carregar portal", { errorCode: failed.error.code });
        return jsonResponse(req, { error: "Não foi possível carregar o portal" }, 500);
      }

      const lancamentos = lancamentosResult.data ?? [];
      const lancamentoIds = lancamentos.map((lancamento) => lancamento.id);
      const itensResult = lancamentoIds.length
        ? await supabase
            .from("itens_lancamento_cliente")
            .select("id, lancamento_id, produto_id, quantidade, observacoes, created_at")
            .in("lancamento_id", lancamentoIds)
        : { data: [], error: null };

      if (itensResult.error) {
        console.error("Falha ao carregar itens do portal", { errorCode: itensResult.error.code });
        return jsonResponse(req, { error: "Não foi possível carregar o portal" }, 500);
      }

      const specialProductIds = (precosResult.data ?? []).map((price) => price.produto_id);
      let productQuery = supabase
        .from("produtos")
        .select("id, nome, unidade")
        .eq("status", "ativo")
        .order("nome");
      if (specialProductIds.length) productQuery = productQuery.in("id", specialProductIds);
      const produtosResult = await productQuery;

      if (produtosResult.error) {
        console.error("Falha ao carregar produtos do portal", { errorCode: produtosResult.error.code });
        return jsonResponse(req, { error: "Não foi possível carregar o portal" }, 500);
      }

      const productMap = new Map((produtosResult.data ?? []).map((product) => [product.id, product]));
      const itensPorLancamento = new Map<string, Array<Record<string, unknown>>>();
      for (const item of itensResult.data ?? []) {
        const list = itensPorLancamento.get(item.lancamento_id) ?? [];
        list.push({ ...item, produto: productMap.get(item.produto_id) ?? null });
        itensPorLancamento.set(item.lancamento_id, list);
      }

      const faturas = (faturasResult.data ?? []).map((fatura) => ({
        ...fatura,
        link_pdf_nf: safeHttpsUrl(fatura.link_pdf_nf),
        boleto_url: safeHttpsUrl(fatura.boleto_url),
      }));
      const empresa = empresaResult.data
        ? { ...empresaResult.data, logo_url: safeHttpsUrl(empresaResult.data.logo_url) }
        : null;
      const ordensMes = ordensMesResult.data ?? [];
      const faturasMes = faturasMesResult.data ?? [];
      const estatisticas = {
        totalOS: ordensMes.length,
        osEntregues: ordensMes.filter((ordem) => ordem.status === "entregue").length,
        osEmProcesso: ordensMes.filter(
          (ordem) => !["entregue", "cancelada"].includes(ordem.status),
        ).length,
        totalPecas: ordensMes.reduce(
          (total, ordem) =>
            total +
            (ordem.itens ?? []).reduce(
              (subtotal, item) => subtotal + Number(item.quantidade ?? 0),
              0,
            ),
          0,
        ),
        valorFaturado: faturasMes.reduce(
          (total, fatura) => total + Number(fatura.valor_total ?? 0),
          0,
        ),
        faturasPagas: faturasMes.filter((fatura) => fatura.status === "pago").length,
        totalFaturas: faturasMes.length,
      };

      return jsonResponse(req, {
        data: {
          cliente: {
            id: context.cliente.id,
            razao_social: context.cliente.razao_social,
            nome_fantasia: context.cliente.nome_fantasia,
          },
          config: context.config,
          empresa,
          ordens: ordensResult.data ?? [],
          faturas,
          agendamentos: agendamentosResult.data ?? [],
          lancamentos: lancamentos.map((lancamento) => ({
            ...lancamento,
            itens: itensPorLancamento.get(lancamento.id) ?? [],
          })),
          produtos: produtosResult.data ?? [],
          estatisticas,
        },
      });
    }

    if (action === "report") {
      if (!body.faturaId || !UUID_PATTERN.test(body.faturaId)) {
        return jsonResponse(req, { error: "Fatura inválida" }, 400);
      }

      const { data: fatura, error: faturaError } = await supabase
        .from("faturas")
        .select("id")
        .eq("id", body.faturaId)
        .eq("cliente_id", context.cliente.id)
        .maybeSingle();
      if (faturaError) throw faturaError;
      if (!fatura) return jsonResponse(req, { error: "Fatura não encontrada" }, 404);

      const { data: links, error: linksError } = await supabase
        .from("lancamentos_fatura")
        .select("lancamento_id")
        .eq("fatura_id", fatura.id);
      if (linksError) throw linksError;
      if (!links?.length) return jsonResponse(req, { data: [] });

      const { data: lancamentos, error: lancamentosError } = await supabase
        .from("lancamentos")
        .select(`
          id,
          data_lancamento,
          data_entrega,
          valor_total,
          itens:itens_lancamento(id, produto_nome, quantidade, preco_unitario, subtotal, unidade)
        `)
        .eq("cliente_id", context.cliente.id)
        .in("id", links.map((link) => link.lancamento_id))
        .order("data_lancamento", { ascending: true });
      if (lancamentosError) throw lancamentosError;

      return jsonResponse(req, { data: lancamentos ?? [] });
    }

    if (action === "create-launch") {
      if (!Array.isArray(body.itens) || body.itens.length < 1 || body.itens.length > 100) {
        return jsonResponse(req, { error: "Informe de 1 a 100 itens" }, 400);
      }

      const items = body.itens.map((item) => ({
        produto_id: typeof item.produto_id === "string" ? item.produto_id : "",
        quantidade: Number(item.quantidade),
        observacoes: cleanOptionalText(item.observacoes, 250),
      }));
      if (
        items.some(
          (item) =>
            !UUID_PATTERN.test(item.produto_id) ||
            !Number.isInteger(item.quantidade) ||
            item.quantidade < 1 ||
            item.quantidade > 100_000,
        )
      ) {
        return jsonResponse(req, { error: "Há itens inválidos no lançamento" }, 400);
      }

      const requestedProductIds = [...new Set(items.map((item) => item.produto_id))];
      const [{ data: specialPrices, error: specialError }, { data: activeProducts, error: productsError }] =
        await Promise.all([
          supabase
            .from("precos_especiais")
            .select("produto_id")
            .eq("cliente_id", context.cliente.id),
          supabase
            .from("produtos")
            .select("id")
            .eq("status", "ativo")
            .in("id", requestedProductIds),
        ]);
      if (specialError || productsError) throw specialError ?? productsError;

      const activeIds = new Set((activeProducts ?? []).map((product) => product.id));
      const specialIds = new Set((specialPrices ?? []).map((price) => price.produto_id));
      const hasSpecialCatalog = specialIds.size > 0;
      const hasInvalidProduct = requestedProductIds.some(
        (id) => !activeIds.has(id) || (hasSpecialCatalog && !specialIds.has(id)),
      );
      if (hasInvalidProduct) {
        return jsonResponse(req, { error: "Um ou mais produtos não estão disponíveis" }, 400);
      }

      const { data: lancamento, error: lancamentoError } = await supabase
        .from("lancamentos_cliente")
        .insert({
          cliente_id: context.cliente.id,
          observacoes: cleanOptionalText(body.observacoes, 500),
          status: "pendente",
        })
        .select("id, cliente_id, status, data_lancamento, observacoes, created_at, updated_at")
        .single();
      if (lancamentoError) throw lancamentoError;

      const { error: itemsError } = await supabase.from("itens_lancamento_cliente").insert(
        items.map((item) => ({ ...item, lancamento_id: lancamento.id })),
      );
      if (itemsError) {
        const { error: rollbackError } = await supabase
          .from("lancamentos_cliente")
          .delete()
          .eq("id", lancamento.id)
          .eq("cliente_id", context.cliente.id);
        if (rollbackError) {
          console.error("Falha ao compensar lançamento incompleto", { errorCode: rollbackError.code });
        }
        throw itemsError;
      }

      return jsonResponse(req, { data: { ...lancamento, itens: items } }, 201);
    }

    return jsonResponse(req, { error: "Ação não suportada" }, 400);
  } catch (error) {
    const errorCode =
      typeof error === "object" && error && "code" in error ? String(error.code) : "unexpected";
    console.error("Falha no portal do cliente", { errorCode });
    return jsonResponse(req, { error: "Não foi possível concluir a operação" }, 500);
  }
});
