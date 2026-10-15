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

function sanitizeSearchTerm(term: string): string {
  return term.replace(/[(),"'\\]/g, "").trim();
}

function hasExplicitSearchArea(recordArea: string | null | undefined): boolean {
  const normalized = recordArea?.trim().toLowerCase();
  return normalized === "industrial" || normalized === "id1"
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
  const name = (value as { razao_social?: unknown }).razao_social;
  return typeof name === "string" ? name : undefined;
}

function getClientArea(value: unknown): string | undefined {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  const classification = (value as { classificacao?: unknown }).classificacao;
  return typeof classification === "string" ? classification : undefined;
}

export const useGlobalSearch = (term: string) => {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const navigationAccess = useNavigationAccess();
  const trimmed = sanitizeSearchTerm(term);

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
    queryKey: ["global-search", activeTenant?.id, activeArea, accessKey, trimmed],
    enabled: Boolean(
      session?.user
      && activeTenant?.id
      && !navigationAccess.isLoading
      && !navigationAccess.isError
      && canSearch
      && trimmed.length >= 2,
    ),
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      if (!session?.user || !activeTenant?.id || navigationAccess.isLoading || navigationAccess.isError || !canSearch) {
        throw new Error("Uma sessão autenticada com permissões carregadas é obrigatória para pesquisar");
      }

      const pattern = `%${trimmed}%`;
      const allow = (type: SearchResultType) => searchableTypes.includes(type);
      const noResults = Promise.resolve({ data: [], error: null });
      const [clientes, produtos, fornecedores, ordens, lancamentos] = await Promise.all([
        allow("cliente")
          ? supabase.from("clientes").select("id,razao_social,nome_fantasia,cpf_cnpj,classificacao").or(`razao_social.ilike.${pattern},nome_fantasia.ilike.${pattern},cpf_cnpj.ilike.${pattern}`).limit(5)
          : noResults,
        allow("produto")
          ? supabase.from("produtos").select("id,nome,codigo,unidade_negocio").or(`nome.ilike.${pattern},codigo.ilike.${pattern}`).limit(5)
          : noResults,
        allow("fornecedor")
          ? supabase.from("fornecedores").select("id,nome,cnpj_cpf").or(`nome.ilike.${pattern},cnpj_cpf.ilike.${pattern}`).limit(5)
          : noResults,
        allow("ordem")
          ? supabase.from("ordens_servico").select("id,numero,origem,cliente:clientes(razao_social)").ilike("numero", pattern).limit(5)
          : noResults,
        allow("lancamento")
          ? supabase.from("lancamentos").select("id,numero_rol,cliente:clientes(razao_social,classificacao)").ilike("numero_rol", pattern).limit(5)
          : noResults,
      ]);

      for (const result of [clientes, produtos, fornecedores, ordens, lancamentos]) {
        if (result.error) throw result.error;
      }

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

      clientes.data?.forEach((client) => {
        appendResult(
          "cliente",
          client.id,
          client.razao_social || client.nome_fantasia || "Cliente",
          client.cpf_cnpj || undefined,
          client.classificacao,
        );
      });
      produtos.data?.forEach((product) => {
        appendResult(
          "produto",
          product.id,
          product.nome,
          product.codigo || undefined,
          product.unidade_negocio,
        );
      });
      fornecedores.data?.forEach((supplier) => {
        appendResult("fornecedor", supplier.id, supplier.nome, supplier.cnpj_cpf || undefined);
      });
      ordens.data?.forEach((order) => {
        appendResult(
          "ordem",
          order.id,
          `OS ${order.numero}`,
          getClientName(order.cliente),
          order.origem,
        );
      });
      lancamentos.data?.forEach((entry) => {
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
