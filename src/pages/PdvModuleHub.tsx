import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  FileText,
  Landmark,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { PdvLayout } from "@/components/layout/PdvLayout";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { ADMIN_ROUTES, toAdminPermissionRoute, type AdminRoutePath } from "@/lib/adminRoutes";
import { getCanonicalPdvPath, type PdvArea } from "@/lib/authorization";
import { cn } from "@/lib/utils";

type ModuleTone = "blue" | "teal" | "violet" | "green" | "amber" | "cyan" | "pink" | "indigo" | "slate";

interface PdvModule {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: ModuleTone;
  path: string | null;
  featured?: boolean;
  badge?: string;
}

const PDV_AREAS: readonly PdvArea[] = ["residencial", "industrial"];

const toneClasses: Record<ModuleTone, string> = {
  blue: "from-sky-500 to-blue-700 hover:from-sky-400 hover:to-blue-600",
  teal: "from-teal-500 to-cyan-700 hover:from-teal-400 hover:to-cyan-600",
  violet: "from-violet-500 to-purple-700 hover:from-violet-400 hover:to-purple-600",
  green: "from-emerald-500 to-green-700 hover:from-emerald-400 hover:to-green-600",
  amber: "from-amber-500 to-orange-700 hover:from-amber-400 hover:to-orange-600",
  cyan: "from-cyan-500 to-sky-700 hover:from-cyan-400 hover:to-sky-600",
  pink: "from-fuchsia-500 to-pink-700 hover:from-fuchsia-400 hover:to-pink-600",
  indigo: "from-indigo-500 to-blue-700 hover:from-indigo-400 hover:to-blue-600",
  slate: "from-slate-500 to-slate-700 hover:from-slate-400 hover:to-slate-600",
};

function getAdminRoute(path: AdminRoutePath) {
  return ADMIN_ROUTES.find((route) => route.path === path);
}

export default function PdvModuleHub() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const { canAccessRoute, isLoading, isError } = useNavigationAccess();

  const requestedArea = searchParams.get("operacao");
  const requestedOperation: PdvArea | null = PDV_AREAS.includes(requestedArea as PdvArea)
    ? requestedArea as PdvArea
    : null;
  const workspaceOperation: PdvArea | null = activeArea === "industrial" || activeArea === "residencial"
    ? activeArea
    : null;
  const operationalCandidates = [requestedOperation, workspaceOperation, ...PDV_AREAS]
    .filter((area): area is PdvArea => area !== null);
  const operation = operationalCandidates.find((area) => (
    canAccessRoute(`/${area}/caixa`)
    || canAccessRoute(`/${area}/ordens`)
    || canAccessRoute(`/${area}/agenda`)
    || canAccessRoute(`/${area}/clientes`)
  )) ?? requestedOperation ?? workspaceOperation ?? "residencial";

  const operationLabel = operation === "industrial" ? "Industrial" : "Doméstica";
  const operationalPath = (suffix = "") => {
    const root = getCanonicalPdvPath(operation);
    return suffix ? `${root}/${suffix}` : root;
  };
  const canOpenAdminRoute = (path: AdminRoutePath) => {
    const route = getAdminRoute(path);
    return route ? canAccessRoute(toAdminPermissionRoute(route)) : false;
  };

  const canUsePdv = canAccessRoute(`/${operation}/caixa`);
  const canUseOrders = canAccessRoute(`/${operation}/ordens`);
  const canUseClients = canAccessRoute(`/${operation}/clientes`);
  const canUseProduction = canAccessRoute(`/${operation}/producao`);
  const canUseAgenda = canAccessRoute(`/${operation}/agenda`);
  const canUseFinance = canAccessRoute(`/${operation}/lancamentos`);
  const reportPath = operation === "industrial"
    ? "/industrial/relatorios/clientes"
    : "/residencial/relatorios/caixa";
  const canUseReports = canAccessRoute(reportPath);
  const canUseAdministration = canOpenAdminRoute("/admin/configuracoes");

  const modules = useMemo<PdvModule[]>(() => [
    {
      id: "balcao",
      title: "Balcão / PDV",
      description: "Atendimento · ROLs · Pagamentos",
      icon: ShoppingCart,
      tone: "blue",
      path: canUsePdv ? operationalPath() : null,
      featured: true,
      badge: "Novo atendimento",
    },
    {
      id: "recepcao",
      title: "Recepção",
      description: "Entrada · Leitura · Conferência",
      icon: ClipboardList,
      tone: "teal",
      path: canUseOrders ? operationalPath("ordens?novo=1") : null,
    },
    {
      id: "cadastros",
      title: "Cadastros",
      description: "Clientes · Peças · Serviços",
      icon: Users,
      tone: "violet",
      path: canUseClients ? operationalPath("clientes") : null,
    },
    {
      id: "producao",
      title: "Produção",
      description: "Fila do dia · Etapas · Capacidade",
      icon: Wrench,
      tone: "green",
      path: canUseProduction ? operationalPath("producao") : null,
      featured: true,
    },
    {
      id: "expedicao",
      title: "Rouparia e expedição",
      description: "Pedidos em andamento · Preparação",
      icon: Package,
      tone: "amber",
      path: canUseOrders ? operationalPath("ordens?status=abertas") : null,
    },
    {
      id: "logistica",
      title: "Entregas e coletas",
      description: "Rotas · Agendamentos · Execução",
      icon: Truck,
      tone: "cyan",
      path: canUseAgenda ? operationalPath("agenda?view=rotas") : null,
    },
    {
      id: "financeiro",
      title: "Financeiro",
      description: "Fechamentos · Pendências · Faturas",
      icon: Landmark,
      tone: "green",
      path: canUseFinance ? operationalPath("lancamentos?tab=pendentes") : null,
    },
    {
      id: "fiscal",
      title: "Fiscal",
      description: "Faturas · Emissão · Documentos",
      icon: FileText,
      tone: "pink",
      path: canUseFinance ? operationalPath("lancamentos?tab=faturas") : null,
    },
    {
      id: "relatorios",
      title: "Relatórios e indicadores",
      description: "Produção · Vendas · Resultados",
      icon: BarChart3,
      tone: "indigo",
      path: canUseReports ? reportPath : null,
    },
    {
      id: "administracao",
      title: "Administração",
      description: "Usuários · Permissões · Sistema",
      icon: Settings,
      tone: "slate",
      path: canUseAdministration ? "/admin/configuracoes" : null,
    },
  ], [
    canUseAdministration,
    canUseAgenda,
    canUseClients,
    canUseFinance,
    canUseOrders,
    canUsePdv,
    canUseProduction,
    canUseReports,
    operation,
    reportPath,
  ]);

  const sections = [
    { title: "Atendimento", modules: modules.slice(0, 3) },
    { title: "Operação", modules: modules.slice(3, 6) },
    { title: "Gestão", modules: modules.slice(6) },
  ];

  return (
    <PdvLayout
      title="Painel principal do PDV"
      subtitle={`Operação ${operationLabel.toLowerCase()} · módulos autorizados`}
    >
      <section
        className="relative isolate min-h-[calc(100vh-8.5rem)] overflow-hidden rounded-2xl border border-slate-700 bg-[#071d34] p-4 text-white shadow-2xl sm:p-6 lg:p-7"
        aria-labelledby="pdv-module-hub-title"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_8%_0%,rgba(14,165,233,0.18),transparent_32%),radial-gradient(circle_at_90%_8%,rgba(20,184,166,0.14),transparent_28%),linear-gradient(135deg,#061a30_0%,#08233d_50%,#06192d_100%)]" />
        <div className="flex flex-col gap-4 border-b border-white/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-200">AnjoLav · PDV</p>
            <h1 id="pdv-module-hub-title" className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Painel principal
            </h1>
            <p className="mt-1 text-base text-slate-200">Escolha um módulo para continuar o atendimento.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-200/35 bg-sky-300/10 px-3 py-1.5 text-sm font-semibold text-sky-100">
              Operação {operationLabel}
            </span>
            {activeArea === "central" && (
              <Button
                type="button"
                variant="outline"
                className="border-white/35 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                onClick={() => navigate("/admin/visao-geral")}
              >
                Voltar ao administrativo
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm font-medium text-slate-200" role="status">
            Verificando os módulos autorizados…
          </div>
        ) : isError ? (
          <div className="mt-6 rounded-xl border border-rose-300/40 bg-rose-500/10 p-4 text-sm text-rose-100" role="alert">
            Não foi possível verificar as permissões dos módulos. Atualize a página e tente novamente.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {sections.map((section) => (
              <section key={section.title} aria-labelledby={`pdv-section-${section.title}`}>
                <h2
                  id={`pdv-section-${section.title}`}
                  className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-200"
                >
                  {section.title}
                </h2>
                <div className="grid gap-3 lg:grid-cols-4">
                  {section.modules.map((module) => {
                    const Icon = module.icon;
                    const enabled = Boolean(module.path);
                    return (
                      <button
                        key={module.id}
                        type="button"
                        disabled={!enabled}
                        onClick={() => module.path && navigate(module.path)}
                        className={cn(
                          "group relative min-h-36 overflow-hidden rounded-xl bg-gradient-to-br p-5 text-left shadow-lg transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071d34]",
                          toneClasses[module.tone],
                          module.featured && "lg:col-span-2",
                          enabled ? "hover:-translate-y-0.5 hover:shadow-xl" : "cursor-not-allowed opacity-45 grayscale",
                        )}
                        aria-label={enabled ? `Abrir ${module.title}` : `${module.title}: sem permissão`}
                      >
                        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-white/10 blur-2xl transition group-hover:bg-white/20" />
                        <div className="relative flex h-full flex-col justify-between gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <Icon className="h-10 w-10 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                            {module.badge && (
                              <span className="rounded-full border border-white/50 bg-white/10 px-2.5 py-1 text-xs font-bold">
                                {module.badge}
                              </span>
                            )}
                          </div>
                          <div>
                            <h3 className="text-2xl font-black leading-tight tracking-[-0.04em]">{module.title}</h3>
                            <p className="mt-1 text-sm font-medium text-white/85">{module.description}</p>
                            {!enabled && <p className="mt-3 text-xs font-bold uppercase tracking-wide text-white/85">Sem acesso</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </PdvLayout>
  );
}
