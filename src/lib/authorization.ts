import {
  getAppRoute,
  normalizeAppPath,
  type AccessibleWorkspaceMap,
  type AppRouteDefinition,
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
}

export function isRouteAccessible(
  route: AppRouteDefinition | null | undefined,
  { accessibleAreas, modulePermissions, isAdmin }: RouteAccessContext,
): boolean {
  if (!route || accessibleAreas[route.area] !== true) return false;
  if (route.adminOnly && !isAdmin) return false;
  return isAdmin || hasAnyModulePermission(modulePermissions, route.requiredModules);
}
