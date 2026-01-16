import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  FileDown,
  ExternalLink,
  Copy,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_SEFAZ, type StatusSefaz } from "@/lib/validacoesFiscais";

interface StatusEmissaoNFProps {
  status: StatusSefaz;
  protocolo?: string | null;
  chaveAcesso?: string | null;
  numeroNF?: string | null;
  linkPdf?: string | null;
  erros?: Array<{ codigo: string; mensagem: string }>;
  onRetentar?: () => void;
  onDownloadDanfse?: () => void;
  isRetentando?: boolean;
}

export function StatusEmissaoNF({
  status,
  protocolo,
  chaveAcesso,
  numeroNF,
  linkPdf,
  erros,
  onRetentar,
  onDownloadDanfse,
  isRetentando,
}: StatusEmissaoNFProps) {
  const statusConfig = STATUS_SEFAZ.find((s) => s.value === status);

  const handleCopyChave = () => {
    if (chaveAcesso) {
      navigator.clipboard.writeText(chaveAcesso);
      toast.success("Chave de acesso copiada!");
    }
  };

  const handleCopyProtocolo = () => {
    if (protocolo) {
      navigator.clipboard.writeText(protocolo);
      toast.success("Protocolo copiado!");
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "autorizada":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "rejeitada":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "processando":
        return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
      case "cancelada":
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <h4 className="font-semibold">Status da Emissão</h4>
            <Badge
              variant={
                status === "autorizada"
                  ? "default"
                  : status === "rejeitada"
                  ? "destructive"
                  : "secondary"
              }
              className="mt-1"
            >
              {statusConfig?.label || status}
            </Badge>
          </div>
        </div>

        {status === "autorizada" && onDownloadDanfse && (
          <Button variant="outline" size="sm" onClick={onDownloadDanfse} className="gap-2">
            <FileDown className="w-4 h-4" />
            DANFSE
          </Button>
        )}
      </div>

      {/* Informações da NF autorizada */}
      {status === "autorizada" && (
        <div className="space-y-3 text-sm">
          {numeroNF && (
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Número NF:</span>
              <span className="font-mono font-medium">{numeroNF}</span>
            </div>
          )}

          {protocolo && (
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Protocolo:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{protocolo}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyProtocolo}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          {chaveAcesso && (
            <div className="p-2 bg-muted/50 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">Chave de Acesso:</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyChave}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <span className="font-mono text-xs break-all">{chaveAcesso}</span>
            </div>
          )}

          {linkPdf && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => window.open(linkPdf, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Consultar na Prefeitura
            </Button>
          )}
        </div>
      )}

      {/* Erros de rejeição */}
      {status === "rejeitada" && erros && erros.length > 0 && (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {erros.map((erro, index) => (
                  <li key={index} className="text-sm">
                    <span className="font-mono text-xs mr-2">[{erro.codigo}]</span>
                    {erro.mensagem}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          {onRetentar && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetentar}
              disabled={isRetentando}
              className="w-full gap-2"
            >
              {isRetentando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              Tentar Novamente
            </Button>
          )}
        </div>
      )}

      {/* Status processando */}
      {status === "processando" && (
        <div className="text-sm text-muted-foreground text-center py-2">
          Aguardando resposta da prefeitura...
        </div>
      )}

      {/* Status não enviada */}
      {status === "nao_enviada" && (
        <div className="text-sm text-muted-foreground text-center py-2">
          A nota fiscal ainda não foi enviada para a prefeitura.
        </div>
      )}
    </Card>
  );
}
