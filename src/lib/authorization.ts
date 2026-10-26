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

export function resolveLegacyRouteRedirect(
  redirect: LegacyRouteRedirect,
  access: RouteAccessContext,
): string | null {
  if (redirect.from === "/pdv" || redirect.from === "/caixa") {
    const pdv = ["/residencial/caixa", "/industrial/caixa"]
      .map(path => getAppRoute(path))
      .find(route => isRouteAccessible(route, access));
    return pdv ? `${pdv.path}${redirect.search ?? ""}` : null;
  }
  const destination = resolvePreferredAccessibleRoute(getAppRoute(redirect.to), access);
  if (!destination) return null;

  return destination.path === redirect.to && redirect.search
    ? `${destination.path}${redirect.search}`
    : destination.path;
}
