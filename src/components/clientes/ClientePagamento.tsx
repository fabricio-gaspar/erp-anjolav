import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Info, Loader2, Building2 } from "lucide-react";
import { useConfiguracaoPagamentoCliente } from "@/hooks/useClientes";
import { BOLETO_ENABLED } from "@/lib/featureFlags";
import { useConfiguracoesFiscais, useDescricoesServicosFiscais } from "@/hooks/useConfiguracoesFiscais";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ClientePagamentoProps {
  clienteId: string | null;
  onBack: () => void;
  onSave: () => void;
}

type TipoFaturamento = "mensal" | "avulso";
type FormaPagamento = "boleto" | "pix" | "transferencia";
type TipoFechamento = "mensal" | "quinzenal" | "avulso";
type CondicaoPagamento = "a_vista" | "5_dias" | "7_dias" | "10_dias" | "15_dias" | "20_dias" | "30_dias";

// Mapear valores antigos para novos ao carregar
function normalizeCondicao(value: string | null): CondicaoPagamento {
  switch (value) {
    case "mensal_30": return "30_dias";
    case "mensal_15": return "15_dias";
    case "semanal": return "7_dias";
    case "a_vista": return "a_vista";
    case "7_dias": return "7_dias";
    case "15_dias": return "15_dias";
    case "30_dias": return "30_dias";
    default: return "30_dias";
  }
}

function diaFechamentoToTipo(dia: number | null): TipoFechamento {
  if (dia === null) return "avulso";
  return dia === 16 ? "quinzenal" : "mensal";
}

const condicaoLabels: Record<CondicaoPagamento, string> = {
  a_vista: "À Vista",
  "5_dias": "5 dias",
  "7_dias": "7 dias",
  "10_dias": "10 dias",
  "15_dias": "15 dias",
  "20_dias": "20 dias",
  "30_dias": "30 dias",
};

export const ClientePagamento = ({ clienteId, onBack, onSave }: ClientePagamentoProps) => {
  const { configuracao, isLoading, upsertConfiguracao } = useConfiguracaoPagamentoCliente(clienteId);
  const { configuracoes: configuracoesFiscais, isLoading: isLoadingFiscal } = useConfiguracoesFiscais();
  const { descricoes, isLoading: isLoadingDescricoes } = useDescricoesServicosFiscais();

  const [tipoFaturamento, setTipoFaturamento] = useState<TipoFaturamento>("avulso");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [tipoFechamento, setTipoFechamento] = useState<TipoFechamento>("mensal");
  const [condicaoPagamento, setCondicaoPagamento] = useState<CondicaoPagamento>("30_dias");
  const [cnpjEmissorId, setCnpjEmissorId] = useState<string>("");
  const [descricaoNfId, setDescricaoNfId] = useState<string>("");
  const [listarItensDetalhados, setListarItensDetalhados] = useState<boolean>(true);

  // Carregar dados existentes
  useEffect(() => {
    if (configuracao) {
      setTipoFaturamento((configuracao.tipo_faturamento as TipoFaturamento) || "avulso");
      setFormaPagamento((configuracao.forma_pagamento as FormaPagamento) || null);
      setTipoFechamento(diaFechamentoToTipo(configuracao.dia_fechamento));
      setCondicaoPagamento(normalizeCondicao(configuracao.condicao_pagamento));
      setCnpjEmissorId(configuracao.cnpj_emissor_id || "");
      setDescricaoNfId(configuracao.descricao_nf_id || "");
      setListarItensDetalhados(configuracao.listar_itens_detalhados !== false);
    }
  }, [configuracao]);

  // Reset when clienteId changes to null
  useEffect(() => {
    if (!clienteId) {
      setTipoFaturamento("avulso");
      setFormaPagamento(null);
      setTipoFechamento("mensal");
      setCondicaoPagamento("30_dias");
      setCnpjEmissorId("");
      setDescricaoNfId("");
      setListarItensDetalhados(true);
    }
  }, [clienteId]);

  const handleSave = async () => {
    if (!clienteId) {
      toast.error("Salve os dados básicos do cliente primeiro.");
      return;
    }

    const diaFechamento = tipoFechamento === "avulso" ? null : tipoFechamento === "quinzenal" ? 16 : 1;

    upsertConfiguracao.mutate(
      {
        cliente_id: clienteId,
        tipo_faturamento: tipoFaturamento,
        forma_pagamento: formaPagamento,
        dia_vencimento: null,
        dia_fechamento: diaFechamento,
        condicao_pagamento: condicaoPagamento,
        cnpj_emissor_id: cnpjEmissorId || null,
        descricao_nf_id: descricaoNfId || null,
        listar_itens_detalhados: listarItensDetalhados,
      },
      {
        onSuccess: () => {
          onSave();
        },
      }
    );
  };

  const isSaving = upsertConfiguracao.isPending;
  const isLoadingAll = isLoading || isLoadingFiscal || isLoadingDescricoes;
  
  // Filtrar apenas descrições ativas
  const descricoesAtivas = descricoes?.filter(d => d.ativo) || [];
  
  // Encontrar os nomes selecionados para o resumo
  const cnpjEmissorSelecionado = configuracoesFiscais.find(c => c.id === cnpjEmissorId);
  const descricaoSelecionada = descricoesAtivas.find(d => d.id === descricaoNfId);

  if (isLoadingAll && clienteId) {
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
              className={`rounded-r-none ${tipoFaturamento === "mensal" ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-r-0"}`}
              onClick={() => setTipoFaturamento("mensal")}
            >
              Mensal
            </Button>
            <Button
              type="button"
              variant={tipoFaturamento === "avulso" ? "default" : "outline"}
              className={`rounded-l-none ${tipoFaturamento === "avulso" ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : ""}`}
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
            {BOLETO_ENABLED && (
              <Button
                type="button"
                variant={formaPagamento === "boleto" ? "default" : "outline"}
                className={`rounded-r-none ${formaPagamento === "boleto" ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-r-0"}`}
                onClick={() => setFormaPagamento("boleto")}
              >
                Boleto
              </Button>
            )}
            <Button
              type="button"
              variant={formaPagamento === "pix" ? "default" : "outline"}
              className={BOLETO_ENABLED 
                ? `rounded-none ${formaPagamento === "pix" ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-r-0"}`
                : `rounded-r-none ${formaPagamento === "pix" ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : "border-r-0"}`}
              onClick={() => setFormaPagamento("pix")}
            >
              PIX
            </Button>
            <Button
              type="button"
              variant={formaPagamento === "transferencia" ? "default" : "outline"}
              className={`rounded-l-none ${formaPagamento === "transferencia" ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" : ""}`}
              onClick={() => setFormaPagamento("transferencia")}
            >
              Transferência
            </Button>
          </div>
        </div>
      </div>

      {/* Tipo de Fechamento + Prazo para Pagamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Tipo de Fechamento
          </label>
          <ToggleGroup
            type="single"
            value={tipoFechamento}
            onValueChange={(value) => {
              if (value) setTipoFechamento(value as TipoFechamento);
            }}
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="mensal" className={`px-4 ${tipoFechamento === "mensal" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              Mensal (dia 1)
            </ToggleGroupItem>
            <ToggleGroupItem value="quinzenal" className={`px-4 ${tipoFechamento === "quinzenal" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              Quinzenal (dia 16)
            </ToggleGroupItem>
            <ToggleGroupItem value="avulso" className={`px-4 ${tipoFechamento === "avulso" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              Avulso
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            {tipoFechamento === "mensal"
              ? "O faturamento será gerado no dia 1 de cada mês"
              : tipoFechamento === "quinzenal"
              ? "O faturamento será gerado no dia 16 de cada mês"
              : "O faturamento será gerado sob demanda"}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Prazo para Pagamento
          </label>
          <ToggleGroup
            type="single"
            value={condicaoPagamento}
            onValueChange={(value) => {
              if (value) setCondicaoPagamento(value as CondicaoPagamento);
            }}
            variant="outline"
            className="justify-start flex-wrap"
          >
            <ToggleGroupItem value="a_vista" className={`px-3 ${condicaoPagamento === "a_vista" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              À Vista
            </ToggleGroupItem>
            <ToggleGroupItem value="5_dias" className={`px-3 ${condicaoPagamento === "5_dias" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              5 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="7_dias" className={`px-3 ${condicaoPagamento === "7_dias" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              7 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="10_dias" className={`px-3 ${condicaoPagamento === "10_dias" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              10 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="15_dias" className={`px-3 ${condicaoPagamento === "15_dias" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              15 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="20_dias" className={`px-3 ${condicaoPagamento === "20_dias" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              20 dias
            </ToggleGroupItem>
            <ToggleGroupItem value="30_dias" className={`px-3 ${condicaoPagamento === "30_dias" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" : ""}`}>
              30 dias
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">
            Prazo após o fechamento para o cliente efetuar o pagamento
          </p>
        </div>
      </div>

      {/* Configurações Fiscais para Faturamento */}
      <Separator className="my-6" />
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Configurações Fiscais para Faturamento</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Defina os valores padrão que serão usados automaticamente ao faturar este cliente.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CNPJ Emissor Padrão */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            CNPJ Emissor Padrão
          </label>
           <Select value={cnpjEmissorId || "none"} onValueChange={(val) => setCnpjEmissorId(val === "none" ? "" : val)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecione o CNPJ emissor..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="none">Nenhum (escolher na hora)</SelectItem>
              {configuracoesFiscais.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.nome} - {config.cnpj}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            CNPJ da empresa que emitirá a NF para este cliente
          </p>
        </div>

        {/* Descrição NF Padrão */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Descrição NF Padrão
          </label>
           <Select value={descricaoNfId || "none"} onValueChange={(val) => setDescricaoNfId(val === "none" ? "" : val)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecione a descrição..." />
            </SelectTrigger>
            <SelectContent className="bg-background">
              <SelectItem value="none">Nenhuma (escolher na hora)</SelectItem>
              {descricoesAtivas.map((desc) => (
                <SelectItem key={desc.id} value={desc.id}>
                  {desc.descricao.length > 50 ? desc.descricao.substring(0, 50) + "..." : desc.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Descrição padrão do serviço que aparecerá na NF
          </p>
        </div>
      </div>

      {/* Tipo de Descrição */}
      <div className="mt-6 space-y-3">
        <label className="text-sm font-medium text-foreground">
          Formato da Descrição na NF
        </label>
        <RadioGroup 
          value={listarItensDetalhados ? "itens" : "padrao"} 
          onValueChange={(value) => setListarItensDetalhados(value === "itens")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="itens" id="itens-radio" />
            <Label htmlFor="itens-radio" className="cursor-pointer">
              Listar itens detalhados
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="padrao" id="padrao-radio" />
            <Label htmlFor="padrao-radio" className="cursor-pointer">
              Usar descrição padrão
            </Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">
          {listarItensDetalhados 
            ? "Cada item será listado com nome, quantidade e valor" 
            : "Será usada a descrição padrão selecionada acima"}
        </p>
      </div>

      {/* Resumo das Configurações */}
      <Card className="max-w-lg border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Resumo das Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tipo de Faturamento:</span>
            <span className="font-medium text-primary">{tipoFaturamento === "mensal" ? "Mensal" : "Avulso"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Forma de Pagamento:</span>
            <span className="font-medium text-primary">
              {formaPagamento ? formaPagamento.charAt(0).toUpperCase() + formaPagamento.slice(1) : "-"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tipo de Fechamento:</span>
            <span className="font-medium text-primary">
              {tipoFechamento === "mensal" ? "Mensal (dia 1)" : tipoFechamento === "quinzenal" ? "Quinzenal (dia 16)" : "Avulso"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Prazo para Pagamento:</span>
            <span className="font-medium text-primary">{condicaoLabels[condicaoPagamento]}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CNPJ Emissor:</span>
            <span className="font-medium">
              {cnpjEmissorSelecionado ? cnpjEmissorSelecionado.nome : "Não definido"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Descrição NF:</span>
            <span className="font-medium truncate max-w-[200px]">
              {descricaoSelecionada 
                ? (descricaoSelecionada.descricao.length > 30 
                    ? descricaoSelecionada.descricao.substring(0, 30) + "..." 
                    : descricaoSelecionada.descricao)
                : "Não definida"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Formato NF:</span>
            <span className="font-medium">
              {listarItensDetalhados ? "Itens detalhados" : "Descrição padrão"}
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
