import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfiguracoesGerais, type ConfiguracaoGeralUpdate } from "@/hooks/useConfiguracoesGerais";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";

const defaults = {
  faturamento_limite_rols: 200,
  faturamento_relatorios_ativo: true,
  faturamento_nfse_ativo: false,
  faturamento_boleto_ativo: false,
  faturamento_email_ativo: false,
  faturamento_whatsapp_ativo: false,
};

type Settings = typeof defaults;
type Flag = Exclude<keyof Settings, "faturamento_limite_rols">;

const services: { key: Flag; title: string; detail: string }[] = [
  { key: "faturamento_relatorios_ativo", title: "Relatório e planilha", detail: "Conferência de ROLs antes do fechamento e exportação da fatura." },
  { key: "faturamento_nfse_ativo", title: "NFS-e", detail: "Mostra a emissão somente quando o adaptador fiscal e o emissor estiverem configurados." },
  { key: "faturamento_boleto_ativo", title: "Boleto", detail: "Desligado por padrão. Exige Asaas de produção e webhook de conciliação antes do primeiro uso." },
  { key: "faturamento_email_ativo", title: "Envio por e-mail", detail: "Reserva a opção para o envio de documentos quando houver conector e confirmação de entrega." },
  { key: "faturamento_whatsapp_ativo", title: "Envio por WhatsApp", detail: "Reserva a opção para o envio de documentos quando o canal aceitar os anexos." },
];

export function ConfiguracoesFaturamento() {
  const { configuracao, isLoading, error, saveConfiguracao } = useConfiguracoesGerais();
  const permission = usePermissaoModulo("configuracoes");
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    if (!configuracao) return;
    setSettings({
      faturamento_limite_rols: configuracao.faturamento_limite_rols ?? 200,
      faturamento_relatorios_ativo: configuracao.faturamento_relatorios_ativo ?? true,
      faturamento_nfse_ativo: configuracao.faturamento_nfse_ativo ?? false,
      faturamento_boleto_ativo: configuracao.faturamento_boleto_ativo ?? false,
      faturamento_email_ativo: configuracao.faturamento_email_ativo ?? false,
      faturamento_whatsapp_ativo: configuracao.faturamento_whatsapp_ativo ?? false,
    });
  }, [configuracao]);

  if (isLoading) return <p role="status">Carregando regras de faturamento...</p>;
  if (error || !configuracao) return <p role="alert">Não foi possível carregar as regras de faturamento. Atualize a página antes de editar.</p>;

  const editable = permission.allowed && !permission.isLoading && !permission.isError;
  const save = () => {
    if (!editable || !Number.isInteger(settings.faturamento_limite_rols)
      || settings.faturamento_limite_rols < 1 || settings.faturamento_limite_rols > 500) return;
    saveConfiguracao.mutate(settings as ConfiguracaoGeralUpdate);
  };

  return <div className="max-w-3xl space-y-5">
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Fechamento por período</h3>
      <p className="mt-1 text-sm text-muted-foreground">ROLs domésticos pagos no PDV não entram no fechamento. Clientes com condição Faturado podem ser conferidos por período; a periodicidade é definida no cadastro do cliente.</p>
      <div className="mt-4 max-w-xs space-y-2">
        <Label htmlFor="billing-roll-limit">Máximo de ROLs por fatura</Label>
        <Input id="billing-roll-limit" type="number" min={1} max={500} step={1} value={settings.faturamento_limite_rols}
          onChange={event => setSettings(current => ({ ...current, faturamento_limite_rols: Number(event.target.value) }))} disabled={!editable} />
        <p className="text-xs text-muted-foreground">Padrão: 200. Este limite é independente da capacidade diária do PDV.</p>
      </div>
    </div>
    <div className="space-y-2">
      {services.map(service => <div key={service.key} className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
        <div><Label htmlFor={service.key} className="font-semibold">{service.title}</Label><p className="mt-1 text-xs text-muted-foreground">{service.detail}</p></div>
        <Switch id={service.key} checked={settings[service.key]} onCheckedChange={value => setSettings(current => ({ ...current, [service.key]: value }))} disabled={!editable} />
      </div>)}
    </div>
    <p className="text-xs text-muted-foreground">Ativar uma opção não substitui as credenciais, o vínculo com o emissor nem a confirmação do provedor. O envio automático de anexos ainda depende de integração validada.</p>
    <Button onClick={save} disabled={!editable || saveConfiguracao.isPending || !Number.isInteger(settings.faturamento_limite_rols) || settings.faturamento_limite_rols < 1 || settings.faturamento_limite_rols > 500}>
      {saveConfiguracao.isPending ? "Salvando..." : "Salvar regras de faturamento"}
    </Button>
  </div>;
}
