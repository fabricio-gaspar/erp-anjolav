import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Wifi, WifiOff, QrCode, RefreshCw, Unplug, Send, MessageSquare } from "lucide-react";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";
import { useMensagensLog } from "@/hooks/useMensagensLog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ConfiguracoesWhatsApp() {
  const {
    instancia,
    isLoading,
    salvarConfig,
    conectar,
    verificarStatus,
    desconectar,
    isConectado,
  } = useWhatsAppConfig();

  const { data: mensagens } = useMensagensLog();

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [nomeInstancia, setNomeInstancia] = useState("loja1");
  const [webhookN8n, setWebhookN8n] = useState("");

  useEffect(() => {
    if (instancia) {
      setApiUrl(instancia.api_url || "");
      setApiKey(instancia.api_key_encrypted || "");
      setNomeInstancia(instancia.nome_instancia || "loja1");
      setWebhookN8n(instancia.webhook_n8n_url || "");
    }
  }, [instancia]);

  const handleSalvar = () => {
    salvarConfig.mutate({
      api_url: apiUrl,
      api_key_encrypted: apiKey,
      nome_instancia: nomeInstancia,
      webhook_n8n_url: webhookN8n,
    });
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {isConectado ? (
                <>
                  <Wifi className="h-5 w-5 text-green-500" />
                  <Badge variant="default" className="bg-green-500">Conectado</Badge>
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

            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => verificarStatus.mutate()}
                disabled={verificarStatus.isPending}
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
          <CardTitle className="text-base">Configuração da Evolution API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>URL da Evolution API</Label>
              <Input
                placeholder="https://evo.minhaempresa.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">URL base da sua instância Evolution API</p>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="Sua API Key da Evolution"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                placeholder="loja1"
                value={nomeInstancia}
                onChange={(e) => setNomeInstancia(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Identificador único da instância</p>
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
        </CardContent>
      </Card>

      {/* Message Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" />
            Últimas Mensagens Enviadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!mensagens || mensagens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma mensagem enviada ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {mensagens.slice(0, 20).map((msg: any) => (
                <div key={msg.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={msg.status === "enviado" ? "default" : "destructive"} className="text-xs">
                        {msg.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{msg.canal}</span>
                      <span className="text-xs text-muted-foreground">{msg.evento}</span>
                    </div>
                    <p className="truncate mt-1">{msg.telefone} — {msg.mensagem?.substring(0, 80)}...</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
