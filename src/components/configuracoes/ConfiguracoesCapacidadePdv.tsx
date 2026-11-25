import { useEffect, useState } from "react";
import { Gauge, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePdvCapacitySettings, type PdvCapacityArea } from "@/hooks/usePdvCapacitySettings";

function areaLabel(area: PdvCapacityArea) {
  return area === "industrial" ? "Industrial" : "Residencial";
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ConfiguracoesCapacidadePdv() {
  const [area, setArea] = useState<PdvCapacityArea>("residencial");
  const [date, setDate] = useState(() => localDateValue(new Date()));
  const [defaultLimit, setDefaultLimit] = useState("100");
  const [dailyLimit, setDailyLimit] = useState("100");
  const {
    capacities,
    dailyCapacity,
    isLoading,
    isDailyLoading,
    isError,
    isDailyError,
    canManage,
    refetch,
    saveCapacity,
    saveDailyCapacity,
    isSaving,
  } = usePdvCapacitySettings(area, date);

  useEffect(() => {
    const current = capacities.find((capacity) => capacity.area === area);
    setDefaultLimit(current ? String(current.limit) : "100");
  }, [area, capacities]);

  useEffect(() => {
    const current = dailyCapacity?.dailyLimit ?? dailyCapacity?.defaultLimit;
    setDailyLimit(current === null || current === undefined ? "100" : String(current));
  }, [dailyCapacity]);

  const submitDefault = async () => {
    const limit = Number(defaultLimit.replace(",", "."));
    await saveCapacity({ area, limit, active: true });
  };

  const submitDaily = async (active = true) => {
    const limit = Number(dailyLimit.replace(",", "."));
    await saveDailyCapacity({ area, date, limit, active });
  };

  if (!canManage) {
    return (
      <Card className="max-w-3xl p-6">
        <h2 className="font-semibold">Capacidade operacional do PDV</h2>
        <p className="mt-2 text-sm text-muted-foreground">Somente administradores da empresa podem parametrizar a capacidade diária.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Gauge className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">Capacidade do PDV por data</h2>
            <p className="mt-1 text-sm text-muted-foreground">Configure um limite padrão por setor e, quando necessário, um limite específico para cada dia.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(160px,0.8fr)_minmax(170px,0.8fr)_minmax(160px,1fr)_auto] sm:items-end">
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
            <Input id="pdv-capacity-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdv-capacity-day-limit">Limite desta data</Label>
            <Input id="pdv-capacity-day-limit" type="number" min="1" step="1" inputMode="numeric" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} placeholder="Ex.: 100" />
          </div>
          <Button type="button" onClick={() => void submitDaily().catch(() => undefined)} disabled={isSaving || !date}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar data
          </Button>
        </div>

        {isDailyError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span>Não foi possível consultar a capacidade desta data.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            {isDailyLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Consultando data…</span>
            ) : dailyCapacity?.isOverride ? (
              <span>Este dia tem limite próprio de <strong>{dailyCapacity.limit} peças/carga</strong>.</span>
            ) : dailyCapacity?.active ? (
              <span>Sem ajuste para este dia. Aplica-se o padrão de <strong>{dailyCapacity.defaultLimit} peças/carga</strong>.</span>
            ) : (
              <span>Nenhuma capacidade padrão ativa. O PDV não bloqueará novos ROLs por limite.</span>
            )}
            {dailyCapacity?.isOverride && (
              <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={() => void submitDaily(false).catch(() => undefined)}>
                Usar limite padrão
              </Button>
            )}
          </div>
        )}

        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground">
          A ocupação é calculada pelos itens dos ROLs ativos com previsão para a data. Alterar o limite não cancela ROLs existentes; o PDV considera o limite vigente ao receber novos pedidos.
        </div>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Limite padrão do setor</h3>
          <p className="text-sm text-muted-foreground">Usado nos dias sem um limite específico. O limite pode ser alterado sem afetar as demais datas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="pdv-capacity-default">Peças/carga por dia · {areaLabel(area)}</Label>
            <Input id="pdv-capacity-default" type="number" min="1" step="1" inputMode="numeric" value={defaultLimit} onChange={(event) => setDefaultLimit(event.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => void submitDefault().catch(() => undefined)} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar padrão
          </Button>
        </div>
        <div className="border-t pt-3">
          <h4 className="mb-2 text-sm font-semibold">Padrões cadastrados</h4>
          {isLoading ? (
            <div className="flex min-h-16 items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>
          ) : isError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>Não foi possível carregar os limites padrão.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : capacities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum padrão cadastrado; o PDV não aplicará limite até um administrador salvar.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {capacities.map((capacity) => (
                <div key={capacity.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2"><span className="font-medium">{areaLabel(capacity.area)}</span><Badge variant={capacity.active ? "default" : "secondary"}>{capacity.active ? "Ativo" : "Desativado"}</Badge></div>
                  <span className="text-muted-foreground">{capacity.limit} peças/carga por dia</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
