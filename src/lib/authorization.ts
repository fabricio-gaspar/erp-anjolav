import {
  APP_ROUTES,
  getAppRoute,
  getWorkspaceRoute,
  normalizeAppPath,
  WORKSPACE_DEFAULT_ORDER,
  type AccessibleWorkspaceMap,
  type AppRouteDefinition,
  type LegacyRouteRedirect,
} from "./appRoutes.ts";

export const MODULE_PERMISSION_KEYS = [
  "dashboard",
  "clientes",
  "produtos",
  "ordens",
  "producao",
  "agenda",
  "faturamento",
  "caixa",
  "contas_receber",
  "contas_pagar",
  "relatorios",
  "configuracoes",
  "alterar_condicoes_comerciais",
] as const;

export type ModulePermissionKey = (typeof MODULE_PERMISSION_KEYS)[number];

export type RoutePermissionRequirement = readonly ModulePermissionKey[];

export { normalizeAppPath };

export function getRoutePermissionRequirement(
  route: string,
): RoutePermissionRequirement | null {
  return getAppRoute(route)?.requiredModules ?? null;
}

export function hasAnyModulePermission(
  permissions: Readonly<Record<string, boolean>> | null | undefined,
  requiredModules: RoutePermissionRequirement,
): boolean {
  return requiredModules.some((moduleKey) => permissions?.[moduleKey] === true);
}

export interface RouteAccessContext {
  accessibleAreas: AccessibleWorkspaceMap;
  modulePermissions: Readonly<Record<string, boolean>> | null | undefined;
  isAdmin: boolean;
  isPlatformAdmin?: boolean;
}

export type PdvArea = Extract<AppRouteDefinition["area"], "industrial" | "residencial">;

export function getCanonicalPdvPath(area: PdvArea): "/pdv/domestico" | "/pdv/industrial" {
  return area === "residencial" ? "/pdv/domestico" : "/pdv/industrial";
}

/**
 * Entrada da frente operacional. O painel preserva o pedido/caixa como uma
 * ação do módulo, em vez de abrir diretamente uma venda ainda sem contexto.
 */
export function getPdvFrontPath(area: PdvArea): "/pdv/painel/domestico" | "/pdv/painel/industrial" {
  return area === "residencial" ? "/pdv/painel/domestico" : "/pdv/painel/industrial";
}

export function isRouteAccessible(
  route: AppRouteDefinition | null | undefined,
  { accessibleAreas, modulePermissions, isAdmin, isPlatformAdmin = false }: RouteAccessContext,
): boolean {
  if (!route || accessibleAreas[route.area] !== true) return false;
  if (route.platformAdminOnly && !isPlatformAdmin) return false;
  if (route.adminOnly && !isAdmin) return false;
  return isAdmin || hasAnyModulePermission(modulePermissions, route.requiredModules);
}

function getFirstAccessibleRouteInArea(
  area: AppRouteDefinition["area"],
  access: RouteAccessContext,
): AppRouteDefinition | null {
  return APP_ROUTES.find(
    (route) => route.area === area && isRouteAccessible(route, access),
  ) ?? null;
}

export function resolveFirstAccessibleRouteInArea(
  area: AppRouteDefinition["area"],
  access: RouteAccessContext,
): AppRouteDefinition | null {
  return getFirstAccessibleRouteInArea(area, access);
}

function getFirstAccessibleRoute(access: RouteAccessContext): AppRouteDefinition | null {
  for (const area of WORKSPACE_DEFAULT_ORDER) {
    const route = getFirstAccessibleRouteInArea(area, access);
    if (route) return route;
  }

  return null;
}

function resolvePreferredAccessibleRoute(
  preferredRoute: AppRouteDefinition | null | undefined,
  access: RouteAccessContext,
): AppRouteDefinition | null {
  if (isRouteAccessible(preferredRoute, access)) return preferredRoute;

  if (preferredRoute) {
    const areaFallback = getFirstAccessibleRouteInArea(preferredRoute.area, access);
    if (areaFallback) return areaFallback;
  }

  return getFirstAccessibleRoute(access);
}

export function resolveDefaultAccessibleRoute(
  access: RouteAccessContext,
): AppRouteDefinition | null {
  return resolvePreferredAccessibleRoute(
    getWorkspaceRoute(WORKSPACE_DEFAULT_ORDER[0]),
    access,
  );
}

export function resolveAccessiblePdvPath(access: RouteAccessContext): string | null {
  for (const area of ["residencial", "industrial"] as const) {
    const route = getAppRoute(`/${area}/caixa`);
    if (isRouteAccessible(route, access)) return getCanonicalPdvPath(area);
  }

  return null;
}

export function resolveAccessiblePdvFrontPath(access: RouteAccessContext): string | null {
  for (const area of ["residencial", "industrial"] as const) {
    const route = getAppRoute(`/${area}/caixa`);
    if (isRouteAccessible(route, access)) return getPdvFrontPath(area);
  }

  return null;
}

export function resolveDefaultAccessiblePath(access: RouteAccessContext): string | null {
  if (access.isAdmin || access.isPlatformAdmin) {
    const controlCenter = getWorkspaceRoute("central");
    if (isRouteAccessible(controlCenter, access)) return "/admin/visao-geral";
  }

  const pdvFront = resolveAccessiblePdvFrontPath(access);
  if (pdvFront) return pdvFront;

  return getFirstAccessibleRoute(access)?.path ?? null;
}

export function resolveLegacyRouteRedirect(
  redirect: LegacyRouteRedirect,
  access: RouteAccessContext,
): string | null {
  if (redirect.from === "/pdv" || redirect.from === "/caixa") {
    const pdvFront = resolveAccessiblePdvFrontPath(access);
    return pdvFront ? `${pdvFront}${redirect.search ?? ""}` : null;
  }
  const destination = resolvePreferredAccessibleRoute(getAppRoute(redirect.to), access);
  if (!destination) return null;

  return destination.path === redirect.to && redirect.search
    ? `${destination.path}${redirect.search}`
    : destination.path;
}
