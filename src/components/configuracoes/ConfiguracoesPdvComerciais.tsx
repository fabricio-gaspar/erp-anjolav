import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePdvCommercialRules, useSavePdvCommercialRules } from "@/hooks/usePdvCommercialRules";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

export function ConfiguracoesPdvComerciais() {
  const { activeArea } = useWorkspace();
  const [area, setArea] = useState<"residencial" | "industrial">(activeArea === "industrial" ? "industrial" : "residencial");
  const { data, isLoading, isError, refetch } = usePdvCommercialRules(area);
  const save = useSavePdvCommercialRules();
  const [urgency, setUrgency] = useState("30");
  const [deliveryModel, setDeliveryModel] = useState<"fixo" | "km">("fixo");
  const [deliveryBaseFee, setDeliveryBaseFee] = useState("0");
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState("0");

  useEffect(() => {
    if (!data) return;
    setUrgency(String(data.urgencyPercentage));
    setDeliveryModel(data.deliveryPricingModel);
    setDeliveryBaseFee(data.deliveryBaseFee.toFixed(2).replace(".", ","));
    setDeliveryFeePerKm(data.deliveryFeePerKm.toFixed(2).replace(".", ","));
  }, [data]);

  const submit = async () => {
    const urgencyValue = Number(urgency.replace(",", "."));
    const baseFeeValue = Number(deliveryBaseFee.replace(",", "."));
    const feePerKmValue = Number(deliveryFeePerKm.replace(",", "."));
    if (!Number.isFinite(urgencyValue) || urgencyValue < 0 || urgencyValue > 100) {
      toast.error("Informe uma porcentagem entre 0 e 100.");
      return;
    }
    if (!Number.isFinite(baseFeeValue) || baseFeeValue < 0 || !Number.isFinite(feePerKmValue) || feePerKmValue < 0 || (deliveryModel === "km" && feePerKmValue === 0)) {
      toast.error(deliveryModel === "km" ? "Informe uma taxa por KM maior que zero." : "Informe uma taxa base de entrega válida.");
      return;
    }
    try {
      await save.mutateAsync({
        area,
        urgencyPercentage: Math.round(urgencyValue * 100) / 100,
        deliveryPricingModel: deliveryModel,
        deliveryBaseFee: Math.round(baseFeeValue * 100) / 100,
        deliveryFeePerKm: Math.round(feePerKmValue * 100) / 100,
      });
      toast.success("Regras comerciais do PDV atualizadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as regras comerciais.");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Regras comerciais do PDV</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configure a urgência e a taxa de delivery por operação. O cálculo por KM usa a distância em linha reta entre a empresa e o endereço do cliente.</p>
        </div>
        <select value={area} onChange={(event) => setArea(event.target.value as typeof area)} className="h-10 rounded-md border bg-background px-3 text-sm font-semibold">
          <option value="residencial">Doméstico</option>
          <option value="industrial">Industrial</option>
        </select>
      </div>

      {isLoading ? <p className="mt-5 text-sm text-muted-foreground">Carregando regras…</p> : isError ? (
        <div className="mt-5 space-y-2"><p className="text-sm text-destructive">Não foi possível carregar as regras comerciais.</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="pdv-urgency-percentage">Lavagem Expressa (%)</Label><Input id="pdv-urgency-percentage" inputMode="decimal" value={urgency} onChange={(event) => setUrgency(event.target.value)} /><p className="text-xs text-muted-foreground">Aplicada automaticamente ao selecionar Lavagem Expressa no ROL.</p></div>
          <div className="space-y-2"><Label htmlFor="pdv-delivery-model">Cobrança do delivery</Label><select id="pdv-delivery-model" value={deliveryModel} onChange={(event) => setDeliveryModel(event.target.value as typeof deliveryModel)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="fixo">Valor fixo por entrega</option><option value="km">Valor por quilômetro (linha reta)</option></select><p className="text-xs text-muted-foreground">Aplicada somente no modo Delivery. Retirada no balcão e coleta não recebem taxa.</p></div>
          <div className="space-y-2"><Label htmlFor="pdv-delivery-base-fee">Taxa base por entrega (R$)</Label><Input id="pdv-delivery-base-fee" inputMode="decimal" value={deliveryBaseFee} onChange={(event) => setDeliveryBaseFee(event.target.value)} /><p className="text-xs text-muted-foreground">Valor adicional por entrega; use zero para cobrar somente por KM.</p></div>
          <div className="space-y-2"><Label htmlFor="pdv-delivery-fee-per-km">Valor por KM (R$)</Label><Input id="pdv-delivery-fee-per-km" inputMode="decimal" value={deliveryFeePerKm} onChange={(event) => setDeliveryFeePerKm(event.target.value)} disabled={deliveryModel === "fixo"} /><p className="text-xs text-muted-foreground">Tarifa aplicada à distância em linha reta. É obrigatória no modo por KM.</p></div>
          <div className="sm:col-span-2"><Button onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar regras da operação"}</Button></div>
        </div>
      )}
    </section>
  );
}
