import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PdvLayout } from "@/components/layout/PdvLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Archive,
  BarChart3,
  CheckCircle2,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Loader2,
  FileText,
  Info,
  AlertTriangle,
  Maximize,
  Minimize,
  Keyboard,
  UserRound,
  UserPlus,
  CalendarDays,
  X,
  Phone,
  Mail,
  IdCard,
  Pencil,
  Printer,
  Package,
  PackageCheck,
  ClipboardList,
  Boxes,
  Truck,
  CalendarRange,
  MoreHorizontal,
  Banknote,
  Smartphone,
  CircleCheck,
  ArrowLeft,
  Save,
  Calculator,
  MessageSquare,
  Wifi,
  WifiOff,
  CircleAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clientClassificationMatchesArea } from "@/lib/operations";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes, useConfiguracaoPagamentoCliente, useEnderecoCliente } from "@/hooks/useClientes";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { ItemDetalhesModal } from "@/components/caixa/ItemDetalhesModal";
import { PagamentoModal, type DadosPagamento, type PdvPaymentMethod } from "@/components/caixa/PagamentoModal";
import { ImpressaoPosVendaModal } from "@/components/caixa/ImpressaoPosVendaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { SangriaModal } from "@/components/caixa/SangriaModal";
import { SuprimentoModal } from "@/components/caixa/SuprimentoModal";
import { ConsultarOSModal } from "@/components/caixa/ConsultarOSModal";
import { ConsultarOrcamentosPdvModal } from "@/components/caixa/ConsultarOrcamentosPdvModal";
import { ReceberPagamentoModal } from "@/components/caixa/ReceberPagamentoModal";
import { ListaDoDiaModal } from "@/components/caixa/ListaDoDiaModal";
import { DisponibilizacaoDoDiaModal } from "@/components/caixa/DisponibilizacaoDoDiaModal";
import { PdvFulfillmentPanel, type PdvFulfillmentSettings } from "@/components/caixa/PdvFulfillmentPanel";
import { CadastroCompletoClientePdvModal } from "@/components/caixa/CadastroCompletoClientePdvModal";
import { PdvWhatsAppDeviceModal } from "@/components/caixa/PdvWhatsAppDeviceModal";
import { CreditoClienteModal } from "@/components/caixa/CreditoClienteModal";
import { useSavePdvQuote } from "@/hooks/usePdvQuotes";

import { AjudaAtalhosModal } from "@/components/caixa/AjudaAtalhosModal";
import { OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrintOS } from "@/hooks/usePrintOS";
import { useApplyPdvCustomerCredit, useCreatePdvSale, usePdvCapacity, usePdvCustomerCreditSummary, usePdvCustomerLoyaltySummary, useRedeemPdvLoyalty } from "@/hooks/usePdvPayments";
import { createPdvIdempotencyKey } from "@/lib/pdvPayment";
import type { PdvSaleRequest } from "@/lib/pdvSale";
import { isOfflineLikeError } from "@/lib/offlinePolicy";
import { createOfflineLocalReference, printOfflinePdvReceipt } from "@/lib/offlineReceipt";
import type { OfflinePdvReceipt } from "@/lib/offlineStore";
import { getCanonicalPdvPath } from "@/lib/authorization";
import { supabase } from "@/integrations/supabase/client";
import { usePdvCommercialRules } from "@/hooks/usePdvCommercialRules";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { calculateDeliveryFee, calculateDistanceKm } from "@/lib/deliveryPricing";
import { clearScopedDraft, readScopedDraft, restoreDraftDate, scopedDraftKey, writeScopedDraft } from "@/lib/scopedDraft";


import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOperationalContext } from "@/contexts/OperationalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOfflineRuntime } from "@/contexts/OfflineRuntimeContext";
import { useNavigationAccess, usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { buildClientPriceCatalog, CLIENT_PRICE_MODE_LABELS, normalizeClientPriceMode } from "@/lib/clientPricing";
import { getDefaultPdvDeliveryDate } from "@/lib/pdvFulfillment";
import { parseCustomerPaymentTerms, isCustomerPaymentAllowed } from "@/lib/customerPaymentTerms";
import { dispararNotificacaoAutomatica } from "@/services/notificacaoService";
import { ClienteContrato } from "@/components/clientes/ClienteContrato";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import "@/styles/pdv-cashier.css";

interface CartItem {
  id: string;
  cartLineId?: string;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  preco: number;
  unidade: string;
  quantidade: number;
  precoOriginal: number;
  // Novos campos de detalhes
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
  operacao?: string;
  tipo_preco?: string;
  servicos_adicionais?: string[];
  complemento?: string;
  metragem_m2?: number;
  largura_m?: number;
  comprimento_m?: number;
  lacre?: string;
}

export type PdvServiceMode = "rol" | "delivery" | "orcamento";

interface OSRecemCriada {
  id: string;
  numero: string;
  valorTotal: number;
  previsaoEntrega: Date;
}

interface DiscardRequest {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => void;
}

interface PdvShortcutModule {
  id: string;
  title: string;
  icon: LucideIcon;
  path?: string;
  action?: "fechar-caixa";
  permissionPath: string;
}

function readPdvSidebarCollapsed(key: string) {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "collapsed";
  } catch {
    return false;
  }
}

interface PdvPaymentSelection {
  pagoAgora: boolean;
  formaPagamento: PdvPaymentMethod | null;
}

interface PdvAttendanceDraft {
  searchTerm: string;
  clientSearch: string;
  selectedClientId: string | null;
  cart: CartItem[];
  quantityDrafts: Record<string, string>;
  fulfillment: PdvFulfillmentSettings;
  fulfillmentDraft: PdvFulfillmentSettings | null;
  appliedDiscount: number;
  rolNotes: string;
  quoteValidUntil: string;
}

const getUnidadeLabel = (unidade: string | null) => {
  switch (unidade) {
    case "kg": return "Kg";
    case "peca": return "Pç";
    case "metro": return "Mt";
    case "unidade": return "Un";
    default: return "Pç";
  }
};

const getPdvUnitDisplay = (unidade: string) => {
  switch (unidade) {
    case "Pç": return "Peça";
    case "Kg": return "Kg";
    case "Mt": return "m²";
    case "Un": return "Unidade";
    default: return unidade;
  }
};

const getPriceUnitLabel = (unidade: string) => {
  switch (unidade) {
    case "Pç": return "peça";
    case "Kg": return "kg";
    case "Mt": return "m²";
    case "Un": return "unidade";
    default: return unidade;
  }
};

const getQuantityInputLabel = (unidade: string) => {
  if (unidade === "Kg") return "Peso (kg)";
  if (unidade === "Pç") return "Quantidade (peças)";
  if (unidade === "Un") return "Quantidade (unidades)";
  return "Quantidade";
};

const isMeterUnit = (unidade: string) => ["mt", "m", "metro", "metros", "m²", "m2"].includes(unidade.trim().toLowerCase());

const formatMetres = (value: number) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value);

const formatSquareMetres = (value: number) => new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
}).format(value);

const getCartLineKey = (item: CartItem) => item.cartLineId ?? item.id;

const getLineTotal = (item: CartItem) => Math.round((item.preco * item.quantidade + Number.EPSILON) * 100) / 100;

const hasValidMeterArea = (item: CartItem) => {
  if (!isMeterUnit(item.unidade)) return true;
  const area = item.metragem_m2;
  if (!Number.isFinite(area) || Number(area) <= 0 || Math.abs(item.quantidade - Number(area)) > 0.000001) return false;
  const hasWidth = Number(item.largura_m) > 0;
  const hasLength = Number(item.comprimento_m) > 0;
  if (hasWidth !== hasLength) return false;
  if (!hasWidth) return true;
  const calculatedArea = Number((Number(item.largura_m) * Number(item.comprimento_m)).toFixed(4));
  return Math.abs(calculatedArea - Number(area)) < 0.0001;
};

const formatCarga = (value: number) => new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
}).format(value);

const normalizeSearchText = (value?: string | null) =>
  (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const matchesSearch = (query: string, ...values: Array<string | null | undefined>) => {
  const prefix = normalizeSearchText(query);
  return Boolean(prefix) && values.some((value) => normalizeSearchText(value).startsWith(prefix));
};

const searchRank = (query: string, ...values: Array<string | null | undefined>) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedValues = values.map(normalizeSearchText).filter(Boolean);
  if (!normalizedQuery) return 99;
  if (normalizedValues.some((value) => value === normalizedQuery)) return 0;
  if (normalizedValues.some((value) => value.startsWith(normalizedQuery))) return 1;
  if (normalizedValues.some((value) => value.split(/\s+/).some((word) => word.startsWith(normalizedQuery)))) return 2;
  return 3;
};

const isValidQuantity = (value: number, unidade: string) =>
  Number.isFinite(value) && value > 0 && value <= 999 &&
  (["Kg", "Mt"].includes(unidade) || Number.isInteger(value));

const createInitialFulfillment = (mode: PdvServiceMode = "rol"): PdvFulfillmentSettings => ({
  deliveryDate: getDefaultPdvDeliveryDate(),
  urgent: false,
  receiptMode: mode === "delivery" ? "coleta" : "balcao",
  deliveryMode: mode === "delivery" ? "entrega" : "balcao",
  deliveryFee: 0,
  driverId: "",
  vehicleId: "",
  capacityOverride: false,
});

// Remount the sale and its dialogs whenever the security context changes.
const CaixaPDV = ({ mode = "rol" }: { mode?: PdvServiceMode }) => {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const { pathname } = useLocation();
  const isExpectedWorkspace = pathname.startsWith("/" + activeArea + "/")
    || (activeArea !== "central" && pathname.startsWith(getCanonicalPdvPath(activeArea)));
  if (!activeTenant || !user || !isExpectedWorkspace) {
    return <AppLayout title="PDV / Caixa"><p>Carregando contexto do atendimento...</p></AppLayout>;
  }
  return <PdvAtendimento key={[activeTenant.id, user.id, activeArea, mode].join(":")} mode={mode} />;
};

const PdvAtendimento = ({ mode }: { mode: PdvServiceMode }) => {

  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const { activeTenant, funcionario, user } = useAuth();
  const queryClient = useQueryClient();
  const offlineRuntime = useOfflineRuntime();
  const area = activeArea === "industrial" ? "industrial" : "residencial";
  const areaLabel = area === "industrial" ? "Industrial" : "Doméstico";
  const { data: commercialRules } = usePdvCommercialRules(area);
  const { configuracao: configuracaoGeral } = useConfiguracoesGerais(offlineRuntime.isOperationalOnline);
  const { setOperationSwitchLocked } = useOperationalContext();
  const { canAccessRoute } = useNavigationAccess();
  const { allowed: canOperateCaixa } = usePermissaoModulo("caixa");
  const { allowed: canManageOrders } = usePermissaoModulo("ordens");
  const canUseLoyalty = canOperateCaixa;
  const { allowed: canManageCommercialTerms } = usePermissaoModulo("alterar_condicoes_comerciais");
  const canManageContracts = canAccessRoute("/" + area + "/clientes");
  const canCreateClient = canAccessRoute("/" + area + "/clientes");
  const canCreateSale = canAccessRoute("/" + area + "/caixa");
  const canViewDayList = area === "residencial" && canAccessRoute("/residencial/agenda");
  const { produtos, isLoading: isLoadingProdutos, isError: productsError, refetch: refetchProducts } = useProdutos({
    enabled: offlineRuntime.isOperationalOnline,
  });
  const {
    clientes,
    isLoading: isLoadingClientes,
    isError: clientsError,
    refetch: refetchClients,
  } = useClientes({ enabled: offlineRuntime.isOperationalOnline });
  const { data: caixaAberto, isLoading: isLoadingCaixa } = useCaixaAberto(
    canOperateCaixa && offlineRuntime.isOperationalOnline,
  );
  const canReceivePayments = offlineRuntime.isOperationalOnline && canOperateCaixa && !!caixaAberto;
  const whatsappProviderStatus = useQuery({
    queryKey: ["pdv-whatsapp-provider-status", activeTenant?.id],
    enabled: Boolean(activeTenant?.id) && offlineRuntime.isOperationalOnline && canOperateCaixa,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-gateway", { body: { action: "status" } });
      if (error || data?.error) throw new Error(typeof data?.error === "string" ? data.error : error?.message || "Falha ao consultar o WhatsApp");
      return { connected: data?.connected === true, status: String(data?.status || "desconectado") };
    },
    staleTime: 30_000,
    refetchInterval: offlineRuntime.isOperationalOnline && canOperateCaixa ? 60_000 : false,
    retry: 1,
  });
  const whatsappProviderState = whatsappProviderStatus.isFetching
    ? "consultando"
    : whatsappProviderStatus.isError
      ? "erro"
      : whatsappProviderStatus.data?.connected
        ? "conectado"
        : ["connecting", "conectando", "aguardando_scan", "qr_ready", "starting"].includes(whatsappProviderStatus.data?.status.toLowerCase() ?? "")
          ? "conectando"
          : "desconectado";
  const whatsappProviderLabel = whatsappProviderState === "conectado" ? "Conectado"
    : whatsappProviderState === "conectando" ? "Conectando"
      : whatsappProviderState === "erro" ? "Erro"
        : whatsappProviderState === "consultando" ? "Verificando"
          : "Desconectado";
  const createPdvSale = useCreatePdvSale();
  const savePdvQuote = useSavePdvQuote();
  const redeemLoyalty = useRedeemPdvLoyalty();
  const applyCustomerCredit = useApplyPdvCustomerCredit();
  const { printROL, printEtiqueta, printROLDisponibilidade } = usePrintOS();
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeBufferRef = useRef("");
  const attendanceDraftKey = scopedDraftKey(user?.id, activeTenant?.id, `pdv:${area}:${mode}`);
  const restoredAttendanceDraft = useRef(readScopedDraft<PdvAttendanceDraft>(attendanceDraftKey));
  
  const [searchTerm, setSearchTerm] = useState(restoredAttendanceDraft.current?.searchTerm ?? "");
  const [showProductList, setShowProductList] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(restoredAttendanceDraft.current?.cart ?? []);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(restoredAttendanceDraft.current?.quantityDrafts ?? {});
  const [showContracts, setShowContracts] = useState(false);
  const [clientSearch, setClientSearch] = useState(restoredAttendanceDraft.current?.clientSearch ?? "");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(restoredAttendanceDraft.current?.selectedClientId ?? null);
  const { data: customerCredit, isLoading: isLoadingCustomerCredit } = usePdvCustomerCreditSummary(
    selectedClientId,
    canOperateCaixa && offlineRuntime.isOperationalOnline,
  );
  const [showClientList, setShowClientList] = useState(false);
  const [showFullClientModal, setShowFullClientModal] = useState(false);
  const [showCustomerCreditModal, setShowCustomerCreditModal] = useState(false);
  const [customerCreditMode, setCustomerCreditMode] = useState<"add" | "subtract">("add");
  const [fulfillment, setFulfillment] = useState<PdvFulfillmentSettings>(() => {
    const initial = createInitialFulfillment(mode);
    const saved = restoredAttendanceDraft.current?.fulfillment;
    return saved ? { ...saved, deliveryDate: restoreDraftDate(saved.deliveryDate, initial.deliveryDate) } : initial;
  });
  const [fulfillmentDraft, setFulfillmentDraft] = useState<PdvFulfillmentSettings | null>(() => {
    const saved = restoredAttendanceDraft.current?.fulfillmentDraft;
    return saved ? { ...saved, deliveryDate: restoreDraftDate(saved.deliveryDate, createInitialFulfillment(mode).deliveryDate) } : null;
  });
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [paymentShortcut, setPaymentShortcut] = useState<PdvPaymentSelection | null>(null);
  
  // Estado para modal de detalhes
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(null);
  
  // Estados para modais de pagamento e impressão
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [paymentAdjustmentOnly, setPaymentAdjustmentOnly] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(restoredAttendanceDraft.current?.appliedDiscount ?? 0);
  const [showImpressaoModal, setShowImpressaoModal] = useState(false);
  const [osRecemCriada, setOsRecemCriada] = useState<OSRecemCriada | null>(null);
  const [offlineReceipt, setOfflineReceipt] = useState<OfflinePdvReceipt | null>(null);
  const [isProcessingVenda, setIsProcessingVenda] = useState(false);
  const saleIdempotencyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const prefilledClientRef = useRef(false);
  
  // Estados para modais de caixa
  const [showAbrirCaixaModal, setShowAbrirCaixaModal] = useState(false);
  const [showFecharCaixaModal, setShowFecharCaixaModal] = useState(false);
  const [showSangriaModal, setShowSangriaModal] = useState(false);
  const sangriaShortcutHandledRef = useRef(false);
  const whatsappShortcutHandledRef = useRef(false);
  const [showSuprimentoModal, setShowSuprimentoModal] = useState(false);
  const [showConsultarOSModal, setShowConsultarOSModal] = useState(false);
  const [showPdvQuotesModal, setShowPdvQuotesModal] = useState(false);
  const [pdvLookupMode, setPdvLookupMode] = useState<"consulta" | "posicao">("consulta");
  const [showReceberPagamentoModal, setShowReceberPagamentoModal] = useState(false);
  const [osParaReceber, setOsParaReceber] = useState<OrdemServicoConsulta | null>(null);
  
  // Novos estados para funcionalidades profissionais
  const [showListaDia, setShowListaDia] = useState(false);
  const [showDisponibilizacaoDia, setShowDisponibilizacaoDia] = useState(false);
  const [showWhatsAppDeviceModal, setShowWhatsAppDeviceModal] = useState(false);
  const [showAjudaAtalhos, setShowAjudaAtalhos] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [discardRequest, setDiscardRequest] = useState<DiscardRequest | null>(null);
  const [rolNotes, setRolNotes] = useState(restoredAttendanceDraft.current?.rolNotes ?? "");
  const [quoteValidUntil, setQuoteValidUntil] = useState(() => restoredAttendanceDraft.current?.quoteValidUntil ?? format(addDays(new Date(), 7), "yyyy-MM-dd"));

  useEffect(() => {
    if (osRecemCriada) {
      clearScopedDraft(attendanceDraftKey);
      return;
    }
    const value: PdvAttendanceDraft = {
      searchTerm, clientSearch, selectedClientId, cart, quantityDrafts,
      fulfillment, fulfillmentDraft, appliedDiscount, rolNotes, quoteValidUntil,
    };
    if (searchTerm || clientSearch || selectedClientId || cart.length || rolNotes || fulfillmentDraft) {
      writeScopedDraft(attendanceDraftKey, value);
    } else {
      clearScopedDraft(attendanceDraftKey);
    }
  }, [attendanceDraftKey, searchTerm, clientSearch, selectedClientId, cart, quantityDrafts, fulfillment, fulfillmentDraft, appliedDiscount, rolNotes, quoteValidUntil, osRecemCriada]);

  useEffect(() => {
    if (!commercialRules) return;
    setFulfillment((current) => current.deliveryFee > 0
      ? current
      : { ...current, deliveryFee: commercialRules.defaultDeliveryFee });
  }, [commercialRules]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("acao") !== "sangria" || sangriaShortcutHandledRef.current || !canReceivePayments) return;

    sangriaShortcutHandledRef.current = true;
    setShowSangriaModal(true);
    params.delete("acao");
    navigate({ search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
  }, [canReceivePayments, navigate, search]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("acao") !== "whatsapp" || whatsappShortcutHandledRef.current) return;

    whatsappShortcutHandledRef.current = true;
    setShowWhatsAppDeviceModal(true);
    params.delete("acao");
    navigate({ search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
  }, [navigate, search]);
  

  const { precos: precosEspeciais, isLoading: pricesLoading, isError: pricesError, refetch: refetchPrices } = usePrecosEspeciais(
    selectedClientId,
    offlineRuntime.isOperationalOnline,
  );
  // Session-only shortcut; never restore a customer from global browser storage.
  const [ultimoClienteId, setUltimoClienteId] = useState<string | null>(null);
  const clientesFiltradosPorTipo = useMemo(() => clientes.filter(c => c.ativo && clientClassificationMatchesArea(c.classificacao, area)), [clientes, area]);
  const selectedClient = useMemo(() => clientesFiltradosPorTipo.find(c => c.id === selectedClientId), [clientesFiltradosPorTipo, selectedClientId]);
  const { endereco: enderecoCliente, isLoading: enderecoLoading, isError: enderecoError } = useEnderecoCliente(
    selectedClient?.id ?? null,
    offlineRuntime.isOperationalOnline,
  );
  const deliveryDistanceKm = useMemo(() => calculateDistanceKm(
    configuracaoGeral?.endereco_latitude,
    configuracaoGeral?.endereco_longitude,
    enderecoCliente?.latitude,
    enderecoCliente?.longitude,
  ), [configuracaoGeral?.endereco_latitude, configuracaoGeral?.endereco_longitude, enderecoCliente?.latitude, enderecoCliente?.longitude]);
  const deliveryPricing = useMemo(() => ({
    model: commercialRules?.deliveryPricingModel ?? "fixo" as const,
    baseFee: commercialRules?.deliveryBaseFee ?? commercialRules?.defaultDeliveryFee ?? 0,
    feePerKm: commercialRules?.deliveryFeePerKm ?? 0,
  }), [commercialRules]);
  const calculatedDeliveryFee = calculateDeliveryFee(deliveryPricing, deliveryDistanceKm);
  const { configuracao: configuracaoPagamento, isLoading: termsLoading, isError: termsError, refetch: refetchTerms } = useConfiguracaoPagamentoCliente(
    selectedClient?.id ?? null,
    offlineRuntime.isOperationalOnline,
  );
  const { data: customerLoyalty, isLoading: isLoadingCustomerLoyalty } = usePdvCustomerLoyaltySummary(
    selectedClient?.id ?? null,
    area,
    canUseLoyalty && offlineRuntime.isOperationalOnline,
  );
  const deliveryDateKey = format(fulfillment.deliveryDate, "yyyy-MM-dd");
  const { data: capacity, isFetching: capacityLoading, isError: capacityError } = usePdvCapacity(
    area,
    selectedClient?.id ?? null,
    deliveryDateKey,
    offlineRuntime.isOperationalOnline,
  );
  const fulfillmentDraftDateKey = format((fulfillmentDraft ?? fulfillment).deliveryDate, "yyyy-MM-dd");
  const {
    data: fulfillmentDraftCapacity,
    isFetching: fulfillmentDraftCapacityLoading,
    isError: fulfillmentDraftCapacityError,
  } = usePdvCapacity(
    area,
    selectedClient?.id ?? null,
    fulfillmentDraftDateKey,
    Boolean(selectedClient && showFulfillmentModal && offlineRuntime.isOperationalOnline),
  );
  const catalogLoading = offlineRuntime.isOperationalOnline && (isLoadingProdutos || isLoadingClientes || pricesLoading || termsLoading);
  const catalogError = offlineRuntime.isOperationalOnline && (pricesError || termsError || productsError || clientsError);
  const catalogReady = canCreateSale && !!selectedClient && !catalogLoading && !catalogError;
  const isFaturado = configuracaoPagamento?.condicao_pagamento === "faturado";
  const paymentTerms = parseCustomerPaymentTerms(configuracaoPagamento);
  const clientPriceMode = selectedClient
    ? normalizeClientPriceMode(selectedClient.tabela_preco_tipo)
    : "padrao";
  const produtosAtivos = useMemo(() => catalogReady ? buildClientPriceCatalog(
    produtos, precosEspeciais, clientPriceMode, area,
  ) : [], [catalogReady, produtos, precosEspeciais, clientPriceMode, area]);
  const getPrecoForProduto = useCallback((produto: Produto): number =>
    produtosAtivos.find(p => p.id === produto.id)?.precoAplicado ?? NaN, [produtosAtivos]);
  const invalidQuantity = cart.some(item => {
    const raw = quantityDrafts[getCartLineKey(item)];
    return raw !== undefined && (!/^\d+(?:[.,]\d+)?$/.test(raw) || !isValidQuantity(Number(raw.replace(",", ".")), item.unidade));
  });
  const cartValid = catalogReady && cart.length > 0 && !invalidQuantity && cart.every(item =>
    isValidQuantity(item.quantidade, item.unidade) && Number.isFinite(item.preco) && item.preco >= 0 &&
    hasValidMeterArea(item) &&
    produtosAtivos.some(p => p.id === item.id && p.precoAplicado === item.preco && getUnidadeLabel(p.unidade) === item.unidade));
  const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
  const totalValue = cart.reduce((sum, item) => sum + getLineTotal(item), 0);
  const effectiveDiscount = Math.min(Math.max(0, appliedDiscount), totalValue);
  const urgencyAmount = fulfillment.urgent
    ? Math.max(0, (totalValue - effectiveDiscount) * (commercialRules?.urgencyPercentage ?? 30) / 100)
    : 0;
  const deliveryFeeAmount = fulfillment.deliveryMode === "entrega" ? Math.max(0, fulfillment.deliveryFee) : 0;
  const totalAfterDiscount = Math.max(0, totalValue - effectiveDiscount + urgencyAmount + deliveryFeeAmount);
  const capacityLimit = Number(capacity?.limit ?? 0);
  const capacityReserved = Number(capacity?.reserved ?? 0);
  const capacityLoad = capacityReserved + totalItems;
  const capacityProgress = capacity?.configured && Number.isFinite(capacityLimit) && capacityLimit > 0
    ? Math.min(100, Math.max(0, (capacityReserved / capacityLimit) * 100))
    : 0;
  const capacityAvailableAfterThisSale = capacity?.configured
    ? Number(capacity.available ?? 0) - totalItems
    : null;
  const isCapacityExceeded = offlineRuntime.isOperationalOnline && capacityAvailableAfterThisSale !== null && capacityAvailableAfterThisSale < -0.0001;
  const requiresOperationalAddress = fulfillment.receiptMode === "coleta" || fulfillment.deliveryMode === "entrega";
  const addressReady = Boolean(enderecoCliente?.logradouro?.trim() && enderecoCliente?.cidade?.trim() && enderecoCliente?.uf?.trim());
  const fulfillmentAddressSnapshot = enderecoCliente ? {
    cep: enderecoCliente.cep,
    logradouro: enderecoCliente.logradouro,
    numero: enderecoCliente.numero,
    complemento: enderecoCliente.complemento,
    bairro: enderecoCliente.bairro,
    cidade: enderecoCliente.cidade,
    uf: enderecoCliente.uf,
    pais: enderecoCliente.pais,
    latitude: enderecoCliente.latitude,
    longitude: enderecoCliente.longitude,
  } : undefined;
  useEffect(() => {
    if (!commercialRules || fulfillment.deliveryMode !== "entrega" || deliveryPricing.model !== "km") return;
    const deliveryFee = calculatedDeliveryFee ?? 0;
    setFulfillment((current) => current.deliveryMode === "entrega" && Math.abs(current.deliveryFee - deliveryFee) > 0.009
      ? { ...current, deliveryFee }
      : current);
  }, [calculatedDeliveryFee, commercialRules, deliveryPricing.model, fulfillment.deliveryMode]);
  const fulfillmentBlockReason = (() => {
    if (!selectedClient) return "Selecione um cliente antes de definir prazo e entrega.";
    if (!Number.isFinite(fulfillment.deliveryDate?.getTime())) return "Informe uma previsão de entrega válida.";
    if (format(fulfillment.deliveryDate, "yyyy-MM-dd") < format(new Date(), "yyyy-MM-dd")) return "A previsão de entrega não pode estar no passado.";
    if (!offlineRuntime.isOperationalOnline && offlineRuntime.offlineBlockReason) return offlineRuntime.offlineBlockReason;
    if (isFaturado && fulfillment.urgent) return "Pedidos faturados não aceitam Lavagem Expressa neste fluxo.";
    if (offlineRuntime.isOperationalOnline && capacityLoading) return "Aguarde a consulta de capacidade para a data escolhida.";
    if (offlineRuntime.isOperationalOnline && capacityError) return "Não foi possível validar a capacidade da data escolhida.";
    if (isCapacityExceeded && (!fulfillment.capacityOverride || !canManageCommercialTerms)) return "A data escolhida está sem capacidade para este pedido.";
    if (requiresOperationalAddress && offlineRuntime.isOperationalOnline && enderecoLoading) return "Aguarde o carregamento do endereço para coleta ou delivery.";
    if (requiresOperationalAddress && offlineRuntime.isOperationalOnline && enderecoError) return "Não foi possível validar o endereço para coleta ou delivery.";
    if (requiresOperationalAddress && !addressReady) return "Cadastre um endereço principal completo para coleta ou delivery.";
    if (fulfillment.deliveryMode === "entrega" && deliveryPricing.model === "km" && deliveryDistanceKm == null) return "Cadastre coordenadas da empresa e do cliente para calcular a taxa por KM.";
    return null;
  })();
  const checkoutBlockReasons = (() => {
    if (!canCreateSale) return ["Seu perfil não tem permissão para criar atendimentos neste PDV."];
    if (!selectedClient) return ["Selecione um cliente para carregar a tabela de preços."];
    if (catalogLoading) return ["Aguarde a validação do cliente, catálogo e preços."];
    if (catalogError) return ["Não foi possível validar cliente, catálogo ou preços; atualize os dados e tente novamente."];

    const reasons: string[] = [];
    if (cart.length === 0) reasons.push("Adicione pelo menos um produto ou serviço.");
    if (invalidQuantity) reasons.push("Corrija as quantidades dos itens antes de continuar.");
    if (cart.some((item) => !hasValidMeterArea(item))) reasons.push("Informe as medidas válidas dos produtos cobrados por área.");
    if (cart.length > 0 && !cartValid && !invalidQuantity && cart.every((item) => hasValidMeterArea(item))) {
      reasons.push("Confira o preço e a unidade de cada item na tabela aplicada ao cliente.");
    }

    if (mode === "orcamento") {
      if (!quoteValidUntil) reasons.push("Defina até quando o orçamento será válido.");
      else if (quoteValidUntil < format(new Date(), "yyyy-MM-dd")) reasons.push("A validade do orçamento não pode estar no passado.");
      if (!offlineRuntime.isOperationalOnline) reasons.push("Conecte o PDV à internet para salvar o orçamento.");
    } else if (selectedClient && reasons.length === 0 && fulfillmentBlockReason) {
      reasons.push(fulfillmentBlockReason);
    }
    return reasons;
  })();
  const firstCheckoutBlockReason = checkoutBlockReasons[0] ?? null;

  const filteredProdutos = useMemo(() => {
    const termo = searchTerm.trim();
    if (!termo) return [];

    return produtosAtivos
      .filter((produto) => matchesSearch(termo, produto.nome, produto.codigo))
      .sort((a, b) => {
        const rankDifference = searchRank(termo, a.nome, a.codigo) - searchRank(termo, b.nome, b.codigo);
        return rankDifference || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [produtosAtivos, searchTerm]);

  const produtoProntoParaAdicionar = useMemo(() => {
    const termo = normalizeSearchText(searchTerm);
    if (!termo) return null;
    return filteredProdutos.find((produto) =>
      normalizeSearchText(produto.codigo) === termo || normalizeSearchText(produto.nome) === termo
    ) ?? (filteredProdutos.length === 1 ? filteredProdutos[0] : null);
  }, [filteredProdutos, searchTerm]);

  const filteredClientes = useMemo(() => {
    const term = clientSearch.trim();
    if (!term) return [];

    return clientesFiltradosPorTipo
      .filter(c => matchesSearch(term, c.nome_fantasia || c.razao_social, c.cpf_cnpj, c.telefone))
      .sort((a, b) => {
        const rankDifference = searchRank(term, a.nome_fantasia || a.razao_social, a.cpf_cnpj, a.telefone)
          - searchRank(term, b.nome_fantasia || b.razao_social, b.cpf_cnpj, b.telefone);
        const nameA = a.nome_fantasia || a.razao_social;
        const nameB = b.nome_fantasia || b.razao_social;
        return rankDifference || nameA.localeCompare(nameB, "pt-BR");
      })
      .slice(0, 10);
  }, [clientesFiltradosPorTipo, clientSearch]);

  const focusClientSearch = useCallback(() => {
    setShowClientList(true);
    requestAnimationFrame(() => clientSearchRef.current?.focus());
  }, []);

  const addToCart = useCallback((produto: Produto) => {
    if (!catalogReady || !produtosAtivos.some(p => p.id === produto.id)) {
      toast.error("Selecione um cliente e aguarde a tabela e a condição de pagamento");
      return;
    }
    
    const preco = getPrecoForProduto(produto);
    if (!Number.isFinite(preco) || preco < 0) return;
    const unidade = getUnidadeLabel(produto.unidade);
    const isAreaBased = isMeterUnit(unidade);
    const existing = isAreaBased ? undefined : cart.find((item) => item.id === produto.id);
    const cartLineId = isAreaBased
      ? `area-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`
      : undefined;
    const itemParaDetalhes: CartItem = existing
      ? { ...existing, quantidade: Math.min(999, existing.quantidade + 1) }
      : {
          ...(cartLineId ? { cartLineId } : {}),
          id: produto.id,
          nome: produto.nome,
          codigo: produto.codigo,
          descricao: produto.descricao,
          preco,
          precoOriginal: produto.preco,
          unidade,
          quantidade: isAreaBased ? 0 : 1,
        };
    setQuantityDrafts(prev => { const next = { ...prev }; delete next[getCartLineKey(itemParaDetalhes)]; return next; });
    setCart((prev) => {
      const existing = isAreaBased ? undefined : prev.find((item) => item.id === produto.id);
      if (existing) {
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantidade: Math.min(999, item.quantidade + 1) }
            : item
        );
      }
      return [...prev, { 
        ...(cartLineId ? { cartLineId } : {}),
        id: produto.id,
        nome: produto.nome,
        codigo: produto.codigo,
        descricao: produto.descricao,
        preco,
        precoOriginal: produto.preco,
        unidade,
        quantidade: isAreaBased ? 0 : 1
      }];
    });
    setSearchTerm("");
    setShowProductList(false);
    if (isAreaBased) {
      setSelectedCartItem(itemParaDetalhes);
      setDetalhesModalOpen(true);
    }
  }, [catalogReady, produtosAtivos, getPrecoForProduto, cart]);

  const handleAddCurrentProduct = () => {
    if (!produtoProntoParaAdicionar) {
      setShowProductList(true);
      searchInputRef.current?.focus();
      toast.info("Selecione um produto ou serviço na lista");
      return;
    }
    addToCart(produtoProntoParaAdicionar);
  };

  const updateQuantity = useCallback((id: string, delta: number) => {
    setQuantityDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
    setCart((prev) =>
      prev
        .map((item) =>
          getCartLineKey(item) === id && !isMeterUnit(item.unidade)
            ? { ...item, quantidade: isValidQuantity(item.quantidade + delta, item.unidade) ? item.quantidade + delta : item.quantidade }
            : item
        )
        .filter((item) => item.quantidade > 0)
    );
  }, []);

  const removeFromCart = (id: string) => {
    clearScopedDraft(attendanceDraftKey ? `${attendanceDraftKey}:item:${id}` : null);
    setCart((prev) => prev.filter((item) => getCartLineKey(item) !== id));
    setQuantityDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const clearCart = useCallback(() => {
    for (const item of cart) clearScopedDraft(attendanceDraftKey ? `${attendanceDraftKey}:item:${getCartLineKey(item)}` : null);
    setCart([]);
    setQuantityDrafts({});
    setFulfillment(createInitialFulfillment(mode));
    setFulfillmentDraft(null);
    setShowFulfillmentModal(false);
    setPaymentShortcut(null);
    setPaymentAdjustmentOnly(false);
    setAppliedDiscount(0);
    setRolNotes("");
  }, [attendanceDraftKey, cart, mode]);

  const openFulfillmentModal = useCallback((preset: Partial<PdvFulfillmentSettings> = {}) => {
    // As escolhas operacionais ficam em rascunho até o atendente confirmá-las.
    setFulfillmentDraft({ ...(fulfillmentDraft ?? fulfillment), ...preset });
    setShowFulfillmentModal(true);
  }, [fulfillment, fulfillmentDraft]);

  const closeFulfillmentModal = useCallback(() => {
    setShowFulfillmentModal(false);
  }, []);

  const applyFulfillmentChanges = useCallback(() => {
    if (!fulfillmentDraft) return;
    if (offlineRuntime.isOperationalOnline && (
      fulfillmentDraftCapacityLoading || fulfillmentDraftCapacityError || fulfillmentDraftCapacity?.date !== fulfillmentDraftDateKey
    )) {
      toast.error("Aguarde a capacidade da data escolhida antes de aplicar as alterações.");
      return;
    }
    setFulfillment(fulfillmentDraft);
    setFulfillmentDraft(null);
    closeFulfillmentModal();
  }, [closeFulfillmentModal, fulfillmentDraft, fulfillmentDraftCapacity, fulfillmentDraftCapacityError, fulfillmentDraftCapacityLoading, fulfillmentDraftDateKey, offlineRuntime.isOperationalOnline]);

  const requestDiscard = useCallback((request: Omit<DiscardRequest, "confirmLabel"> & { confirmLabel?: string }) => {
    if (cart.length === 0) {
      request.action();
      return;
    }
    setDiscardRequest({ ...request, confirmLabel: request.confirmLabel ?? "Descartar e continuar" });
  }, [cart.length]);

  const requestClearSale = useCallback(() => {
    if (cart.length === 0) {
      toast.info("Não há itens para limpar");
      return;
    }
    requestDiscard({
      title: "Descartar esta venda?",
      description: "Os itens e detalhes lançados no ROL serão removidos. Esta ação não pode ser desfeita.",
      confirmLabel: "Descartar venda",
      action: () => {
        clearCart();
        setSelectedClientId(null);
        setClientSearch("");
        setSearchTerm("");
        clearScopedDraft(attendanceDraftKey);
      },
    });
  }, [attendanceDraftKey, cart.length, clearCart, requestDiscard]);

  const editQuantity = (item: CartItem, raw: string) => {
    if (isMeterUnit(item.unidade)) return;
    const lineKey = getCartLineKey(item);
    setQuantityDrafts(prev => ({ ...prev, [lineKey]: raw }));
    const value = Number(raw.replace(",", "."));
    if (/^\d+(?:[.,]\d+)?$/.test(raw) && isValidQuantity(value, item.unidade)) {
      setCart(prev => prev.map(current => getCartLineKey(current) === lineKey ? { ...current, quantidade: value } : current));
    }
  };

  const openDetalhesModal = (item: CartItem) => {
    setSelectedCartItem(item);
    setDetalhesModalOpen(true);
  };

  const saveDetalhes = (detalhes: {
    cor_item?: string;
    marca_item?: string;
    avarias?: string;
    posicao_prateleira?: string;
    observacoes?: string;
    operacao?: string;
    tipo_preco?: string;
    servicos_adicionais?: string[];
    complemento?: string;
    metragem_m2?: number;
    largura_m?: number;
    comprimento_m?: number;
    lacre?: string;
  }) => {
    if (!selectedCartItem) return;
    setCart(prev => prev.map(item => {
      if (getCartLineKey(item) !== getCartLineKey(selectedCartItem)) return item;
      const quantityFromMeasurement = isMeterUnit(item.unidade)
        ? detalhes.metragem_m2 && isValidQuantity(detalhes.metragem_m2, item.unidade) ? detalhes.metragem_m2 : 0
        : item.quantidade;
      return { ...item, ...detalhes, quantidade: quantityFromMeasurement };
    }));
    setQuantityDrafts(prev => {
      const next = { ...prev };
      delete next[getCartLineKey(selectedCartItem)];
      return next;
    });
    setSelectedCartItem(null);
  };

  const hasItemDetalhes = (item: CartItem) => {
    return !!(item.cor_item || item.marca_item || item.avarias || item.posicao_prateleira || item.observacoes || item.operacao || item.servicos_adicionais?.length || item.complemento || item.metragem_m2 || item.largura_m || item.comprimento_m || item.lacre);
  };

  const applySelectedClient = useCallback((clientId: string) => {
    clearCart();
    setSelectedClientId(clientId);
    setShowClientList(false);
    setClientSearch("");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [clearCart]);

  const selectClient = useCallback((clientId: string) => {
    if (clientId === selectedClientId) {
      setShowClientList(false);
      return;
    }
    requestDiscard({
      title: "Trocar o cliente desta venda?",
      description: "O ROL atual possui itens. Para evitar preços e condições incorretos, eles serão descartados ao trocar o cliente.",
      action: () => applySelectedClient(clientId),
    });
  }, [applySelectedClient, requestDiscard, selectedClientId]);

  useEffect(() => {
    if (prefilledClientRef.current || clientesFiltradosPorTipo.length === 0) return;
    const requestedClient = new URLSearchParams(search).get("cliente");
    prefilledClientRef.current = true;
    if (requestedClient && clientesFiltradosPorTipo.some((client) => client.id === requestedClient)) {
      selectClient(requestedClient);
    }
  }, [clientesFiltradosPorTipo, search, selectClient]);

  useEffect(() => {
    if (!catalogReady) return;

    // Recalcula somente quando os preços do cliente selecionado estiverem disponíveis.
    setCart(prev => prev.flatMap(item => {
      const produto = produtosAtivos.find(p => p.id === item.id);
      if (!produto || !Number.isFinite(produto.precoAplicado) || produto.precoAplicado < 0) return [];
      const unidade = getUnidadeLabel(produto.unidade);
      if (isMeterUnit(unidade) ? item.quantidade !== 0 && !isValidQuantity(item.quantidade, unidade) : !isValidQuantity(item.quantidade, unidade)) return [];
      return [{ ...item, preco: produto.precoAplicado, unidade }];
    }));
  }, [catalogReady, produtosAtivos]);

  const clearClient = () => {
    requestDiscard({
      title: "Remover o cliente desta venda?",
      description: "O ROL atual possui itens e será descartado junto com a seleção do cliente.",
      action: () => {
        setSelectedClientId(null);
        setClientSearch("");
        clearCart();
        requestAnimationFrame(() => clientSearchRef.current?.focus());
      },
    });
  };

  // Função para abrir modal de pagamento
  const handleOpenPagamento = useCallback(() => {
    if (osRecemCriada) {
      setShowImpressaoModal(true);
      return;
    }
    if (!catalogReady || !cartValid || cart.length === 0 || !selectedClientId) {
      const reason = firstCheckoutBlockReason ?? "Confira cliente, tabela e itens antes de finalizar.";
      toast.error(reason);
      return;
    }
    if (fulfillmentBlockReason) {
      toast.error(fulfillmentBlockReason);
      return;
    }
    saleIdempotencyRef.current ??= createPdvIdempotencyKey("sale");
    setShowPagamentoModal(true);
  }, [catalogReady, cartValid, cart.length, selectedClientId, osRecemCriada, fulfillmentBlockReason, firstCheckoutBlockReason]);

  const handleApplyDiscount = useCallback((discountAmount: number) => {
    setAppliedDiscount(discountAmount);
    setPaymentAdjustmentOnly(false);
    setShowPagamentoModal(false);
    toast.success(`Desconto aplicado: ${formatCurrency(discountAmount)}. Finalize o ROL no painel principal.`);
  }, []);

  // Função para finalizar venda
  const handleFinalizarVenda = async (dados: DadosPagamento) => {
    if (submittingRef.current || osRecemCriada || !selectedClient || !cartValid) {
      toast.error("Revise o cliente, a tabela e as quantidades antes de finalizar");
      return;
    }
    if (fulfillmentBlockReason) {
      toast.error(fulfillmentBlockReason);
      return;
    }
    if (dados.pagoAgora && (!canReceivePayments || isFaturado || !dados.formaPagamento)) {
      toast.error(isFaturado ? "Cliente faturado: o recebimento será feito no fechamento" : "Recebimento exige permissão de caixa e caixa aberto");
      return;
    }
    if (!isCustomerPaymentAllowed(paymentTerms, { ...dados, canReceivePayments }) || (!canManageCommercialTerms && dados.valorDesconto > 0) || (dados.formaPagamento === "FIDELIDADE" && !canUseLoyalty)) {
      toast.error("O pagamento deve respeitar a condição do cliente e suas permissões");
      return;
    }
    if (!Number.isFinite(dados.valorTotal) || dados.valorTotal <= 0 || !Number.isFinite(dados.valorDesconto) || dados.valorDesconto < 0 || (isFaturado && (dados.urgente || dados.valorDesconto > 0))) {
      toast.error("Revise os valores do atendimento; faturado deve manter o valor do ROL igual ao lançamento");
      return;
    }
    
    submittingRef.current = true;
    setIsProcessingVenda(true);
    let pendingOfflineRequest: PdvSaleRequest | null = null;
    let pendingOfflineReceipt: OfflinePdvReceipt | null = null;
    const saveOfflineSale = async (messagePrefix = "ROL salvo offline") => {
      if (!pendingOfflineRequest || !pendingOfflineReceipt) {
        throw new Error("Os dados do ROL offline não foram preparados");
      }
      if (pendingOfflineRequest.payment !== null || pendingOfflineRequest.cashRegisterId !== null) {
        throw new Error("Somente ROLs sem recebimento podem ser salvos offline");
      }
      await offlineRuntime.queueSale({ request: pendingOfflineRequest, receipt: pendingOfflineReceipt });
      setOfflineReceipt(pendingOfflineReceipt);
      setShowPagamentoModal(false);
      setUltimoClienteId(selectedClientId);
      saleIdempotencyRef.current = null;
      clearCart();
      setSelectedClientId(null);
      setClientSearch("");
      toast.success(`${messagePrefix}: ${pendingOfflineReceipt.localReference}.`, {
        action: {
          label: "Imprimir provisório",
          onClick: () => { void printOfflinePdvReceipt(pendingOfflineReceipt); },
        },
      });
    };
    
    try {
      const saleKey = saleIdempotencyRef.current ?? createPdvIdempotencyKey("sale");
      saleIdempotencyRef.current = saleKey;
      const splitPayments = dados.pagamentos ?? [];
      const firstSplitPayment = splitPayments[0];
      const initialPaymentMethod = firstSplitPayment?.method ?? dados.formaPagamento;
      const initialPaymentAmount = firstSplitPayment?.amount ?? dados.valorPagamento;
      const payment = !dados.pagoAgora || !initialPaymentMethod || initialPaymentMethod === "FIDELIDADE" || initialPaymentMethod === "CREDITO_CLIENTE"
        ? null
        : initialPaymentMethod === "PIX"
          ? { method: "PIX" as const, amount: initialPaymentAmount }
          : {
              method: initialPaymentMethod,
              amount: initialPaymentAmount,
              amountReceived: initialPaymentMethod === "DINHEIRO" ? (firstSplitPayment?.amountReceived ?? dados.valorRecebido) : undefined,
              installments: initialPaymentMethod === "CARTAO_CREDITO" ? dados.parcelas ?? 1 : 1,
              brand: dados.bandeira,
              nsu: dados.nsu,
              authorizationCode: dados.codigoAutorizacao,
            };
      const salePayment = dados.pagoAgora && splitPayments.length > 1
        ? splitPayments.map((item) => ({
            method: item.method,
            amount: item.amount,
            amountReceived: item.method === "DINHEIRO" ? (item.amountReceived ?? item.amount) : undefined,
            installments: 1,
          }))
        : payment;
      const saleRequest: PdvSaleRequest = {
        clientId: selectedClientId,
        cashRegisterId: dados.pagoAgora ? caixaAberto?.id ?? null : null,
        deliveryDate: dados.previsaoEntrega.toISOString().split("T")[0],
        urgent: dados.urgente,
        urgencyPercentage: dados.percentualUrgencia,
        discountAmount: dados.valorDesconto,
        receiptMode: dados.receiptMode,
        deliveryMode: dados.deliveryMode,
        deliveryFee: fulfillment.deliveryFee,
        addressSnapshot: dados.addressSnapshot,
        capacityOverride: isCapacityExceeded && fulfillment.capacityOverride && canManageCommercialTerms,
        driverId: dados.motoristaId,
        vehicleId: dados.veiculoId,
        items: cart.map((item) => ({
          produto_id: item.id,
          quantidade: item.quantidade,
          cor_item: item.cor_item,
          marca_item: item.marca_item,
          avarias: item.avarias,
          posicao_prateleira: item.posicao_prateleira,
          observacoes: [
            item.observacoes,
            item.operacao ? `Operação: ${item.operacao}` : null,
            item.servicos_adicionais?.length ? `Serviços adicionais: ${item.servicos_adicionais.join(", ")}` : null,
            item.complemento ? `Complemento: ${item.complemento}` : null,
            item.metragem_m2 ? `Área: ${formatSquareMetres(item.metragem_m2)} m²` : null,
            item.largura_m && item.comprimento_m ? `Medidas: ${formatMetres(item.largura_m)} m × ${formatMetres(item.comprimento_m)} m` : null,
            item.metragem_m2 ? `Cálculo: ${formatCurrency(item.preco)} / m² × ${formatSquareMetres(item.metragem_m2)} m² = ${formatCurrency(getLineTotal(item))}` : null,
            item.lacre ? `Lacre: ${item.lacre}` : null,
          ].filter(Boolean).join(" · ") || undefined,
        })),
        notes: rolNotes.trim() || null,
        payment: salePayment,
        idempotencyKey: saleKey,
      };
      const receiptCreatedAt = new Date().toISOString();
      const offlineSaleReceipt: OfflinePdvReceipt = {
        localReference: createOfflineLocalReference(saleKey, receiptCreatedAt),
        createdAt: receiptCreatedAt,
        tenantName: activeTenant?.name ?? "AnjoLav",
        area,
        operatorName: funcionario?.nome || user?.email || "Operador",
        clientId: selectedClient.id,
        clientName: selectedClient.nome_fantasia || selectedClient.razao_social,
        clientDocument: selectedClient.cpf_cnpj,
        deliveryDate: saleRequest.deliveryDate,
        receiptMode: dados.receiptMode,
        deliveryMode: dados.deliveryMode,
        notes: saleRequest.notes,
        subtotal: totalValue,
        discountAmount: dados.valorDesconto,
        urgencyAmount: dados.urgente ? Math.max(0, (totalValue - dados.valorDesconto) * dados.percentualUrgencia / 100) : 0,
        deliveryFee: dados.deliveryMode === "entrega" ? Math.max(0, fulfillment.deliveryFee) : 0,
        total: dados.valorTotal,
        items: cart.map((item) => ({
          productId: item.id,
          name: item.nome,
          quantity: item.quantidade,
          unit: item.unidade,
          unitPrice: item.preco,
          subtotal: getLineTotal(item),
          details: [item.cor_item && `Cor: ${item.cor_item}`, item.marca_item && `Marca: ${item.marca_item}`, item.metragem_m2 && `Área: ${formatSquareMetres(item.metragem_m2)} m²`, item.largura_m && item.comprimento_m && `Medidas: ${formatMetres(item.largura_m)} m × ${formatMetres(item.comprimento_m)} m`, item.lacre && `Lacre: ${item.lacre}`, item.observacoes]
            .filter(Boolean)
            .join(" · ") || null,
        })),
      };
      pendingOfflineRequest = saleRequest;
      pendingOfflineReceipt = offlineSaleReceipt;

      if (!offlineRuntime.isOperationalOnline) {
        if (!offlineRuntime.canQueueOffline) {
          throw new Error(offlineRuntime.offlineBlockReason || "O modo offline não está pronto neste PDV");
        }
        if (dados.pagoAgora) {
          throw new Error("Recebimentos não podem ser registrados sem conexão");
        }
        await saveOfflineSale();
        return;
      }

      const result = await createPdvSale.mutateAsync(saleRequest);
      offlineRuntime.reportBackendSuccess();

      setOsRecemCriada({
        id: result.order.id,
        numero: result.order.number,
        valorTotal: result.order.total,
        previsaoEntrega: dados.previsaoEntrega,
      });

      setShowPagamentoModal(false);
      if (dados.pagoAgora && caixaAberto && dados.formaPagamento === "FIDELIDADE" && dados.pontosResgate) {
        try {
          const redeemed = await redeemLoyalty.mutateAsync({
            orderId: result.order.id,
            cashRegisterId: caixaAberto.id,
            moment: "ENTRADA",
            points: dados.pontosResgate,
            idempotencyKey: `${saleKey}:loyalty`,
          });
          toast.success(`${dados.pontosResgate} pontos resgatados (${Number(redeemed.redeemedValue ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`);
        } catch (loyaltyError) {
          toast.error(loyaltyError instanceof Error ? loyaltyError.message : "O ROL foi criado, mas não foi possível resgatar os pontos");
        }
      }
      if (dados.pagoAgora && caixaAberto && dados.formaPagamento === "CREDITO_CLIENTE" && dados.valorCreditoAplicar) {
        try {
          const applied = await applyCustomerCredit.mutateAsync({
            orderId: result.order.id,
            cashRegisterId: caixaAberto.id,
            moment: "ENTRADA",
            amount: dados.valorCreditoAplicar,
            idempotencyKey: `${saleKey}:credit`,
          });
          const balance = Number(applied.saldoCredito ?? 0);
          toast.success(`Crédito aplicado ao ROL ${result.order.number}. Saldo restante: ${formatCurrency(balance)}`);
        } catch (creditError) {
          toast.error(creditError instanceof Error ? `ROL criado, mas o crédito não foi aplicado: ${creditError.message}` : "ROL criado, mas o crédito não foi aplicado. Consulte o pagamento do ROL antes de tentar novamente.");
        }
      }
      // Aguarda pagamentos e crédito antes de montar o aviso de entrada em texto.
      void dispararNotificacaoAutomatica("rol_entrada", result.order.id, `rol:${result.order.id}:entrada`).then((notification) => {
        if (notification.partial) {
          toast.warning(`ROL ${result.order.number} enviado para ${notification.sentCount} de ${notification.recipientCount} números. Confira os celulares cadastrados.`);
        } else if (notification.success && !notification.skipped && !notification.idempotent) {
          toast.success(`Aviso de entrada do ROL ${result.order.number} aceito pelo WhatsApp.`);
        } else if (!notification.success) {
          toast.message(`ROL ${result.order.number} criado; o envio automático não foi concluído. Verifique o WhatsApp do cliente.`);
        }
      });
      setShowImpressaoModal(true);
      
    } catch (error) {
      console.error("Erro ao finalizar venda:", error);
      offlineRuntime.reportBackendFailure(error);
      if (!dados.pagoAgora && pendingOfflineRequest && pendingOfflineReceipt && isOfflineLikeError(error) && offlineRuntime.canQueueOffline) {
        try {
          // Se o servidor recebeu o pedido antes da queda, a mesma chave de
          // idempotência retorna o ROL existente quando a fila for reenviada.
          await saveOfflineSale("Conexão interrompida; ROL protegido na fila offline");
          return;
        } catch (queueError) {
          console.error("Não foi possível proteger o ROL na fila offline", queueError);
        }
      }
      toast.error(error instanceof Error ? error.message : "Erro ao finalizar venda");
    } finally {
      submittingRef.current = false;
      setIsProcessingVenda(false);
    }
  };

  const handleSaveQuote = async () => {
    if (!user?.id) {
      toast.error("Sua sessão não está disponível para registrar o responsável do orçamento");
      return;
    }
    if (!selectedClient || !cartValid || savePdvQuote.isPending) {
      toast.error("Selecione o cliente e confira os itens antes de salvar o orçamento");
      return;
    }
    if (!quoteValidUntil || quoteValidUntil < format(new Date(), "yyyy-MM-dd")) {
      toast.error("Defina uma validade igual ou posterior a hoje");
      return;
    }

    try {
      const quote = await savePdvQuote.mutateAsync({
        clientId: selectedClient.id,
        total: totalValue,
        validUntil: quoteValidUntil,
        area,
        createdBy: user.id,
        notes: rolNotes,
        items: cart.map((item) => ({
          produto_id: item.id,
          codigo: item.codigo ?? null,
          descricao: item.nome,
          quantidade: item.quantidade,
          unidade: item.unidade,
          preco_unitario: item.preco,
          subtotal: getLineTotal(item),
          tabela_preco: clientPriceMode,
          detalhes: {
            cor: item.cor_item ?? null,
            marca: item.marca_item ?? null,
            defeito: item.avarias ?? null,
            posicao: item.posicao_prateleira ?? null,
            observacoes: item.observacoes ?? null,
            operacao: item.operacao ?? null,
            tipo_preco: item.tipo_preco ?? null,
            servicos_adicionais: item.servicos_adicionais ?? [],
            complemento: item.complemento ?? null,
            metragem_m2: item.metragem_m2 ?? null,
            largura_m: item.largura_m ?? null,
            comprimento_m: item.comprimento_m ?? null,
            lacre: item.lacre ?? null,
          },
        })),
      });
      toast.success(`${quote.codigo} salvo · ${formatCurrency(Number(quote.valor_total))}`);
      clearCart();
      setSelectedClientId(null);
      setClientSearch("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o orçamento");
    }
  };

  // Função após impressão (ou pular)
  const handleImpressaoComplete = () => {
    // Salvar último cliente usado
    if (selectedClientId) {
      setUltimoClienteId(selectedClientId);
    }
    setOsRecemCriada(null);
    setOfflineReceipt(null);
    saleIdempotencyRef.current = null;
    clearCart();
    setSelectedClientId(null);
    setClientSearch("");
    toast.success("Venda finalizada com sucesso!");
  };

  // Detectar leitura de código de barras (digitação rápida)
  useEffect(() => {
    const handleBarcodeInput = (e: KeyboardEvent) => {
      // Ignorar se um modal está aberto ou se está em um input
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      // Detectar digitação rápida de números (scanner)
      if (/^[0-9]$/.test(e.key)) {
        const nextBuffer = barcodeBufferRef.current + e.key;
        barcodeBufferRef.current = nextBuffer;
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          if (nextBuffer.length >= 3) {
            const produto = produtosAtivos.find((p) => p.codigo === nextBuffer);
            if (produto) {
              addToCart(produto);
            } else {
              toast.error(`Produto não encontrado: ${nextBuffer}`);
            }
          }
          barcodeBufferRef.current = "";
          barcodeTimeoutRef.current = null;
        }, 150);
      }
    };

    window.addEventListener("keypress", handleBarcodeInput);
    return () => {
      window.removeEventListener("keypress", handleBarcodeInput);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = null;
      }
      barcodeBufferRef.current = "";
    };
  }, [addToCart, produtosAtivos]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Usar último cliente
  const selectLastClient = useCallback(() => {
    if (ultimoClienteId && clientesFiltradosPorTipo.some(c => c.id === ultimoClienteId)) {
      selectClient(ultimoClienteId);
      toast.success("Último cliente selecionado");
    } else {
      toast.info("Nenhum cliente anterior disponível");
    }
  }, [ultimoClienteId, selectClient, clientesFiltradosPorTipo]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    // Ignorar se está digitando em um input (exceto para F-keys)
    const isTyping = document.activeElement?.tagName === "INPUT" || 
                     document.activeElement?.tagName === "TEXTAREA";
    
    // F1 - Ajuda
    if (e.key === "F1") {
      e.preventDefault();
      setShowAjudaAtalhos(true);
    }
    // F2 - Cliente
    if (e.key === "F2") {
      e.preventDefault();
      focusClientSearch();
    }
    // F3 - Busca de produtos, conforme a ajuda de atalhos.
    if (e.key === "F3") {
      e.preventDefault();
      if (searchInputRef.current?.disabled) toast.info("Selecione um cliente e aguarde a tabela de preços para buscar produtos.");
      else searchInputRef.current?.focus();
    }
    // F4 - Pagamento
    if (e.key === "F4") {
      e.preventDefault();
      handleOpenPagamento();
    }
    // F5 - Imprimir ROL recém-finalizada
    if (e.key === "F5") {
      e.preventDefault();
      if (osRecemCriada) {
        void printROL(osRecemCriada.id);
      } else {
        toast.info("Finalize o atendimento antes de imprimir a ROL.");
      }
    }
    // F6 - Consultar ordens e ROLs
    if (e.key === "F6") {
      e.preventDefault();
      setPdvLookupMode("consulta");
      setShowConsultarOSModal(true);
    }
    // F7 - Sangria/Suprimento (abre sangria por padrão)
    if (e.key === "F7") {
      e.preventDefault();
      if (canReceivePayments) {
        setShowSangriaModal(true);
      }
    }
    // F8 - Limpar carrinho
    if (e.key === "F8") {
      e.preventDefault();
      requestClearSale();
    }
    // F9 - Último cliente
    if (e.key === "F9") {
      e.preventDefault();
      selectLastClient();
    }
    // F10 - Fechar caixa
    if (e.key === "F10") {
      e.preventDefault();
      if (canReceivePayments) {
        setShowFecharCaixaModal(true);
      }
    }
    // F11 - Tela cheia
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
    // + / - para quantidade do último item (apenas se não estiver digitando)
    if (!isTyping && cart.length > 0) {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        const lastItem = cart[cart.length - 1];
        updateQuantity(getCartLineKey(lastItem), 1);
      }
      if (e.key === "-") {
        e.preventDefault();
        const lastItem = cart[cart.length - 1];
        updateQuantity(getCartLineKey(lastItem), -1);
      }
    }
    // ESC - Fechar modais
    if (e.key === "Escape") {
      if (showPagamentoModal) setShowPagamentoModal(false);
      if (showConsultarOSModal) {
        setShowConsultarOSModal(false);
        setPdvLookupMode("consulta");
      }
      if (showAjudaAtalhos) setShowAjudaAtalhos(false);
      if (showFulfillmentModal) closeFulfillmentModal();
    }
  }, [
    canReceivePayments,
    cart,
    focusClientSearch,
    handleOpenPagamento,
    requestClearSale,
    osRecemCriada,
    printROL,
    selectLastClient,
    showAjudaAtalhos,
    showConsultarOSModal,
    closeFulfillmentModal,
    showFulfillmentModal,
    showPagamentoModal,
    toggleFullscreen,
    updateQuantity,
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      if (cart.length === 0 || osRecemCriada) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventAccidentalExit);
    return () => window.removeEventListener("beforeunload", preventAccidentalExit);
  }, [cart.length, osRecemCriada]);

  useEffect(() => {
    setOperationSwitchLocked(cart.length > 0 && !osRecemCriada);
    return () => setOperationSwitchLocked(false);
  }, [cart.length, osRecemCriada, setOperationSwitchLocked]);

  // Escutar mudanças de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const currentItem = cart[cart.length - 1] ?? null;
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openOrderLookup = useCallback((mode: "consulta" | "posicao" = "consulta") => {
    setPdvLookupMode(mode);
    setShowConsultarOSModal(true);
  }, []);

  const handleDarBaixa = useCallback(async (ordem: OrdemServicoConsulta) => {
    if (!window.confirm(`Confirmar baixa do ROL ${ordem.numero}? Esta ação registra a entrega/retirada do cliente.`)) return;
    try {
      const { error } = await supabase.rpc("dar_baixa_rol_pdv", { _ordem_servico_id: ordem.id });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consulta-os"] }),
        queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
        queryClient.invalidateQueries({ queryKey: ["order-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["vendas-do-dia"] }),
      ]);
      toast.success(`ROL ${ordem.numero} baixado com sucesso.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível dar baixa no ROL.");
    }
  }, [queryClient]);

  const notificationFailureMessage = (reason?: string) => {
    const messages: Record<string, string> = {
      CLIENT_INACTIVE: "O cadastro do cliente está inativo. Ative o cadastro antes de avisar.",
      CLIENT_OPT_OUT: "O cliente desativou mensagens pelo WhatsApp.",
      PHONE_INVALID: "Nenhum telefone válido está cadastrado no cliente.",
      PHONE_CHANGED: "O telefone mudou durante o envio. Confira o cadastro e gere um novo aviso.",
      PROVIDER_DISABLED: "O envio WA-AKG está desativado nas configurações da empresa.",
      PROVIDER_UNCONFIGURED: "Falta configurar a conexão WA-AKG desta empresa.",
      PROVIDER_URL_INVALID: "A origem WA-AKG configurada não foi autorizada.",
      ROL_IMAGE_MISSING: "A imagem do comprovante do ROL não foi preparada.",
      ROL_IMAGE_UNAVAILABLE: "Não foi possível carregar o comprovante do ROL.",
      ROL_IMAGE_STORE_FAILED: "Não foi possível preparar o comprovante do ROL para envio.",
      template_inativo: "O modelo de mensagem deste aviso está desativado.",
      falhou: "O provedor não concluiu a mensagem. Confira o dispositivo WA-AKG e o histórico de envios.",
      incerto: "O provedor não confirmou o resultado. Confira o histórico antes de reenviar para evitar duplicidade.",
      pendente: "A mensagem permanece na fila. Confira a conexão do dispositivo WA-AKG.",
    };
    if (!reason) return "Confira a conexão e o histórico do WhatsApp antes de tentar novamente.";
    return messages[reason] ?? `Motivo informado pelo canal: ${reason}. Confira o histórico antes de reenviar.`;
  };

  const enviarAvisoDisponibilidade = async (ordemId: string, modalidade: string, ordemNumero?: string) => {
    const evento = modalidade === "entrega" ? "rol_pronto_delivery" : "rol_pronto_retirada";
    const resultado = await dispararNotificacaoAutomatica(
      evento,
      ordemId,
      `rol:${ordemId}:disponivel:${modalidade === "entrega" ? "entrega" : "balcao"}`,
    );
    if (resultado.partial) {
      toast.warning(`ROL ${ordemNumero || ordemId}: aviso enviado para ${resultado.sentCount} de ${resultado.recipientCount} números. ${notificationFailureMessage(resultado.reason)}`);
      return false;
    }
    if (resultado.success) {
      toast.success(resultado.idempotent ? `Aviso do ROL ${ordemNumero || ordemId} já enviado anteriormente.` : `Cliente avisado: ROL ${ordemNumero || ordemId} disponível.`);
      return true;
    }
    toast.error(`Não foi possível enviar o aviso do ROL ${ordemNumero || ordemId}. ${notificationFailureMessage(resultado.reason)}`);
    return false;
  };

  const workbenchTitle = mode === "delivery"
    ? "Balcão / PDV — Novo Delivery"
    : mode === "orcamento"
      ? "Balcão / PDV — Novo orçamento"
      : "Balcão / PDV — Novo ROL";
  const serviceLabel = mode === "delivery" ? "Delivery" : mode === "orcamento" ? "orçamento" : "ROL";
  const selectorPath = area === "industrial" ? "/pdv/industrial" : "/pdv/domestico";
  const panelPath = area === "industrial" ? "/pdv/painel/industrial" : "/pdv/painel/domestico";
  const quickModuleOptions: PdvShortcutModule[] = [
    { id: "clientes", title: "Clientes", icon: UserRound, permissionPath: `/${area}/clientes`, path: `${selectorPath}/clientes` },
    { id: "entregar", title: "Entregar pedido", icon: CheckCircle2, permissionPath: `/${area}/ordens`, path: `${selectorPath}/ordens?situacao=a_retirar` },
    { id: "agenda", title: "Agenda", icon: CalendarDays, permissionPath: `/${area}/agenda`, path: `${selectorPath}/agenda` },
    { id: "producao", title: "Produção", icon: Wrench, permissionPath: `/${area}/producao`, path: `${selectorPath}/producao` },
    { id: "delivery", title: "Delivery", icon: Truck, permissionPath: `/${area}/agenda`, path: `${selectorPath}/agenda?tipo=entrega&view=rotas` },
    { id: "catalogo", title: "Catálogo", icon: PackageCheck, permissionPath: area === "industrial" ? "/industrial/produtos" : "/residencial/produtos", path: `${selectorPath}/produtos` },
    { id: "estoque", title: "Estoque", icon: Boxes, permissionPath: `/${area}/estoque`, path: `${selectorPath}/estoque` },
    { id: "relatorios", title: "Relatórios", icon: BarChart3, permissionPath: area === "industrial" ? "/industrial/relatorios/clientes" : "/residencial/relatorios/caixa", path: `${selectorPath}/relatorios` },
    { id: "fechamento", title: "Fechar caixa", icon: ReceiptText, permissionPath: `/${area}/caixa`, action: "fechar-caixa" as const },
  ].filter((module) => canAccessRoute(module.permissionPath));
  const sidebarPreferenceKey = `anjolav:pdv-sidebar:v1:${activeTenant?.id ?? ""}:${user?.id ?? ""}:${area}`;
  const [sidebarPreference, setSidebarPreference] = useState(() => ({
    key: sidebarPreferenceKey,
    collapsed: readPdvSidebarCollapsed(sidebarPreferenceKey),
  }));
  const sidebarCollapsed = sidebarPreference.key === sidebarPreferenceKey && sidebarPreference.collapsed;

  useEffect(() => {
    if (sidebarPreference.key !== sidebarPreferenceKey) {
      setSidebarPreference({ key: sidebarPreferenceKey, collapsed: readPdvSidebarCollapsed(sidebarPreferenceKey) });
      return;
    }
    try {
      window.localStorage.setItem(sidebarPreferenceKey, sidebarPreference.collapsed ? "collapsed" : "expanded");
    } catch {
      // O menu continua funcionando enquanto a página estiver aberta.
    }
  }, [sidebarPreference, sidebarPreferenceKey]);

  const renderSidebarModule = (module: PdvShortcutModule) => {
    const Icon = module.icon;
    const isCloseCash = module.action === "fechar-caixa";
    return (
      <button
        key={module.id}
        type="button"
        className="pdv-sidebar-link"
        aria-label={module.title}
        title={isCloseCash && !canReceivePayments ? "Não há caixa aberto para fechar" : module.title}
        disabled={isCloseCash && !canReceivePayments}
        onClick={() => openQuickModule(module)}
      >
        <Icon aria-hidden="true" />
        <span>{module.title}</span>
      </button>
    );
  };
  const leaveAttendance = (action: () => void, _destination: string) => {
    action();
  };

  const openQuickModule = (module: PdvShortcutModule) => {
    if (module.action === "fechar-caixa") {
      const openCloseCash = () => {
        if (caixaAberto) setShowFecharCaixaModal(true);
        else toast.info("Não há caixa aberto para fechar.");
      };
      openCloseCash();
      return;
    }
    if (module.path) {
      navigate(module.path, {
        state: {
          pdvReturnTo: `${location.pathname}${location.search}`,
          pdvBackgroundLocation: location,
        },
      });
    }
  };

  return (
    <PdvLayout variant="front" operation={area} title={workbenchTitle} subtitle={`Atendimento ${areaLabel}`}>

      <div className={cn("pdv-cashier-page pdv-roll-workbench", `pdv-roll-workbench--${mode}`)} data-testid="pdv-cashier-reference">
        <div className="pdv-roll-heading pdv-page-heading">
          <button type="button" className="pdv-page-heading__back" aria-label="Voltar à Central de operações" onClick={() => leaveAttendance(() => navigate(panelPath), "a Central de operações")}><ArrowLeft aria-hidden="true" /> <span>Voltar</span></button>
          <span className="pdv-page-heading__divider" aria-hidden="true" />
          <div className="pdv-page-heading__main">
            <h1>{workbenchTitle}</h1>
            <p>{mode === "delivery" ? "Coleta e entrega no endereço do cliente" : mode === "orcamento" ? "Proposta sem cobrança ou movimentação de caixa" : "Atendimento completo de peças e serviços"}</p>
          </div>
          <nav className="pdv-page-heading__actions" aria-label="Tipo de atendimento">
            <button type="button" className={mode === "rol" ? "is-active" : undefined} aria-pressed={mode === "rol"} onClick={() => mode !== "rol" && leaveAttendance(() => navigate(`${selectorPath}/rol`), "atendimento ROL")}>ROL</button>
            <button type="button" className={mode === "delivery" ? "is-active" : undefined} aria-pressed={mode === "delivery"} onClick={() => mode !== "delivery" && leaveAttendance(() => navigate(`${selectorPath}/delivery`), "atendimento Delivery")}>Delivery</button>
            <button type="button" className={mode === "orcamento" ? "is-active" : undefined} aria-pressed={mode === "orcamento"} onClick={() => mode !== "orcamento" && leaveAttendance(() => navigate(`${selectorPath}/orcamento`), "Orçamento")}>Orçamento</button>
          </nav>
        </div>
        <div className={cn("pdv-workbench-layout", sidebarCollapsed && "is-collapsed")}>
          <aside className="pdv-tools-sidebar" aria-label="Atalhos do Balcão / PDV">
            <div className="pdv-tools-sidebar__header">
              {!sidebarCollapsed && <span>Atalhos do atendimento</span>}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="pdv-sidebar-toggle"
                aria-label={sidebarCollapsed ? "Expandir menu de atalhos" : "Recolher menu de atalhos"}
                aria-expanded={!sidebarCollapsed}
                title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
                onClick={() => setSidebarPreference({ key: sidebarPreferenceKey, collapsed: !sidebarCollapsed })}
              >
                {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
              </Button>
            </div>
            <nav className="pdv-tools-sidebar__nav">
              {quickModuleOptions.some((module) => module.id === "clientes") && (
                <section className="pdv-tools-group" aria-label="Cadastros">
                  <h2><UserRound aria-hidden="true" /><span>Cadastros</span></h2>
                  {quickModuleOptions.filter((module) => module.id === "clientes").map(renderSidebarModule)}
                </section>
              )}
              <section className="pdv-tools-group" aria-label="Consultas e relatórios">
                <h2><ClipboardList aria-hidden="true" /><span>Consultas e relatórios</span></h2>
                <button type="button" className="pdv-sidebar-link" aria-label="Consultar ROLs" title="Consultar ROLs" onClick={() => openOrderLookup()}><ClipboardList aria-hidden="true" /><span>Consultar ROLs</span></button>
                <button type="button" className="pdv-sidebar-link" aria-label="Orçamentos" title="Orçamentos" onClick={() => setShowPdvQuotesModal(true)}><FileText aria-hidden="true" /><span>Orçamentos</span></button>
                {quickModuleOptions.filter((module) => module.id === "relatorios").map(renderSidebarModule)}
                {canViewDayList && <button type="button" className="pdv-sidebar-link" aria-label="Lista do dia" title="Lista do dia" onClick={() => setShowListaDia(true)}><CalendarDays aria-hidden="true" /><span>Lista do dia</span></button>}
              </section>

              <section className="pdv-tools-group" aria-label="Operação">
                <h2><Wrench aria-hidden="true" /><span>Operação</span></h2>
                {quickModuleOptions.filter((module) => module.id === "agenda").map(renderSidebarModule)}
                {quickModuleOptions.filter((module) => module.id === "producao").map(renderSidebarModule)}
                <button type="button" className="pdv-sidebar-link" aria-label="Disponibilização" title="Disponibilização" disabled={!canViewDayList} onClick={() => setShowDisponibilizacaoDia(true)}><PackageCheck aria-hidden="true" /><span>Disponibilização</span></button>
                {quickModuleOptions.filter((module) => module.id === "delivery").map(renderSidebarModule)}
                {quickModuleOptions.filter((module) => ["catalogo", "estoque"].includes(module.id)).map(renderSidebarModule)}
              </section>

              <section className="pdv-tools-group" aria-label="Entrega">
                <h2><CheckCircle2 aria-hidden="true" /><span>Entrega</span></h2>
                {quickModuleOptions.filter((module) => module.id === "entregar").map(renderSidebarModule)}
              </section>

              <section className="pdv-tools-group" aria-label="Caixa">
                <h2><ReceiptText aria-hidden="true" /><span>Caixa</span></h2>
                <button type="button" className="pdv-sidebar-link" aria-label="Sangria" title={canReceivePayments ? "Registrar sangria no caixa aberto" : "Abra o caixa para registrar uma sangria"} disabled={!canReceivePayments} onClick={() => setShowSangriaModal(true)}><ArrowDownCircle aria-hidden="true" /><span>Sangria</span></button>
                {quickModuleOptions.filter((module) => module.id === "fechamento").map(renderSidebarModule)}
              </section>

              <section className="pdv-tools-group" aria-label="Comunicação">
                <h2><MoreHorizontal aria-hidden="true" /><span>Comunicação</span></h2>
                <button type="button" className="pdv-sidebar-link" aria-label={`WhatsApp · ${whatsappProviderLabel}`} title={`WhatsApp · ${whatsappProviderLabel}`} onClick={() => setShowWhatsAppDeviceModal(true)}>
                  <MessageSquare aria-hidden="true" />
                  <span>WhatsApp</span>
                  <span className="pdv-whatsapp-status" aria-label={`Estado do WhatsApp: ${whatsappProviderLabel}`}>
                    <span aria-hidden="true" className={cn("pdv-whatsapp-status__dot", `is-${whatsappProviderState}`)} />
                    <small>{whatsappProviderLabel}</small>
                  </span>
                </button>
              </section>
            </nav>
          </aside>

          <div className="pdv-workbench-content" role="region" aria-label="Atendimento em andamento">
        <div className="pdv-cashier-grid">
          <section className="pdv-primary-column" aria-label="Etapas de entrada do pedido">
            <section className="pdv-reference-card pdv-customer-card" aria-labelledby="pdv-client-title">
              <div className="pdv-card-title-row">
                <div className="pdv-card-title">
                  <span className="pdv-step-number" aria-hidden="true">1</span>
                  <h2 id="pdv-client-title">Cliente</h2>
                </div>
                {canCreateClient && !selectedClient && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" aria-label="Cadastrar cliente" onClick={() => setShowFullClientModal(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Cadastrar
                  </Button>
                )}
              </div>

              <div className="pdv-customer-search">
                <Search className="h-4 w-4" />
                <Input
                  id="pdv-client-search"
                  ref={clientSearchRef}
                  placeholder="Buscar por nome, telefone ou CPF..."
                  value={clientSearch}
                  onChange={(event) => {
                    setClientSearch(event.target.value);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                  skipUppercase
                  className="pl-10 text-sm"
                />
                {showClientList && (
                  <div className="pdv-customer-result-list">
                    {!clientSearch.trim() ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">Digite a primeira letra para buscar um cliente.</p>
                    ) : isLoadingClientes ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">Carregando clientes…</p>
                    ) : clientsError && offlineRuntime.isOperationalOnline ? (
                      <div className="space-y-2 p-3 text-center text-sm text-destructive">
                        <p>Não foi possível carregar os clientes.</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => void refetchClients()}>Tentar novamente</Button>
                      </div>
                    ) : !offlineRuntime.isOperationalOnline && clientes.length === 0 ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">Sem conexão e sem clientes disponíveis neste dispositivo. Reconecte o PDV e atualize os dados locais.</p>
                    ) : filteredClientes.length === 0 ? (
                      <div className="space-y-2 p-3 text-center text-sm text-muted-foreground">
                        <p>Cliente não encontrado nesta operação.</p>
                        {canCreateClient && <Button type="button" size="sm" onClick={() => setShowFullClientModal(true)}><UserPlus className="mr-2 h-4 w-4" />Cadastrar novo cliente</Button>}
                      </div>
                    ) : (
                      filteredClientes.map((cliente) => (
                        <button key={cliente.id} type="button" onClick={() => selectClient(cliente.id)}>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{cliente.nome_fantasia || cliente.razao_social}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{cliente.cpf_cnpj || "Sem documento"} · {cliente.telefone || "Sem telefone"}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedClient ? (
                <div className="pdv-customer-selected">
                  <div className="pdv-customer-selected-main">
                    <div className="pdv-customer-selected-top">
                      <span className="pdv-customer-avatar"><UserRound className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="pdv-customer-name">
                          {selectedClient.nome_fantasia || selectedClient.razao_social}
                          <span className="pdv-customer-badge">Cliente</span>
                          <span className="pdv-customer-price-badge" title="Tabela de preço configurada para este cliente">
                            Tabela: {CLIENT_PRICE_MODE_LABELS[normalizeClientPriceMode(selectedClient.tabela_preco_tipo)]}
                          </span>
                        </p>
                        {canUseLoyalty && isLoadingCustomerLoyalty ? (
                          <p className="pdv-customer-loyalty text-muted-foreground">Consultando pontos…</p>
                        ) : canUseLoyalty && customerLoyalty?.programaAtivo ? (
                          <p className="pdv-customer-loyalty text-success">{customerLoyalty.saldoPontos} pontos · {formatCurrency(customerLoyalty.valorSaldo)}</p>
                        ) : null}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={clearClient} aria-label="Remover cliente" title="Trocar cliente">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="pdv-customer-meta">
                      {selectedClient.telefone && <span><Phone className="h-3.5 w-3.5" /><span>{selectedClient.telefone}</span></span>}
                      {selectedClient.cpf_cnpj && <span><IdCard className="h-3.5 w-3.5" /><span>{selectedClient.cpf_cnpj}</span></span>}
                      {selectedClient.email && <span><Mail className="h-3.5 w-3.5" /><span>{selectedClient.email}</span></span>}
                    </div>
                    {area === "industrial" && !termsLoading && !termsError && !paymentTerms.conditionConfigured && (
                      <p role="status" className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                        Condição de pagamento não configurada: este ROL usará pagamento na retirada e não seguirá para faturamento. Para faturar, configure a condição no cadastro do cliente antes de finalizar.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </section>

          <section className="pdv-center-column">
            <section className="pdv-items-card overflow-hidden" aria-labelledby="pdv-items-title">
              <div className="pdv-items-header">
                <div className="pdv-items-title">
                  <span className="pdv-step-number" aria-hidden="true">4</span>
                  <div className="pdv-items-title-copy">
                    <h2 id="pdv-items-title">Itens do atendimento</h2>
                    <p>Adicione produtos e serviços da lavanderia.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="pdv-items-stats">{cart.length} {cart.length === 1 ? "item adicionado" : "itens adicionados"}</span>
                  <Button type="button" variant="outline" size="sm" className="pdv-clear-button hidden gap-1.5 sm:inline-flex" onClick={requestClearSale}>
                    <Trash2 className="h-3.5 w-3.5" /> Limpar itens
                  </Button>
                </div>
              </div>

              <div className="pdv-product-entry">
                <div className="pdv-product-search">
                  <Search className="h-4 w-4" />
                  <Input
                    id="pdv-product-search"
                    ref={searchInputRef}
                    disabled={!selectedClient || catalogLoading || catalogError}
                    placeholder={!selectedClient ? "Selecione primeiro o cliente" : catalogLoading ? "Carregando tabela de preços..." : catalogError ? "Tabela indisponível" : "Buscar produto ou serviço (ex.: camisa, calça, lençol...)"}
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setShowProductList(true);
                    }}
                    onFocus={() => setShowProductList(true)}
                    skipUppercase
                  />
                  {showProductList && (
                    <div className="pdv-product-result-list">
                      {!searchTerm.trim() ? (
                        <p className="p-3 text-center text-sm text-muted-foreground">Digite a primeira letra para buscar um produto ou serviço.</p>
                      ) : isLoadingProdutos ? (
                        <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos…</div>
                      ) : filteredProdutos.length === 0 ? (
                        <p className="p-3 text-center text-sm text-muted-foreground">Nenhum produto ou serviço encontrado.</p>
                      ) : (
                        filteredProdutos.map((produto) => {
                          const preco = getPrecoForProduto(produto);
                          return (
                            <button key={produto.id} type="button" disabled={!catalogReady} onClick={() => addToCart(produto)}>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{produto.nome}</span>
                                <span className="block text-[11px] text-muted-foreground">{produto.codigo || "Sem código"}</span>
                              </span>
                              <span className="shrink-0 text-right text-sm font-bold text-success">
                                {formatCurrency(preco)}
                                <span className="block text-[10px] font-medium text-muted-foreground">por {getPriceUnitLabel(getUnidadeLabel(produto.unidade))}</span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="pdv-product-quantity-field">
                  <span>{currentItem && isMeterUnit(currentItem.unidade) ? "Área calculada" : currentItem ? getQuantityInputLabel(currentItem.unidade) : "Quantidade"}</span>
                  {currentItem && isMeterUnit(currentItem.unidade) ? (
                    <div className="flex min-h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-semibold">
                      {currentItem.metragem_m2 ? `${formatSquareMetres(currentItem.metragem_m2)} m²` : "Informe as medidas no item"}
                    </div>
                  ) : (
                    <div className="pdv-product-quantity">
                      <button type="button" disabled={!currentItem} onClick={() => currentItem && updateQuantity(getCartLineKey(currentItem), -1)} aria-label="Diminuir quantidade do item atual"><Minus className="h-4 w-4" /></button>
                      <Input aria-label="Quantidade do item atual" inputMode="decimal" disabled={!currentItem} value={currentItem ? quantityDrafts[getCartLineKey(currentItem)] ?? String(currentItem.quantidade) : "1"} onChange={(event) => currentItem && editQuantity(currentItem, event.target.value)} />
                      <button type="button" disabled={!currentItem || !catalogReady} onClick={() => currentItem && updateQuantity(getCartLineKey(currentItem), 1)} aria-label="Aumentar quantidade do item atual"><Plus className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>

                <Button type="button" className="pdv-add-button gap-2" disabled={!catalogReady} onClick={handleAddCurrentProduct}>
                  <ShoppingCart className="h-4 w-4" /> Adicionar
                </Button>

                {(catalogError || (selectedClient && catalogLoading) || invalidQuantity) && (
                  <div className="col-span-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                    {catalogError ? <>Não foi possível carregar clientes, tabela ou condição de pagamento. <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => { void refetchPrices(); void refetchTerms(); void refetchProducts(); void refetchClients(); }}>Tentar novamente</Button></> : invalidQuantity ? "Quantidade deve ser maior que zero e até 999. Peças exigem valores inteiros." : "Carregando tabela e condição de pagamento…"}
                  </div>
                )}
              </div>

              <div className="pdv-items-content" role="region" aria-label="Lista de itens do atendimento" tabIndex={0}>
                <div className="pdv-mobile-cart" data-testid="pdv-mobile-cart">
                  {cart.length === 0 ? (
                    <div className="pdv-items-empty">
                      <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      <p className="font-medium">Nenhum item lançado</p>
                      <p className="mt-1 text-xs">Os itens adicionados aparecerão aqui.</p>
                    </div>
                  ) : cart.map((item, index) => (
                    <article key={getCartLineKey(item)} className={cn("rounded-lg border p-3", item.avarias && "border-warning/40 bg-warning/5")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-muted-foreground">ITEM {index + 1}</p>
                          <p className="truncate font-black">{item.nome}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(item.preco)} por {getPriceUnitLabel(item.unidade)}</p>
                        </div>
                        <p className="shrink-0 text-lg font-black text-success">{formatCurrency(getLineTotal(item))}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {isMeterUnit(item.unidade) ? (
                          <div className="text-sm font-semibold">
                            {item.metragem_m2 ? `${formatSquareMetres(item.metragem_m2)} m²` : <span className="text-destructive">Medidas pendentes</span>}
                            {item.largura_m && item.comprimento_m && <span className="ml-2 text-xs font-normal text-muted-foreground">{formatMetres(item.largura_m)} × {formatMetres(item.comprimento_m)} m</span>}
                          </div>
                        ) : (
                          <div className="pdv-table-quantity">
                            <button type="button" onClick={() => updateQuantity(getCartLineKey(item), -1)} aria-label={`Diminuir ${item.nome}`}><Minus className="h-3.5 w-3.5" /></button>
                            <Input aria-label={`${getQuantityInputLabel(item.unidade)} de ${item.nome}`} inputMode={item.unidade === "Kg" ? "decimal" : "numeric"} value={quantityDrafts[getCartLineKey(item)] ?? String(item.quantidade)} onChange={(event) => editQuantity(item, event.target.value)} />
                            <button type="button" onClick={() => updateQuantity(getCartLineKey(item), 1)} aria-label={`Aumentar ${item.nome}`}><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openDetalhesModal(item)} aria-label={`Detalhes de ${item.nome}`}><FileText className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(getCartLineKey(item))} aria-label={`Remover ${item.nome}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <table className="pdv-items-table">
                  <thead>
                    <tr>
                      <th className="w-14 text-center">#</th>
                      <th className="w-[105px]">Item</th>
                      <th>Descrição</th>
                      <th className="w-[128px] text-center">Qtd. / peso / área</th>
                      <th className="w-[94px] text-center">Unidade</th>
                      <th className="w-[105px] text-right">Preço unit.</th>
                      <th className="w-[113px] text-right">Total</th>
                      <th className="w-[110px] text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="pdv-items-empty">
                            <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
                            <p className="font-medium">Nenhum item lançado</p>
                            <p className="mt-1 text-xs">Os itens adicionados aparecerão aqui.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, index) => {
                        const temDetalhes = hasItemDetalhes(item);
                        return (
                          <tr key={getCartLineKey(item)} className={cn(item.avarias && "bg-warning/5")}>
                            <td className="text-center font-semibold text-muted-foreground">{index + 1}</td>
                            <td>
                              <div className="pdv-item-product">
                                <span className="pdv-item-thumb"><Package className="h-5 w-5" /></span>
                                <span className="min-w-0"><span className="pdv-item-code">{item.codigo || String(index + 1).padStart(3, "0")}</span></span>
                              </div>
                            </td>
                            <td>
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="pdv-item-name">{item.nome}</span>
                                {item.avarias && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />}
                              </div>
                              <span className="pdv-item-description">
                                {item.descricao?.trim().toLocaleLowerCase("pt-BR") === "detalhes de peça registrados"
                                  ? "Detalhes do item registrados"
                                  : item.descricao || (temDetalhes ? "Detalhes do item registrados" : "Lavagem e processamento")}
                              </span>
                            </td>
                            <td>
                              {isMeterUnit(item.unidade) ? (
                                <div className="text-center text-sm font-semibold">
                                  {item.metragem_m2 ? `${formatSquareMetres(item.metragem_m2)} m²` : <span className="text-destructive">Pendente</span>}
                                  {item.largura_m && item.comprimento_m && <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">{formatMetres(item.largura_m)} × {formatMetres(item.comprimento_m)} m</span>}
                                </div>
                              ) : (
                                <div className="pdv-table-quantity">
                                  <button type="button" onClick={() => updateQuantity(getCartLineKey(item), -1)} aria-label={`Diminuir ${item.nome}`}><Minus className="h-3.5 w-3.5" /></button>
                                  <Input aria-label={`${getQuantityInputLabel(item.unidade)} de ${item.nome}`} inputMode={item.unidade === "Kg" ? "decimal" : "numeric"} value={quantityDrafts[getCartLineKey(item)] ?? String(item.quantidade)} onChange={(event) => editQuantity(item, event.target.value)} />
                                  <button type="button" onClick={() => updateQuantity(getCartLineKey(item), 1)} aria-label={`Aumentar ${item.nome}`}><Plus className="h-3.5 w-3.5" /></button>
                                </div>
                              )}
                            </td>
                            <td className="text-center"><span className="pdv-unit-chip">{getPdvUnitDisplay(item.unidade)}</span></td>
                            <td className="text-right font-semibold tabular-nums">
                              <span className="block">{formatCurrency(item.preco)}</span>
                              <span className="block text-[10px] font-normal text-muted-foreground">por {getPriceUnitLabel(item.unidade)}</span>
                            </td>
                            <td className="text-right font-black tabular-nums">{formatCurrency(getLineTotal(item))}</td>
                            <td>
                              <div className="pdv-item-actions">
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-primary" onClick={() => openDetalhesModal(item)} aria-label={`Detalhes de ${item.nome}`} title="Editar detalhes do item"><Pencil className="h-4 w-4" /></Button>
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-destructive" onClick={() => removeFromCart(getCartLineKey(item))} aria-label={`Remover ${item.nome}`} title="Remover item"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pdv-roll-notes">
                <label htmlFor="pdv-rol-notes">Observações do {serviceLabel}</label>
                <Textarea
                  id="pdv-rol-notes"
                  value={rolNotes}
                  maxLength={500}
                  onChange={(event) => setRolNotes(event.target.value)}
                  placeholder="Ex.: manchas na gola, passadoria leve, embalar em separado..."
                  rows={2}
                />
                <small>{rolNotes.length} / 500</small>
              </div>

            </section>
          </section>
          </section>

          <aside className="pdv-right-column" aria-label={mode === "orcamento" ? "Validade, resumo e salvamento da proposta" : "Prazo, capacidade, resumo e finalização do pedido"}>
            {mode === "orcamento" ? (
              <section className="pdv-reference-card pdv-capacity-card" aria-labelledby="pdv-quote-validity-title">
                <div className="pdv-card-title-row">
                  <div className="pdv-card-title">
                    <span className="pdv-step-number" aria-hidden="true">3</span>
                    <div>
                      <h2 id="pdv-quote-validity-title">Validade da proposta</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Defina até quando os preços deste orçamento serão válidos.</p>
                    </div>
                  </div>
                </div>
                <label htmlFor="pdv-quote-validity" className="mt-3 block text-sm font-semibold">Válido até</label>
                <Input
                  id="pdv-quote-validity"
                  type="date"
                  min={format(new Date(), "yyyy-MM-dd")}
                  value={quoteValidUntil}
                  onChange={(event) => setQuoteValidUntil(event.target.value)}
                  aria-label="Data de validade do orçamento"
                />
                <p className="mt-2 text-xs text-muted-foreground">A proposta não define data de entrega, não reserva capacidade e não movimenta o caixa.</p>
              </section>
            ) : (
            <section className="pdv-reference-card pdv-capacity-card" aria-labelledby="pdv-capacity-title">
              <div className="pdv-card-title-row">
                <div className="pdv-card-title">
                  <span className="pdv-step-number" aria-hidden="true">3</span>
                  <h2 id="pdv-capacity-title">Prazo e capacidade</h2>
                </div>
              </div>
              <div className="pdv-delivery-mode" aria-label="Modalidade de entrega">
                <button
                  type="button"
                  className={fulfillment.deliveryMode === "balcao" ? "is-active" : undefined}
                  disabled={!selectedClient}
                  onClick={() => setFulfillment((current) => ({ ...current, deliveryMode: "balcao" }))}
                >
                  <Archive className="h-4 w-4" /> Retirada
                </button>
                <button
                  type="button"
                  className={fulfillment.deliveryMode === "entrega" ? "is-active" : undefined}
                  disabled={!selectedClient}
                  onClick={() => setFulfillment((current) => ({ ...current, deliveryMode: "entrega" }))}
                >
                  <Truck className="h-4 w-4" /> Delivery
                </button>
              </div>
              <div className="pdv-capacity-date">
                <span className="pdv-capacity-date-icon"><CalendarDays className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <small>Data prometida</small>
                  <strong>{format(fulfillment.deliveryDate, "dd/MM/yyyy")} <span className="font-medium text-muted-foreground">({format(fulfillment.deliveryDate, "EEEE", { locale: ptBR })})</span></strong>
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2 w-full gap-2" disabled={!selectedClient} onClick={() => openFulfillmentModal()}>
                <CalendarDays className="h-4 w-4" /> Consultar agenda e capacidade
              </Button>
              <div className="pdv-capacity-summary">
                <div className="pdv-capacity-heading">
                  <span className="flex items-center gap-1.5">Capacidade de {format(fulfillment.deliveryDate, "dd/MM/yyyy")} <Info className="h-3.5 w-3.5 text-primary" /></span>
                </div>
                {capacityLoading ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando agenda…</p>
                ) : capacityError ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">Não foi possível validar a capacidade.</p>
                ) : !capacity?.configured ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sem limite diário padrão configurado para {areaLabel.toLowerCase()}.
                  </p>
                ) : (
                  <>
                    <div className="pdv-capacity-meter-row">
                      <div className="pdv-capacity-meter" aria-label={`Capacidade utilizada: ${capacityProgress.toFixed(0)}%`}><span style={{ width: `${capacityProgress}%` }} /></div>
                      <strong aria-label={`Capacidade já agendada para ${format(fulfillment.deliveryDate, "dd/MM/yyyy")}: ${formatCarga(capacityReserved)} de ${formatCarga(capacityLimit)} peças ou cargas`}>
                        {formatCarga(capacityReserved)}/{formatCarga(capacityLimit)}
                      </strong>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Após este ROL: {formatCarga(capacityLoad)}/{formatCarga(capacityLimit)} · +{formatCarga(totalItems)} peças/carga.</p>
                  </>
                )}
              </div>
            </section>
            )}
            <section className="pdv-summary-card" aria-labelledby="pdv-summary-title">
              <header>
                <div className="pdv-summary-heading">
                  <span className="pdv-step-number" aria-hidden="true">5</span>
                  <h2 id="pdv-summary-title">Resumo do {serviceLabel}</h2>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="pdv-more-actions-trigger" aria-label="Mais Ações"><MoreHorizontal className="h-4 w-4" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 p-2">
                    <DropdownMenuLabel className="px-2 pb-1 text-xs uppercase tracking-wide text-muted-foreground">Ações do atendimento</DropdownMenuLabel>
                    {canManageContracts && <DropdownMenuItem disabled={!selectedClient} onSelect={() => { if (selectedClient) setShowContracts(true); }}><FileText className="mr-2 h-4 w-4" />Contrato do cliente</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><FileText className="mr-2 h-4 w-4" />Venda atual</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 p-2">
                        <DropdownMenuItem disabled={!currentItem} onSelect={() => { if (currentItem) openDetalhesModal(currentItem); }}><FileText className="mr-2 h-4 w-4" />Detalhes do item</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={requestClearSale}><Trash2 className="mr-2 h-4 w-4" />Cancelar venda<DropdownMenuShortcut>F8</DropdownMenuShortcut></DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    {canOperateCaixa && <DropdownMenuItem disabled={!canReceivePayments} onSelect={() => { if (canReceivePayments) setShowSuprimentoModal(true); }}><ArrowUpCircle className="mr-2 h-4 w-4" />Suprimento</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger><Keyboard className="mr-2 h-4 w-4" />Tela e atalhos</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56 p-2">
                        <DropdownMenuItem onSelect={() => setShowAjudaAtalhos(true)}><Keyboard className="mr-2 h-4 w-4" />Atalhos<DropdownMenuShortcut>F1</DropdownMenuShortcut></DropdownMenuItem>
                        <DropdownMenuItem onSelect={toggleFullscreen}>{isFullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}Tela cheia<DropdownMenuShortcut>F11</DropdownMenuShortcut></DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </header>
              <div className="pdv-summary-lines">
                <div className="pdv-summary-line"><span>Subtotal</span><strong>{formatCurrency(totalValue)}</strong></div>
                {mode !== "orcamento" && <>
                  <div className="pdv-adjustment-line">
                    <span className="text-[13px] text-muted-foreground">Desconto</span>
                    <button type="button" className="pdv-adjustment-button" aria-label="Configurar desconto" onClick={() => { setPaymentShortcut(null); setPaymentAdjustmentOnly(true); handleOpenPagamento(); }}>{formatCurrency(effectiveDiscount)}</button>
                    <span className="flex h-[34px] items-center justify-center rounded-md border text-xs font-bold text-muted-foreground">%</span>
                  </div>
                  <div className="pdv-adjustment-line">
                    <span className="text-[13px] text-muted-foreground">{fulfillment.urgent ? "Lavagem Expressa" : "Acréscimo"}</span>
                    <button type="button" className="pdv-adjustment-button" aria-label="Configurar Lavagem Expressa" onClick={() => openFulfillmentModal()}>{formatCurrency(urgencyAmount)}</button>
                    <span className="flex h-[34px] items-center justify-center rounded-md border text-xs font-bold text-muted-foreground">%</span>
                  </div>
                </>}
                {mode !== "orcamento" && deliveryFeeAmount > 0 && <div className="pdv-summary-line"><span>Taxa de delivery</span><strong>{formatCurrency(deliveryFeeAmount)}</strong></div>}
              </div>
              {canOperateCaixa && mode !== "orcamento" && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <CreditCard className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground">Crédito disponível</p>
                      <p className="text-sm font-bold text-foreground">{isLoadingCustomerCredit ? "Consultando…" : formatCurrency(Number(customerCredit?.saldo ?? 0))}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" disabled={!canReceivePayments} onClick={() => { setCustomerCreditMode("add"); setShowCustomerCreditModal(true); }}>
                    <CreditCard className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" disabled={!canReceivePayments || Number(customerCredit?.saldo ?? 0) <= 0} onClick={() => { setCustomerCreditMode("subtract"); setShowCustomerCreditModal(true); }}>
                    Abater
                  </Button>
                  </div>
                </div>
              )}
              <div className="pdv-total-banner">
                <small>Total do {serviceLabel}</small>
                <strong>{formatCurrency(mode === "orcamento" ? totalValue : totalAfterDiscount)}</strong>
              </div>
            </section>

            <section className="pdv-payment-card" aria-labelledby="pdv-payment-title">
              <header>
                <span className="pdv-step-number" aria-hidden="true">6</span>
                <div>
                  <h2 id="pdv-payment-title">{mode === "orcamento" ? "Salvar proposta" : "Pagamento"}</h2>
                  <p>{mode === "orcamento" ? "O orçamento não movimenta o caixa." : "Selecione a forma para a finalização."}</p>
                </div>
              </header>
              <div
                role="status"
                aria-live="polite"
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2.5 text-xs",
                  checkoutBlockReasons.length > 0
                    ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                    : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100",
                )}
              >
                <p className="flex items-center gap-2 font-semibold">
                  {checkoutBlockReasons.length > 0
                    ? <AlertTriangle className="h-4 w-4 shrink-0" />
                    : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                  {checkoutBlockReasons.length > 0 ? "Antes de continuar" : mode === "orcamento" ? "Proposta pronta para salvar" : "Atendimento pronto para finalizar"}
                </p>
                {checkoutBlockReasons.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 pl-6">
                    {checkoutBlockReasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1 pl-6">
                    {mode === "orcamento"
                      ? "Salvar a proposta não movimenta o caixa."
                      : isFaturado
                        ? "O valor seguirá para faturamento, sem recebimento neste caixa."
                        : "Na próxima etapa, forma, valor recebido, troco e dados obrigatórios de pagamento serão conferidos antes de gravar o ROL."}
                  </p>
                )}
              </div>
              {mode === "orcamento" ? (
                <div className="pdv-payment-actions pdv-quote-actions">
                  <div className="pdv-quote-notice"><Calculator className="h-5 w-5" /><span><strong>{quoteValidUntil ? `Válido até ${format(new Date(`${quoteValidUntil}T00:00:00`), "dd/MM/yyyy")}` : "Defina a validade da proposta"}</strong><small>Cliente, operação, responsável e itens ficam registrados.</small></span></div>
                  <Button type="button" data-testid="pdv-save-quote" className="pdv-finish-button gap-2" disabled={!cartValid || !quoteValidUntil || quoteValidUntil < format(new Date(), "yyyy-MM-dd") || savePdvQuote.isPending || !offlineRuntime.isOperationalOnline} onClick={() => void handleSaveQuote()}>
                    {savePdvQuote.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Salvar orçamento
                  </Button>
                </div>
              ) : (
                <>
                  {!offlineRuntime.isOperationalOnline && <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">Modo offline: salve apenas ROL sem recebimento. A validação de capacidade será refeita ao sincronizar.</p>}
                  {offlineRuntime.isOperationalOnline && !isLoadingCaixa && !canReceivePayments && !isFaturado && <p className="mt-2 text-xs text-warning">Abra o caixa e confirme sua permissão para receber agora.</p>}
                  {offlineRuntime.isOperationalOnline && !isLoadingCaixa && canOperateCaixa && !caixaAberto && (
                    <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => setShowAbrirCaixaModal(true)}>
                      Abrir caixa para receber
                    </Button>
                  )}
                  <div className="pdv-payment-options">
                    <button type="button" className={cn("pdv-payment-option", !isFaturado && canReceivePayments && (!paymentShortcut || paymentShortcut.pagoAgora && paymentShortcut.formaPagamento === "DINHEIRO") && "is-selected")} disabled={isFaturado || !canReceivePayments} onClick={() => { setPaymentAdjustmentOnly(false); setPaymentShortcut({ pagoAgora: true, formaPagamento: "DINHEIRO" }); handleOpenPagamento(); }}><Banknote className="h-5 w-5" /> Dinheiro</button>
                    <button type="button" className={cn("pdv-payment-option", paymentShortcut?.pagoAgora && paymentShortcut.formaPagamento === "PIX" && "is-selected")} disabled={isFaturado || !canReceivePayments} onClick={() => { setPaymentAdjustmentOnly(false); setPaymentShortcut({ pagoAgora: true, formaPagamento: "PIX" }); handleOpenPagamento(); }}><Smartphone className="h-5 w-5" /> PIX</button>
                    <button type="button" className={cn("pdv-payment-option", paymentShortcut?.pagoAgora && paymentShortcut.formaPagamento === "CARTAO_DEBITO" && "is-selected")} disabled={isFaturado || !canReceivePayments} onClick={() => { setPaymentAdjustmentOnly(false); setPaymentShortcut({ pagoAgora: true, formaPagamento: "CARTAO_DEBITO" }); handleOpenPagamento(); }}><CreditCard className="h-5 w-5" /> Cartão</button>
                    <button type="button" className={cn("pdv-payment-option", paymentShortcut?.pagoAgora === false && "is-selected")} disabled={isFaturado || Boolean(fulfillmentBlockReason)} onClick={() => { setPaymentAdjustmentOnly(false); setPaymentShortcut({ pagoAgora: false, formaPagamento: null }); handleOpenPagamento(); }}><CalendarRange className="h-5 w-5" /> Posterior</button>
                  </div>
                  <div className="pdv-payment-actions">
                    <Button type="button" data-testid="pdv-workflow-finalize" className="pdv-finish-button gap-2" disabled={!cartValid || isProcessingVenda || Boolean(fulfillmentBlockReason)} onClick={() => { setPaymentAdjustmentOnly(false); setPaymentShortcut(null); handleOpenPagamento(); }}>
                      <CircleCheck className="h-5 w-5" /> {!offlineRuntime.isOperationalOnline ? "Salvar ROL offline" : isFaturado ? "Finalizar ROL faturado" : mode === "delivery" ? "Finalizar delivery (F4)" : "Finalizar ROL (F4)"}
                    </Button>
                    <Button type="button" variant="outline" className="pdv-print-button gap-2" onClick={() => {
                      if (offlineReceipt) {
                        void printOfflinePdvReceipt(offlineReceipt);
                        return;
                      }
                      if (osRecemCriada) {
                        void printROL(osRecemCriada.id);
                        return;
                      }
                      toast.info("Finalize o atendimento antes de imprimir a ROL.");
                    }}>
                      <Printer className="h-4 w-4" /> Imprimir ROL (F5)
                    </Button>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>

          </div>
        </div>

      </div>

      {/* Modal de Detalhes do Item */}
      {selectedCartItem && (
        <ItemDetalhesModal
          key={getCartLineKey(selectedCartItem)}
          draftKey={attendanceDraftKey ? `${attendanceDraftKey}:item:${getCartLineKey(selectedCartItem)}` : null}
          open={detalhesModalOpen}
          onOpenChange={setDetalhesModalOpen}
          onDiscard={() => { setSelectedCartItem(null); setDetalhesModalOpen(false); }}
          itemNome={selectedCartItem.nome}
          quantidade={selectedCartItem.quantidade}
          unidade={selectedCartItem.unidade}
          precoUnitario={selectedCartItem.preco}
          unidadePreco={getPriceUnitLabel(selectedCartItem.unidade)}
          detalhes={{
            cor_item: selectedCartItem.cor_item,
            marca_item: selectedCartItem.marca_item,
            avarias: selectedCartItem.avarias,
            posicao_prateleira: selectedCartItem.posicao_prateleira,
            observacoes: selectedCartItem.observacoes,
            operacao: selectedCartItem.operacao,
            tipo_preco: selectedCartItem.tipo_preco,
            servicos_adicionais: selectedCartItem.servicos_adicionais,
            complemento: selectedCartItem.complemento,
            metragem_m2: selectedCartItem.metragem_m2,
            largura_m: selectedCartItem.largura_m,
            comprimento_m: selectedCartItem.comprimento_m,
            lacre: selectedCartItem.lacre,
          }}
          onSave={saveDetalhes}
        />
      )}

      {selectedClient && (
        <Dialog open={showFulfillmentModal} onOpenChange={(open) => {
          if (open) return;
          closeFulfillmentModal();
        }}>
          <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>Prazo, capacidade e entrega</DialogTitle>
              <DialogDescription>Defina prazo, capacidade, entrega ou retirada sem abandonar o pedido atual.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 overflow-y-auto pr-1">
              <PdvFulfillmentPanel
                clienteNome={selectedClient.nome_fantasia || selectedClient.razao_social}
                endereco={enderecoCliente}
                enderecoLoading={enderecoLoading}
                enderecoError={enderecoError}
                settings={fulfillmentDraft ?? fulfillment}
                requestedLoad={totalItems}
                capacity={fulfillmentDraftCapacity}
                capacityLoading={fulfillmentDraftCapacityLoading}
                capacityError={fulfillmentDraftCapacityError}
                canOverrideCapacity={canManageCommercialTerms}
                canSetUrgency={!isFaturado}
                deliveryPricing={deliveryPricing}
                deliveryDistanceKm={deliveryDistanceKm}
                onChange={setFulfillmentDraft}
              />
            </div>
            <DialogFooter className="shrink-0 border-t pt-4 sm:gap-3">
              <Button type="button" variant="outline" onClick={closeFulfillmentModal}>Cancelar</Button>
              <Button type="button" data-testid="pdv-fulfillment-apply" className="gap-2" onClick={applyFulfillmentChanges}>
                <CircleCheck className="h-4 w-4" /> Aplicar alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Pagamento */}
      <PagamentoModal
        open={showPagamentoModal}
        onOpenChange={(nextOpen) => {
          setShowPagamentoModal(nextOpen);
          if (!nextOpen) setPaymentAdjustmentOnly(false);
        }}
        cart={cart}
        cliente={selectedClient ? {
          id: selectedClient.id,
          razao_social: selectedClient.razao_social,
          nome_fantasia: selectedClient.nome_fantasia,
          cpf_cnpj: selectedClient.cpf_cnpj,
          classificacao: selectedClient.classificacao,
        } : null}
        totalOriginal={totalValue}
        initialDiscountAmount={effectiveDiscount}
        adjustmentOnly={paymentAdjustmentOnly}
        onApplyDiscount={handleApplyDiscount}
        loyalty={canUseLoyalty ? customerLoyalty ?? null : null}
        canManageCommercialTerms={canManageCommercialTerms}
        canReceivePayments={canReceivePayments}
        offlineMode={!offlineRuntime.isOperationalOnline}
        customerCredit={canOperateCaixa ? customerCredit ?? null : null}
        customerCreditLoading={isLoadingCustomerCredit}
        termsLoading={catalogLoading}
        termsError={catalogError || !cartValid}
        loyaltyLoading={isLoadingCustomerLoyalty}
        configuracaoPagamento={configuracaoPagamento ?? null}
        fulfillment={fulfillment}
        urgencyPercentage={commercialRules?.urgencyPercentage ?? 30}
        fulfillmentAddressSnapshot={fulfillmentAddressSnapshot}
        fulfillmentBlockReason={fulfillmentBlockReason}
        initialSelection={paymentShortcut}
        onConfirm={handleFinalizarVenda}
        isLoading={isProcessingVenda}
      />

      {canOperateCaixa && selectedClient && mode !== "orcamento" && (
        <CreditoClienteModal
          open={showCustomerCreditModal}
          onOpenChange={setShowCustomerCreditModal}
          client={{ id: selectedClient.id, name: selectedClient.nome_fantasia || selectedClient.razao_social }}
          cashRegisterId={caixaAberto?.id ?? null}
          canReceivePayments={canReceivePayments}
          summary={customerCredit}
          isLoadingSummary={isLoadingCustomerCredit}
          mode={customerCreditMode}
        />
      )}

      {/* Modal de Impressão Pós-Venda */}
      {osRecemCriada && (
        <ImpressaoPosVendaModal
          open={showImpressaoModal}
          onOpenChange={setShowImpressaoModal}
          osId={osRecemCriada.id}
          osNumero={osRecemCriada.numero}
          clienteNome={selectedClient?.nome_fantasia || selectedClient?.razao_social || "Cliente"}
          valorTotal={osRecemCriada.valorTotal}
          previsaoEntrega={osRecemCriada.previsaoEntrega}
          onComplete={handleImpressaoComplete}
        />
      )}

      {/* Modais de Caixa */}
      {canOperateCaixa && <AbrirCaixaModal
        open={showAbrirCaixaModal}
        onOpenChange={setShowAbrirCaixaModal}
      />}

      {canOperateCaixa && caixaAberto && (
        <>
          <FecharCaixaModal
            open={showFecharCaixaModal}
            onOpenChange={setShowFecharCaixaModal}
            caixa={caixaAberto}
          />
          <SangriaModal
            open={showSangriaModal}
            onOpenChange={setShowSangriaModal}
            caixaId={caixaAberto.id}
          />
          <SuprimentoModal
            open={showSuprimentoModal}
            onOpenChange={setShowSuprimentoModal}
            caixaId={caixaAberto.id}
          />
        </>
      )}

      {/* Modal Consultar ROL */}
      <ConsultarOSModal
        open={showConsultarOSModal}
        onOpenChange={(open) => {
          setShowConsultarOSModal(open);
          if (!open) setPdvLookupMode("consulta");
        }}
        positionMode={pdvLookupMode === "posicao"}
        canReceivePayments={canReceivePayments}
        receivePaymentBlockReason={!offlineRuntime.isOperationalOnline
          ? "Reconecte o PDV para receber pagamentos."
          : !canOperateCaixa
            ? "Seu perfil não possui permissão para operar o caixa."
            : !caixaAberto
              ? "Abra o caixa antes de receber o saldo do ROL."
              : null}
        onReceberPagamento={canOperateCaixa ? (ordem) => {
          if (!canReceivePayments || ordem.condicao_pagamento === "faturado") {
            toast.error(!offlineRuntime.isOperationalOnline ? "Reconecte o PDV para receber pagamentos." : "Abra o caixa para receber o saldo do ROL.");
            return;
          }
          setOsParaReceber(ordem);
          setShowReceberPagamentoModal(true);
        } : undefined}
        onDarBaixa={canOperateCaixa || canManageOrders ? handleDarBaixa : undefined}
        onEnviarEntrada={(ordem) => {
          void dispararNotificacaoAutomatica("rol_entrada", ordem.id, `rol:${ordem.id}:entrada:manual`).then((resultado) => {
            if (resultado.partial) {
              toast.warning(`Aviso de entrada enviado para ${resultado.sentCount} de ${resultado.recipientCount} números. Confira os celulares cadastrados.`);
              return;
            }
            if (resultado.success) {
              toast.success(resultado.idempotent ? "Aviso de entrada já enviado anteriormente." : "Aviso de entrada enviado ao cliente.");
            } else {
              toast.error("Não foi possível enviar o aviso de entrada pelo WhatsApp.");
            }
          });
        }}
        onImprimirROL={(osId) => {
          void printROL(osId);
        }}
        onImprimirEtiquetas={(osId) => {
          void printEtiqueta(osId);
        }}
        onImprimirDisponibilidade={(osId) => {
          void printROLDisponibilidade(osId);
        }}
        onEnviarDisponibilidade={(ordem) => {
          void enviarAvisoDisponibilidade(ordem.id, ordem.entrega_modalidade, ordem.numero);
        }}
      />

      <ConsultarOrcamentosPdvModal
        area={area}
        open={showPdvQuotesModal}
        onOpenChange={setShowPdvQuotesModal}
      />

      {/* Modal Receber Pagamento */}
      {canReceivePayments && osParaReceber && (
        <ReceberPagamentoModal
          canUseLoyalty={canUseLoyalty}
          open={showReceberPagamentoModal}
          onOpenChange={setShowReceberPagamentoModal}
          osId={osParaReceber.id}
          clienteId={osParaReceber.cliente.id}
          osNumero={osParaReceber.numero}
          clienteNome={osParaReceber.cliente?.nome_fantasia || osParaReceber.cliente?.razao_social || "Cliente"}
          valorTotal={osParaReceber.valor_total || 0}
          valorPago={osParaReceber.valor_pago || 0}
          onSuccess={() => {
            setOsParaReceber(null);
          }}
        />
      )}

      {canViewDayList && <ListaDoDiaModal
        open={showListaDia}
        onOpenChange={setShowListaDia}
      />}

      {canViewDayList && <DisponibilizacaoDoDiaModal
        open={showDisponibilizacaoDia}
        onOpenChange={setShowDisponibilizacaoDia}
        onEnviarDisponibilidade={enviarAvisoDisponibilidade}
      />}

      <PdvWhatsAppDeviceModal
        open={showWhatsAppDeviceModal}
        onOpenChange={setShowWhatsAppDeviceModal}
      />

      {canManageContracts && selectedClient && <Dialog open={showContracts} onOpenChange={setShowContracts}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Contrato · {selectedClient.nome_fantasia || selectedClient.razao_social}</DialogTitle>
            <DialogDescription>Setor {areaLabel} · Contrato do cliente selecionado.</DialogDescription>
          </DialogHeader>
          {showContracts && <ClienteContrato clienteId={selectedClient.id} />}
        </DialogContent>
      </Dialog>}

      {canCreateClient && <CadastroCompletoClientePdvModal
        open={showFullClientModal}
        onOpenChange={setShowFullClientModal}
        clientes={clientesFiltradosPorTipo}
        initialSearch={clientSearch}
        isLoadingClientes={isLoadingClientes}
        hasClientesError={clientsError}
        onRetryClientes={() => { void refetchClients(); }}
        canCreateClient={canCreateClient}
        canEditClient={canAccessRoute("/" + area + "/clientes")}
        onSelectClient={(clientId) => {
          selectClient(clientId);
          void refetchClients();
        }}
      />}

      {/* Modal Ajuda Atalhos */}
      <AjudaAtalhosModal
        open={showAjudaAtalhos}
        onOpenChange={setShowAjudaAtalhos}
      />

      <AlertDialog open={Boolean(discardRequest)} onOpenChange={(open) => !open && setDiscardRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{discardRequest?.title}</AlertDialogTitle>
            <AlertDialogDescription>{discardRequest?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar nesta venda</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const action = discardRequest?.action;
                setDiscardRequest(null);
                action?.();
              }}
            >
              {discardRequest?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PdvLayout>
  );
};

export default CaixaPDV;
