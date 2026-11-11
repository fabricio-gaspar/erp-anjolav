import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RotateCcw, Wifi, WifiOff, QrCode, RefreshCw, Unplug, Send, MessageSquare } from "lucide-react";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { useMensagensLog } from "@/hooks/useMensagensLog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const deliveryStatus = {
  pendente: { label: "Pendente", variant: "outline" as const },
  processando: { label: "Processando", variant: "secondary" as const },
  enviado: { label: "Enviado", variant: "default" as const },
  entregue: { label: "Entregue", variant: "default" as const },
  lido: { label: "Lido", variant: "default" as const },
  falhou: { label: "Falhou", variant: "destructive" as const },
  incerto: { label: "Requer conciliação", variant: "secondary" as const },
  dead_letter: { label: "Intervenção necessária", variant: "destructive" as const },
};

const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 6 ? "••••" : `${digits.slice(0, 4)}••••${digits.slice(-4)}`;
};

export function ConfiguracoesWhatsApp() {
  const {
    instancia,
    isLoading,
    salvarConfig,
    conectar,
    verificarStatus,
    desconectar,
    enviarMensagem,
    retryDelivery,
    resolveDelivery,
    isConectado,
  } = useWhatsAppConfig();

  const { data: mensagens, isLoading: isLoadingMessages, isError: isMessagesError } = useMensagensLog();

  const [apiUrl, setApiUrl] = useState("");
  const [nomeInstancia, setNomeInstancia] = useState("loja1");
  const [webhookN8n, setWebhookN8n] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [reconciliationId, setReconciliationId] = useState<string | null>(null);
  const [reconciliationReason, setReconciliationReason] = useState("");

  useEffect(() => {
    if (instancia) {
      setApiUrl(instancia.api_url || "");
      setNomeInstancia(instancia.nome_instancia || "loja1");
      setWebhookN8n(instancia.webhook_n8n_url || "");
    }
  }, [instancia]);

  const handleSalvar = () => {
    salvarConfig.mutate({
      api_url: apiUrl,
      nome_instancia: nomeInstancia,
      webhook_n8n_url: webhookN8n,
    });
  };

  const reconcile = async (resolution: "CONFIRMADO_ENVIADO" | "CONFIRMADO_NAO_ENVIADO") => {
    if (!reconciliationId || reconciliationReason.trim().length < 10) return;
    await resolveDelivery.mutateAsync({
      deliveryId: reconciliationId,
      resolution,
      reason: reconciliationReason,
    });
    setReconciliationId(null);
    setReconciliationReason("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5" />
            Status da Conexão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              {isConectado ? (
                <>
                  <Wifi className="h-5 w-5 text-green-500" />
                  <Badge variant="default" className="bg-green-500">Conectado</Badge>
                </>
              ) : !instancia?.api_url ? (
                <>
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="outline">Não configurado</Badge>
                </>
              ) : instancia?.status === "aguardando_scan" ? (
                <>
                  <QrCode className="h-5 w-5 text-yellow-500" />
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Aguardando Scan</Badge>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-red-500" />
                  <Badge variant="destructive">Desconectado</Badge>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => verificarStatus.mutate()}
                disabled={verificarStatus.isPending || !instancia?.api_url}
              >
                {verificarStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1">Verificar</span>
              </Button>

              {isConectado ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => desconectar.mutate()}
                  disabled={desconectar.isPending}
                >
                  <Unplug className="h-4 w-4 mr-1" />
                  Desconectar
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => conectar.mutate()}
                  disabled={conectar.isPending || !apiUrl}
                >
                  {conectar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                  <span className="ml-1">Conectar</span>
                </Button>
              )}
            </div>
          </div>

          {/* QR Code Display */}
          {instancia?.qr_code && !isConectado && (
            <div className="flex flex-col items-center gap-3 p-6 bg-muted/50 rounded-lg border">
              <p className="text-sm font-medium">Escaneie o QR Code com seu WhatsApp</p>
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={`data:image/png;base64,${instancia.qr_code}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar Aparelho
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração do WA-AKG</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL HTTPS do WA-AKG</Label>
              <Input
                placeholder="https://whatsapp.minhaempresa.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use a origem HTTPS da VPS e inclua o host no secret WA_AKG_ALLOWED_HOSTS.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <Label>Credencial do WA-AKG</Label>
              <p className="text-xs text-muted-foreground">
                A chave não é armazenada nem exibida no navegador. Configure-a no Supabase como
                secret <code className="font-mono">WA_AKG_API_KEY</code>. O envio real exige WA_AKG_ENABLED=true.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Nome de exibição</Label>
              <Input
                placeholder="loja1"
                value={nomeInstancia}
                onChange={(e) => setNomeInstancia(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">A sessão técnica é isolada por empresa e criada pelo servidor.</p>
            </div>

            <div className="space-y-2">
              <Label>URL Webhook n8n</Label>
              <Input
                placeholder="https://n8n.minhaempresa.com/webhook/..."
                value={webhookN8n}
                onChange={(e) => setWebhookN8n(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">URL do webhook no n8n para automações</p>
            </div>
          </div>

          <Button onClick={handleSalvar} disabled={salvarConfig.isPending}>
            {salvarConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Configuração
          </Button>
          <div className="rounded-lg border p-3">
            <Label htmlFor="wa-test-phone">Destinatário de teste autorizado</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                id="wa-test-phone"
                type="tel"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                value={testPhone}
                onChange={(event) => setTestPhone(event.target.value)}
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!isConectado || testPhone.replace(/\D/g, "").length < 10 || enviarMensagem.isPending}
                onClick={() => enviarMensagem.mutate({
                  telefone: testPhone,
                  mensagem: "Teste autorizado de conexão do AnjoLav ERP com WA-AKG.",
                  evento: "teste",
                })}
              >
                {enviarMensagem.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar teste
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">O envio ocorre somente ao clicar. Exige WA_AKG_ENABLED=true no servidor.</p>
          </div>
          <p className="text-xs text-muted-foreground">O ROL é enviado como relação textual. PDF só será anexado quando houver documento persistido e acesso seguro para o cliente.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4" />Fila e histórico de entregas</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Uma intenção é registrada antes do provedor. Resultado incerto nunca é reenviado automaticamente.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />{mensagens?.filter((item) => item.status === "enviado").length || 0} enviadas</Badge>
              <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />{mensagens?.filter((item) => item.status === "incerto").length || 0} para conciliar</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingMessages ? (
            <div className="page-empty-state"><Loader2 className="mb-2 h-5 w-5 animate-spin" />Carregando entregas...</div>
          ) : isMessagesError ? (
            <div className="page-empty-state">Não foi possível carregar o histórico. Atualize a página e tente novamente.</div>
          ) : !mensagens || mensagens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma intenção de envio registrada.
            </p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {mensagens.slice(0, 20).map((msg) => (
                <div key={msg.id} className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={deliveryStatus[msg.status]?.variant || "outline"} className="text-xs">{deliveryStatus[msg.status]?.label || msg.status}</Badge>
                        <span className="text-xs font-medium">{msg.evento}</span>
                        <span className="text-xs text-muted-foreground">tentativa {msg.attempt_count}</span>
                      </div>
                      <p className="mt-1 text-sm">Destino {maskPhone(msg.telefone)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {msg.provider_message_id ? " · confirmação externa registrada" : ""}
                      </p>
                      {msg.status === "incerto" && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Consulte o WA-AKG antes de decidir. Um reenvio agora pode duplicar a mensagem.</p>}
                      {msg.last_error_code && msg.status !== "incerto" && <p className="mt-1 text-xs text-muted-foreground">Código: {msg.last_error_code}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {msg.status === "falhou" && !msg.provider_attempted_at && msg.attempt_count < 3 && (
                        <Button variant="outline" size="sm" onClick={() => retryDelivery.mutate(msg.id)} disabled={retryDelivery.isPending}>
                          {retryDelivery.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />}Tentar novamente
                        </Button>
                      )}
                      {msg.status === "incerto" && (
                        <Button variant="outline" size="sm" onClick={() => { setReconciliationId(msg.id); setReconciliationReason(""); }}>
                          <Clock3 className="mr-1 h-3.5 w-3.5" />Conciliar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reconciliationId} onOpenChange={(open) => !open && setReconciliationId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Conciliar resultado incerto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              Verifique o painel ou aparelho do WA-AKG antes de responder. Esta decisão libera ou encerra o reenvio e fica registrada com seu usuário.
            </div>
            <div><Label htmlFor="whatsapp-reconciliation-reason">Evidência da verificação *</Label><Textarea id="whatsapp-reconciliation-reason" value={reconciliationReason} onChange={(event) => setReconciliationReason(event.target.value)} placeholder="Ex.: mensagem localizada no histórico da instância às 14:32" rows={3} /></div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setReconciliationId(null)}>Cancelar</Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => reconcile("CONFIRMADO_NAO_ENVIADO")} disabled={reconciliationReason.trim().length < 10 || resolveDelivery.isPending}>Confirmar que não enviou</Button>
              <Button onClick={() => reconcile("CONFIRMADO_ENVIADO")} disabled={reconciliationReason.trim().length < 10 || resolveDelivery.isPending}>Confirmar envio</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
