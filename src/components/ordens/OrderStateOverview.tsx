import { AlertTriangle, Banknote, ClipboardCheck, ReceiptText, ShieldCheck, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type BadgeVariant = "info" | "success" | "warning" | "danger" | "default";

interface StateDefinition {
  label: string;
  variant: BadgeVariant;
}

const operationalStates: Record<string, StateDefinition> = {
  retirada: { label: "Recebimento", variant: "info" },
  separacao: { label: "Conferência", variant: "warning" },
  lavagem: { label: "Lavagem", variant: "warning" },
  secagem: { label: "Secagem", variant: "warning" },
  passadoria: { label: "Acabamento", variant: "warning" },
  embalagem: { label: "Embalagem", variant: "info" },
  expedicao: { label: "Disponível", variant: "success" },
  entregue: { label: "Concluído", variant: "success" },
  cancelada: { label: "Cancelado", variant: "danger" },
};

const paymentStates: Record<string, StateDefinition> = {
  pendente: { label: "Pendente", variant: "warning" },
  parcial: { label: "Parcial", variant: "info" },
  pago: { label: "Pago", variant: "success" },
};

const qualityStates: Record<string, StateDefinition> = {
  nao_iniciada: { label: "Não iniciada", variant: "default" },
  em_analise: { label: "Em análise", variant: "info" },
  aprovada: { label: "Aprovada", variant: "success" },
  com_pendencias: { label: "Com pendências", variant: "warning" },
};

const logisticsStates: Record<string, StateDefinition> = {
  nao_iniciada: { label: "Não iniciada", variant: "default" },
  aguardando_coleta: { label: "Aguardando coleta", variant: "warning" },
  coletado: { label: "Coletado", variant: "info" },
  aguardando_entrega: { label: "Aguardando entrega", variant: "warning" },
  em_rota: { label: "Em rota", variant: "info" },
  entrega_parcial: { label: "Entrega parcial", variant: "warning" },
  entregue: { label: "Entregue", variant: "success" },
  tentativa_falha: { label: "Tentativa sem sucesso", variant: "danger" },
  cancelada: { label: "Cancelada", variant: "danger" },
};

const fiscalStates: Record<string, StateDefinition> = {
  nao_aplicavel: { label: "Não aplicável", variant: "default" },
  pendente: { label: "Pendente", variant: "warning" },
  emitida: { label: "Emitida", variant: "success" },
  cancelada: { label: "Cancelada", variant: "danger" },
};

interface OrderStateOverviewProps {
  operationalStatus: string;
  paymentStatus?: string | null;
  qualityStatus?: string | null;
  logisticsStatus?: string | null;
  fiscalStatus?: string | null;
  totalValue?: number | null;
  paidValue?: number | null;
}

function stateFor(states: Record<string, StateDefinition>, value: string | null | undefined) {
  return states[value || ""] || { label: value || "Não definido", variant: "default" as const };
}

export function OrderStateOverview({
  operationalStatus,
  paymentStatus,
  qualityStatus,
  logisticsStatus,
  fiscalStatus,
  totalValue,
  paidValue,
}: OrderStateOverviewProps) {
  const operational = stateFor(operationalStates, operationalStatus);
  const payment = stateFor(paymentStates, paymentStatus || "pendente");
  const quality = stateFor(qualityStates, qualityStatus || "nao_iniciada");
  const logistics = stateFor(logisticsStates, logisticsStatus || "nao_iniciada");
  const fiscal = stateFor(fiscalStates, fiscalStatus || "nao_aplicavel");
  const pendingValue = Math.max(Number(totalValue || 0) - Number(paidValue || 0), 0);
  const hasBlocker = qualityStatus === "com_pendencias" || logisticsStatus === "tentativa_falha";

  const states = [
    { title: "Operação", icon: ClipboardCheck, state: operational, detail: "Etapa atual do serviço" },
    {
      title: "Pagamento",
      icon: Banknote,
      state: payment,
      detail: pendingValue > 0 ? `Saldo de R$ ${pendingValue.toFixed(2).replace(".", ",")}` : "Sem saldo pendente",
    },
    {
      title: "Qualidade",
      icon: ShieldCheck,
      state: quality,
      detail: qualityStatus === "com_pendencias" ? "Há itens retidos ou em retrabalho" : "Controle por item",
    },
    {
      title: "Logística",
      icon: Truck,
      state: logistics,
      detail: logisticsStatus === "entrega_parcial" ? "Ainda há itens sob responsabilidade" : "Entrega independente da produção",
    },
    {
      title: "Fiscal",
      icon: ReceiptText,
      state: fiscal,
      detail: "Documento fiscal não altera o fluxo operacional",
    },
  ];

  return (
    <section aria-label="Situação do pedido" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Situação do pedido</h3>
          <p className="text-xs text-muted-foreground">Cada dimensão avança sem apagar as demais.</p>
        </div>
        {hasBlocker && (
          <div className="flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> Requer atenção
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {states.map(({ title, icon: Icon, state, detail }) => (
          <Card key={title} className={cn("border-border/70 shadow-none", state.variant === "warning" && "border-warning/30")}>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
                <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
                <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
