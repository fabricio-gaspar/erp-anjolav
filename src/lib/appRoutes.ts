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
  | "industrial-pdv"
  | "industrial-orders"
  | "industrial-logistics"
  | "industrial-finance"
  | "industrial-support"
  | "residential-dashboard"
  | "residential-pdv"
  | "residential-orders"
  | "residential-logistics"
  | "residential-finance"
  | "residential-support";

export interface AppRouteDefinition {
  path: string;
  area: WorkspaceArea;
  requiredModules: RoutePermissionRequirement;
  adminOnly: boolean;
  platformAdminOnly?: boolean;
  label: string;
  sidebarLabel?: string;
  navigationGroup: NavigationGroup;
}

export const APP_ROUTES = [
  {
    path: "/central",
    area: "central",
    requiredModules: ["dashboard"],
    adminOnly: false,
    label: "Painel Administrativo",
    sidebarLabel: "Visão geral",
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
    label: "Visão operacional Industrial",
    sidebarLabel: "Meu dia",
    navigationGroup: "industrial-dashboard",
  },
  {
    path: "/industrial/clientes",
    area: "industrial",
    requiredModules: ["clientes"],
    adminOnly: false,
    label: "Clientes",
    navigationGroup: "industrial-support",
  },
  {
    path: "/industrial/produtos",
    area: "industrial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Produtos/Serviços",
    sidebarLabel: "Serviços e preços",
    navigationGroup: "industrial-support",
  },
  {
    path: "/industrial/fornecedores",
    area: "industrial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Fornecedores",
    navigationGroup: "industrial-support",
  },
  {
    path: "/industrial/agenda",
    area: "industrial",
    requiredModules: ["agenda"],
    adminOnly: false,
    label: "Agenda Industrial",
    sidebarLabel: "Coletas e entregas",
    navigationGroup: "industrial-logistics",
  },
  {
    path: "/industrial/ordens",
    area: "industrial",
    requiredModules: ["ordens"],
    adminOnly: false,
    label: "Ordens de Serviço",
    sidebarLabel: "Pedidos",
    navigationGroup: "industrial-orders",
  },
  {
    path: "/industrial/producao",
    area: "industrial",
    requiredModules: ["producao"],
    adminOnly: false,
    label: "Produção Industrial",
    sidebarLabel: "Produção",
    navigationGroup: "industrial-orders",
  },
  {
    path: "/industrial/caixa",
    area: "industrial",
    requiredModules: ["caixa", "faturamento"],
    adminOnly: false,
    label: "PDV Atendimento",
    sidebarLabel: "PDV / Caixa",
    navigationGroup: "industrial-pdv",
  },
  {
    path: "/industrial/lancamentos",
    area: "industrial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Fechamento e histórico",
    sidebarLabel: "Fechamentos",
    navigationGroup: "industrial-finance",
  },
  {
    path: "/industrial/financeiro",
    area: "industrial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Financeiro Industrial",
    sidebarLabel: "Financeiro",
    navigationGroup: "industrial-finance",
  },
  {
    path: "/industrial/estoque",
    area: "industrial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Estoque",
    sidebarLabel: "Estoque e compras",
    navigationGroup: "industrial-support",
  },
  {
    path: "/industrial/relatorios/clientes",
    area: "industrial",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Demonstrativos industriais",
    sidebarLabel: "Demonstrativos",
    navigationGroup: "industrial-support",
  },
  {
    path: "/industrial/relatorios/proximidade",
    area: "industrial",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Proximidade",
    sidebarLabel: "Planejamento de rotas",
    navigationGroup: "industrial-logistics",
  },
  {
    path: "/residencial",
    area: "residencial",
    requiredModules: ["dashboard"],
    adminOnly: false,
    label: "Visão operacional Doméstica",
    sidebarLabel: "Meu dia",
    navigationGroup: "residential-dashboard",
  },
  {
    path: "/residencial/caixa",
    area: "residencial",
    requiredModules: ["caixa", "faturamento"],
    adminOnly: false,
    label: "PDV Atendimento",
    sidebarLabel: "PDV / Caixa",
    navigationGroup: "residential-pdv",
  },
  {
    path: "/residencial/clientes",
    area: "residencial",
    requiredModules: ["clientes"],
    adminOnly: false,
    label: "Clientes",
    navigationGroup: "residential-support",
  },
  {
    path: "/residencial/agenda",
    area: "residencial",
    requiredModules: ["agenda"],
    adminOnly: false,
    label: "Agenda Doméstica",
    sidebarLabel: "Coletas e entregas",
    navigationGroup: "residential-logistics",
  },
  {
    path: "/residencial/ordens",
    area: "residencial",
    requiredModules: ["ordens"],
    adminOnly: false,
    label: "Ordens de Serviço",
    sidebarLabel: "Pedidos",
    navigationGroup: "residential-orders",
  },
  {
    path: "/residencial/producao",
    area: "residencial",
    requiredModules: ["producao"],
    adminOnly: false,
    label: "Produção Doméstica",
    sidebarLabel: "Produção",
    navigationGroup: "residential-orders",
  },
  {
    path: "/residencial/lancamentos",
    area: "residencial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Fechamento e histórico",
    sidebarLabel: "Fechamentos",
    navigationGroup: "residential-finance",
  },
  {
    path: "/residencial/financeiro",
    area: "residencial",
    requiredModules: ["faturamento"],
    adminOnly: false,
    label: "Financeiro Doméstico",
    sidebarLabel: "Financeiro",
    navigationGroup: "residential-finance",
  },
  {
    path: "/residencial/produtos",
    area: "residencial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Produtos/Serviços",
    sidebarLabel: "Serviços e preços",
    navigationGroup: "residential-support",
  },
  {
    path: "/residencial/estoque",
    area: "residencial",
    requiredModules: ["produtos"],
    adminOnly: false,
    label: "Estoque",
    sidebarLabel: "Estoque e compras",
    navigationGroup: "residential-support",
  },
  {
    path: "/residencial/relatorios/caixa",
    area: "residencial",
    requiredModules: ["relatorios"],
    adminOnly: false,
    label: "Relatório de Caixa",
    navigationGroup: "residential-support",
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
    { id: "industrial-pdv", label: "PDV / Caixa" },
    { id: "industrial-orders", label: "Pedidos e Produção" },
    { id: "industrial-logistics", label: "Coletas e entregas" },
    { id: "industrial-finance", label: "Financeiro" },
    { id: "industrial-support", label: "Apoio" },
  ],
  residencial: [
    { id: "residential-dashboard", label: null },
    { id: "residential-pdv", label: "PDV / Caixa" },
    { id: "residential-orders", label: "Pedidos e Produção" },
    { id: "residential-logistics", label: "Coletas e entregas" },
    { id: "residential-finance", label: "Financeiro" },
    { id: "residential-support", label: "Apoio" },
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
    lancamento: `/${area}/lancamentos`,
  };

  const path = pathByType[type];
  return path && getAppRoute(path) ? (path as AppRoutePath) : null;
}

export type { ModulePermissionKey };
