import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  Factory,
  FileText,
  Package,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { cn } from "@/lib/utils";

type OperationalArea = "industrial" | "residencial";

interface OperationalTile {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  tone: "blue" | "cyan" | "green" | "purple" | "orange" | "indigo";
  requiredRoute: string;
}

const TONE_CLASSES: Record<OperationalTile["tone"], string> = {
  blue: "from-[#0e8ee8] to-[#0874ce]",
  cyan: "from-[#10b7c5] to-[#087f9a]",
  green: "from-[#0aa97a] to-[#087a67]",
  purple: "from-[#8450c6] to-[#6233a3]",
  orange: "from-[#ef9715] to-[#d26e08]",
  indigo: "from-[#4a6fc7] to-[#2d4b9f]",
};

function getTiles(area: OperationalArea): Array<{ group: string; items: OperationalTile[] }> {
  const pdvPath = area === "industrial" ? "/pdv/industrial" : "/pdv/domestico";
  const reportPath = area === "industrial"
    ? "/industrial/relatorios/clientes"
    : "/residencial/relatorios/caixa";

  return [
    {
      group: "Atendimento",
      items: [
        {
          id: "pdv",
          label: "Balcão PDV",
          description: "Abra um ROL e atenda sem sair do pedido.",
          to: pdvPath,
          requiredRoute: `/${area}/caixa`,
          icon: ShoppingCart,
          tone: "blue",
        },
        {
          id: "ordens",
          label: "ROLs e pedidos",
          description: "Consulte, acompanhe e trate os pedidos.",
          to: `/${area}/ordens`,
          requiredRoute: `/${area}/ordens`,
          icon: ClipboardList,
          tone: "cyan",
        },
        {
          id: "clientes",
          label: "Clientes",
          description: "Cadastre e consulte clientes da operação.",
          to: `/${area}/clientes`,
          requiredRoute: `/${area}/clientes`,
          icon: Users,
          tone: "purple",
        },
        {
          id: "produtos",
          label: "Peças e serviços",
          description: "Consulte produtos, serviços e preços autorizados.",
          to: `/${area}/produtos`,
          requiredRoute: `/${area}/produtos`,
          icon: Package,
          tone: "indigo",
        },
      ],
    },
    {
      group: "Operação",
      items: [
        {
          id: "agenda",
          label: "Agenda e rotas",
          description: "Organize coletas, entregas e capacidade.",
          to: `/${area}/agenda`,
          requiredRoute: `/${area}/agenda`,
          icon: CalendarDays,
          tone: "green",
        },
        {
          id: "producao",
          label: "Produção",
          description: "Acompanhe etapas, prioridades e pendências.",
          to: `/${area}/producao`,
          requiredRoute: `/${area}/producao`,
          icon: Factory,
          tone: "orange",
        },
        ...(area === "industrial"
          ? [{
              id: "estoque",
              label: "Estoque",
              description: "Controle insumos e movimentações da operação.",
              to: "/industrial/estoque",
              requiredRoute: "/industrial/estoque",
              icon: Boxes,
              tone: "cyan" as const,
            }]
          : [{
              id: "entregas",
              label: "Entrega e retirada",
              description: "Consulte a programação de atendimento do dia.",
              to: "/residencial/agenda",
              requiredRoute: "/residencial/agenda",
              icon: Truck,
              tone: "cyan" as const,
            }]),
      ],
    },
    {
      group: "Financeiro operacional",
      items: [
        {
          id: "financeiro",
          label: "Financeiro",
          description: "Acompanhe recebimentos e indicadores permitidos.",
          to: `/${area}/financeiro`,
          requiredRoute: `/${area}/financeiro`,
          icon: WalletCards,
          tone: "green",
        },
        {
          id: "fechamento",
          label: "Fechamento e histórico",
          description: "Veja ROLs pendentes, faturas e histórico.",
          to: `/${area}/lancamentos`,
          requiredRoute: `/${area}/lancamentos`,
          icon: FileText,
          tone: "blue",
        },
        {
          id: "relatorios",
          label: "Relatórios",
          description: "Acesse os demonstrativos liberados ao seu perfil.",
          to: reportPath,
          requiredRoute: reportPath,
          icon: BarChart3,
          tone: "purple",
        },
      ],
    },
  ];
}

/**
 * Entry screen for store and industrial operators. It deliberately keeps
 * administrative routes out of the operational menu; access is still checked
 * by the destination's ProtectedRoute.
 */
export function OperationalDashboard() {
  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const { funcionario } = useAuth();
  const { canAccessRoute, isLoading } = useNavigationAccess();
  const area: OperationalArea = activeArea === "industrial" ? "industrial" : "residencial";
  const areaLabel = area === "industrial" ? "Industrial" : "Doméstico";
  const groups = getTiles(area);
  const firstName = funcionario?.nome?.trim().split(/\s+/)[0];

  return (
    <AppLayout
      title="Painel operacional"
      subtitle={`Atalhos autorizados da operação ${areaLabel.toLowerCase()}`}
    >
      <section
        aria-labelledby="operational-dashboard-title"
        className="min-h-[calc(100vh-64px)] bg-[#062443] px-4 py-7 text-white sm:px-8 sm:py-10 lg:px-12"
      >
        <div className="mx-auto w-full max-w-[1540px]">
          <div className="mb-9 flex flex-col gap-3 border-b border-white/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#87d7ff]">Operação {areaLabel}</p>
              <h2 id="operational-dashboard-title" className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                {firstName ? `Olá, ${firstName}` : "Painel principal"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                Escolha uma atividade para continuar. Somente recursos autorizados para o seu perfil são exibidos.
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-[#4cc3f1]/40 bg-[#0e3d67] px-3 py-1.5 text-xs font-bold text-[#b9e7ff]">
              Ambiente operacional
            </span>
          </div>

          {groups.map((group) => {
            const visibleTiles = group.items.filter((tile) => isLoading || canAccessRoute(tile.requiredRoute));
            if (visibleTiles.length === 0) return null;

            return (
              <section key={group.group} className="mb-8" aria-label={`${group.group} — atalhos operacionais`}>
                <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#91cbed]">
                  {group.group}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {visibleTiles.map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => navigate(tile.to)}
                        disabled={isLoading}
                        className={cn(
                          "group relative min-h-[144px] overflow-hidden rounded-sm bg-gradient-to-br p-5 text-left shadow-[0_12px_30px_rgba(0,0,0,0.18)] transition duration-200",
                          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-70",
                          "hover:-translate-y-0.5 hover:brightness-110",
                          TONE_CLASSES[tile.tone],
                        )}
                      >
                        <Icon className="h-9 w-9 text-white" strokeWidth={1.8} />
                        <p className="mt-5 pr-7 text-lg font-black tracking-[-0.025em]">{tile.label}</p>
                        <p className="mt-1 max-w-[22rem] text-xs leading-5 text-white/85">{tile.description}</p>
                        <ArrowRight className="absolute bottom-5 right-5 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {!isLoading && groups.every((group) => group.items.every((tile) => !canAccessRoute(tile.requiredRoute))) && (
            <div className="rounded-lg border border-white/20 bg-white/10 p-5 text-sm text-slate-100">
              Seu perfil ainda não possui atividades operacionais liberadas. Solicite a revisão de acesso ao administrador.
            </div>
          )}
        </div>
      </section>
    </AppLayout>
  );
}
