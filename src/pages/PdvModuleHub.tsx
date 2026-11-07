import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  FileText,
  Landmark,
  Package,
  ReceiptText,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { PdvLayout } from "@/components/layout/PdvLayout";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { getCanonicalPdvPath, type PdvArea } from "@/lib/authorization";
import { cn } from "@/lib/utils";
import "@/styles/pdv-front.css";

type ModuleTone = "blue" | "teal" | "violet" | "green" | "amber" | "cyan" | "pink" | "indigo" | "slate";

interface PdvModule {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: ModuleTone;
  path: string | null;
  featured?: boolean;
  actionLabel?: string;
}

interface PdvModuleHubProps {
  /** Área definida pela rota canônica da frente operacional. */
  operation?: PdvArea;
}

const PDV_AREAS: readonly PdvArea[] = ["residencial", "industrial"];

export default function PdvModuleHub({ operation: operationFromRoute }: PdvModuleHubProps) {
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
  const operationalCandidates = [operationFromRoute, requestedOperation, workspaceOperation, ...PDV_AREAS]
    .filter((area): area is PdvArea => area !== null && area !== undefined);
  const operation = operationalCandidates.find((area) => (
    canAccessRoute(`/${area}/caixa`)
    || canAccessRoute(`/${area}/ordens`)
    || canAccessRoute(`/${area}/agenda`)
    || canAccessRoute(`/${area}/clientes`)
  )) ?? operationFromRoute ?? requestedOperation ?? workspaceOperation ?? "residencial";

  const operationLabel = operation === "industrial" ? "Industrial" : "Doméstica";
  const operationalPath = (suffix = "") => {
    const root = getCanonicalPdvPath(operation);
    return suffix ? `${root}/${suffix}` : root;
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

  const modules = useMemo<PdvModule[]>(() => [
    {
      id: "balcao",
      title: "Balcão / PDV",
      description: "Atendimento · ROLs · Pagamentos",
      icon: ShoppingCart,
      tone: "blue",
      path: canUsePdv ? operationalPath() : null,
      featured: true,
      actionLabel: "Novo atendimento",
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
      description: "Embalagem · Prateleiras",
      icon: Package,
      tone: "amber",
      path: canUseOrders ? operationalPath("ordens?status=abertas") : null,
    },
    {
      id: "logistica",
      title: "Entregas e coletas",
      description: "Rotas · Agendamentos",
      icon: Truck,
      tone: "cyan",
      path: canUseAgenda ? operationalPath("agenda?view=rotas") : null,
    },
    {
      id: "financeiro",
      title: "Financeiro",
      description: "Caixa · Cobranças · Boletos",
      icon: Landmark,
      tone: "green",
      path: canUseFinance ? operationalPath("lancamentos?tab=pendentes") : null,
    },
    {
      id: "fiscal",
      title: "Fiscal",
      description: "Notas fiscais · Emissão",
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
      id: "fechamento",
      title: "Caixa e fechamento",
      description: "Sangrias · Suprimentos · Fechamento",
      icon: ReceiptText,
      tone: "slate",
      path: canUsePdv ? operationalPath() : null,
    },
  ], [
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
      variant="front"
      operation={operation}
      title="Painel principal"
      subtitle={`Operação ${operationLabel.toLowerCase()} · módulos autorizados`}
    >
      <section className="pdv-front" aria-labelledby="pdv-module-hub-title" data-testid="pdv-front-office">
        <div className="pdv-front-heading">
          <div>
            <h1 id="pdv-module-hub-title">Painel principal</h1>
            <p>Selecione um módulo para começar</p>
          </div>
          <span className="pdv-front-context">Operação {operationLabel}</span>
        </div>

        {isLoading ? (
          <div className="pdv-front-state" role="status">Verificando os módulos autorizados…</div>
        ) : isError ? (
          <div className="pdv-front-state pdv-front-state--error" role="alert">
            Não foi possível verificar as permissões dos módulos. Atualize a página e tente novamente.
          </div>
        ) : (
          <div className="pdv-front-sections">
            {sections.map((section) => (
              <section key={section.title} className="pdv-front-section" aria-labelledby={`pdv-section-${section.title}`}>
                <h2 id={`pdv-section-${section.title}`}>{section.title}</h2>
                <div className="pdv-front-module-grid">
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
                          "pdv-front-tile",
                          `pdv-front-tile--${module.tone}`,
                          module.featured && "pdv-front-tile--featured",
                          !enabled && "pdv-front-tile--disabled",
                        )}
                        aria-label={enabled ? `Abrir ${module.title}` : `${module.title}: sem permissão`}
                      >
                        <Icon className="pdv-front-tile-icon" strokeWidth={1.9} aria-hidden="true" />
                        <div className="pdv-front-tile-copy">
                          <h3>{module.title}</h3>
                          <p>{module.description}</p>
                        </div>
                        {module.actionLabel && (
                          <span className="pdv-front-tile-action">
                            {module.actionLabel}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        )}
                        {!enabled && <span className="pdv-front-tile-lock">Sem acesso</span>}
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
