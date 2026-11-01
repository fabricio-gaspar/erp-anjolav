import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarDays, CalendarIcon, Gauge, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { LogisticaSection, type LogisticaEndereco } from "@/components/delivery/LogisticaSection";
import { cn } from "@/lib/utils";
import { getDefaultPdvDeliveryDate } from "@/lib/pdvFulfillment";
import type { PdvCapacitySnapshot } from "@/hooks/usePdvPayments";

export interface PdvFulfillmentSettings {
  deliveryDate: Date;
  urgent: boolean;
  receiptMode: "balcao" | "coleta";
  deliveryMode: "balcao" | "entrega";
  driverId: string;
  vehicleId: string;
  capacityOverride: boolean;
}

interface PdvFulfillmentPanelProps {
  clienteNome?: string;
  endereco: LogisticaEndereco | null;
  enderecoLoading?: boolean;
  enderecoError?: boolean;
  settings: PdvFulfillmentSettings;
  requestedLoad: number;
  capacity: PdvCapacitySnapshot | null | undefined;
  capacityLoading?: boolean;
  capacityError?: boolean;
  canOverrideCapacity: boolean;
  canSetUrgency?: boolean;
  onChange: (next: PdvFulfillmentSettings) => void;
}

function formatCarga(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

export function PdvFulfillmentPanel({
  clienteNome,
  endereco,
  enderecoLoading = false,
  enderecoError = false,
  settings,
  requestedLoad,
  capacity,
  capacityLoading = false,
  capacityError = false,
  canOverrideCapacity,
  canSetUrgency = true,
  onChange,
}: PdvFulfillmentPanelProps) {
  const projectedLoad = Number.isFinite(requestedLoad) ? Math.max(0, requestedLoad) : 0;
  const configuredCapacity = capacity?.configured === true;
  const projectedAvailable = configuredCapacity
    ? Number(capacity.available ?? 0) - projectedLoad
    : null;
  const isOverCapacity = projectedAvailable !== null && projectedAvailable < -0.0001;
  const isAtCapacity = projectedAvailable !== null && projectedAvailable <= 0;
  const requiresAddress = settings.receiptMode === "coleta" || settings.deliveryMode === "entrega";
  const addressReady = Boolean(endereco?.logradouro?.trim() && endereco?.cidade?.trim() && endereco?.uf?.trim());

  const update = (patch: Partial<PdvFulfillmentSettings>) => onChange({ ...settings, ...patch });
  const changeUrgency = (urgent: boolean) => {
    if (!canSetUrgency) return;
    onChange({
      ...settings,
      urgent,
      deliveryDate: getDefaultPdvDeliveryDate(urgent),
      capacityOverride: false,
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-strong bg-card p-3 shadow-sm sm:p-4" aria-labelledby="pdv-fulfillment-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="pdv-fulfillment-title" className="flex items-center gap-2 text-base font-black">
            <CalendarDays className="h-5 w-5 text-primary" /> Prazo, capacidade e entrega
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Defina a promessa operacional antes de avançar para o resumo e pagamento.</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Etapas 6 e 7</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 font-black"><CalendarIcon className="h-4 w-4 text-primary" /> Prazo prometido</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 w-full justify-start rounded-lg border-strong bg-background text-left font-semibold">
                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                {format(settings.deliveryDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={settings.deliveryDate}
                onSelect={(date) => date && update({ deliveryDate: date, capacityOverride: false })}
                disabled={(date) => date < new Date()}
                initialFocus
                locale={ptBR}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex min-h-11 items-center justify-between rounded-xl border border-warning/40 bg-warning/5 p-3">
          <div className="flex items-center gap-3">
            <Zap className={cn("h-6 w-6", settings.urgent ? "text-warning" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-black">Atendimento urgente</p>
              <p className="text-xs text-muted-foreground">Prioriza o prazo e aplica a regra comercial.</p>
            </div>
          </div>
          <Switch aria-label="Atendimento urgente" checked={settings.urgent} onCheckedChange={changeUrgency} disabled={!canSetUrgency} />
        </div>
      </div>

      <div className={cn(
        "rounded-xl border p-3",
        isOverCapacity ? "border-destructive/50 bg-destructive/5" : isAtCapacity ? "border-warning/50 bg-warning/5" : "border-strong bg-muted/20",
      )}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-2">
            <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-black">Capacidade da data</p>
              {capacityLoading ? (
                <p role="status" className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Consultando a agenda de produção…</p>
              ) : capacityError ? (
                <p role="alert" className="mt-1 text-sm text-destructive">Não foi possível validar a capacidade. Revise a conexão antes de finalizar.</p>
              ) : !configuredCapacity ? (
                <p className="mt-1 text-sm text-muted-foreground">Sem limite diário configurado para este setor. A confirmação continuará registrando a carga, mas a administração deve parametrizar a agenda.</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Limite {formatCarga(Number(capacity?.limit ?? 0))} · reservado {formatCarga(Number(capacity?.reserved ?? 0))} · pedido atual {formatCarga(projectedLoad)}
                </p>
              )}
            </div>
          </div>
          {configuredCapacity && !capacityLoading && !capacityError && (
            <span className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              isOverCapacity ? "bg-destructive text-destructive-foreground" : isAtCapacity ? "bg-warning text-warning-foreground" : "bg-success/15 text-success",
            )}>
              {isOverCapacity ? "Lotada" : `Disponível: ${formatCarga(Math.max(0, projectedAvailable ?? 0))}`}
            </span>
          )}
        </div>

        {isOverCapacity && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-background/70 p-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>A carga deste pedido ultrapassa a capacidade disponível para a data escolhida.</p>
            </div>
            {canOverrideCapacity ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">Autorizar exceção de capacidade</p>
                  <p className="text-xs text-muted-foreground">A exceção é validada no servidor e fica registrada na auditoria do pedido.</p>
                </div>
                <Switch aria-label="Autorizar exceção de capacidade" checked={settings.capacityOverride} onCheckedChange={(capacityOverride) => update({ capacityOverride })} />
              </div>
            ) : (
              <p role="alert" className="mt-3 text-sm font-medium text-destructive">Escolha outra data ou peça a autorização de um perfil com permissão comercial.</p>
            )}
          </div>
        )}
      </div>

      <LogisticaSection
        clienteNome={clienteNome}
        endereco={endereco}
        enderecoLoading={enderecoLoading}
        enderecoError={enderecoError}
        receiptMode={settings.receiptMode}
        onReceiptModeChange={(receiptMode) => update({ receiptMode })}
        deliveryMode={settings.deliveryMode}
        onDeliveryModeChange={(deliveryMode) => update({ deliveryMode })}
        dataEntrega={settings.deliveryDate}
        onDataEntregaChange={(deliveryDate) => update({ deliveryDate })}
        motoristaId={settings.driverId}
        onMotoristaChange={(driverId) => update({ driverId })}
        veiculoId={settings.vehicleId}
        onVeiculoChange={(vehicleId) => update({ vehicleId })}
        mostrarDataEntrega={false}
      />

      {requiresAddress && !enderecoLoading && !enderecoError && !addressReady && (
        <p role="alert" className="text-sm font-medium text-destructive">Cadastre um endereço principal completo para confirmar coleta ou delivery.</p>
      )}
    </section>
  );
}
