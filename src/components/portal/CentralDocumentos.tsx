import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  FileText, 
  Receipt, 
  CreditCard, 
  QrCode,
  ChevronDown,
  ChevronUp,
  FolderOpen
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DocumentoCard } from "./DocumentoCard";
import type { FaturaPortal } from "@/hooks/usePortalData";

interface CentralDocumentosProps {
  faturas: FaturaPortal[];
  isLoading: boolean;
}

function getStatusFatura(status: string) {
  switch (status) {
    case "pago":
      return { label: "Pago", variant: "default" as const, className: "bg-green-600" };
    case "nota_emitida":
      return { label: "NF Emitida", variant: "secondary" as const };
    case "enviado":
      return { label: "Enviado", variant: "default" as const, className: "bg-blue-600" };
    default:
      return { label: "Pendente", variant: "outline" as const };
  }
}

export function CentralDocumentos({ faturas, isLoading }: CentralDocumentosProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("faturas");

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  // Separar faturas por categoria
  const faturasComNF = faturas.filter(f => f.numero_nf || f.link_pdf_nf);
  const faturasComBoleto = faturas.filter(f => f.boleto_url || f.boleto_linha_digitavel);
  const faturasComPix = faturas.filter(f => f.pix_copia_cola);
  const faturasPendentes = faturas.filter(f => f.status !== "pago");
  const faturasPagas = faturas.filter(f => f.status === "pago");

  const sections = [
    {
      id: "faturas",
      title: "Faturas",
      icon: FileText,
      count: faturas.length,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      id: "notas",
      title: "Notas Fiscais",
      icon: Receipt,
      count: faturasComNF.length,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      id: "boletos",
      title: "Boletos",
      icon: CreditCard,
      count: faturasComBoleto.length,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      id: "pix",
      title: "PIX",
      icon: QrCode,
      count: faturasComPix.length,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-primary" />
        Central de Documentos
      </h3>

      {faturas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum documento disponível</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Cards resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.id}
                  className={`cursor-pointer transition-colors ${
                    expandedSection === section.id ? "border-primary" : ""
                  }`}
                  onClick={() =>
                    setExpandedSection(expandedSection === section.id ? null : section.id)
                  }
                >
                  <CardContent className="p-3 flex items-center gap-2">
                    <div className={`p-1.5 rounded ${section.bgColor}`}>
                      <Icon className={`h-4 w-4 ${section.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground">{section.count} docs</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Lista expandida de faturas */}
          {expandedSection === "faturas" && (
            <div className="space-y-2 pt-2">
              {faturas.slice(0, 10).map((fatura) => {
                const status = getStatusFatura(fatura.status);
                return (
                  <DocumentoCard
                    key={fatura.id}
                    icon={FileText}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-100"
                    titulo={`Fatura ${format(new Date(fatura.periodo_inicio), "MMM/yyyy", { locale: ptBR })}`}
                    subtitulo={`R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • ${format(new Date(fatura.periodo_inicio), "dd/MM")} a ${format(new Date(fatura.periodo_fim), "dd/MM")}`}
                    status={status}
                  />
                );
              })}
            </div>
          )}

          {/* Lista de Notas Fiscais */}
          {expandedSection === "notas" && (
            <div className="space-y-2 pt-2">
              {faturasComNF.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma nota fiscal emitida
                </p>
              ) : (
                faturasComNF.slice(0, 10).map((fatura) => (
                  <DocumentoCard
                    key={fatura.id}
                    icon={Receipt}
                    iconColor="text-purple-600"
                    iconBg="bg-purple-100"
                    titulo={`NF ${fatura.numero_nf || "Pendente"}`}
                    subtitulo={fatura.data_emissao_nf ? `Emitida em ${format(new Date(fatura.data_emissao_nf), "dd/MM/yyyy")}` : undefined}
                    downloadUrl={fatura.link_pdf_nf || undefined}
                    downloadLabel="Baixar NF"
                    copiavel={fatura.chave_acesso ? { valor: fatura.chave_acesso, label: "Copiar Chave" } : undefined}
                  />
                ))
              )}
            </div>
          )}

          {/* Lista de Boletos */}
          {expandedSection === "boletos" && (
            <div className="space-y-2 pt-2">
              {faturasComBoleto.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum boleto disponível
                </p>
              ) : (
                faturasComBoleto.slice(0, 10).map((fatura) => {
                  const status = getStatusFatura(fatura.status);
                  return (
                    <DocumentoCard
                      key={fatura.id}
                      icon={CreditCard}
                      iconColor="text-orange-600"
                      iconBg="bg-orange-100"
                      titulo={`Boleto - R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      subtitulo={fatura.data_vencimento ? `Vencimento: ${format(new Date(fatura.data_vencimento), "dd/MM/yyyy")}` : undefined}
                      status={status}
                      downloadUrl={fatura.boleto_url || undefined}
                      downloadLabel="Baixar Boleto"
                      copiavel={fatura.boleto_linha_digitavel ? { valor: fatura.boleto_linha_digitavel, label: "Copiar Linha Digitável" } : undefined}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Lista de PIX */}
          {expandedSection === "pix" && (
            <div className="space-y-2 pt-2">
              {faturasComPix.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum PIX disponível
                </p>
              ) : (
                faturasComPix.slice(0, 10).map((fatura) => {
                  const status = getStatusFatura(fatura.status);
                  return (
                    <DocumentoCard
                      key={fatura.id}
                      icon={QrCode}
                      iconColor="text-green-600"
                      iconBg="bg-green-100"
                      titulo={`PIX - R$ ${Number(fatura.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      subtitulo={fatura.data_vencimento ? `Vencimento: ${format(new Date(fatura.data_vencimento), "dd/MM/yyyy")}` : undefined}
                      status={status}
                      copiavel={fatura.pix_copia_cola ? { valor: fatura.pix_copia_cola, label: "Copiar Código PIX" } : undefined}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
