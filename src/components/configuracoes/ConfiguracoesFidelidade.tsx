import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DEFAULTS = {
  ativo: false,
  valor_minimo_acumulo: 50,
  reais_por_ponto: 1,
  valor_por_ponto: 0.1,
  pontos_minimos_resgate: 100,
};

export function ConfiguracoesFidelidade() {
  const { activeTenant } = useAuth();
  const [config, setConfig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeTenant) return;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("fidelidade_configuracoes")
        .select("ativo, valor_minimo_acumulo, reais_por_ponto, valor_por_ponto, pontos_minimos_resgate")
        .eq("tenant_id", activeTenant.id)
        .maybeSingle();
      if (error) toast.error("Não foi possível carregar as regras de fidelidade");
      if (data) setConfig({
        ativo: data.ativo,
        valor_minimo_acumulo: Number(data.valor_minimo_acumulo),
        reais_por_ponto: Number(data.reais_por_ponto),
        valor_por_ponto: Number(data.valor_por_ponto),
        pontos_minimos_resgate: Number(data.pontos_minimos_resgate),
      });
      else setConfig(DEFAULTS);
      setLoading(false);
    })();
  }, [activeTenant]);

  const setNumber = (field: keyof Omit<typeof DEFAULTS, "ativo">, raw: string) => {
    const value = Number(raw);
    setConfig((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  };

  const save = async () => {
    if (!activeTenant) return;
    if (config.valor_minimo_acumulo < 0 || config.reais_por_ponto <= 0 || config.valor_por_ponto <= 0 || !Number.isInteger(config.pontos_minimos_resgate) || config.pontos_minimos_resgate < 1) {
      toast.error("Revise os valores das regras de fidelidade");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("fidelidade_configuracoes").upsert({
      tenant_id: activeTenant.id,
      ...config,
    }, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível salvar as regras de fidelidade");
      return;
    }
    toast.success("Regras de fidelidade salvas");
  };

  if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Card className="max-w-3xl space-y-6 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Gift className="h-5 w-5" /></div>
        <div><h2 className="font-semibold">Programa de fidelidade</h2><p className="text-sm text-muted-foreground">Pontos são gerados somente após o pagamento integral da OS e podem ser usados como desconto no PDV.</p></div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div><Label>Ativar programa</Label><p className="text-xs text-muted-foreground">Permanece desativado até você habilitar esta opção.</p></div>
        <Switch checked={config.ativo} onCheckedChange={(ativo) => setConfig((current) => ({ ...current, ativo }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="loyalty-minimum">Compra mínima para pontuar (R$)</Label><Input id="loyalty-minimum" className="mt-1" type="number" min="0" step="0.01" value={config.valor_minimo_acumulo} onChange={(event) => setNumber("valor_minimo_acumulo", event.target.value)} /></div>
        <div><Label htmlFor="loyalty-rate">Reais por ponto (R$)</Label><Input id="loyalty-rate" className="mt-1" type="number" min="0.01" step="0.01" value={config.reais_por_ponto} onChange={(event) => setNumber("reais_por_ponto", event.target.value)} /></div>
        <div><Label htmlFor="loyalty-value">Valor de cada ponto (R$)</Label><Input id="loyalty-value" className="mt-1" type="number" min="0.01" step="0.01" value={config.valor_por_ponto} onChange={(event) => setNumber("valor_por_ponto", event.target.value)} /></div>
        <div><Label htmlFor="loyalty-redemption">Pontos mínimos para resgate</Label><Input id="loyalty-redemption" className="mt-1" type="number" min="1" step="1" value={config.pontos_minimos_resgate} onChange={(event) => setNumber("pontos_minimos_resgate", event.target.value)} /></div>
      </div>
      <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Com as regras atuais, uma compra paga de R$ {config.valor_minimo_acumulo.toFixed(2)} ou mais gera 1 ponto a cada R$ {config.reais_por_ponto.toFixed(2)}; cada ponto vale R$ {config.valor_por_ponto.toFixed(2)} no resgate.</div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar regras</Button></div>
    </Card>
  );
}
