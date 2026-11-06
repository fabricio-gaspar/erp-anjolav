import { useMemo, useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, CalendarClock, Check, CheckCircle2,
  ClipboardCheck, FileText, Loader2, MapPin, Minus, PackagePlus, PencilLine, Plus,
  Search, ShoppingBag, Trash2, Truck, UserRound, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ItemDetalhesModal } from "@/components/caixa/ItemDetalhesModal";
import { useClientes, useConfiguracaoPagamentoCliente, useEnderecoCliente } from "@/hooks/useClientes";
import { useMotoristas } from "@/hooks/useMotoristas";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { useCreatePdvSale } from "@/hooks/usePdvPayments";
import { usePrecosEspeciais, useProdutos } from "@/hooks/useProdutos";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getCanonicalPdvPath } from "@/lib/authorization";
import { buildClientPriceCatalog } from "@/lib/clientPricing";
import { customerPaymentTermsLabels, parseCustomerPaymentTerms } from "@/lib/customerPaymentTerms";
import { calculateOrderPreview, formatOrderAddress, isValidOrderQuantity, orderUnitLabel } from "@/lib/orderIntake";
import { createPdvIdempotencyKey } from "@/lib/pdvPayment";
import { cn } from "@/lib/utils";

interface NovaOSProps { onSuccess?: () => void }

interface CartItem {
  productId: string;
  name: string;
  code: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
}

interface CatalogItem {
  id: string;
  nome: string;
  codigo: string | null;
  unidade: string | null;
  precoAplicado: number;
}

type Step = 1 | 2 | 3;
type ReceiptMode = "balcao" | "coleta";
type DeliveryMode = "balcao" | "entrega";

const CURRENCY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const STEPS: Array<{ value: Step; label: string; description: string }> = [
  { value: 1, label: "Cliente e itens", description: "Serviços e medidas" },
  { value: 2, label: "Prazo e logística", description: "Recebimento e entrega" },
  { value: 3, label: "Revisão", description: "Conferência final" },
];

function parseNumber(value: string) { return Number(value.replace(",", ".")); }

export function NovaOS({ onSuccess }: NovaOSProps) {
  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const { activeTenant } = useAuth();
  const area = activeArea === "industrial" || activeArea === "residencial" ? activeArea : null;
  const areaLabel = area === "industrial" ? "Industrial" : "Doméstico";
  const today = format(new Date(), "yyyy-MM-dd");
  const [step, setStep] = useState<Step>(1);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [intakeDate, setIntakeDate] = useState(today);
  const [deliveryDate, setDeliveryDate] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"));
  const [receiptMode, setReceiptMode] = useState<ReceiptMode>("balcao");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("balcao");
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [urgencyPercentage, setUrgencyPercentage] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const submissionRef = useRef<{ fingerprint: string; key: string } | null>(null);

  const clientsQuery = useClientes();
  const productsQuery = useProdutos();
  const driversQuery = useMotoristas();
  const vehiclesQuery = useVeiculos();
  const commercialPermission = usePermissaoModulo("alterar_condicoes_comerciais");
  const createOrder = useCreatePdvSale();
  const activeClients = useMemo(() => clientsQuery.clientes.filter((client) => client.ativo), [clientsQuery.clientes]);
  const selectedClient = activeClients.find((client) => client.id === selectedClientId) ?? null;
  const pricesQuery = usePrecosEspeciais(selectedClientId);
  const termsQuery = useConfiguracaoPagamentoCliente(selectedClientId);
  const addressQuery = useEnderecoCliente(selectedClientId);
  const paymentTerms = parseCustomerPaymentTerms(termsQuery.configuracao);
  const paymentLabels = customerPaymentTermsLabels(paymentTerms);

  const catalog = useMemo(() => {
    if (!selectedClient || !area || pricesQuery.isLoading || pricesQuery.isError) return [];
    return buildClientPriceCatalog(productsQuery.produtos, pricesQuery.precos, selectedClient.tabela_preco_tipo, area);
  }, [area, pricesQuery.isError, pricesQuery.isLoading, pricesQuery.precos, productsQuery.produtos, selectedClient]);

  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return activeClients.slice(0, 8);
    return activeClients.filter((client) => [client.razao_social, client.nome_fantasia, client.cpf_cnpj, client.telefone]
      .some((value) => value?.toLocaleLowerCase("pt-BR").includes(term))).slice(0, 8);
  }, [activeClients, clientSearch]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLocaleLowerCase("pt-BR");
    if (!term) return catalog.slice(0, 8);
    return catalog.filter((product) => product.nome.toLocaleLowerCase("pt-BR").includes(term) ||
      product.codigo?.toLocaleLowerCase("pt-BR").includes(term)).slice(0, 8);
  }, [catalog, productSearch]);

  const invalidQuantity = cart.some((item) => {
    const draft = quantityDrafts[item.productId];
    return draft !== undefined && (!/^\d+(?:[.,]\d+)?$/.test(draft) || !isValidOrderQuantity(parseNumber(draft), item.unit));
  });
  const itemsValid = cart.length > 0 && !invalidQuantity && cart.every((item) =>
    isValidOrderQuantity(item.quantity, item.unit) && Number.isFinite(item.unitPrice) && item.unitPrice >= 0);
  const discount = parseNumber(discountAmount) || 0;
  const urgency = parseNumber(urgencyPercentage) || 0;
  const totals = calculateOrderPreview(cart.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })), discount, urgent, urgency);
  const needsAddress = receiptMode === "coleta" || deliveryMode === "entrega";
  const addressComplete = Boolean(addressQuery.endereco?.logradouro && addressQuery.endereco.cidade && addressQuery.endereco.uf);
  const datesValid = intakeDate >= today && deliveryDate >= intakeDate;
  const commercialValuesValid = discount >= 0 && discount <= totals.subtotal && urgency >= 0 && urgency <= 100;
  const stepOneReady = Boolean(selectedClient && itemsValid && !pricesQuery.isLoading && !termsQuery.isLoading);
  const stepTwoReady = datesValid && commercialValuesValid && (!needsAddress || addressComplete);
  const canConfirmHere = paymentTerms.condition !== "entrada";
  const dataLoading = clientsQuery.isLoading || productsQuery.isLoading || driversQuery.isLoading || vehiclesQuery.isLoading;
  const catalogError = clientsQuery.isError || productsQuery.isError || pricesQuery.isError || termsQuery.isError;
  const selectedDetailItem = cart.find((item) => item.productId === detailItemId) ?? null;

  const selectClient = (clientId: string) => {
    if (clientId === selectedClientId) return;
    setSelectedClientId(clientId || null);
    setCart([]);
    setQuantityDrafts({});
    setClientSearch("");
    submissionRef.current = null;
  };

  const addProduct = (productId: string) => {
    const product = catalog.find((candidate) => candidate.id === productId);
    if (!product) return;
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) return current.map((item) => item.productId === product.id ? { ...item, quantity: Math.min(999, item.quantity + 1) } : item);
      return [...current, { productId: product.id, name: product.nome, code: product.codigo, unit: product.unidade, quantity: 1, unitPrice: product.precoAplicado }];
    });
    setProductSearch("");
    submissionRef.current = null;
  };

  const updateQuantity = (item: CartItem, raw: string) => {
    setQuantityDrafts((current) => ({ ...current, [item.productId]: raw }));
    const next = parseNumber(raw);
    if (/^\d+(?:[.,]\d+)?$/.test(raw) && isValidOrderQuantity(next, item.unit)) {
      setCart((current) => current.map((candidate) => candidate.productId === item.productId ? { ...candidate, quantity: next } : candidate));
      submissionRef.current = null;
    }
  };

  const adjustQuantity = (item: CartItem, change: number) => {
    const next = item.quantity + change;
    if (!isValidOrderQuantity(next, item.unit)) return;
    setQuantityDrafts((current) => { const copy = { ...current }; delete copy[item.productId]; return copy; });
    setCart((current) => current.map((candidate) => candidate.productId === item.productId ? { ...candidate, quantity: next } : candidate));
    submissionRef.current = null;
  };

  const removeItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.productId !== productId));
    setQuantityDrafts((current) => { const copy = { ...current }; delete copy[productId]; return copy; });
    submissionRef.current = null;
  };

  const goNext = () => {
    if (step === 1 && !stepOneReady) return void toast.error("Selecione o cliente e inclua ao menos um item válido");
    if (step === 2 && !stepTwoReady) return void toast.error(needsAddress && !addressComplete
      ? "Complete o endereço do cliente antes de solicitar coleta ou entrega" : "Revise datas e condições comerciais");
    setStep((current) => Math.min(3, current + 1) as Step);
  };

  const handleConfirm = async () => {
    if (!area || !selectedClient || !stepOneReady || !stepTwoReady) return;
    if (!canConfirmHere) {
      navigate(`${getCanonicalPdvPath(area)}?cliente=${selectedClient.id}`);
      toast.info("Este cliente exige pagamento na entrada. Continue pelo PDV para receber e confirmar.");
      return;
    }
    const payload = {
      clientId: selectedClient.id,
      cashRegisterId: null,
      deliveryDate,
      urgent,
      urgencyPercentage: urgent ? urgency : 0,
      discountAmount: commercialPermission.allowed ? discount : 0,
      driverId: receiptMode === "coleta" && driverId ? driverId : undefined,
      vehicleId: receiptMode === "coleta" && vehicleId ? vehicleId : undefined,
      items: cart.map((item) => ({ produto_id: item.productId, quantidade: item.quantity, cor_item: item.cor_item,
        marca_item: item.marca_item, avarias: item.avarias, posicao_prateleira: item.posicao_prateleira, observacoes: item.observacoes })),
      payment: null,
      intakeDate,
      notes: notes.trim() || null,
      receiptMode,
      deliveryMode,
      addressSnapshot: needsAddress ? addressQuery.endereco ?? {} : {},
    } as const;
    const fingerprint = JSON.stringify(payload);
    if (!submissionRef.current || submissionRef.current.fingerprint !== fingerprint) {
      submissionRef.current = { fingerprint, key: createPdvIdempotencyKey("sale") };
    }
    try {
      const result = await createOrder.mutateAsync({ ...payload, idempotencyKey: submissionRef.current.key });
      toast.success(`Pedido ${result.order.number} confirmado com segurança.`);
      onSuccess?.();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível confirmar o pedido");
    }
  };

  if (!area) return (
    <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Unidade operacional necessária</AlertTitle>
      <AlertDescription>Abra o painel Industrial ou Doméstico para criar um pedido.</AlertDescription></Alert>
  );
  if (dataLoading) return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-muted/20" role="status">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /><span className="font-medium text-muted-foreground">Preparando o novo pedido…</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-lg font-bold tracking-tight">Novo pedido</h2><p className="text-sm text-muted-foreground">Preencha por etapas; os dados permanecem ao voltar.</p></div>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5"><Building2 className="h-3.5 w-3.5" />{activeTenant?.name ?? "Empresa"} • {areaLabel}</Badge>
        </div>
        <nav aria-label="Etapas do novo pedido" className="grid gap-2 sm:grid-cols-3">
          {STEPS.map((item) => {
            const current = step === item.value;
            const complete = step > item.value;
            const enabled = item.value <= step || (item.value === 2 && stepOneReady) || (item.value === 3 && stepOneReady && stepTwoReady);
            return <button key={item.value} type="button" disabled={!enabled} onClick={() => enabled && setStep(item.value)} aria-current={current ? "step" : undefined}
              className={cn("flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors", current && "border-primary bg-primary/5",
                complete && "border-primary/30 bg-primary/[0.03]", !current && !complete && "border-border bg-muted/20", enabled ? "hover:border-primary/50" : "cursor-not-allowed opacity-55")}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black", (current || complete) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>{complete ? <Check className="h-4 w-4" /> : item.value}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
            </button>;
          })}
        </nav>
      </div>

      {catalogError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Não foi possível carregar os dados comerciais</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Cliente, catálogo, preço ou condição de pagamento não puderam ser confirmados. Nenhum pedido será criado.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void Promise.all([clientsQuery.refetch(), productsQuery.refetch(), pricesQuery.refetch(), termsQuery.refetch()])}>Tentar novamente</Button>
        </AlertDescription></Alert>}
      {needsAddress && addressQuery.isError && <Alert variant="destructive"><MapPin className="h-4 w-4" /><AlertTitle>Endereço indisponível</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Não foi possível confirmar o endereço para coleta ou entrega. Nenhum pedido será criado enquanto a leitura falhar.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void addressQuery.refetch()}>Tentar novamente</Button>
        </AlertDescription></Alert>}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {step === 1 && <StepOne selectedClient={selectedClient} filteredClients={filteredClients} clientSearch={clientSearch} setClientSearch={setClientSearch}
            selectClient={selectClient} catalogError={catalogError} productSearch={productSearch} setProductSearch={setProductSearch}
            filteredProducts={filteredProducts} addProduct={addProduct} cart={cart} quantityDrafts={quantityDrafts} invalidQuantity={invalidQuantity}
            updateQuantity={updateQuantity} adjustQuantity={adjustQuantity} removeItem={removeItem} setDetailItemId={setDetailItemId} />}
          {step === 2 && <StepTwo today={today} intakeDate={intakeDate} setIntakeDate={setIntakeDate} deliveryDate={deliveryDate}
            setDeliveryDate={setDeliveryDate} datesValid={datesValid} receiptMode={receiptMode} setReceiptMode={setReceiptMode}
            deliveryMode={deliveryMode} setDeliveryMode={setDeliveryMode} needsAddress={needsAddress} addressComplete={addressComplete}
            address={addressQuery.endereco} driverId={driverId} setDriverId={setDriverId} vehicleId={vehicleId} setVehicleId={setVehicleId}
            drivers={driversQuery.motoristasAtivos} vehicles={vehiclesQuery.veiculosAtivos} paymentTerms={paymentTerms}
            paymentLabels={paymentLabels} urgent={urgent} setUrgent={setUrgent} urgencyPercentage={urgencyPercentage}
            setUrgencyPercentage={setUrgencyPercentage} canDiscount={commercialPermission.allowed} discountAmount={discountAmount}
            setDiscountAmount={setDiscountAmount} subtotal={totals.subtotal} notes={notes} setNotes={setNotes} />}
          {step === 3 && selectedClient && <StepThree selectedClientName={selectedClient.razao_social} companyName={activeTenant?.name ?? "Empresa"}
            areaLabel={areaLabel} intakeDate={intakeDate} deliveryDate={deliveryDate} receiptMode={receiptMode} deliveryMode={deliveryMode}
            paymentLabel={paymentLabels.condition} needsAddress={needsAddress} address={addressQuery.endereco} cart={cart} notes={notes} />}
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start" aria-label="Resumo do novo pedido">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Resumo</CardTitle>
            <CardDescription>{cart.length} {cart.length === 1 ? "item" : "itens"} no pedido</CardDescription></CardHeader>
            <CardContent className="space-y-3"><SummaryLine label="Serviços" value={CURRENCY.format(totals.subtotal)} />
              <SummaryLine label="Desconto" value={totals.discount ? `− ${CURRENCY.format(totals.discount)}` : "—"} />
              <SummaryLine label="Urgência" value={totals.urgency ? `+ ${CURRENCY.format(totals.urgency)}` : "—"} /><Separator />
              <div className="flex items-end justify-between gap-3"><span className="font-bold">Total previsto</span><span className="text-xl font-black text-primary">{CURRENCY.format(totals.total)}</span></div>
              <p className="text-xs text-muted-foreground">O total definitivo é calculado pelo servidor na confirmação.</p>
              {selectedClient && <div className="rounded-lg bg-muted/40 p-3"><p className="truncate text-sm font-bold">{selectedClient.razao_social}</p><p className="text-xs text-muted-foreground">{paymentLabels.condition}</p></div>}
            </CardContent></Card>
        </aside>
      </div>

      <div className="flex flex-col-reverse gap-2 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <Button type="button" variant="outline" disabled={step === 1 || createOrder.isPending} onClick={() => setStep((current) => Math.max(1, current - 1) as Step)} className="gap-2"><ArrowLeft className="h-4 w-4" />Voltar</Button>
        {step < 3 ? <Button type="button" onClick={goNext} disabled={(step === 1 ? !stepOneReady : !stepTwoReady) || catalogError} className="gap-2 font-bold">
          Continuar para {step === 1 ? "prazo e logística" : "revisão"}<ArrowRight className="h-4 w-4" /></Button>
          : <Button type="button" onClick={handleConfirm} disabled={createOrder.isPending || !stepOneReady || !stepTwoReady || catalogError} className="gap-2 font-bold">
            {createOrder.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Confirmando pedido…</> : canConfirmHere ? <><CheckCircle2 className="h-4 w-4" />Confirmar pedido</> : <><WalletCards className="h-4 w-4" />Continuar no PDV</>}
          </Button>}
      </div>

      {selectedDetailItem && <ItemDetalhesModal open onOpenChange={(open) => !open && setDetailItemId(null)} itemNome={selectedDetailItem.name}
        quantidade={selectedDetailItem.quantity} detalhes={selectedDetailItem} onSave={(details) => {
          setCart((current) => current.map((item) => item.productId === selectedDetailItem.productId ? { ...item, ...details } : item));
          setDetailItemId(null); submissionRef.current = null;
        }} />}
    </div>
  );
}

interface StepOneProps {
  selectedClient: ReturnType<typeof useClientes>["clientes"][number] | null;
  filteredClients: ReturnType<typeof useClientes>["clientes"];
  clientSearch: string; setClientSearch: (value: string) => void; selectClient: (id: string) => void;
  catalogError: boolean; productSearch: string; setProductSearch: (value: string) => void;
  filteredProducts: CatalogItem[]; addProduct: (id: string) => void;
  cart: CartItem[]; quantityDrafts: Record<string, string>; invalidQuantity: boolean;
  updateQuantity: (item: CartItem, raw: string) => void; adjustQuantity: (item: CartItem, change: number) => void;
  removeItem: (id: string) => void; setDetailItemId: (id: string) => void;
}

function StepOne(props: StepOneProps) {
  return <div className="space-y-5">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" />1. Selecione o cliente</CardTitle>
      <CardDescription>A área e a tabela comercial são aplicadas automaticamente.</CardDescription></CardHeader>
      <CardContent className="space-y-3">{props.selectedClient ?
        <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="truncate font-bold">{props.selectedClient.razao_social}</p><p className="text-sm text-muted-foreground">{props.selectedClient.cpf_cnpj || "Documento não informado"} • {props.selectedClient.telefone || "Telefone não informado"}</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => props.selectClient("")}>Trocar cliente</Button></div>
        : <><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar cliente por nome, documento ou telefone" placeholder="Buscar cliente por nome, documento ou telefone" value={props.clientSearch}
            onChange={(event) => props.setClientSearch(event.target.value)} className="pl-9" skipUppercase /></div>
          <div className="grid gap-2 md:grid-cols-2">{props.filteredClients.map((client) => <button key={client.id} type="button" onClick={() => props.selectClient(client.id)}
            className="rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
            <span className="block truncate text-sm font-bold">{client.razao_social}</span><span className="block truncate text-xs text-muted-foreground">{client.cpf_cnpj || client.telefone || "Cadastro sem documento"}</span></button>)}
            {props.filteredClients.length === 0 && <p className="col-span-full rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum cliente ativo encontrado.</p>}
          </div></>}
      </CardContent></Card>

    <Card className={!props.selectedClient ? "opacity-60" : undefined}><CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" />2. Inclua serviços e medidas</CardTitle>
      <CardDescription>O preço exibido é uma prévia; o servidor recalcula a tabela autorizada na confirmação.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Buscar serviço por nome ou código" placeholder="Buscar serviço por nome ou código" value={props.productSearch}
          onChange={(event) => props.setProductSearch(event.target.value)} disabled={!props.selectedClient || props.catalogError} className="pl-9" skipUppercase /></div>
        {props.selectedClient && props.productSearch.trim() && <div className="grid gap-2 rounded-xl border bg-muted/20 p-2 sm:grid-cols-2">
          {props.filteredProducts.map((product) => <button key={product.id} type="button" onClick={() => props.addProduct(product.id)} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left hover:border-primary/50">
            <span className="min-w-0"><span className="block truncate text-sm font-bold">{product.nome}</span><span className="block text-xs text-muted-foreground">{product.codigo || "Sem código"} • {orderUnitLabel(product.unidade)}</span></span>
            <span className="shrink-0 text-sm font-black text-primary">{CURRENCY.format(product.precoAplicado)}</span></button>)}
          {props.filteredProducts.length === 0 && <p className="col-span-full p-3 text-center text-sm text-muted-foreground">Nenhum serviço disponível na tabela deste cliente.</p>}
        </div>}
        <div className="space-y-2">{props.cart.map((item) => <div key={item.productId} className="rounded-xl border bg-card p-3 sm:p-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-bold">{item.name}</p>
            <p className="text-xs text-muted-foreground">{CURRENCY.format(item.unitPrice)} por {orderUnitLabel(item.unit)}</p>
            {(item.avarias || item.cor_item || item.marca_item) && <p className="mt-1 line-clamp-1 text-xs font-medium text-amber-700">Condição física registrada</p>}</div>
            <div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label={`Diminuir quantidade de ${item.name}`} onClick={() => props.adjustQuantity(item, -1)}><Minus className="h-4 w-4" /></Button>
              <Input aria-label={`Quantidade de ${item.name}`} inputMode="decimal" value={props.quantityDrafts[item.productId] ?? String(item.quantity).replace(".", ",")}
                onChange={(event) => props.updateQuantity(item, event.target.value)} className={cn("w-20 text-center font-bold", props.quantityDrafts[item.productId] !== undefined && props.invalidQuantity && "border-destructive")} skipUppercase />
              <span className="w-10 text-xs font-bold text-muted-foreground">{orderUnitLabel(item.unit)}</span>
              <Button type="button" variant="outline" size="icon" aria-label={`Aumentar quantidade de ${item.name}`} onClick={() => props.adjustQuantity(item, 1)}><Plus className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Detalhes físicos de ${item.name}`} onClick={() => props.setDetailItemId(item.productId)}><PencilLine className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item.name}`} onClick={() => props.removeItem(item.productId)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></div>
            <p className="w-24 text-right font-black">{CURRENCY.format(item.quantity * item.unitPrice)}</p></div></div>)}
          {props.cart.length === 0 && <div className="rounded-xl border border-dashed px-4 py-10 text-center"><ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 font-bold">Nenhum item no pedido</p><p className="text-sm text-muted-foreground">Busque um serviço acima para começar.</p></div>}
        </div>
      </CardContent></Card>
  </div>;
}

interface StepTwoProps {
  today: string; intakeDate: string; setIntakeDate: (value: string) => void; deliveryDate: string; setDeliveryDate: (value: string) => void; datesValid: boolean;
  receiptMode: ReceiptMode; setReceiptMode: (value: ReceiptMode) => void; deliveryMode: DeliveryMode; setDeliveryMode: (value: DeliveryMode) => void;
  needsAddress: boolean; addressComplete: boolean; address: ReturnType<typeof useEnderecoCliente>["endereco"];
  driverId: string; setDriverId: (value: string) => void; vehicleId: string; setVehicleId: (value: string) => void;
  drivers: ReturnType<typeof useMotoristas>["motoristasAtivos"]; vehicles: ReturnType<typeof useVeiculos>["veiculosAtivos"];
  paymentTerms: ReturnType<typeof parseCustomerPaymentTerms>; paymentLabels: ReturnType<typeof customerPaymentTermsLabels>;
  urgent: boolean; setUrgent: (value: boolean) => void; urgencyPercentage: string; setUrgencyPercentage: (value: string) => void;
  canDiscount: boolean; discountAmount: string; setDiscountAmount: (value: string) => void; subtotal: number; notes: string; setNotes: (value: string) => void;
}

function StepTwo(props: StepTwoProps) {
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Prazo prometido</CardTitle>
    <CardDescription>O prazo deve considerar a data em que as peças chegarão à lavanderia.</CardDescription></CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="order-intake-date">Recebimento previsto *</Label>
      <Input id="order-intake-date" type="date" min={props.today} value={props.intakeDate} onChange={(event) => props.setIntakeDate(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="order-delivery-date">Entrega prometida *</Label><Input id="order-delivery-date" type="date" min={props.intakeDate || props.today} value={props.deliveryDate} onChange={(event) => props.setDeliveryDate(event.target.value)} /></div>
      {!props.datesValid && <p className="text-sm font-medium text-destructive sm:col-span-2">A entrega deve ocorrer na mesma data ou depois do recebimento, sem datas passadas.</p>}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />Recebimento e entrega</CardTitle>
      <CardDescription>Escolha como as peças chegam e como o pedido finalizado será devolvido.</CardDescription></CardHeader>
      <CardContent className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><ModeChoice kind="receipt" value={props.receiptMode} onChange={props.setReceiptMode} /><ModeChoice kind="delivery" value={props.deliveryMode} onChange={props.setDeliveryMode} /></div>
        {props.needsAddress && <div className={cn("rounded-xl border p-4", props.addressComplete ? "border-primary/20 bg-primary/[0.03]" : "border-destructive/40 bg-destructive/[0.03]")}>
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Endereço do atendimento</p>
            <p className="mt-1 text-sm text-muted-foreground">{formatOrderAddress(props.address ?? undefined)}</p><p className="mt-2 text-xs text-muted-foreground">Uma fotografia deste endereço será preservada no pedido; alterações futuras no cliente não mudam o histórico.</p></div></div>
          {!props.addressComplete && <p className="mt-3 text-sm font-bold text-destructive">Complete logradouro, cidade e UF no cadastro do cliente.</p>}</div>}
        {props.receiptMode === "coleta" && <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="order-driver">Motorista sugerido</Label>
          <Select value={props.driverId} onValueChange={props.setDriverId}><SelectTrigger id="order-driver"><SelectValue placeholder="Definir depois" /></SelectTrigger><SelectContent>{props.drivers.map((driver) => <SelectItem key={driver.id} value={driver.id}>{driver.nome}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="order-vehicle">Veículo sugerido</Label><Select value={props.vehicleId} onValueChange={props.setVehicleId}><SelectTrigger id="order-vehicle"><SelectValue placeholder="Definir depois" /></SelectTrigger>
            <SelectContent>{props.vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.placa} • {vehicle.modelo}</SelectItem>)}</SelectContent></Select></div></div>}
      </CardContent></Card>

    <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-primary" />Condição comercial</CardTitle>
      <CardDescription>Condição herdada do cadastro; recebimento de dinheiro continua no PDV.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><InfoTile label="Pagamento" value={props.paymentLabels.condition} /><InfoTile label="Preferência" value={props.paymentLabels.preferredMethod} /></div>
        {props.paymentTerms.condition === "entrada" && <Alert><WalletCards className="h-4 w-4" /><AlertTitle>Confirmação pelo PDV</AlertTitle>
          <AlertDescription>Este cliente exige pagamento na entrada. Na etapa final, o sistema abrirá o PDV com o cliente selecionado.</AlertDescription></Alert>}
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-3 rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><Label htmlFor="order-urgent">Pedido urgente</Label><p className="text-xs text-muted-foreground">Aplica o adicional configurado.</p></div>
          <Switch id="order-urgent" checked={props.urgent} onCheckedChange={props.setUrgent} /></div>{props.urgent && <div className="space-y-2"><Label htmlFor="order-urgency">Adicional de urgência (%)</Label>
            <Input id="order-urgency" type="number" min="0" max="100" step="0.01" value={props.urgencyPercentage} onChange={(event) => props.setUrgencyPercentage(event.target.value)} /></div>}</div>
          <div className="space-y-3 rounded-xl border p-4"><div><Label htmlFor="order-discount">Desconto autorizado</Label><p className="text-xs text-muted-foreground">Disponível somente para perfis comerciais.</p></div>
            {props.canDiscount ? <Input id="order-discount" type="number" min="0" max={props.subtotal} step="0.01" value={props.discountAmount} onChange={(event) => props.setDiscountAmount(event.target.value)} />
              : <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">Sem permissão para conceder desconto</p>}</div></div>
        <div className="space-y-2"><Label htmlFor="order-notes">Observações do pedido</Label><Textarea id="order-notes" maxLength={2000} rows={4} value={props.notes}
          onChange={(event) => props.setNotes(event.target.value)} placeholder="Preferências, cuidados, instruções e informações para a operação…" /><p className="text-right text-xs text-muted-foreground">{props.notes.length}/2000</p></div>
      </CardContent></Card>
  </div>;
}

function ModeChoice({ kind, value, onChange }: { kind: "receipt"; value: ReceiptMode; onChange: (value: ReceiptMode) => void } | { kind: "delivery"; value: DeliveryMode; onChange: (value: DeliveryMode) => void }) {
  const receipt = kind === "receipt";
  return <fieldset className="space-y-3"><legend className="text-sm font-bold">{receipt ? "Entrada das peças" : "Saída do pedido"}</legend>
    <RadioGroup value={value} onValueChange={(next) => onChange(next as never)} className="grid gap-2">
      <Label htmlFor={`${kind}-counter`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04]">
        <RadioGroupItem id={`${kind}-counter`} value="balcao" className="mt-0.5" /><span><span className="block font-bold">{receipt ? "Cliente leva ao balcão" : "Cliente retira no balcão"}</span><span className="text-xs text-muted-foreground">{receipt ? "Sem rota de coleta." : "Entrega presencial na unidade."}</span></span></Label>
      <Label htmlFor={`${kind}-route`} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[:checked]:border-primary has-[:checked]:bg-primary/[0.04]">
        <RadioGroupItem id={`${kind}-route`} value={receipt ? "coleta" : "entrega"} className="mt-0.5" /><span><span className="block font-bold">{receipt ? "Coletar no cliente" : "Entregar no cliente"}</span>
          <span className="text-xs text-muted-foreground">{receipt ? "Entra na fila de planejamento logístico." : "Usa o endereço registrado abaixo."}</span></span></Label>
    </RadioGroup></fieldset>;
}

interface StepThreeProps {
  selectedClientName: string; companyName: string; areaLabel: string; intakeDate: string; deliveryDate: string;
  receiptMode: ReceiptMode; deliveryMode: DeliveryMode; paymentLabel: string; needsAddress: boolean;
  address: ReturnType<typeof useEnderecoCliente>["endereco"]; cart: CartItem[]; notes: string;
}

function StepThree(props: StepThreeProps) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Revise antes de confirmar</CardTitle>
    <CardDescription>Preço, permissão e condição de pagamento serão validados novamente no servidor.</CardDescription></CardHeader>
    <CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <ReviewBlock icon={UserRound} label="Cliente" value={props.selectedClientName} /><ReviewBlock icon={Building2} label="Origem" value={`${props.companyName} • ${props.areaLabel}`} />
      <ReviewBlock icon={CalendarClock} label="Prazo" value={`${format(parseISO(props.intakeDate), "dd/MM/yyyy")} → ${format(parseISO(props.deliveryDate), "dd/MM/yyyy")}`} />
      <ReviewBlock icon={Truck} label="Recebimento" value={props.receiptMode === "coleta" ? "Coleta no cliente" : "Cliente leva ao balcão"} />
      <ReviewBlock icon={MapPin} label="Entrega" value={props.deliveryMode === "entrega" ? "Entrega no cliente" : "Cliente retira no balcão"} />
      <ReviewBlock icon={WalletCards} label="Pagamento" value={props.paymentLabel} /></div>
      {props.needsAddress && <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Endereço preservado no pedido</p><p className="mt-1 text-sm font-bold">{formatOrderAddress(props.address ?? undefined)}</p></div>}
      <div><h3 className="mb-2 font-bold">Itens e condições físicas</h3><div className="overflow-hidden rounded-xl border">{props.cart.map((item, index) => <div key={item.productId} className={cn("grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center", index > 0 && "border-t")}>
        <div className="min-w-0"><p className="truncate font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{[item.cor_item, item.marca_item, item.avarias].filter(Boolean).join(" • ") || "Sem condição física adicional"}</p></div>
        <p className="text-sm font-bold">{item.quantity.toLocaleString("pt-BR")} {orderUnitLabel(item.unit)}</p><p className="text-right font-black">{CURRENCY.format(item.quantity * item.unitPrice)}</p></div>)}</div></div>
      {props.notes.trim() && <div className="rounded-xl border bg-muted/20 p-4"><p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Observações</p><p className="mt-1 whitespace-pre-wrap text-sm">{props.notes.trim()}</p></div>}
      <Alert className="border-primary/20 bg-primary/[0.03]"><CheckCircle2 className="h-4 w-4 text-primary" /><AlertTitle>Confirmação transacional</AlertTitle>
        <AlertDescription>Um clique cria o pedido e todos os itens juntos. Repetir a mesma solicitação não duplica o atendimento.</AlertDescription></Alert>
    </CardContent></Card>;
}

function InfoTile({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function SummaryLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-bold">{value}</span></div>; }
function ReviewBlock({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border bg-muted/20 p-3"><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
    <p className="mt-1 truncate text-sm font-bold" title={value}>{value}</p></div>;
}
