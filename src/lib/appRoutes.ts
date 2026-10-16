import type { ModulePermissionKey, RoutePermissionRequirement } from "./authorization.ts";

export const WORKSPACE_AREAS = ["central", "industrial", "residencial"] as const;

export type WorkspaceArea = (typeof WORKSPACE_AREAS)[number];

export const WORKSPACE_DEFAULT_ORDER = WORKSPACE_AREAS;

export type NavigationGroup =
  | "central-dashboard"
  | "workspace-switcher"
  | "central-management"
  | "central-admin"
  | "industrial-dashboard"
  | "industrial-customers"
  | "industrial-operations"
  | "industrial-billing"
  | "industrial-analysis"
  | "residential-dashboard"
  | "residential-service"
  | "residential-operations"
  | "residential-billing";

export interface AppRouteDefinition {
  path: string;
  area: WorkspaceArea;
  requiredModules: RoutePermissionRequirement;
  adminOnly: boolean;
  platformAdminOnly?: boolean;
  label: string;
  navigationGroup: NavigationGroup;
}

export const APP_ROUTES = [
  {
    path: "/central",
    area: "central",
    requiredModules: ["dashboard"],
    adminOnly: false,
    label: "Painel Central",
    navigationGroup: "central-dashboard",
  },
  {
    path: "/central/financeiro",
    area: "central",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Financeiro Global",
    navigationGroup: "central-management",
  },
  {
    path: "/central/contas",
    area: "central",
    requiredModules: ["contas_receber", "contas_pagar"],
    adminOnly: false,
    label: "Contas",
    navigationGroup: "central-management",
  },
  {
    path: "/central/agenda-eventos",
    area: "central",
    requiredModules: ["agenda"],
    adminOnly: false,
    label: "Agenda Administrativa",
    navigationGroup: "central-admin",
  },
  {
    path: "/central/relatorios/quilometragem",
    area: "central",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Relatórios de Quilometragem",
    navigationGroup: "central-management",
  },
  {
    path: "/central/relatorios/mensal",
    area: "central",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Relatório Mensal",
    navigationGroup: "central-management",
  },
  {
    path: "/central/configuracoes",
    area: "central",
    requiredModules: ["configuracoes"],
    adminOnly: true,
    label: "Configurações",
    navigationGroup: "central-admin",
  },
  {
    path: "/central/auditoria",
    area: "central",
    requiredModules: ["configuracoes"],
    adminOnly: true,
    label: "Auditoria",
    navigationGroup: "central-admin",
  },
  {
    path: "/central/administracao-saas",
    area: "central",
    requiredModules: ["configuracoes"],
    adminOnly: true,
    platformAdminOnly: true,
    label: "Administração SaaS",
    navigationGroup: "central-admin",
  },
  {
    path: "/industrial",
    area: "industrial",
    requiredModules: ["dashboard"],
    adminOnly: false,
    label: "Painel Industrial",
    navigationGroup: "industrial-dashboard",
  },
  {
    path: "/industrial/clientes",
    area: "industrial",
    requiredModules: ["clientes"],
    adminOnly: false,
    label: "Clientes",
    navigationGroup: "industrial-customers",
  },
  {
    path: "/industrial/produtos",
    area: "industrial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Produtos/Serviços",
    navigationGroup: "industrial-customers",
  },
  {
    path: "/industrial/fornecedores",
    area: "industrial",
    requiredModules: ["clientes"],
    adminOnly: false,
    label: "Fornecedores",
    navigationGroup: "industrial-customers",
  },
  {
    path: "/industrial/agenda",
    area: "industrial",
    requiredModules: ["agenda"],
    adminOnly: false,
    label: "Agenda Industrial",
    navigationGroup: "industrial-operations",
  },
  {
    path: "/industrial/ordens",
    area: "industrial",
    requiredModules: ["ordens"],
    adminOnly: false,
    label: "Ordens de Serviço",
    navigationGroup: "industrial-operations",
  },
  {
    path: "/industrial/producao",
    area: "industrial",
    requiredModules: ["producao"],
    adminOnly: false,
    label: "Produção Industrial",
    navigationGroup: "industrial-operations",
  },
  {
    path: "/industrial/lancamentos",
    area: "industrial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Faturamento/Lançamentos",
    navigationGroup: "industrial-billing",
  },
  {
    path: "/industrial/financeiro",
    area: "industrial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Financeiro Industrial",
    navigationGroup: "industrial-billing",
  },
  {
    path: "/industrial/estoque",
    area: "industrial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Estoque",
    navigationGroup: "industrial-billing",
  },
  {
    path: "/industrial/relatorios/clientes",
    area: "industrial",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Relatório de Clientes",
    navigationGroup: "industrial-analysis",
  },
  {
    path: "/industrial/relatorios/proximidade",
    area: "industrial",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Proximidade",
    navigationGroup: "industrial-analysis",
  },
  {
    path: "/residencial",
    area: "residencial",
    requiredModules: ["dashboard"],
    adminOnly: false,
    label: "Painel Residencial",
    navigationGroup: "residential-dashboard",
  },
  {
    path: "/residencial/caixa",
    area: "residencial",
    requiredModules: ["caixa"],
    adminOnly: false,
    label: "PDV Loja",
    navigationGroup: "residential-service",
  },
  {
    path: "/residencial/clientes",
    area: "residencial",
    requiredModules: ["clientes"],
    adminOnly: false,
    label: "Clientes",
    navigationGroup: "residential-service",
  },
  {
    path: "/residencial/agenda",
    area: "residencial",
    requiredModules: ["agenda"],
    adminOnly: false,
    label: "Agenda Residencial",
    navigationGroup: "residential-operations",
  },
  {
    path: "/residencial/ordens",
    area: "residencial",
    requiredModules: ["ordens"],
    adminOnly: false,
    label: "Ordens de Serviço",
    navigationGroup: "residential-operations",
  },
  {
    path: "/residencial/producao",
    area: "residencial",
    requiredModules: ["producao"],
    adminOnly: false,
    label: "Produção Residencial",
    navigationGroup: "residential-operations",
  },
  {
    path: "/residencial/financeiro",
    area: "residencial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Financeiro Residencial",
    navigationGroup: "residential-billing",
  },
  {
    path: "/residencial/produtos",
    area: "residencial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Produtos/Serviços",
    navigationGroup: "residential-billing",
  },
  {
    path: "/residencial/relatorios/caixa",
    area: "residencial",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Relatório de Caixa",
    navigationGroup: "residential-billing",
  },
] as const satisfies readonly AppRouteDefinition[];

export type AppRoutePath = (typeof APP_ROUTES)[number]["path"];

export interface SidebarNavigationGroup {
  id: NavigationGroup;
  label: string | null;
  routes: readonly AppRouteDefinition[];
}

interface SidebarNavigationGroupDefinition {
  id: NavigationGroup;
  label: string | null;
}

const SIDEBAR_GROUP_DEFINITIONS: Readonly<Record<WorkspaceArea, readonly SidebarNavigationGroupDefinition[]>> = {
  central: [
    { id: "central-dashboard", label: null },
    { id: "workspace-switcher", label: "Ambientes" },
    { id: "central-management", label: "Gestão Consolidada" },
    { id: "central-admin", label: "Administração" },
  ],
  industrial: [
    { id: "industrial-dashboard", label: null },
    { id: "industrial-customers", label: "Clientes e Contratos" },
    { id: "industrial-operations", label: "Operação" },
    { id: "industrial-billing", label: "Faturamento e Gestão" },
    { id: "industrial-analysis", label: "Análises" },
  ],
  residencial: [
    { id: "residential-dashboard", label: null },
    { id: "residential-service", label: "Atendimento" },
    { id: "residential-operations", label: "Pedidos e Produção" },
    { id: "residential-billing", label: "Caixa e Financeiro" },
  ],
};

export interface LegacyRouteRedirect {
  from: string;
  to: AppRoutePath;
  search?: string;
}

export const LEGACY_ROUTE_REDIRECTS: readonly LegacyRouteRedirect[] = [
  { from: "/dashboard", to: "/central" },
  { from: "/configuracoes", to: "/central/configuracoes" },
  { from: "/financeiro", to: "/central/financeiro" },
  { from: "/caixa", to: "/residencial/caixa" },
  { from: "/lancamentos", to: "/industrial/lancamentos" },
  { from: "/contas", to: "/central/contas" },
  { from: "/clientes", to: "/industrial/clientes" },
  { from: "/produtos", to: "/industrial/produtos" },
  { from: "/producao", to: "/industrial/producao" },
  { from: "/ordens", to: "/industrial/ordens" },
  { from: "/agenda", to: "/industrial/agenda" },
  { from: "/fornecedores", to: "/industrial/fornecedores" },
  { from: "/estoque", to: "/industrial/estoque" },
  { from: "/relatorios/clientes", to: "/industrial/relatorios/clientes" },
  { from: "/relatorios/proximidade", to: "/industrial/relatorios/proximidade" },
  { from: "/relatorios/caixa", to: "/residencial/relatorios/caixa" },
  { from: "/agenda-eventos", to: "/central/agenda-eventos" },
  { from: "/relatorios/quilometragem", to: "/central/relatorios/quilometragem" },
  { from: "/relatorios/mensal", to: "/central/relatorios/mensal" },
  { from: "/faturamento", to: "/industrial/lancamentos", search: "?tab=faturas" },
  { from: "/receber", to: "/central/contas", search: "?tab=receber" },
  { from: "/pagar", to: "/central/contas", search: "?tab=pagar" },
  { from: "/asaas", to: "/central/contas", search: "?tab=receber" },
  { from: "/relatorios/financeiro", to: "/central/financeiro" },
];

export function normalizeAppPath(route: string): string {
  const [withoutQuery] = route.split(/[?#]/, 1);
  if (!withoutQuery || withoutQuery === "/") return "/";
  return withoutQuery.replace(/\/+$/, "");
}

export function getAppRoute(route: string): AppRouteDefinition | undefined {
  const path = normalizeAppPath(route);
  return APP_ROUTES.find((candidate) => candidate.path === path);
}

export function getWorkspaceRoute(area: WorkspaceArea): AppRouteDefinition | undefined {
  return getAppRoute(`/${area}`);
}

export function getSidebarNavigationGroups(area: WorkspaceArea): readonly SidebarNavigationGroup[] {
  return SIDEBAR_GROUP_DEFINITIONS[area]
    .map((group) => ({
      ...group,
      routes: APP_ROUTES.filter((route) => route.navigationGroup === group.id),
    }))
    .filter((group) => group.routes.length > 0);
}

export type AccessibleWorkspaceMap = Partial<Record<WorkspaceArea, boolean>>;

export type SearchResultType = "cliente" | "produto" | "fornecedor" | "ordem" | "lancamento";

export function getSearchWorkspace(
  recordArea: string | null | undefined,
  fallback: WorkspaceArea = "industrial",
): WorkspaceArea {
  const normalized = recordArea?.trim().toLowerCase();
  if (normalized === "central") return "central";
  if (["residencial", "loja", "id2"].includes(normalized ?? "")) return "residencial";
  if (["industrial", "id1"].includes(normalized ?? "")) return "industrial";
  return fallback;
}

export function getSearchResultRoute(
  type: SearchResultType,
  recordArea: string | null | undefined,
  fallback: WorkspaceArea = "industrial",
): AppRoutePath | null {
  const area = getSearchWorkspace(recordArea, fallback);
  if (area === "central") return null;

  const pathByType: Record<SearchResultType, string | null> = {
    cliente: `/${area}/clientes`,
    produto: `/${area}/produtos`,
    fornecedor: "/industrial/fornecedores",
    ordem: `/${area}/ordens`,
    lancamento: area === "industrial" ? "/industrial/lancamentos" : null,
  };

  const path = pathByType[type];
  return path && getAppRoute(path) ? (path as AppRoutePath) : null;
}

export type { ModulePermissionKey };
