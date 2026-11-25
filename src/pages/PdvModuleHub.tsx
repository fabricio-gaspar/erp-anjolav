import { useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Gauge,
  LockOpen,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { PdvLayout } from "@/components/layout/PdvLayout";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useAgendaDia, useMetricasProducao } from "@/hooks/useHistoricoProducao";
import { useListaDiaRols } from "@/hooks/useListaDiaRols";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import { type ListaDiaFiltros } from "@/lib/listaDiaRols";
import { getCanonicalPdvPath, type PdvArea } from "@/lib/authorization";
import "@/styles/pdv-front.css";

interface PdvModuleHubProps {
  operation?: PdvArea;
}

const PDV_AREAS: readonly PdvArea[] = ["residencial", "industrial"];

export default function PdvModuleHub({ operation: operationFromRoute }: PdvModuleHubProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const { canAccessRoute, isLoading, isError } = useNavigationAccess();
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [cashClosedByOperator, setCashClosedByOperator] = useState(false);

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

  const operationalPath = useCallback((suffix = "") => {
    const root = getCanonicalPdvPath(operation);
    return suffix ? `${root}/${suffix}` : root;
  }, [operation]);

  const canUsePdv = canAccessRoute(`/${operation}/caixa`);
  const {
    data: caixaAberto,
    isLoading: isLoadingCaixa,
    isError: isOpenCashError,
    refetch: refetchOpenCash,
  } = useCaixaAberto(canUsePdv && !isLoading);
  const canUseOrders = canAccessRoute(`/${operation}/ordens`);
  const canUseProduction = canAccessRoute(`/${operation}/producao`);
  const canUseAgenda = canAccessRoute(`/${operation}/agenda`);

  const today = format(new Date(), "yyyy-MM-dd");
  const dailyColetaFilters = useMemo<ListaDiaFiltros>(() => ({
    tipoRelatorio: "coleta",
    dataEntradaInicio: "",
    dataEntradaFim: "",
    previsaoInicio: today,
    previsaoFim: today,
    modelo: "sem_valor",
    situacao: "todos",
    numeroRol: "",
    clienteId: "",
  }), [today]);
  const { metricas: productionMetrics, isLoading: isLoadingProductionMetrics } = useMetricasProducao(
    !isLoading && (canUseOrders || canUseProduction),
  );
  const {
    entregas = [],
    retiradas = [],
    isLoading: isLoadingAgenda,
  } = useAgendaDia(!isLoading && canUseAgenda, today, today);
  const { data: dailyColetas, isLoading: isLoadingColetas } = useListaDiaRols(
    dailyColetaFilters,
    !isLoading && canUseOrders,
  );

  const indicators = [
    { label: "Entregas hoje", value: entregas.length, icon: Package },
    { label: "Em produção", value: productionMetrics?.osEmAberto ?? 0, icon: Gauge },
    { label: "Aguardando retirada", value: retiradas.length, icon: ShoppingCart },
    { label: "Coletas pendentes", value: dailyColetas?.totalEncontrado ?? dailyColetas?.rols.length ?? 0, icon: Truck },
  ];
  const isLoadingIndicators = isLoadingAgenda || isLoadingProductionMetrics || isLoadingColetas;
  const waitingForCash = canUsePdv
    && !cashClosedByOperator
    && !isLoading
    && !isLoadingCaixa
    && !caixaAberto
    && !isOpenCashError;

  return (
    <PdvLayout variant="front" operation={operation} title="Painel principal">
      <section className="pdv-front" aria-labelledby="pdv-module-hub-title" data-testid="pdv-front-office">
        <div className="pdv-front-heading">
          <div>
            <h1 id="pdv-module-hub-title">Central de operações</h1>
          <p>Resumo da operação e entrada rápida no PDV.</p>
          </div>
          <time className="pdv-front-date" dateTime={new Date().toISOString()}>
            <CalendarDays aria-hidden="true" />
            {format(new Date(), "d MMM yyyy", { locale: ptBR })}
          </time>
        </div>

        {isLoading ? (
          <div className="pdv-front-state" role="status">Verificando os módulos autorizados…</div>
        ) : isError ? (
          <div className="pdv-front-state pdv-front-state--error" role="alert">
            Não foi possível verificar as permissões dos módulos. Atualize a página e tente novamente.
          </div>
        ) : isOpenCashError ? (
          <div className="pdv-front-state pdv-front-state--error" role="alert">
            <p>Não foi possível consultar o caixa compartilhado.</p>
            <button type="button" className="pdv-front-state-action" onClick={() => void refetchOpenCash()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
            </button>
          </div>
        ) : cashClosedByOperator ? (
          <div className="pdv-front-cash-gate" role="status">
            <div className="pdv-front-cash-gate-icon" aria-hidden="true"><LockOpen className="h-7 w-7" /></div>
            <div>
              <h2>Caixa fechado</h2>
              <p>O caixa do dia foi encerrado. Abra um novo caixa quando iniciar o próximo expediente.</p>
              <button type="button" className="pdv-front-cash-gate-action" onClick={() => { setCashClosedByOperator(false); setShowAbrirCaixa(true); }}>
                Abrir caixa do dia
              </button>
            </div>
          </div>
        ) : waitingForCash ? (
          <div className="pdv-front-cash-gate" role="status">
            <div className="pdv-front-cash-gate-icon" aria-hidden="true"><LockOpen className="h-7 w-7" /></div>
            <div>
              <h2>Abra o caixa para iniciar o atendimento</h2>
              <p>O caixa é compartilhado entre os usuários autorizados desta empresa. A abertura acontece uma única vez no início do dia.</p>
              <button type="button" className="pdv-front-cash-gate-action" onClick={() => setShowAbrirCaixa(true)}>
                Abrir caixa do dia
              </button>
            </div>
          </div>
        ) : (
          <div className="pdv-front-content">
            <div className="pdv-front-indicators" aria-label="Indicadores operacionais">
              {indicators.map((indicator) => {
                const Icon = indicator.icon;
                return (
                  <div key={indicator.label} className="pdv-front-indicator">
                    <Icon aria-hidden="true" />
                    <span><small>{indicator.label}</small><strong>{isLoadingIndicators ? "—" : indicator.value.toString().padStart(2, "0")}</strong></span>
                  </div>
                );
              })}
            </div>
            <section className="pdv-front-launch" aria-labelledby="pdv-front-launch-title">
              <div className="pdv-front-launch-copy">
                <span className="pdv-front-launch-icon" aria-hidden="true"><ShoppingCart /></span>
                <div>
                  <h2 id="pdv-front-launch-title">Atendimento</h2>
                  <p>Abra o PDV e fixe somente os módulos que sua operação precisa.</p>
                </div>
              </div>
              <button
                type="button"
                className="pdv-front-launch-action"
                disabled={!canUsePdv}
                onClick={() => navigate(operationalPath())}
                aria-label={canUsePdv ? "Abrir novo atendimento no PDV" : "PDV sem permissão"}
              >
                Novo atendimento / PDV <ArrowRight aria-hidden="true" />
              </button>
            </section>
            <p className="pdv-front-launch-hint">Atalhos e módulos adicionais ficam dentro do atendimento, no menu “Módulos”.</p>
            <footer className="pdv-front-footer">AnjoLav ERP <span aria-hidden="true">•</span> Ambiente {operation === "industrial" ? "Industrial" : "Doméstico"}</footer>
          </div>
        )}
      </section>
      <AbrirCaixaModal open={showAbrirCaixa || waitingForCash} onOpenChange={setShowAbrirCaixa} mandatory={waitingForCash} />
      {caixaAberto && (
        <FecharCaixaModal
          open={showFecharCaixa}
          onOpenChange={setShowFecharCaixa}
          onClosed={() => { setShowFecharCaixa(false); setCashClosedByOperator(true); }}
          caixa={caixaAberto}
        />
      )}
    </PdvLayout>
  );
}
