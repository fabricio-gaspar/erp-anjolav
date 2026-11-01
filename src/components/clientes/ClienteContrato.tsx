import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  History,
  Loader2,
  PackagePlus,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  BILLING_FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/customerPaymentTerms";
import { formatNumberToCurrency, parseCurrencyToNumber } from "@/lib/currencyUtils";
import {
  type ContratoItemDraft,
  type FormaPagamentoContrato,
  type PeriodicidadeContrato,
  useContratoCliente,
  useContratoOperacoes,
  useContratosAluguel,
  useItensContrato,
} from "@/hooks/useContratosAluguel";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { useProdutos } from "@/hooks/useProdutos";

interface ClienteContratoProps {
  clienteId: string | null;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

const operationLabels = {
  CRIAR: "Contrato criado",
  ATUALIZAR: "Condições atualizadas",
  ENCERRAR: "Contrato encerrado",
  MIGRACAO: "Registro compatibilizado",
} as const;

export function ClienteContrato({ clienteId }: ClienteContratoProps) {
  const permission = usePermissaoModulo("alterar_condicoes_comerciais");
  const canManage = permission.allowed && !permission.isLoading && !permission.isError;
  const { data: contrato, isLoading: loadingContrato, isError: contractError, refetch } = useContratoCliente(clienteId);
  const { data: persistedItems = [], isLoading: loadingItems } = useItensContrato(contrato?.id ?? null);
  const { data: operations = [] } = useContratoOperacoes(contrato?.id ?? null);
  const { produtos, isLoading: loadingProducts } = useProdutos();
  const { saveContrato, endContrato } = useContratosAluguel();

  const [creatingReplacement, setCreatingReplacement] = useState(false);
  const [description, setDescription] = useState("Contrato industrial");
  const [baseValue, setBaseValue] = useState("0,00");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [billingAuthorized, setBillingAuthorized] = useState(false);
  const [frequency, setFrequency] = useState<PeriodicidadeContrato>("avulso");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [paymentMethod, setPaymentMethod] = useState<FormaPagamentoContrato | null>(null);
  const [commercialRules, setCommercialRules] = useState("");
  const [notes, setNotes] = useState("");
  const [draftItems, setDraftItems] = useState<ContratoItemDraft[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitValue, setNewUnitValue] = useState("0");
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endReason, setEndReason] = useState("");

  const editingContract = contrato?.ativo && !creatingReplacement ? contrato : null;
  const showForm = !contrato || contrato.ativo || creatingReplacement;
  const formDisabled = !canManage || saveContrato.isPending || endContrato.isPending;

  useEffect(() => {
    setCreatingReplacement(false);
    setDescription("Contrato industrial");
    setBaseValue("0,00");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setBillingAuthorized(false);
    setFrequency("avulso");
    setClosingDay("");
    setDueDay("10");
    setPaymentMethod(null);
    setCommercialRules("");
    setNotes("");
    setDraftItems([]);
    setSelectedProductId("");
    setNewQuantity("1");
    setNewUnitValue("0");
  }, [clienteId]);

  useEffect(() => {
    if (!contrato?.ativo || creatingReplacement) return;
    setDescription(contrato.descricao);
    setBaseValue(formatNumberToCurrency(Number(contrato.valor_servico)));
    setStartDate(contrato.data_inicio);
    setEndDate(contrato.data_fim ?? "");
    setBillingAuthorized(contrato.autoriza_faturamento);
    setFrequency(contrato.periodicidade_fechamento);
    setClosingDay(contrato.dia_fechamento?.toString() ?? "");
    setDueDay(contrato.dia_vencimento.toString());
    setPaymentMethod(contrato.forma_pagamento);
    setCommercialRules(contrato.regras_comerciais ?? "");
    setNotes(contrato.observacoes ?? "");
  }, [contrato, creatingReplacement]);

  useEffect(() => {
    if (!contrato?.ativo || creatingReplacement || loadingItems) return;
    setDraftItems(persistedItems.flatMap((item) => item.produto_id ? [{
      produtoId: item.produto_id,
      quantidade: Number(item.quantidade),
      valorUnitario: Number(item.valor_unitario),
    }] : []));
  }, [contrato, persistedItems, loadingItems, creatingReplacement]);

  const resetForReplacement = () => {
    setCreatingReplacement(true);
    setDescription("Contrato industrial");
    setBaseValue("0,00");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setBillingAuthorized(false);
    setFrequency("avulso");
    setClosingDay("");
    setDueDay("10");
    setPaymentMethod(null);
    setCommercialRules("");
    setNotes("");
    setDraftItems([]);
  };

  const productMap = useMemo(
    () => new Map(produtos.map((product) => [product.id, product])),
    [produtos],
  );
  const availableProducts = useMemo(
    () => produtos.filter((product) => (
      product.status === "ativo" && !draftItems.some((item) => item.produtoId === product.id)
    )),
    [produtos, draftItems],
  );
  const serviceValue = draftItems.reduce(
    (total, item) => total + item.quantidade * item.valorUnitario,
    0,
  );
  const referenceValue = parseCurrencyToNumber(baseValue) + serviceValue;
  const referenceQuantity = draftItems.reduce((total, item) => total + item.quantidade, 0);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = productMap.get(productId);
    setNewUnitValue(product ? Number(product.preco).toFixed(2) : "0");
  };

  const handleAddItem = () => {
    const product = productMap.get(selectedProductId);
    const quantity = Number(newQuantity.replace(",", "."));
    const unitValue = Number(newUnitValue.replace(",", "."));
    if (!product) {
      toast.error("Selecione um serviço válido");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Informe uma quantidade de referência válida");
      return;
    }
    if (!Number.isFinite(unitValue) || unitValue < 0) {
      toast.error("Informe um preço unitário válido");
      return;
    }
    setDraftItems((current) => [...current, {
      produtoId: product.id,
      quantidade: quantity,
      valorUnitario: unitValue,
    }]);
    setSelectedProductId("");
    setNewQuantity("1");
    setNewUnitValue("0");
  };

  const handleRemoveItem = (productId: string) => {
    setDraftItems((current) => current.filter((item) => item.produtoId !== productId));
  };

  const handleBillingAuthorization = (checked: boolean) => {
    setBillingAuthorized(checked);
    if (checked) {
      if (frequency === "avulso") setFrequency("mensal");
      if (!closingDay) setClosingDay("1");
      if (!paymentMethod) setPaymentMethod("boleto");
      return;
    }
    setFrequency("avulso");
    setClosingDay("");
    if (paymentMethod === "boleto" || paymentMethod === "transferencia") {
      setPaymentMethod(null);
    }
  };

  const handleFrequency = (value: PeriodicidadeContrato) => {
    setFrequency(value);
    if (value === "avulso") setClosingDay("");
    else if (!closingDay) setClosingDay("1");
    else if (value === "quinzenal" && Number(closingDay) > 16) setClosingDay("1");
  };

  const handleSave = () => {
    if (!clienteId || formDisabled) return;
    const parsedBaseValue = parseCurrencyToNumber(baseValue);
    const parsedClosingDay = frequency === "avulso" ? null : Number(closingDay);
    const parsedDueDay = Number(dueDay);
    if (description.trim().length < 3) {
      toast.error("Informe uma descrição com ao menos 3 caracteres");
      return;
    }
    if (!startDate || (endDate && endDate < startDate)) {
      toast.error("Revise o período de vigência");
      return;
    }
    const maxClosingDay = frequency === "quinzenal" ? 16 : 31;
    if (frequency !== "avulso" && (
      !Number.isInteger(parsedClosingDay) || parsedClosingDay < 1 || parsedClosingDay > maxClosingDay
    )) {
      toast.error(frequency === "quinzenal"
        ? "O primeiro fechamento quinzenal deve ficar entre os dias 1 e 16"
        : "Informe um dia de fechamento entre 1 e 31");
      return;
    }
    if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      toast.error("Informe um dia de vencimento entre 1 e 31");
      return;
    }
    if (parsedBaseValue + serviceValue <= 0) {
      toast.error("Informe um valor fixo ou ao menos um serviço com valor");
      return;
    }
    saveContrato.mutate({
      id: editingContract?.id,
      clienteId,
      descricao: description.trim(),
      valorServico: parsedBaseValue,
      dataInicio: startDate,
      dataFim: endDate || null,
      periodicidade: frequency,
      diaFechamento: parsedClosingDay,
      diaVencimento: parsedDueDay,
      formaPagamento: paymentMethod,
      autorizaFaturamento: billingAuthorized,
      regrasComerciais: commercialRules.trim() || null,
      observacoes: notes.trim() || null,
      itens: draftItems,
      versao: editingContract?.versao,
    }, {
      onSuccess: () => setCreatingReplacement(false),
    });
  };

  const handleEnd = () => {
    if (!editingContract || endReason.trim().length < 5) return;
    endContrato.mutate({
      id: editingContract.id,
      motivo: endReason.trim(),
      versao: editingContract.versao,
    }, {
      onSuccess: () => {
        setEndDialogOpen(false);
        setEndReason("");
      },
    });
  };

  if (!clienteId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">Salve ou selecione um cliente industrial</p>
          <p className="mt-1 text-sm text-muted-foreground">Depois, registre aqui as condições contratuais.</p>
        </CardContent>
      </Card>
    );
  }

  if (loadingContrato) {
    return (
      <Card><CardContent className="flex items-center justify-center py-14">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando contrato...</span>
      </CardContent></Card>
    );
  }

  if (contractError) {
    return (
      <Card><CardContent role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
        <XCircle className="h-8 w-8 text-destructive" />
        <p>Não foi possível carregar o contrato. A edição permanece bloqueada.</p>
        <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5" data-testid="industrial-contract-workspace">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.035]">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileCheck2 className="h-5 w-5 text-primary" />
                Contrato industrial
              </CardTitle>
              {contrato ? (
                <StatusBadge variant={contrato.ativo ? "success" : "default"}>
                  {contrato.ativo ? "Ativo" : "Encerrado"}
                </StatusBadge>
              ) : <StatusBadge>Novo</StatusBadge>}
            </div>
            <CardDescription className="max-w-2xl">
              Centraliza vigência, preços, regras e autorização de faturamento. A gravação ocorre em uma única operação auditável.
            </CardDescription>
          </div>
          {editingContract && (
            <div className="rounded-lg border bg-background/80 px-3 py-2 text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Versão vigente</p>
              <p className="font-semibold">{editingContract.versao + 1}</p>
            </div>
          )}
        </CardHeader>
      </Card>

      {!canManage && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Consulta apenas. Criar, alterar ou encerrar exige permissão para condições comerciais.</p>
        </div>
      )}

      {contrato && !contrato.ativo && !creatingReplacement && (
        <Card>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{contrato.descricao}</h3>
                <StatusBadge>Encerrado</StatusBadge>
              </div>
              <p className="text-sm text-muted-foreground">
                Vigência: {format(parseISO(contrato.data_inicio), "dd/MM/yyyy")}
                {contrato.data_fim ? ` a ${format(parseISO(contrato.data_fim), "dd/MM/yyyy")}` : ""}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Motivo:</span> {contrato.encerramento_motivo || "Não informado em cadastro legado"}
              </p>
            </div>
            <Button onClick={resetForReplacement} disabled={!canManage} className="w-full gap-2 lg:w-auto">
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <fieldset disabled={formDisabled} className="min-w-0 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vigência e identificação</CardTitle>
              <CardDescription>Dados que definem quando e em quais termos o acordo comercial é válido.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contract-description">Descrição *</Label>
                <Input
                  id="contract-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex.: Higienização de enxoval hospitalar"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-start-date">Início da vigência *</Label>
                <Input id="contract-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-end-date">Fim da vigência</Label>
                <Input id="contract-end-date" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
                <p className="text-xs text-muted-foreground">Em branco para prazo indeterminado.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                Cobrança e autorização
              </CardTitle>
              <CardDescription>O segmento industrial, sozinho, não concede crédito nem permite faturamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <Label htmlFor="contract-billing-authorized" className="text-base">Autorizar faturamento contratual</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Permite concluir os serviços sem quitação imediata e receber pelo fechamento das faturas de origem.
                  </p>
                </div>
                <Switch id="contract-billing-authorized" checked={billingAuthorized} onCheckedChange={handleBillingAuthorization} />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="contract-base-value">Valor fixo por ciclo</Label>
                  <CurrencyInput id="contract-base-value" value={baseValue} onChange={(event) => setBaseValue(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Periodicidade</Label>
                  <Select value={frequency} onValueChange={(value) => handleFrequency(value as PeriodicidadeContrato)} disabled={!billingAuthorized}>
                    <SelectTrigger aria-label="Periodicidade do contrato"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BILLING_FREQUENCY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract-closing-day">
                    {frequency === "quinzenal" ? "Primeiro fechamento" : "Dia do fechamento"}
                  </Label>
                  <Input
                    id="contract-closing-day"
                    type="number"
                    min={1}
                    max={frequency === "quinzenal" ? 16 : 31}
                    value={closingDay}
                    onChange={(event) => setClosingDay(event.target.value)}
                    disabled={!billingAuthorized || frequency === "avulso"}
                  />
                  {frequency === "quinzenal" && <p className="text-xs text-muted-foreground">O segundo fechamento ocorre 15 dias depois.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract-due-day">Dia do vencimento *</Label>
                  <Input id="contract-due-day" type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2 xl:col-span-1">
                  <Label>Método preferido</Label>
                  <Select value={paymentMethod ?? "none"} onValueChange={(value) => setPaymentMethod(value === "none" ? null : value as FormaPagamentoContrato)}>
                    <SelectTrigger aria-label="Método de pagamento do contrato"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não definido</SelectItem>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <SelectItem
                          key={value}
                          value={value}
                          disabled={!billingAuthorized && (value === "boleto" || value === "transferencia")}
                        >
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PackagePlus className="h-4 w-4 text-primary" />
                Serviços, unidades e preços
              </CardTitle>
              <CardDescription>Quantidades servem como referência contratual; o faturamento usa as origens efetivamente selecionadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-xl border bg-muted/25 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_130px_160px_auto] lg:items-end">
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label>Serviço</Label>
                  <Select value={selectedProductId} onValueChange={handleProductChange}>
                    <SelectTrigger aria-label="Serviço do contrato"><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                    <SelectContent>
                      {loadingProducts ? <SelectItem value="loading" disabled>Carregando...</SelectItem> : availableProducts.length === 0 ? (
                        <SelectItem value="empty" disabled>Nenhum serviço disponível</SelectItem>
                      ) : availableProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.nome} · {product.unidade || "unidade"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract-item-quantity">Quantidade ref.</Label>
                  <Input id="contract-item-quantity" inputMode="decimal" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contract-item-value">Preço unitário (R$)</Label>
                  <Input id="contract-item-value" inputMode="decimal" value={newUnitValue} onChange={(event) => setNewUnitValue(event.target.value)} />
                </div>
                <Button type="button" variant="secondary" onClick={handleAddItem} disabled={!selectedProductId} className="w-full gap-2 lg:w-auto">
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
              </div>

              {loadingItems && editingContract ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando composição...
                </div>
              ) : draftItems.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center">
                  <PackagePlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium">Nenhum serviço variável adicionado</p>
                  <p className="mt-1 text-xs text-muted-foreground">O contrato pode usar apenas valor fixo ou combinar os dois modelos.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {draftItems.map((item) => {
                      const product = productMap.get(item.produtoId);
                      return (
                        <article key={item.produtoId} className="rounded-xl border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{product?.nome || "Serviço indisponível"}</p>
                              <p className="text-xs text-muted-foreground">Unidade: {product?.unidade || "unidade"}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${product?.nome || "serviço"}`} onClick={() => handleRemoveItem(item.produtoId)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                            <div><dt className="text-xs text-muted-foreground">Qtd.</dt><dd>{item.quantidade}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Unitário</dt><dd>{formatCurrency(item.valorUnitario)}</dd></div>
                            <div><dt className="text-xs text-muted-foreground">Referência</dt><dd className="font-semibold">{formatCurrency(item.quantidade * item.valorUnitario)}</dd></div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-hidden rounded-xl border md:block">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Serviço</TableHead><TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Quantidade ref.</TableHead>
                        <TableHead className="text-right">Preço unitário</TableHead>
                        <TableHead className="text-right">Valor ref.</TableHead><TableHead className="w-12" />
                      </TableRow></TableHeader>
                      <TableBody>{draftItems.map((item) => {
                        const product = productMap.get(item.produtoId);
                        return <TableRow key={item.produtoId}>
                          <TableCell className="font-medium">{product?.nome || "Serviço indisponível"}</TableCell>
                          <TableCell>{product?.unidade || "unidade"}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valorUnitario)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(item.quantidade * item.valorUnitario)}</TableCell>
                          <TableCell><Button type="button" variant="ghost" size="icon" aria-label={`Remover ${product?.nome || "serviço"}`} onClick={() => handleRemoveItem(item.produtoId)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                        </TableRow>;
                      })}</TableBody>
                    </Table>
                  </div>
                </>
              )}

              <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/[0.035] p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Valor fixo</p><p className="mt-1 font-semibold">{formatCurrency(parseCurrencyToNumber(baseValue))}</p></div>
                <div><p className="text-xs text-muted-foreground">Serviços de referência</p><p className="mt-1 font-semibold">{formatCurrency(serviceValue)}</p></div>
                <div><p className="text-xs text-muted-foreground">Quantidade de referência</p><p className="mt-1 font-semibold">{referenceQuantity.toLocaleString("pt-BR")}</p></div>
                <div className="rounded-lg bg-primary px-3 py-2 text-primary-foreground"><p className="text-xs opacity-80">Valor de referência</p><p className="mt-1 text-lg font-bold">{formatCurrency(referenceValue)}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Regras e observações</CardTitle></CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contract-commercial-rules">Regras comerciais verificadas</Label>
                <Textarea id="contract-commercial-rules" rows={4} value={commercialRules} onChange={(event) => setCommercialRules(event.target.value)} placeholder="Reajustes, tolerâncias, mínimos, exceções e critérios de medição..." skipUppercase />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contract-notes">Observações operacionais</Label>
                <Textarea id="contract-notes" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Janelas de coleta, contatos e orientações da operação..." skipUppercase />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {editingContract && <Button type="button" variant="outline" className="w-full text-destructive hover:text-destructive sm:w-auto" onClick={() => setEndDialogOpen(true)}><XCircle className="mr-2 h-4 w-4" /> Encerrar contrato</Button>}
              {creatingReplacement && <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => setCreatingReplacement(false)}>Cancelar novo contrato</Button>}
            </div>
            <Button type="button" onClick={handleSave} disabled={formDisabled} className="w-full gap-2 sm:w-auto" data-testid="save-industrial-contract">
              {saveContrato.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingContract ? "Salvar alterações" : "Criar contrato"}
            </Button>
          </div>
        </fieldset>
      )}

      {contrato && operations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" /> Histórico auditável</CardTitle><CardDescription>Eventos preservados com versão e horário da operação.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {operations.slice(0, 6).map((operation, index) => (
              <div key={operation.id} className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{operationLabels[operation.tipo]}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(operation.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Versão {operation.versao_nova + 1}</p>
                </div>
                {index === 0 && <CheckCircle2 className="mt-1 h-4 w-4 text-success" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar contrato industrial</DialogTitle>
            <DialogDescription>
              O contrato deixa de autorizar novos fechamentos. O cadastro, a composição e todo o histórico permanecem preservados.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="contract-end-reason">Motivo do encerramento *</Label>
            <Textarea id="contract-end-reason" value={endReason} onChange={(event) => setEndReason(event.target.value)} rows={4} placeholder="Informe o motivo com pelo menos 5 caracteres" skipUppercase />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialogOpen(false)} disabled={endContrato.isPending}>Manter contrato</Button>
            <Button variant="destructive" onClick={handleEnd} disabled={endReason.trim().length < 5 || endContrato.isPending}>
              {endContrato.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
