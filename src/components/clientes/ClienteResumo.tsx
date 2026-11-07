import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageSquareWarning,
  Phone,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useClientProfile } from "@/hooks/useClientProfile";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatClientAddress } from "@/lib/clientAddress";
import { CLIENT_PRICE_MODE_LABELS, normalizeClientPriceMode } from "@/lib/clientPricing";
import {
  CLIENT_ORDER_STATUS_LABELS,
  CLIENT_PAYMENT_CONDITION_LABELS,
  CLIENT_PAYMENT_METHOD_LABELS,
  CLIENT_PAYMENT_STATUS_LABELS,
  deriveClientProfileNextAction,
  type ClientProfileTab,
} from "@/lib/clientProfile";
import { cn } from "@/lib/utils";

interface ClienteResumoProps {
  clienteId: string | null;
  onOpenTab: (tab: ClientProfileTab) => void;
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const actionTone = {
  default: "border-primary/20 bg-primary/5",
  warning: "border-amber-200 bg-amber-50/70",
  danger: "border-destructive/25 bg-destructive/5",
  success: "border-emerald-200 bg-emerald-50/70",
};

const actionIcon = {
  default: ClipboardList,
  warning: AlertTriangle,
  danger: ShieldAlert,
  success: CheckCircle2,
};

function formatDate(value: string | null, pattern = "dd MMM yyyy") {
  if (!value) return "Sem data";
  return format(parseISO(value), pattern, { locale: ptBR });
}

function getOrderBadgeVariant(status: string) {
  if (status === "entregue") return "success" as const;
  if (status === "cancelada") return "danger" as const;
  if (status === "expedicao") return "info" as const;
  return "warning" as const;
}

function getPaymentBadgeVariant(status: string) {
  if (status === "pago") return "success" as const;
  if (status === "cancelado") return "danger" as const;
  if (status === "parcial") return "warning" as const;
  return "default" as const;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  restricted = false,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  detail: string;
  restricted?: boolean;
}) {
  return (
    <Card className="min-w-0 border-border/70 shadow-none">
      <CardContent className="flex min-w-0 items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-1 truncate text-xl font-bold tabular-nums", restricted && "text-muted-foreground")}>{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RestrictedBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      <ShieldAlert className="mx-auto mb-2 h-5 w-5" />
      {children}
    </div>
  );
}

function EmptyBlock({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function ClienteResumo({ clienteId, onOpenTab }: ClienteResumoProps) {
  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const { data: profile, isLoading, isError, refetch } = useClientProfile(clienteId);

  if (!clienteId) {
    return <EmptyBlock>Salve os dados básicos para abrir a ficha completa do cliente.</EmptyBlock>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Carregando ficha do cliente…
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="content-panel flex min-h-64 flex-col items-center justify-center gap-3 text-center" role="alert">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-semibold">Não foi possível carregar a ficha do cliente</p>
          <p className="mt-1 text-sm text-muted-foreground">Nenhum total foi exibido como zero. Tente novamente para recuperar os dados autorizados.</p>
        </div>
        <Button variant="outline" onClick={() => void refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
        </Button>
      </div>
    );
  }

  const nextAction = deriveClientProfileNextAction(profile);
  const ActionIcon = actionIcon[nextAction.tone];
  const operationArea = activeArea === "central" ? profile.customer.classification : activeArea;
  const ordersPath = `/${operationArea}/ordens`;
  const financePath = activeArea === "central" ? "/central/financeiro" : `/${operationArea}/financeiro`;
  const orderSummary = profile.orders.summary;
  const financeSummary = profile.finance.summary;
  const primaryAddress = profile.addresses.primary;
  const formattedAddress = primaryAddress
    ? formatClientAddress({
      logradouro: primaryAddress.street,
      numero: primaryAddress.number,
      complemento: primaryAddress.complement,
      bairro: primaryAddress.neighborhood,
      cidade: primaryAddress.city,
      uf: primaryAddress.state,
    })
    : null;

  const openClientOrders = (lateOnly = false) => {
    const params = new URLSearchParams({ cliente: profile.customer.legalName });
    if (lateOnly) params.set("prazo", "atrasado");
    navigate(`${ordersPath}?${params.toString()}`);
  };

  const handleNextAction = () => {
    if (nextAction.tab) onOpenTab(nextAction.tab);
    else if (nextAction.openOrders) openClientOrders(nextAction.tone === "danger");
    else if (profile.finance.allowed && financeSummary?.overdueInvoiceCount) navigate(financePath);
  };

  const hasNextActionTarget = Boolean(
    nextAction.tab
      || nextAction.openOrders
      || (profile.finance.allowed && financeSummary?.overdueInvoiceCount),
  );

  return (
    <div className="pdv-client-profile space-y-4" data-testid="client-profile">
      <section className={cn("flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between", actionTone[nextAction.tone])}>
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/80">
            <ActionIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Próxima ação</p>
            <h3 className="mt-1 font-semibold text-foreground">{nextAction.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
          </div>
        </div>
        {hasNextActionTarget && (
          <Button variant="outline" className="w-full shrink-0 bg-background/80 sm:w-auto" onClick={handleNextAction}>
            Resolver agora<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </section>

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do cliente">
        <MetricCard
          icon={ClipboardList}
          label="Pedidos em aberto"
          value={profile.orders.allowed && orderSummary ? String(orderSummary.open) : "Restrito"}
          detail={profile.orders.allowed && orderSummary ? `${orderSummary.late} fora do prazo` : "Seu perfil não consulta pedidos"}
          restricted={!profile.orders.allowed}
        />
        <MetricCard
          icon={WalletCards}
          label="Saldo dos pedidos"
          value={profile.orders.allowed && orderSummary ? money.format(orderSummary.openBalance) : "Restrito"}
          detail={profile.orders.allowed && orderSummary ? `${orderSummary.pendingPayment} com pagamento pendente` : "Seu perfil não consulta recebimentos"}
          restricted={!profile.orders.allowed}
        />
        <MetricCard
          icon={ReceiptText}
          label="Saldo faturado"
          value={profile.finance.allowed && financeSummary ? money.format(financeSummary.openBalance) : "Restrito"}
          detail={profile.finance.allowed && financeSummary ? `${financeSummary.overdueInvoiceCount} faturas vencidas` : "Disponível para perfis financeiros"}
          restricted={!profile.finance.allowed}
        />
        <MetricCard
          icon={MapPin}
          label="Endereços ativos"
          value={String(profile.addresses.activeCount)}
          detail={primaryAddress ? `${primaryAddress.name || "Principal"} • ${primaryAddress.type}` : "Nenhum endereço principal"}
        />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <Card className="min-w-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Contato e identificação</CardTitle>
                  <CardDescription>Dados úteis para atendimento e comunicação.</CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onOpenTab("dados")}>Editar</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <ContactLine icon={UserRound} label={profile.customer.contactName || profile.customer.tradeName || "Sem contato indicado"} />
              <ContactLine icon={Phone} label={profile.customer.phone || "Sem telefone"} />
              <ContactLine icon={Mail} label={profile.customer.email || "Sem e-mail"} />
              <ContactLine icon={FileText} label={profile.customer.document || "Documento não informado"} />
              {profile.customer.notes && <p className="sm:col-span-2 rounded-lg bg-muted/30 p-3 leading-6 text-muted-foreground">{profile.customer.notes}</p>}
            </CardContent>
          </Card>

          <Card className="min-w-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Endereço principal</CardTitle>
                  <CardDescription>Referência para novos pedidos e operações.</CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onOpenTab("endereco")}>Gerenciar</Button>
              </div>
            </CardHeader>
            <CardContent>
              {primaryAddress ? (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge variant="info">{primaryAddress.type}</StatusBadge>
                    {primaryAddress.name && <span className="font-medium">{primaryAddress.name}</span>}
                  </div>
                  <p className="break-words leading-6 text-foreground">{formattedAddress}</p>
                  {primaryAddress.instructions && <p className="rounded-lg bg-muted/30 p-3 leading-6 text-muted-foreground">{primaryAddress.instructions}</p>}
                </div>
              ) : (
                <EmptyBlock>Nenhum endereço ativo. Cadastre apenas quando a operação exigir coleta, entrega ou faturamento.</EmptyBlock>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Condição comercial</CardTitle>
                  <CardDescription>Preferências não comprovam pagamento nem autorizam crédito sozinhas.</CardDescription>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onOpenTab("pagamento")}>Editar</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <KeyValue label="Condição" value={profile.commercialTerms.condition ? CLIENT_PAYMENT_CONDITION_LABELS[profile.commercialTerms.condition] || profile.commercialTerms.condition : "Não configurada"} />
              <KeyValue label="Método preferido" value={profile.commercialTerms.preferredMethod ? CLIENT_PAYMENT_METHOD_LABELS[profile.commercialTerms.preferredMethod] || profile.commercialTerms.preferredMethod : "Não definido"} />
              <KeyValue label="Tabela de preços" value={CLIENT_PRICE_MODE_LABELS[normalizeClientPriceMode(profile.commercialTerms.priceTable)]} />
              <div className="border-t pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">Contrato ativo</span>
                  <span className="font-medium">{profile.contract?.description || "Sem contrato ativo"}</span>
                </div>
                {profile.contract && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Desde {formatDate(profile.contract.startDate)} • faturamento {profile.contract.billingAuthorized ? "autorizado" : "não autorizado"}
                  </p>
                )}
                <Button variant="link" className="mt-1 h-auto px-0" onClick={() => onOpenTab("contrato")}>Abrir contrato</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="min-w-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Pedidos recentes</CardTitle>
                  <CardDescription>Operação, prazo e pagamento no mesmo recorte autorizado.</CardDescription>
                </div>
                {profile.orders.allowed && <Button size="sm" variant="outline" onClick={() => openClientOrders()}>Ver todos</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {!profile.orders.allowed ? (
                <RestrictedBlock>Seu perfil não possui acesso ao histórico de pedidos.</RestrictedBlock>
              ) : profile.orders.recent.length === 0 ? (
                <EmptyBlock>Nenhum pedido encontrado para este cliente.</EmptyBlock>
              ) : (
                <div className="divide-y">
                  {profile.orders.recent.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      className="flex min-h-20 w-full min-w-0 flex-col gap-2 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between sm:px-2"
                      onClick={() => navigate(`${ordersPath}?id=${order.id}`)}
                      aria-label={`Abrir pedido ${order.number}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">Pedido {order.number}</span>
                          <StatusBadge variant={getOrderBadgeVariant(order.status)}>{CLIENT_ORDER_STATUS_LABELS[order.status] || order.status}</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Previsão {formatDate(order.promisedDate, "dd/MM/yyyy")} • {CLIENT_PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-semibold tabular-nums">{money.format(order.totalValue)}</p>
                        {order.openBalance > 0 && <p className="text-xs text-muted-foreground">Saldo {money.format(order.openBalance)}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Financeiro e pagamentos</CardTitle>
                  <CardDescription>Faturas e recebimentos preservados no ledger financeiro.</CardDescription>
                </div>
                {profile.finance.allowed && <Button size="sm" variant="outline" onClick={() => navigate(financePath)}>Abrir financeiro</Button>}
              </div>
            </CardHeader>
            <CardContent>
              {!profile.finance.allowed ? (
                <RestrictedBlock>Valores financeiros estão disponíveis apenas para perfis autorizados.</RestrictedBlock>
              ) : profile.finance.recentInvoices.length === 0 ? (
                <EmptyBlock>Nenhuma fatura registrada para este cliente.</EmptyBlock>
              ) : (
                <div className="space-y-3">
                  {profile.finance.recentInvoices.slice(0, 3).map((invoice) => (
                    <div key={invoice.id} className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{formatDate(invoice.periodStart, "dd/MM")}–{formatDate(invoice.periodEnd, "dd/MM/yyyy")}</span>
                          <StatusBadge variant={getPaymentBadgeVariant(invoice.paymentStatus)}>{CLIENT_PAYMENT_STATUS_LABELS[invoice.paymentStatus] || invoice.paymentStatus}</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Vencimento {formatDate(invoice.dueDate, "dd/MM/yyyy")}</p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-semibold tabular-nums">{money.format(invoice.totalValue)}</p>
                        <p className="text-xs text-muted-foreground">Saldo {money.format(invoice.openBalance)}</p>
                      </div>
                    </div>
                  ))}
                  {profile.finance.recentPayments.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimos recebimentos</p>
                      {profile.finance.recentPayments.slice(0, 2).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                          <span className="min-w-0 truncate text-muted-foreground">{formatDate(payment.paymentDate, "dd/MM/yyyy")} • {CLIENT_PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}</span>
                          <span className="shrink-0 font-medium tabular-nums">{money.format(payment.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card className="min-w-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><MessageSquareWarning className="h-4 w-4 text-primary" />Ocorrências</CardTitle>
              </CardHeader>
              <CardContent>
                {!profile.occurrences.allowed ? (
                  <RestrictedBlock>Histórico operacional restrito para este perfil.</RestrictedBlock>
                ) : profile.occurrences.recent.length === 0 ? (
                  <EmptyBlock>Nenhuma ocorrência recente.</EmptyBlock>
                ) : (
                  <div className="space-y-3">
                    {profile.occurrences.recent.slice(0, 3).map((occurrence) => (
                      <button key={occurrence.id} type="button" className="block w-full rounded-lg border p-3 text-left hover:bg-muted/30" onClick={() => navigate(`${ordersPath}?id=${occurrence.orderId}`)}>
                        <p className="text-xs font-semibold text-primary">Pedido {occurrence.orderNumber}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5">{occurrence.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{formatDate(occurrence.createdAt, "dd/MM/yyyy HH:mm")}</p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" />Próximos atendimentos</CardTitle>
              </CardHeader>
              <CardContent>
                {!profile.appointments.allowed ? (
                  <RestrictedBlock>Agenda restrita para este perfil.</RestrictedBlock>
                ) : profile.appointments.recent.length === 0 ? (
                  <EmptyBlock>Nenhuma coleta ou entrega agendada.</EmptyBlock>
                ) : (
                  <div className="space-y-3">
                    {profile.appointments.recent.map((appointment) => (
                      <div key={appointment.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge variant="info">{appointment.type}</StatusBadge>
                          <span className="text-sm font-semibold">{formatDate(appointment.date, "dd/MM/yyyy")}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{appointment.time?.slice(0, 5) || "Sem horário"}{appointment.notes ? ` • ${appointment.notes}` : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContactLine({ icon: Icon, label }: { icon: typeof Phone; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
