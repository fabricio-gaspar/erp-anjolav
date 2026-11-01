import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Loader2, Package, RefreshCw, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAgendaDia } from "@/hooks/useHistoricoProducao";
import { cn } from "@/lib/utils";

interface AgendaRecord {
  id: string;
  cliente_id?: string | null;
  horario?: string | null;
  status?: string | null;
  pronto_entrega?: boolean | null;
  os_numero?: string | null;
  cliente?: { razao_social?: string | null } | null;
}

interface DayItem {
  id: string;
  clientId: string | null;
  clientName: string;
  time: string | null;
  status: string | null;
  readyForDelivery: boolean;
  orderNumber: string | null;
}

interface ListaDoDiaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectClient: (clientId: string) => void;
  onOpenAgenda?: () => void;
}

function statusLabel(item: DayItem) {
  if (item.readyForDelivery) return "Pronta";
  if (item.status === "realizado") return "Concluída";
  if (item.status === "confirmado") return "Confirmada";
  if (item.status === "em_andamento") return "Em andamento";
  return "Pendente";
}

function statusClassName(item: DayItem) {
  if (item.readyForDelivery || item.status === "realizado") return "bg-success/10 text-success";
  if (item.status === "confirmado" || item.status === "em_andamento") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

function DailyListSection({
  title,
  type,
  items,
  onSelectClient,
}: {
  title: string;
  type: "pickup" | "delivery";
  items: DayItem[];
  onSelectClient: (clientId: string) => void;
}) {
  const Icon = type === "pickup" ? Truck : Package;
  const tone = type === "pickup" ? "text-primary" : "text-success";

  return (
    <section className="min-w-0 rounded-xl border bg-card" aria-label={title}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", tone)} />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum item previsto para hoje.</p>
      ) : (
        <div className="divide-y">
          {items.map((item) => {
            const canAttend = Boolean(item.clientId) && item.status !== "realizado";
            return (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{item.clientName}</p>
                    {item.readyForDelivery && <Badge className="bg-success/10 text-success hover:bg-success/10">ROL pronta</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {item.orderNumber && <span className="font-medium text-primary">{item.orderNumber}</span>}
                    {item.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{item.time}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("border-0", statusClassName(item))}>{statusLabel(item)}</Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canAttend}
                    onClick={() => item.clientId && onSelectClient(item.clientId)}
                  >
                    Atender
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ListaDoDiaModal({ open, onOpenChange, onSelectClient, onOpenAgenda }: ListaDoDiaModalProps) {
  const { retiradas, entregas, isLoading, error, refetch } = useAgendaDia(open);
  const pickups = useMemo(() => (retiradas as unknown as AgendaRecord[]).map((item) => ({
    id: item.id,
    clientId: item.cliente_id ?? null,
    clientName: item.cliente?.razao_social || "Cliente sem nome",
    time: item.horario ?? null,
    status: item.status ?? null,
    readyForDelivery: false,
    orderNumber: null,
  })), [retiradas]);
  const deliveries = useMemo(() => (entregas as unknown as AgendaRecord[]).map((item) => ({
    id: item.id,
    clientId: item.cliente_id ?? null,
    clientName: item.cliente?.razao_social || "Cliente sem nome",
    time: item.horario ?? null,
    status: item.status ?? null,
    readyForDelivery: Boolean(item.pronto_entrega),
    orderNumber: item.os_numero ?? null,
  })), [entregas]);

  const handleSelectClient = (clientId: string) => {
    onOpenChange(false);
    onSelectClient(clientId);
  };

  const handleOpenAgenda = () => {
    onOpenChange(false);
    onOpenAgenda?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Lista do dia</DialogTitle>
          <DialogDescription>Retiradas, entregas e ROLs prontas para hoje — {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Carregando lista do dia...
          </div>
        ) : error ? (
          <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <p className="font-medium">Não foi possível carregar a lista do dia.</p>
            <Button type="button" variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <DailyListSection title="Retiradas do dia" type="pickup" items={pickups} onSelectClient={handleSelectClient} />
            <DailyListSection title="Entregas do dia" type="delivery" items={deliveries} onSelectClient={handleSelectClient} />
          </div>
        )}

        <DialogFooter>
          {onOpenAgenda && <Button type="button" variant="outline" onClick={handleOpenAgenda}>Abrir agenda completa</Button>}
          <Button type="button" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
