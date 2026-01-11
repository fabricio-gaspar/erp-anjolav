import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Info, Loader2 } from "lucide-react";
import { useConfiguracaoPagamentoCliente } from "@/hooks/useClientes";
import { toast } from "sonner";

interface ClientePagamentoProps {
  clienteId: string | null;
  onBack: () => void;
  onSave: () => void;
}

type TipoFaturamento = "mensal" | "avulso";
type FormaPagamento = "boleto" | "pix" | "transferencia";

export const ClientePagamento = ({ clienteId, onBack, onSave }: ClientePagamentoProps) => {
  const { configuracao, isLoading, upsertConfiguracao } = useConfiguracaoPagamentoCliente(clienteId);

  const [tipoFaturamento, setTipoFaturamento] = useState<TipoFaturamento>("avulso");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [diaVencimento, setDiaVencimento] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("mensal_30");

  // Carregar dados existentes
  useEffect(() => {
    if (configuracao) {
      setTipoFaturamento((configuracao.tipo_faturamento as TipoFaturamento) || "avulso");
      setFormaPagamento((configuracao.forma_pagamento as FormaPagamento) || null);
      setDiaVencimento(configuracao.dia_vencimento?.toString() || "");
      setCondicaoPagamento(configuracao.condicao_pagamento || "mensal_30");
    }
  }, [configuracao]);

  // Reset when clienteId changes to null
  useEffect(() => {
    if (!clienteId) {
      setTipoFaturamento("avulso");
      setFormaPagamento(null);
      setDiaVencimento("");
      setCondicaoPagamento("mensal_30");
    }
  }, [clienteId]);

  const handleSave = async () => {
    if (!clienteId) {
      toast.error("Salve os dados básicos do cliente primeiro.");
      return;
    }

    upsertConfiguracao.mutate(
      {
        cliente_id: clienteId,
        tipo_faturamento: tipoFaturamento,
        forma_pagamento: formaPagamento,
        dia_vencimento: diaVencimento ? parseInt(diaVencimento) : null,
        condicao_pagamento: condicaoPagamento,
      },
      {
        onSuccess: () => {
          onSave();
        },
      }
    );
  };

  const isSaving = upsertConfiguracao.isPending;

  if (isLoading && clienteId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
      </div>
    );
  }

  if (!clienteId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Salve os dados básicos do cliente primeiro para continuar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Info Alert */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground">
          Configure como este cliente será cobrado mensalmente. Estes dados serão utilizados automaticamente no processo de faturamento.
        </p>
      </div>

      {/* Tipo de Faturamento + Forma de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Tipo de Faturamento <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-0">
            <Button
              type="button"
              variant={tipoFaturamento === "mensal" ? "default" : "outline"}
              className={`rounded-r-none ${tipoFaturamento === "mensal" ? "" : "border-r-0"}`}
              onClick={() => setTipoFaturamento("mensal")}
            >
              Mensal
            </Button>
            <Button
              type="button"
              variant={tipoFaturamento === "avulso" ? "default" : "outline"}
              className="rounded-l-none"
              onClick={() => setTipoFaturamento("avulso")}
            >
              Avulso
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Forma de Pagamento <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-0">
            <Button
              type="button"
              variant={formaPagamento === "boleto" ? "default" : "outline"}
              className={`rounded-r-none ${formaPagamento === "boleto" ? "" : "border-r-0"}`}
              onClick={() => setFormaPagamento("boleto")}
            >
              Boleto
            </Button>
            <Button
              type="button"
              variant={formaPagamento === "pix" ? "default" : "outline"}
              className="rounded-none border-r-0"
              onClick={() => setFormaPagamento("pix")}
            >
              PIX
            </Button>
            <Button
              type="button"
              variant={formaPagamento === "transferencia" ? "default" : "outline"}
              className="rounded-l-none"
              onClick={() => setFormaPagamento("transferencia")}
            >
              Transferência
            </Button>
          </div>
        </div>
      </div>

      {/* Dia de Vencimento + Condição de Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Dia de Vencimento <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="Ex: 10"
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Dia do mês em que a fatura vence (1 a 31)</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Condição de Pagamento</label>
          <Select value={condicaoPagamento} onValueChange={setCondicaoPagamento}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="mensal_30">Mensal (30 dias)</SelectItem>
              <SelectItem value="mensal_15">Quinzenal (15 dias)</SelectItem>
              <SelectItem value="semanal">Semanal (7 dias)</SelectItem>
              <SelectItem value="a_vista">À Vista</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo das Configurações */}
      <Card className="max-w-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Resumo das Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tipo de Faturamento:</span>
            <span className="font-medium capitalize">{tipoFaturamento === "mensal" ? "Mensal" : "Avulso"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Forma de Pagamento:</span>
            <span className="font-medium">
              {formaPagamento ? formaPagamento.charAt(0).toUpperCase() + formaPagamento.slice(1) : "-"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Dia de Vencimento:</span>
            <span className="font-medium">Dia {diaVencimento || "-"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Condição:</span>
            <span className="font-medium">
              {condicaoPagamento === "mensal_30" && "Mensal (30 dias)"}
              {condicaoPagamento === "mensal_15" && "Quinzenal (15 dias)"}
              {condicaoPagamento === "semanal" && "Semanal (7 dias)"}
              {condicaoPagamento === "a_vista" && "À Vista"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Footer Buttons */}
      <div className="flex items-center justify-start gap-4 pt-4">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salvar e Continuar
        </Button>
      </div>
    </div>
  );
};
