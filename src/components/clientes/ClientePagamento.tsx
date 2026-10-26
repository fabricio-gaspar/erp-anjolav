import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Info, Loader2, Building2, MessageSquare, CalendarDays } from "lucide-react";
import { useConfiguracaoPagamentoCliente } from "@/hooks/useClientes";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { useConfiguracoesFiscaisOperacionais, useDescricoesServicosFiscais } from "@/hooks/useConfiguracoesFiscais";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  PAYMENT_CONDITION_LABELS, PAYMENT_METHOD_LABELS, BILLING_FREQUENCY_LABELS,
  parseCustomerPaymentTerms, customerPaymentTermsToConfig, customerPaymentMethodError,
  type PaymentCondition, type PreferredPaymentMethod, type BillingFrequency,
} from "@/lib/customerPaymentTerms";
import { Textarea } from "@/components/ui/textarea";

interface ClientePagamentoProps {
  clienteId: string | null;
  onBack: () => void;
  onSave: () => void;
}

export const ClientePagamento = (props: ClientePagamentoProps) => (
  <ClientePagamentoForm key={props.clienteId ?? "new"} {...props} />
);

const ClientePagamentoForm = ({ clienteId, onBack, onSave }: ClientePagamentoProps) => {
  const commercialPermission = usePermissaoModulo("alterar_condicoes_comerciais");
  const canManageCommercialTerms = commercialPermission.allowed && !commercialPermission.isLoading && !commercialPermission.isError;
  const { configuracao, isLoading, isError, refetch, upsertConfiguracao } = useConfiguracaoPagamentoCliente(clienteId);
  const { configuracoes: configuracoesFiscais, isLoading: isLoadingFiscal } = useConfiguracoesFiscaisOperacionais();
  const { descricoes, isLoading: isLoadingDescricoes } = useDescricoesServicosFiscais();

  const [formaPagamento, setFormaPagamento] = useState<PreferredPaymentMethod | null>(null);
  const [condicao, setCondicao] = useState<PaymentCondition | null>(null);
  const [tipoFechamento, setTipoFechamento] = useState<BillingFrequency>("avulso");
  const [diaFechamento, setDiaFechamento] = useState<number | null>(null);
  const [diaVencimento, setDiaVencimento] = useState<number>(10);
  const [cnpjEmissorId, setCnpjEmissorId] = useState<string>("");
  const [descricaoNfId, setDescricaoNfId] = useState<string>("");
  const [listarItensDetalhados, setListarItensDetalhados] = useState<boolean>(true);
  const [observacaoFaturamento, setObservacaoFaturamento] = useState<string>("");
  const paymentMethodError = customerPaymentMethodError(condicao, formaPagamento);

  useEffect(() => {
    const current = configuracao?.cliente_id === clienteId ? configuracao : null;
    const terms = parseCustomerPaymentTerms(current);
    setCondicao(terms.conditionConfigured ? terms.condition : null);
    setFormaPagamento(terms.preferredMethod);
    setTipoFechamento(terms.frequency);
    setDiaFechamento(terms.closingDay);
    setDiaVencimento(terms.dueDay ?? 10);
    setCnpjEmissorId(current?.cnpj_emissor_id || "");
    setDescricaoNfId(current?.descricao_nf_id || "");
    setListarItensDetalhados(current?.listar_itens_detalhados !== false);
    setObservacaoFaturamento(current?.observacao_faturamento || "");
  }, [configuracao, clienteId]);

  const handleSave = async () => {
    if (!canManageCommercialTerms || isLoading || isError || upsertConfiguracao.isPending) return;
    if (!clienteId) {
      toast.error("Salve os dados básicos do cliente primeiro.");
      return;
    }

    if (!condicao) {
      toast.error("Selecione uma condição de pagamento explícita.");
      return;
    }
    if (paymentMethodError) {
      toast.error(paymentMethodError);
      return;
    }
    if (condicao === "faturado" && tipoFechamento !== "avulso" && (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31)) {
      toast.error("Informe um dia de fechamento entre 1 e 31.");
      return;
    }

    upsertConfiguracao.mutate(
      {
        cliente_id: clienteId,
        ...customerPaymentTermsToConfig({
          condition: condicao, conditionConfigured: true, preferredMethod: formaPagamento,
          frequency: tipoFechamento, closingDay: diaFechamento, dueDay: diaVencimento,
        }),
        cnpj_emissor_id: cnpjEmissorId || null,
        descricao_nf_id: descricaoNfId || null,
        listar_itens_detalhados: listarItensDetalhados,
        observacao_faturamento: observacaoFaturamento || null,
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
  const descricoesAtivas = descricoes?.filter(d => d.ativo) || [];
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

  if (isError && clienteId) {
    return (
      <div role="alert" className="space-y-3 py-6">
        <p>Não foi possível carregar as condições de pagamento. A edição está bloqueada para evitar substituir dados não carregados.</p>
        <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
        <Button variant="outline" onClick={onBack}>Voltar</Button>
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
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground">
          Defina a condição e o método preferido para clientes industriais e residenciais. A preferência não comprova pagamento. Este cadastro não emite cobranças ou notas automaticamente.
        </p>
      </div>

      {!canManageCommercialTerms && <p className="text-sm text-muted-foreground">Consulta apenas. A edição exige permissão para gerenciar condições comerciais.</p>}
      <fieldset disabled={!canManageCommercialTerms || isSaving} className="space-y-6 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <Label>Condição de pagamento</Label>
            <Select disabled={!canManageCommercialTerms || isSaving} value={condicao ?? ""} onValueChange={(value) => setCondicao(value as PaymentCondition)}>
              <SelectTrigger><SelectValue placeholder="Não configurada" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_CONDITION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            {!condicao && <p className="text-xs text-muted-foreground">Sem condição explícita, o PDV usa pagamento na retirada. Cadastros legados não autorizam faturamento.</p>}
          </div>
          <div className="space-y-2">
            <Label>Método preferido</Label>
            <Select disabled={!canManageCommercialTerms || isSaving} value={formaPagamento ?? "none"} onValueChange={(value) => setFormaPagamento(value === "none" ? null : value as PreferredPaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não definido</SelectItem>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} disabled={!!customerPaymentMethodError(condicao, value as PreferredPaymentMethod)}>
                    {label}{value === "boleto" || value === "transferencia" ? " (somente Faturado)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMethodError && (
              <p role="alert" className="text-sm text-destructive">{paymentMethodError}. Altere a condição ou escolha outro método antes de salvar.</p>
            )}
          </div>
        </div>
        {condicao === "faturado" && <>
          <div className="space-y-2">
            <Label>Periodicidade do faturamento</Label>
            <Select disabled={!canManageCommercialTerms || isSaving} value={tipoFechamento} onValueChange={(value) => {
              setTipoFechamento(value as BillingFrequency);
              setDiaFechamento(value === "avulso" ? null : value === "quinzenal" ? 16 : 1);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_FREQUENCY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            {tipoFechamento !== "avulso" && <>
              <Label htmlFor="cliente-dia-fechamento">Dia de fechamento</Label>
                <Input id="cliente-dia-fechamento" type="number" min={1} max={31} step={1} value={diaFechamento ?? ""} onChange={(event) => setDiaFechamento(event.target.value === "" ? null : Number(event.target.value))} />
            </>}
            <p className="text-xs text-muted-foreground">Referência para o fechamento das pendências. A emissão deve ser realizada no fluxo de faturamento.</p>
          </div>
          {/* Dia de Vencimento — Estilo calendário */}
          <Card className="border-border/50">
            <CardContent className="pt-3 pb-3 px-3">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <label className="text-xs font-medium text-foreground">Dia de Vencimento</label>
              </div>
              <div className="grid grid-cols-7 gap-0.5 max-w-sm">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDiaVencimento(day)}
                    className={`h-7 w-full rounded-full text-xs font-medium transition-colors ${
                      diaVencimento === day
                        ? "bg-secondary text-secondary-foreground shadow-sm"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Dia de vencimento de referência: <span className="font-semibold text-foreground">{diaVencimento}</span>. Confira a data ao realizar o faturamento.
              </p>
            </CardContent>
          </Card>

        </>}

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
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">CNPJ Emissor Padrão</label>
            <Select disabled={!canManageCommercialTerms || isSaving} value={cnpjEmissorId || "none"} onValueChange={(val) => setCnpjEmissorId(val === "none" ? "" : val)}>
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
            <p className="text-xs text-muted-foreground">CNPJ da empresa que emitirá a NF para este cliente</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Descrição NF Padrão</label>
            <Select disabled={!canManageCommercialTerms || isSaving} value={descricaoNfId || "none"} onValueChange={(val) => setDescricaoNfId(val === "none" ? "" : val)}>
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
            <p className="text-xs text-muted-foreground">Descrição padrão do serviço que aparecerá na NF</p>
          </div>
        </div>

        {/* Formato da Descrição na NF */}
        <div className="mt-6 space-y-3">
          <label className="text-sm font-medium text-foreground">Formato da Descrição na NF</label>
          <RadioGroup
            disabled={!canManageCommercialTerms || isSaving}
            value={listarItensDetalhados ? "itens" : "padrao"}
            onValueChange={(value) => setListarItensDetalhados(value === "itens")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="itens" id="itens-radio" />
              <Label htmlFor="itens-radio" className="cursor-pointer">Listar itens detalhados</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="padrao" id="padrao-radio" />
              <Label htmlFor="padrao-radio" className="cursor-pointer">Usar descrição padrão</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            {listarItensDetalhados
              ? "Cada item será listado com nome, quantidade e valor"
              : "Será usada a descrição padrão selecionada acima"}
          </p>
        </div>

        {/* Observação Padrão */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">Observação Padrão para Faturamento</label>
          </div>
          <Textarea
            value={observacaoFaturamento}
            onChange={(e) => setObservacaoFaturamento(e.target.value)}
            placeholder="Texto que será inserido automaticamente na observação da fatura deste cliente..."
            rows={3}
            className="resize-none"
            skipUppercase
          />
          <p className="text-xs text-muted-foreground">
            Este texto será preenchido automaticamente ao gerar uma fatura para este cliente. Pode ser editado na hora.
          </p>
        </div>

      </fieldset>

      {/* Resumo */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            Resumo das Configurações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Condição:</span>
            <span className="font-medium">{condicao ? PAYMENT_CONDITION_LABELS[condicao] : "Não configurada — pagamento na retirada"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Método preferido:</span>
            <span className="font-medium text-primary">
              {formaPagamento ? PAYMENT_METHOD_LABELS[formaPagamento] : "-"}
            </span>
          </div>
          {condicao === "faturado" && <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Periodicidade:</span>
              <span className="font-medium text-primary">
                {BILLING_FREQUENCY_LABELS[tipoFechamento]}{tipoFechamento !== "avulso" && diaFechamento ? ` (dia ${diaFechamento})` : ""}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dia de Vencimento:</span>
              <span className="font-medium text-primary">Dia {diaVencimento}</span>
            </div>
          </>}
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CNPJ Emissor:</span>
            <span className="font-medium">{cnpjEmissorSelecionado ? cnpjEmissorSelecionado.nome : "Não definido"}</span>
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
            <span className="font-medium">{listarItensDetalhados ? "Itens detalhados" : "Descrição padrão"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-start gap-4 pt-4">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={handleSave} className="gap-2" disabled={isSaving || !canManageCommercialTerms || !condicao}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salvar e Continuar
        </Button>
      </div>
    </div>
  );
};
