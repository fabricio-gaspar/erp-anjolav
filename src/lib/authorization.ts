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

const ROUTE_PERMISSION_MAP: Readonly<Record<string, RoutePermissionRequirement>> = {
  "/central": ["dashboard"],
  "/central/financeiro": ["faturamento"],
  "/central/contas": ["contas_receber", "contas_pagar"],
  "/central/agenda-eventos": ["agenda"],
  "/central/relatorios/quilometragem": ["relatorios"],
  "/central/relatorios/mensal": ["relatorios"],
  "/central/configuracoes": ["configuracoes"],

  "/industrial": ["dashboard"],
  "/industrial/clientes": ["clientes"],
  "/industrial/produtos": ["produtos"],
  "/industrial/fornecedores": ["clientes"],
  "/industrial/agenda": ["agenda"],
  "/industrial/ordens": ["ordens"],
  "/industrial/producao": ["producao"],
  "/industrial/lancamentos": ["faturamento"],
  "/industrial/financeiro": ["faturamento"],
  "/industrial/estoque": ["produtos"],
  "/industrial/relatorios/clientes": ["relatorios"],
  "/industrial/relatorios/proximidade": ["relatorios"],

  "/residencial": ["dashboard"],
  "/residencial/caixa": ["caixa"],
  "/residencial/clientes": ["clientes"],
  "/residencial/agenda": ["agenda"],
  "/residencial/ordens": ["ordens"],
  "/residencial/producao": ["producao"],
  "/residencial/financeiro": ["faturamento"],
  "/residencial/produtos": ["produtos"],
  "/residencial/relatorios/caixa": ["relatorios"],
};

export function normalizeAppPath(route: string): string {
  const [withoutQuery] = route.split(/[?#]/, 1);
  if (!withoutQuery || withoutQuery === "/") return "/";
  return withoutQuery.replace(/\/+$/, "");
}

export function getRoutePermissionRequirement(
  route: string,
): RoutePermissionRequirement | null {
  return ROUTE_PERMISSION_MAP[normalizeAppPath(route)] ?? null;
}

export function hasAnyModulePermission(
  permissions: Readonly<Record<string, boolean>> | null | undefined,
  requiredModules: RoutePermissionRequirement,
): boolean {
  return requiredModules.some((moduleKey) => permissions?.[moduleKey] === true);
}
