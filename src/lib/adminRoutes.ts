import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Landmark,
  LayoutDashboard,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import type { AppRouteDefinition, WorkspaceArea } from "@/lib/appRoutes";
import type { ModulePermissionKey, RoutePermissionRequirement } from "@/lib/authorization";

export type AdminRoutePath =
  | "/admin/visao-geral"
  | "/admin/cadastros/clientes"
  | "/admin/cadastros/produtos"
  | "/admin/cadastros/fornecedores"
  | "/admin/operacoes/agenda"
  | "/admin/operacoes/ordens"
  | "/admin/operacoes/producao"
  | "/admin/financeiro"
  | "/admin/financeiro/lancamentos"
  | "/admin/financeiro/contas"
  | "/admin/financeiro/contas-receber"
  | "/admin/financeiro/contas-pagar"
  | "/admin/financeiro/caixas"
  | "/admin/estoque"
  | "/admin/relatorios"
  | "/admin/relatorios/central"
  | "/admin/relatorios/quilometragem"
  | "/admin/configuracoes"
  | "/admin/auditoria"
  | "/admin/plataforma";

export interface AdminRouteDefinition {
  path: AdminRoutePath;
  label: string;
  section: string;
  icon: LucideIcon;
  requiredModules: RoutePermissionRequirement;
  adminOnly?: boolean;
  platformAdminOnly?: boolean;
  hiddenFromNavigation?: boolean;
}

const central = (modules: ModulePermissionKey | ModulePermissionKey[]): RoutePermissionRequirement => (
  Array.isArray(modules) ? modules : [modules]
);

export const ADMIN_ROUTES: readonly AdminRouteDefinition[] = [
  { path: "/admin/visao-geral", label: "Visão geral", section: "Painel", icon: LayoutDashboard, requiredModules: central("dashboard") },
  { path: "/admin/cadastros/clientes", label: "Clientes", section: "Cadastros", icon: Users, requiredModules: central("clientes") },
  { path: "/admin/cadastros/produtos", label: "Catálogo", section: "Cadastros", icon: ShoppingCart, requiredModules: central("produtos") },
  { path: "/admin/cadastros/fornecedores", label: "Fornecedores", section: "Cadastros", icon: Building2, requiredModules: central("produtos") },
  { path: "/admin/operacoes/agenda", label: "Agenda e Delivery", section: "Operações", icon: CalendarDays, requiredModules: central("agenda") },
  { path: "/admin/operacoes/ordens", label: "ROLs", section: "Operações", icon: ClipboardList, requiredModules: central("ordens"), hiddenFromNavigation: true },
  { path: "/admin/operacoes/producao", label: "Produção", section: "Operações", icon: Wrench, requiredModules: central("producao") },
  { path: "/admin/estoque", label: "Estoque", section: "Operações", icon: Package, requiredModules: central("produtos") },
  { path: "/admin/financeiro", label: "Painel financeiro", section: "Financeiro", icon: Landmark, requiredModules: central("faturamento") },
  { path: "/admin/financeiro/lancamentos", label: "Faturamento", section: "Financeiro", icon: FileText, requiredModules: central("faturamento") },
  { path: "/admin/financeiro/contas", label: "Contas financeiras", section: "Financeiro", icon: FileText, requiredModules: central(["contas_receber", "contas_pagar"]), hiddenFromNavigation: true },
  { path: "/admin/financeiro/contas-receber", label: "Contas a receber", section: "Financeiro", icon: TrendingUp, requiredModules: central("contas_receber") },
  { path: "/admin/financeiro/contas-pagar", label: "Contas a pagar", section: "Financeiro", icon: TrendingDown, requiredModules: central("contas_pagar") },
  { path: "/admin/financeiro/caixas", label: "Relatórios de caixa", section: "Relatórios", icon: Archive, requiredModules: central(["caixa", "faturamento"]) },
  { path: "/admin/relatorios/central", label: "Central de relatórios", section: "Relatórios", icon: BarChart3, requiredModules: central("relatorios") },
  { path: "/admin/relatorios", label: "Resultado mensal", section: "Relatórios", icon: BarChart3, requiredModules: central("relatorios") },
  { path: "/admin/relatorios/quilometragem", label: "Relatório de quilometragem", section: "Relatórios", icon: BarChart3, requiredModules: central("relatorios") },
  { path: "/admin/configuracoes", label: "Configurações", section: "Administração", icon: Settings, requiredModules: central("configuracoes"), adminOnly: true },
  { path: "/admin/auditoria", label: "Registro de auditoria", section: "Administração", icon: ShieldCheck, requiredModules: central("configuracoes"), adminOnly: true },
  { path: "/admin/plataforma", label: "Empresas e planos", section: "Administração", icon: ShieldCheck, requiredModules: central("configuracoes"), adminOnly: true, platformAdminOnly: true },
];

export function toAdminPermissionRoute(route: AdminRouteDefinition): AppRouteDefinition {
  return {
    path: route.path,
    area: "central" as WorkspaceArea,
    requiredModules: route.requiredModules,
    adminOnly: route.adminOnly === true,
    platformAdminOnly: route.platformAdminOnly,
    label: route.label,
    navigationGroup: "central-management",
  };
}
