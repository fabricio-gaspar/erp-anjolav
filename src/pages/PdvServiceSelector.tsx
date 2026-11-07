import { ArrowLeft, ArrowRight, Calculator, ClipboardList, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PdvLayout } from "@/components/layout/PdvLayout";
import type { PdvArea } from "@/lib/authorization";
import { cn } from "@/lib/utils";
import "@/styles/pdv-service-selector.css";

interface PdvServiceSelectorProps {
  operation: PdvArea;
}

const OPTIONS = [
  {
    id: "rol",
    title: "ROL",
    description: "Novo atendimento de balcão com peças, serviços, prazo, pagamento e impressão.",
    helper: "Atendimento completo",
    icon: ClipboardList,
    tone: "blue",
  },
  {
    id: "delivery",
    title: "Delivery",
    description: "Coleta e entrega no endereço do cliente com agenda, capacidade e rota.",
    helper: "Coleta e entrega",
    icon: Truck,
    tone: "teal",
  },
  {
    id: "orcamento",
    title: "Orçamento",
    description: "Monte e salve uma proposta sem gerar cobrança ou movimentação de caixa.",
    helper: "Proposta comercial",
    icon: Calculator,
    tone: "violet",
  },
] as const;

export default function PdvServiceSelector({ operation }: PdvServiceSelectorProps) {
  const navigate = useNavigate();
  const root = operation === "industrial" ? "/pdv/industrial" : "/pdv/domestico";
  const operationLabel = operation === "industrial" ? "Industrial" : "Doméstica";

  return (
    <PdvLayout
      variant="front"
      operation={operation}
      title="Balcão / PDV"
      subtitle={`Operação ${operationLabel.toLowerCase()}`}
    >
      <main className="pdv-service-selector" data-testid="pdv-service-selector">
        <button
          type="button"
          className="pdv-service-selector__back"
          onClick={() => navigate(operation === "industrial" ? "/pdv/painel/industrial" : "/pdv/painel/domestico")}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel principal
        </button>

        <header className="pdv-service-selector__heading">
          <div>
            <span className="pdv-service-selector__eyebrow">Balcão / PDV</span>
            <h1>Como deseja iniciar o atendimento?</h1>
            <p>Escolha o tipo de operação. O atendente permanecerá no PDV durante todo o fluxo.</p>
          </div>
          <span className="pdv-service-selector__context">Operação {operationLabel}</span>
        </header>

        <section className="pdv-service-selector__grid" aria-label="Tipos de atendimento">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`pdv-service-${option.id}`}
                className={cn("pdv-service-card", `pdv-service-card--${option.tone}`)}
                onClick={() => navigate(`${root}/${option.id}`)}
              >
                <span className="pdv-service-card__icon"><Icon aria-hidden="true" /></span>
                <span className="pdv-service-card__copy">
                  <small>{option.helper}</small>
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </span>
                <span className="pdv-service-card__action">Iniciar <ArrowRight className="h-4 w-4" /></span>
              </button>
            );
          })}
        </section>
      </main>
    </PdvLayout>
  );
}
