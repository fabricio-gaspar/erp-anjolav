import { LucideIcon, Download, Copy, Check, Eye } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface DocumentoCardProps {
  titulo: string;
  subtitulo?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  status?: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className?: string;
  };
  acoes?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
    disabled?: boolean;
  }[];
  copiavel?: {
    valor: string;
    label: string;
  };
  downloadUrl?: string;
  downloadLabel?: string;
  onVisualize?: () => void;
  visualizeLabel?: string;
}

export function DocumentoCard({
  titulo,
  subtitulo,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  status,
  acoes,
  copiavel,
  downloadUrl,
  downloadLabel,
  onVisualize,
  visualizeLabel,
}: DocumentoCardProps) {
  const [copiado, setCopiado] = useState(false);

  const handleCopy = async () => {
    if (!copiavel) return;
    try {
      await navigator.clipboard.writeText(copiavel.valor);
      setCopiado(true);
      toast.success(`${copiavel.label} copiado!`);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm truncate">{titulo}</h4>
              {status && (
                <Badge variant={status.variant} className={status.className}>
                  {status.label}
                </Badge>
              )}
            </div>
            {subtitulo && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2 mt-3">
              {onVisualize && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={onVisualize}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {visualizeLabel || "Visualizar"}
                </Button>
              )}

              {copiavel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleCopy}
                >
                  {copiado ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  {copiado ? "Copiado!" : copiavel.label}
                </Button>
              )}

              {downloadUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => window.open(downloadUrl, "_blank")}
                >
                  <Download className="h-3 w-3 mr-1" />
                  {downloadLabel || "Baixar"}
                </Button>
              )}

              {acoes?.map((acao, index) => {
                const AcaoIcon = acao.icon;
                return (
                  <Button
                    key={index}
                    size="sm"
                    variant={acao.variant || "outline"}
                    className="h-7 text-xs"
                    onClick={acao.onClick}
                    disabled={acao.disabled}
                  >
                    {AcaoIcon && <AcaoIcon className="h-3 w-3 mr-1" />}
                    {acao.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
