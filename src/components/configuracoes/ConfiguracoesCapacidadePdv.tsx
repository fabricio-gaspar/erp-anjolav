import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Gauge, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePdvCapacitySettings, type PdvCapacityArea } from "@/hooks/usePdvCapacitySettings";

const todayIso = () => format(new Date(), "yyyy-MM-dd");

function areaLabel(area: PdvCapacityArea) {
  return area === "industrial" ? "Industrial" : "Residencial";
}

function formatCapacityDate(date: string) {
  try {
    return format(parseISO(`${date}T12:00:00`), "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return date;
  }
}

export function ConfiguracoesCapacidadePdv() {
  const { capacities, isLoading, isError, canManage, refetch, saveCapacity, isSaving } = usePdvCapacitySettings();
  const [area, setArea] = useState<PdvCapacityArea>("residencial");
  const [date, setDate] = useState(todayIso);
  const [limit, setLimit] = useState("100");

  const submit = async () => {
    const normalizedLimit = Number(limit.replace(",", "."));
    if (date < todayIso()) return;
    await saveCapacity({ area, date, limit: normalizedLimit, active: true });
  };

  if (!canManage) {
    return (
      <Card className="max-w-3xl p-6">
        <h2 className="font-semibold">Capacidade operacional do PDV</h2>
        <p className="mt-2 text-sm text-muted-foreground">Somente administradores da empresa podem parametrizar o limite diário por setor.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Gauge className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">Capacidade operacional do PDV</h2>
            <p className="mt-1 text-sm text-muted-foreground">Defina o limite diário de carga por setor. O caixa só consulta esta regra; ele não altera limites nem sai do atendimento.</p>
          </div>
        </div>

        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
          A carga inicial é a soma das quantidades dos itens prometidos para a data. Configure a unidade de limite de forma coerente com a operação (por exemplo, peças operacionais ou quilos) e revise a agenda diariamente.
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(150px,0.8fr)_minmax(180px,1fr)_minmax(160px,0.8fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="pdv-capacity-area">Setor</Label>
            <Select value={area} onValueChange={(value) => setArea(value as PdvCapacityArea)}>
              <SelectTrigger id="pdv-capacity-area"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residencial">Residencial</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdv-capacity-date">Data</Label>
            <Input id="pdv-capacity-date" type="date" min={todayIso()} value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdv-capacity-limit">Limite de carga</Label>
            <Input id="pdv-capacity-limit" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Ex.: 100" />
          </div>
          <Button type="button" onClick={() => void submit().catch(() => undefined)} disabled={isSaving || date < todayIso()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar limite
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h3 className="font-semibold">Limites configurados</h3>
            <p className="text-sm text-muted-foreground">Desative uma data para que o PDV trate a capacidade como não parametrizada, sem apagar seu histórico.</p>
          </div>
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>

        {isLoading ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando capacidades…</div>
        ) : isError ? (
          <div role="alert" className="flex min-h-36 flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="text-sm font-medium">Não foi possível carregar os limites de capacidade.</p>
            <Button type="button" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        ) : capacities.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum limite diário configurado. O PDV seguirá registrando a carga, mas não bloqueará uma data sem parâmetro.</p>
        ) : (
          <div className="divide-y">
            {capacities.map((capacity) => (
              <div key={capacity.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{areaLabel(capacity.area)}</p><Badge variant={capacity.active ? "default" : "secondary"}>{capacity.active ? "Ativa" : "Desativada"}</Badge></div>
                  <p className="mt-1 text-sm text-muted-foreground">{formatCapacityDate(capacity.date)} · Limite: {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(capacity.limit)}</p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Label htmlFor={`pdv-capacity-active-${capacity.id}`} className="cursor-pointer text-sm">{capacity.active ? "Ativa no PDV" : "Manter desativada"}</Label>
                  <Switch
                    id={`pdv-capacity-active-${capacity.id}`}
                    aria-label={`Ativar capacidade ${areaLabel(capacity.area)} ${capacity.date}`}
                    checked={capacity.active}
                    disabled={isSaving}
                    onCheckedChange={(active) => void saveCapacity({
                      area: capacity.area,
                      date: capacity.date,
                      limit: capacity.limit,
                      active,
                    }).catch(() => undefined)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
