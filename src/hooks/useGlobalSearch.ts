import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { supabase } from "@/integrations/supabase/client";
import {
  getSearchResultRoute,
  WORKSPACE_DEFAULT_ORDER,
  type SearchResultType,
  type WorkspaceArea,
} from "@/lib/appRoutes";

export interface GlobalSearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  route: string;
}

const SEARCH_TYPES: readonly SearchResultType[] = [
  "cliente",
  "produto",
  "fornecedor",
  "ordem",
  "lancamento",
];
const CLIENT_TEXT_FIELDS = ["razao_social", "nome_fantasia"] as const;
const CLIENT_IDENTITY_FIELDS = ["cpf_cnpj", "telefone", "telefone2"] as const;
const MAX_SEARCH_TERM_LENGTH = 80;

/**
 * Mantém apenas letras e números antes de interpolar o valor na sintaxe bruta
 * exigida por PostgREST para filtros `or`. Os espaços viram curingas gerados
 * pela aplicação; curingas e operadores fornecidos pelo usuário são descartados.
 */
export function sanitizeGlobalSearchTerm(term: string): string {
  const chunks = term.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...chunks.join(" ")].slice(0, MAX_SEARCH_TERM_LENGTH).join("").trim();
}

function buildIlikePattern(safeTerm: string): string {
  return `%${safeTerm.split(/\s+/).filter(Boolean).join("%")}%`;
}

function buildDigitTolerantPattern(safeTerm: string, fallbackPattern: string): string {
  const digits = safeTerm.replace(/\D/g, "");
  return digits.length >= 3 ? `%${[...digits].join("%")}%` : fallbackPattern;
}

function buildSafeOrFilter(
  fields: readonly string[],
  pattern: string,
): string {
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}

function hasExplicitSearchArea(recordArea: string | null | undefined): boolean {
  const normalized = recordArea?.trim().toLowerCase();
  return normalized === "central"
    || normalized === "industrial" || normalized === "id1"
    || normalized === "residencial" || normalized === "loja" || normalized === "id2";
}

function getOperationalFallbackAreas(activeArea: WorkspaceArea): WorkspaceArea[] {
  return activeArea === "central"
    ? WORKSPACE_DEFAULT_ORDER.filter((area) => area !== "central")
    : [activeArea];
}

function resolveSearchRoute(
  type: SearchResultType,
  recordArea: string | null | undefined,
  activeArea: WorkspaceArea,
  canAccessRoute: (route: string) => boolean,
): string | null {
  const routeForRecordArea = getSearchResultRoute(type, recordArea, "central");
  if (routeForRecordArea) return canAccessRoute(routeForRecordArea) ? routeForRecordArea : null;
  if (hasExplicitSearchArea(recordArea)) return null;

  for (const fallbackArea of getOperationalFallbackAreas(activeArea)) {
    const fallbackRoute = getSearchResultRoute(type, undefined, fallbackArea);
    if (fallbackRoute && canAccessRoute(fallbackRoute)) return fallbackRoute;
  }

  return null;
}

function getClientName(value: unknown): string | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const client = value as { nome_fantasia?: unknown; razao_social?: unknown };
  if (typeof client.nome_fantasia === "string" && client.nome_fantasia.trim()) {
    return client.nome_fantasia;
  }
  return typeof client.razao_social === "string" ? client.razao_social : undefined;
}

function getClientArea(value: unknown): string | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const classification = (value as { classificacao?: unknown }).classificacao;
  return typeof classification === "string" ? classification : undefined;
}

function getOrderNumberTerm(safeTerm: string): string {
  return safeTerm
    .replace(/^(?:pedido|ordem(?:\s+de\s+servi[cç]o)?|os)\s*/iu, "")
    .trim() || safeTerm;
}

function getClientSublabel(client: {
  razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj: string | null;
  telefone: string | null;
  telefone2: string | null;
}): string | undefined {
  const label = client.nome_fantasia?.trim() || client.razao_social;
  const details = [
    label !== client.razao_social ? client.razao_social : null,
    client.cpf_cnpj,
    client.telefone,
    client.telefone2,
  ].filter((value): value is string => Boolean(value?.trim()));

  return details.length > 0 ? details.join(" · ") : undefined;
}

export const useGlobalSearch = (term: string) => {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const navigationAccess = useNavigationAccess();
  const safeTerm = sanitizeGlobalSearchTerm(term);
  const hasMinimumTerm = safeTerm.replace(/\s/g, "").length >= 2;

  const canSearchType = (type: SearchResultType): boolean => {
    if (navigationAccess.isLoading || navigationAccess.isError) return false;

    return getOperationalFallbackAreas(activeArea).some((area) => {
      const route = getSearchResultRoute(type, undefined, area);
      return !!route && navigationAccess.canAccessRoute(route);
    });
  };

  const searchableTypes = SEARCH_TYPES.filter(canSearchType);
  const canSearch = searchableTypes.length > 0;
  const accessKey = searchableTypes.join(",");

  return useQuery({
    queryKey: [
      "global-search",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      accessKey,
      safeTerm,
    ],
    enabled: Boolean(
      session?.user
      && activeTenant?.id
      && !navigationAccess.isLoading
      && !navigationAccess.isError
      && canSearch
      && hasMinimumTerm,
    ),
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      if (
        !session?.user
        || !activeTenant?.id
        || navigationAccess.isLoading
        || navigationAccess.isError
        || !canSearch
        || !hasMinimumTerm
      ) {
        throw new Error("Uma sessão autenticada com permissões carregadas é obrigatória para pesquisar");
      }

      const tenantId = activeTenant.id;
      const pattern = buildIlikePattern(safeTerm);
      const identityPattern = buildDigitTolerantPattern(safeTerm, pattern);
      const clientFilter = [
        buildSafeOrFilter(CLIENT_TEXT_FIELDS, pattern),
        buildSafeOrFilter(CLIENT_IDENTITY_FIELDS, identityPattern),
      ].join(",");
      const clientNameFilter = buildSafeOrFilter(CLIENT_TEXT_FIELDS, pattern);
      const orderPattern = buildIlikePattern(getOrderNumberTerm(safeTerm));
      const allow = (type: SearchResultType) => searchableTypes.includes(type);

      const fetchClients = async () => {
        if (!allow("cliente")) return [];
        let query = supabase
          .from("clientes")
          .select("id,razao_social,nome_fantasia,cpf_cnpj,telefone,telefone2,classificacao")
          .filter("tenant_id", "eq", tenantId);
        if (activeArea !== "central") query = query.eq("classificacao", activeArea);
        const { data, error } = await query.or(clientFilter).limit(5);
        if (error) throw error;
        return data ?? [];
      };

      const fetchProducts = async () => {
        if (!allow("produto")) return [];
        let query = supabase
          .from("produtos")
          .select("id,nome,codigo,unidade_negocio")
          .filter("tenant_id", "eq", tenantId);
        if (activeArea === "industrial") query = query.in("unidade_negocio", ["ID1", "ambos"]);
        if (activeArea === "residencial") query = query.in("unidade_negocio", ["ID2", "ambos"]);
        const { data, error } = await query
          .or(buildSafeOrFilter(["nome", "codigo"], pattern))
          .limit(5);
        if (error) throw error;
        return data ?? [];
      };

      const fetchSuppliers = async () => {
        if (!allow("fornecedor")) return [];
        const { data, error } = await supabase
          .from("fornecedores")
          .select("id,nome,cnpj_cpf")
          .filter("tenant_id", "eq", tenantId)
          .or(buildSafeOrFilter(["nome", "cnpj_cpf"], pattern))
          .limit(5);
        if (error) throw error;
        return data ?? [];
      };

      const fetchOrdersByNumber = async () => {
        if (!allow("ordem")) return [];
        let query = supabase
          .from("ordens_servico")
          .select("id,numero,origem,cliente:clientes!ordens_servico_cliente_id_fkey(razao_social,nome_fantasia)")
          .filter("tenant_id", "eq", tenantId);
        if (activeArea !== "central") query = query.eq("origem", activeArea);
        const { data, error } = await query.ilike("numero", orderPattern).limit(5);
        if (error) throw error;
        return data ?? [];
      };

      const fetchOrderClientIds = async () => {
        if (!allow("ordem")) return [];
        let query = supabase
          .from("clientes")
          .select("id")
          .filter("tenant_id", "eq", tenantId);
        if (activeArea !== "central") query = query.eq("classificacao", activeArea);
        const { data, error } = await query.or(clientNameFilter).limit(20);
        if (error) throw error;
        return (data ?? []).map((client) => client.id);
      };

      const fetchEntries = async () => {
        if (!allow("lancamento")) return [];
        const { data, error } = await supabase
          .from("lancamentos")
          .select("id,numero_rol,cliente:clientes(razao_social,nome_fantasia,classificacao)")
          .filter("tenant_id", "eq", tenantId)
          .ilike("numero_rol", pattern)
          .limit(5);
        if (error) throw error;
        return data ?? [];
      };

      const [clientes, produtos, fornecedores, ordensPorNumero, clienteIds, lancamentos] = await Promise.all([
        fetchClients(),
        fetchProducts(),
        fetchSuppliers(),
        fetchOrdersByNumber(),
        fetchOrderClientIds(),
        fetchEntries(),
      ]);

      const fetchOrdersByClient = async () => {
        if (!allow("ordem") || clienteIds.length === 0) return [];
        let query = supabase
          .from("ordens_servico")
          .select("id,numero,origem,cliente:clientes!ordens_servico_cliente_id_fkey(razao_social,nome_fantasia)")
          .filter("tenant_id", "eq", tenantId)
          .in("cliente_id", clienteIds);
        if (activeArea !== "central") query = query.eq("origem", activeArea);
        const { data, error } = await query.limit(5);
        if (error) throw error;
        return data ?? [];
      };

      const ordensPorCliente = await fetchOrdersByClient();
      const ordens = [...new Map(
        [...ordensPorNumero, ...ordensPorCliente].map((order) => [order.id, order]),
      ).values()].slice(0, 5);

      const out: GlobalSearchResult[] = [];
      const appendResult = (
        type: SearchResultType,
        id: string,
        label: string,
        sublabel: string | undefined,
        recordArea?: string | null,
      ) => {
        const route = resolveSearchRoute(type, recordArea, activeArea, navigationAccess.canAccessRoute);
        if (!route) return;
        out.push({ id, type, label, sublabel, route: `${route}?id=${id}` });
      };

      clientes.forEach((client) => {
        appendResult(
          "cliente",
          client.id,
          client.nome_fantasia || client.razao_social || "Cliente",
          getClientSublabel(client),
          client.classificacao,
        );
      });
      produtos.forEach((product) => {
        appendResult(
          "produto",
          product.id,
          product.nome,
          product.codigo || undefined,
          product.unidade_negocio,
        );
      });
      fornecedores.forEach((supplier) => {
        appendResult("fornecedor", supplier.id, supplier.nome, supplier.cnpj_cpf || undefined);
      });
      ordens.forEach((order) => {
        appendResult(
          "ordem",
          order.id,
          `Pedido / ROL ${order.numero}`,
          getClientName(order.cliente),
          order.origem,
        );
      });
      lancamentos.forEach((entry) => {
        appendResult(
          "lancamento",
          entry.id,
          entry.numero_rol || "Lançamento",
          getClientName(entry.cliente),
          getClientArea(entry.cliente),
        );
      });

      return out;
    },
  });
};
