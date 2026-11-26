import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Loader2, MapPin, Navigation, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddressMap } from "@/components/ui/AddressMap";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEnderecosCliente, type EnderecoCliente } from "@/hooks/useClientes";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { useAuth } from "@/contexts/AuthContext";
import { clearScopedDraft, readScopedDraft, scopedDraftKey, writeScopedDraft } from "@/lib/scopedDraft";
import {
  CLIENT_ADDRESS_TYPES,
  CLIENT_ADDRESS_TYPE_LABELS,
  formatClientAddress,
  normalizeClientAddressDraft,
  validateClientAddressDraft,
  type ClientAddressDraft,
  type ClientAddressType,
} from "@/lib/clientAddress";
import { cn } from "@/lib/utils";
import {
  buscarCepComFallback,
  calcularDistanciaKm,
  geocodeEnderecoCliente,
  type BrasilApiCnpjResponse,
} from "@/services/apiServices";

interface ClienteEnderecoProps {
  clienteId: string | null;
  onNext: () => void;
  onSave: () => void;
  cnpjData?: BrasilApiCnpjResponse | null;
}

type AddressFieldErrors = ReturnType<typeof validateClientAddressDraft>["fieldErrors"];

function createEmptyDraft(clientId: string, cnpjData?: BrasilApiCnpjResponse | null): ClientAddressDraft {
  return {
    id: null,
    clientId,
    type: "principal",
    name: "",
    postalCode: cnpjData?.cep ?? "",
    street: cnpjData?.logradouro ?? "",
    number: cnpjData?.numero ?? "",
    complement: cnpjData?.complemento ?? "",
    neighborhood: cnpjData?.bairro ?? "",
    city: cnpjData?.municipio ?? "",
    state: cnpjData?.uf ?? "",
    country: "Brasil",
    latitude: null,
    longitude: null,
    primary: true,
    instructions: "",
  };
}

function addressToDraft(address: EnderecoCliente): ClientAddressDraft {
  return {
    id: address.id,
    clientId: address.cliente_id,
    type: address.tipo,
    name: address.nome ?? "",
    postalCode: address.cep ?? "",
    street: address.logradouro ?? "",
    number: address.numero ?? "",
    complement: address.complemento ?? "",
    neighborhood: address.bairro ?? "",
    city: address.cidade ?? "",
    state: address.uf ?? "",
    country: address.pais ?? "Brasil",
    latitude: address.latitude,
    longitude: address.longitude,
    primary: address.principal,
    instructions: address.instrucoes ?? "",
  };
}

function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export const ClienteEndereco = ({ clienteId, onNext, cnpjData }: ClienteEnderecoProps) => {
  const { enderecos, isLoading, isError, refetch, saveAddress, deleteAddress } = useEnderecosCliente(clienteId);
  const { configuracao } = useConfiguracoesGerais();
  const { user, activeTenant } = useAuth();
  const draftKey = scopedDraftKey(user?.id, activeTenant?.id, `cliente:endereco:${clienteId ?? "novo"}`);
  const restored = useRef(readScopedDraft<{ selectedAddressId: string | null; draft: ClientAddressDraft }>(draftKey));
  const loadedDraftKey = useRef(draftKey);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(restored.current?.selectedAddressId ?? null);
  const [draft, setDraft] = useState<ClientAddressDraft | null>(restored.current?.draft ?? null);
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({});
  const [dirty, setDirty] = useState(Boolean(restored.current));
  const [isSearchingPostalCode, setIsSearchingPostalCode] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [approximateLocation, setApproximateLocation] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<EnderecoCliente | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (loadedDraftKey.current !== draftKey) return;
    if (clienteId && dirty && draft) writeScopedDraft(draftKey, { selectedAddressId, draft });
    else clearScopedDraft(draftKey);
  }, [clienteId, draftKey, selectedAddressId, draft, dirty]);

  const activeAddresses = useMemo(() => enderecos.filter((address) => address.ativo), [enderecos]);
  const archivedAddresses = useMemo(() => enderecos.filter((address) => !address.ativo), [enderecos]);
  const companyLatitude = configuracao?.endereco_latitude ?? null;
  const companyLongitude = configuracao?.endereco_longitude ?? null;
  const hasCompanyCoordinates = Number.isFinite(companyLatitude) && Number.isFinite(companyLongitude);
  const hasDraftCoordinates = draft !== null
    && Number.isFinite(draft.latitude)
    && Number.isFinite(draft.longitude);
  const distance = hasDraftCoordinates && hasCompanyCoordinates
    ? calcularDistanciaKm(companyLatitude!, companyLongitude!, draft.latitude!, draft.longitude!)
    : null;

  useEffect(() => {
    if (!clienteId || isLoading || dirty) return;
    const selected = enderecos.find((address) => address.id === selectedAddressId && address.ativo)
      ?? enderecos.find((address) => address.ativo && address.principal)
      ?? enderecos.find((address) => address.ativo)
      ?? null;
    if (selected) {
      setSelectedAddressId(selected.id);
      setDraft(addressToDraft(selected));
      return;
    }
    setSelectedAddressId(null);
    setDraft(createEmptyDraft(clienteId, cnpjData));
  }, [clienteId, cnpjData, dirty, enderecos, isLoading, selectedAddressId]);

  useEffect(() => {
    const saved = readScopedDraft<{ selectedAddressId: string | null; draft: ClientAddressDraft }>(draftKey);
    loadedDraftKey.current = draftKey;
    setSelectedAddressId(saved?.selectedAddressId ?? null);
    setDraft(saved?.draft ?? (clienteId ? createEmptyDraft(clienteId, cnpjData) : null));
    setFieldErrors({});
    setDirty(Boolean(saved));
    setApproximateLocation(false);
    setSaveError(null);
  }, [clienteId, cnpjData, draftKey]);

  const selectAddress = (address: EnderecoCliente) => {
    clearScopedDraft(draftKey);
    setSelectedAddressId(address.id);
    setDraft(addressToDraft(address));
    setFieldErrors({});
    setDirty(false);
    setApproximateLocation(false);
    setSaveError(null);
  };

  const startNewAddress = () => {
    if (!clienteId) return;
    clearScopedDraft(draftKey);
    setSelectedAddressId(null);
    setDraft({
      ...createEmptyDraft(clienteId),
      type: activeAddresses.length === 0 ? "principal" : "outro",
      primary: activeAddresses.length === 0,
    });
    setFieldErrors({});
    setDirty(true);
    setApproximateLocation(false);
    setSaveError(null);
  };

  const setField = <Key extends keyof ClientAddressDraft>(field: Key, value: ClientAddressDraft[Key]) => {
    setDraft((current) => {
      if (!current) return current;
      const addressFields: Array<keyof ClientAddressDraft> = [
        "postalCode", "street", "number", "complement", "neighborhood", "city", "state",
      ];
      return {
        ...current,
        [field]: value,
        ...(addressFields.includes(field) ? { latitude: null, longitude: null } : {}),
      };
    });
    setFieldErrors((current) => ({ ...current, [field]: undefined, coordinates: undefined }));
    setSaveError(null);
    setDirty(true);
    if (["postalCode", "street", "number", "neighborhood", "city", "state"].includes(field)) {
      setApproximateLocation(false);
    }
  };

  const handlePostalCodeSearch = async () => {
    if (!draft) return;
    const postalCode = draft.postalCode.replace(/\D/g, "");
    if (postalCode.length !== 8) {
      setFieldErrors((current) => ({ ...current, postalCode: "Informe os 8 dígitos do CEP." }));
      return;
    }
    setIsSearchingPostalCode(true);
    try {
      const result = await buscarCepComFallback(postalCode);
      if (!result) {
        setFieldErrors((current) => ({ ...current, postalCode: "CEP não encontrado. Confira ou preencha manualmente." }));
        return;
      }
      setDraft((current) => current ? {
        ...current,
        postalCode,
        street: result.logradouro || current.street,
        neighborhood: result.bairro || current.neighborhood,
        city: result.localidade || current.city,
        state: result.uf || current.state,
        latitude: null,
        longitude: null,
      } : current);
      setFieldErrors((current) => ({ ...current, postalCode: undefined }));
      setApproximateLocation(false);
      setDirty(true);
      toast.success("CEP encontrado. Revise o número e localize o endereço pelo logradouro.");
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      setFieldErrors((current) => ({ ...current, postalCode: "Não foi possível consultar o CEP agora." }));
    } finally {
      setIsSearchingPostalCode(false);
    }
  };

  const handleGeocode = async () => {
    if (!draft) return;
    if (!draft.street.trim() || !draft.city.trim() || !draft.state.trim()) {
      setFieldErrors((current) => ({ ...current, coordinates: "Preencha rua, cidade e UF antes de localizar o endereço." }));
      return;
    }
    setIsGeocoding(true);
    try {
      const result = await geocodeEnderecoCliente({
        postalCode: draft.postalCode,
        street: draft.street,
        number: draft.number,
        neighborhood: draft.neighborhood,
        city: draft.city,
        state: draft.state,
      });
      if (!result) {
        toast.warning("Não foi possível confirmar esse logradouro no mapa. Posicione o marcador manualmente.");
        return;
      }
      setDraft((current) => current ? { ...current, latitude: result.latitude, longitude: result.longitude } : current);
      setFieldErrors((current) => ({ ...current, coordinates: undefined }));
      setApproximateLocation(true);
      setDirty(true);
      if (result.postalCodeMismatch) {
        toast.warning("Mapa localizado pela rua e número. O provedor encontrou um CEP diferente; confira o CEP informado.");
      } else {
        toast.success(result.precision === "address"
          ? "Endereço localizado. Confira e ajuste o marcador, se necessário."
          : "Logradouro localizado aproximadamente. Confira e ajuste o marcador.");
      }
    } catch (error) {
      console.error("Erro ao localizar endereço:", error);
      toast.error("Não foi possível localizar o endereço no mapa agora.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const save = async (continueAfterSave: boolean) => {
    if (!draft) return;
    const normalized = normalizeClientAddressDraft(draft);
    const validation = validateClientAddressDraft(normalized);
    if (!validation.valid) {
      setDraft(normalized);
      setFieldErrors(validation.fieldErrors);
      toast.error("Revise os campos indicados antes de salvar.");
      return;
    }
    try {
      setSaveError(null);
      const saved = await saveAddress.mutateAsync(normalized);
      setSelectedAddressId(saved.id);
      setDraft(addressToDraft(saved));
      setFieldErrors({});
      setDirty(false);
      clearScopedDraft(draftKey);
      if (continueAfterSave) onNext();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar o endereço agora.");
    }
  };

  if (!clienteId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-56 flex-col items-center justify-center gap-2 p-8 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">Salve a identificação do cliente primeiro</p>
          <p className="max-w-md text-sm text-muted-foreground">Depois você poderá cadastrar um ou mais endereços para coleta, entrega e faturamento.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !draft) {
    return <div className="flex min-h-64 items-center justify-center gap-2" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Carregando endereços…</span></div>;
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
          <CircleAlert className="h-8 w-8 text-destructive" />
          <p className="font-semibold">Não foi possível carregar os endereços</p>
          <p className="text-sm text-muted-foreground">A edição está bloqueada para não substituir dados que não foram carregados.</p>
          <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const isSaving = saveAddress.isPending;

  return (
    <div className="pdv-client-address-book space-y-5" data-testid="client-address-book">
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.34fr)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="gap-3 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div><CardTitle className="text-lg">Endereços do cliente</CardTitle><CardDescription className="mt-1">Selecione um endereço para editá-lo ou definir o padrão dos pedidos.</CardDescription></div>
              <Button type="button" size="sm" className="min-h-11 gap-2" onClick={startNewAddress}><Plus className="h-4 w-4" /> Novo</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAddresses.length === 0 && (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <MapPin className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nenhum endereço ativo</p>
                <p className="mt-1 text-xs text-muted-foreground">O atendimento simples pode continuar sem endereço. Cadastre-o quando houver coleta, entrega ou necessidade fiscal.</p>
              </div>
            )}
            {activeAddresses.map((address) => {
              const typeLabel = CLIENT_ADDRESS_TYPE_LABELS[address.tipo];
              const addressName = address.nome?.trim();
              const nameMatchesType = addressName?.localeCompare(typeLabel, "pt-BR", { sensitivity: "base" }) === 0;
              const displayName = addressName && !nameMatchesType
                ? addressName
                : `Endereço ${typeLabel.toLocaleLowerCase("pt-BR")}`;
              return (
                <div key={address.id} className={cn("flex items-start gap-2 rounded-xl border p-3 transition-colors", selectedAddressId === address.id ? "border-primary bg-primary/[0.04]" : "hover:border-primary/40 hover:bg-muted/30")}>
                  <button type="button" onClick={() => selectAddress(address)} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Editar ${displayName}: ${formatClientAddress(address)}`} aria-pressed={selectedAddressId === address.id}>
                    <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{displayName}</span>{addressName && !nameMatchesType && <Badge variant="outline">{typeLabel}</Badge>}{address.principal && <Badge className="gap-1"><Star className="h-3 w-3" /> Padrão</Badge>}</span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">{formatClientAddress(address)}</span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setAddressToDelete(address)} aria-label={`Excluir definitivamente ${displayName}: ${formatClientAddress(address)}`} title="Excluir endereço definitivamente"><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            {archivedAddresses.length > 0 && (
              <div className="space-y-2 border-t pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endereços inativos</p>{archivedAddresses.map((address) => <div key={address.id} className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"><span className="min-w-0 flex-1 truncate">{address.nome || CLIENT_ADDRESS_TYPE_LABELS[address.tipo]} · {formatClientAddress(address)}</span><Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setAddressToDelete(address)} aria-label="Excluir definitivamente endereço inativo" title="Excluir definitivamente"><Trash2 className="h-4 w-4" /></Button></div>)}</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle className="flex items-center gap-2 text-lg">{draft.id ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}{draft.id ? "Editar endereço" : "Novo endereço"}</CardTitle><CardDescription className="mt-1">Logradouro, cidade e UF são obrigatórios somente ao salvar um endereço.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="client-address-type">Finalidade *</Label><Select value={draft.type} onValueChange={(value: ClientAddressType) => setField("type", value)}><SelectTrigger id="client-address-type" className="min-h-11 text-base md:text-sm"><SelectValue /></SelectTrigger><SelectContent>{CLIENT_ADDRESS_TYPES.map((type) => <SelectItem key={type} value={type}>{CLIENT_ADDRESS_TYPE_LABELS[type]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="client-address-name">Nome para identificação</Label><Input id="client-address-name" value={draft.name} onChange={(event) => setField("name", event.target.value)} placeholder="Ex.: Casa, Matriz, Doca 2" skipUppercase className="min-h-11 text-base md:text-sm" /></div>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/20 p-4"><div><Label htmlFor="client-address-primary" className="text-base">Usar como endereço principal</Label><p className="mt-1 text-sm text-muted-foreground">Pedidos usam este endereço por padrão; coleta ou entrega específica prevalece na rota correspondente.</p></div><Switch id="client-address-primary" checked={draft.primary} onCheckedChange={(checked) => setField("primary", checked)} aria-label="Usar como endereço principal" /></div>
              <div className="grid gap-4 md:grid-cols-[minmax(180px,0.35fr)_minmax(0,1fr)]">
                <div className="space-y-2"><Label htmlFor="client-address-postal-code">CEP</Label><div className="flex gap-2"><Input id="client-address-postal-code" value={formatPostalCode(draft.postalCode)} onChange={(event) => setField("postalCode", event.target.value)} inputMode="numeric" autoComplete="postal-code" aria-invalid={Boolean(fieldErrors.postalCode)} aria-describedby={fieldErrors.postalCode ? "client-address-postal-code-error" : undefined} className="min-h-11 text-base md:text-sm" /><Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => void handlePostalCodeSearch()} disabled={isSearchingPostalCode} aria-label="Buscar CEP">{isSearchingPostalCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div>{fieldErrors.postalCode && <p id="client-address-postal-code-error" className="text-sm text-destructive">{fieldErrors.postalCode}</p>}</div>
                <div className="space-y-2"><Label htmlFor="client-address-street">Logradouro *</Label><Input id="client-address-street" value={draft.street} onChange={(event) => setField("street", event.target.value)} autoComplete="street-address" skipUppercase aria-invalid={Boolean(fieldErrors.street)} aria-describedby={fieldErrors.street ? "client-address-street-error" : undefined} className="min-h-11 text-base md:text-sm" />{fieldErrors.street && <p id="client-address-street-error" className="text-sm text-destructive">{fieldErrors.street}</p>}</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2"><Label htmlFor="client-address-number">Número</Label><Input id="client-address-number" value={draft.number} onChange={(event) => setField("number", event.target.value)} skipUppercase className="min-h-11 text-base md:text-sm" /></div>
                <div className="space-y-2 sm:col-span-1 lg:col-span-2"><Label htmlFor="client-address-complement">Complemento</Label><Input id="client-address-complement" value={draft.complement} onChange={(event) => setField("complement", event.target.value)} skipUppercase className="min-h-11 text-base md:text-sm" /></div>
                <div className="space-y-2"><Label htmlFor="client-address-neighborhood">Bairro</Label><Input id="client-address-neighborhood" value={draft.neighborhood} onChange={(event) => setField("neighborhood", event.target.value)} skipUppercase className="min-h-11 text-base md:text-sm" /></div>
                <div className="space-y-2"><Label htmlFor="client-address-city">Cidade *</Label><Input id="client-address-city" value={draft.city} onChange={(event) => setField("city", event.target.value)} skipUppercase aria-invalid={Boolean(fieldErrors.city)} aria-describedby={fieldErrors.city ? "client-address-city-error" : undefined} className="min-h-11 text-base md:text-sm" />{fieldErrors.city && <p id="client-address-city-error" className="text-sm text-destructive">{fieldErrors.city}</p>}</div>
                <div className="space-y-2"><Label htmlFor="client-address-state">UF *</Label><Input id="client-address-state" value={draft.state} onChange={(event) => setField("state", event.target.value)} maxLength={2} autoCapitalize="characters" aria-invalid={Boolean(fieldErrors.state)} aria-describedby={fieldErrors.state ? "client-address-state-error" : undefined} className="min-h-11 text-base uppercase md:text-sm" />{fieldErrors.state && <p id="client-address-state-error" className="text-sm text-destructive">{fieldErrors.state}</p>}</div>
              </div>
              <div className="space-y-2"><Label htmlFor="client-address-instructions">Instruções para coleta ou entrega</Label><Textarea id="client-address-instructions" value={draft.instructions} onChange={(event) => setField("instructions", event.target.value)} maxLength={500} placeholder="Ex.: acessar pela portaria lateral e falar com o almoxarifado" skipUppercase className="min-h-24 text-base md:text-sm" /><p className="text-xs text-muted-foreground">{draft.instructions.length}/500 — evite registrar dados pessoais desnecessários.</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" /> Localização no mapa</CardTitle><CardDescription>O endereço textual é autoritativo. O mapa ajuda o planejamento, mas não bloqueia o cadastro quando indisponível.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => void handleGeocode()} disabled={isGeocoding || !draft.street.trim() || !draft.city.trim() || !draft.state.trim()}>{isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}Localizar pelo endereço</Button>{distance !== null && <Badge variant="secondary">{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} da unidade</Badge>}</div>
              {hasDraftCoordinates && !approximateLocation && <p className="text-xs text-muted-foreground">Se esta posição foi salva a partir do CEP, use “Localizar pelo endereço” para conferir rua e número e salve o cadastro.</p>}
              {approximateLocation && <p className="text-sm text-amber-700" role="status">O mapa foi localizado pelo logradouro e número; confirme o ponto e arraste o marcador se necessário.</p>}
              {fieldErrors.coordinates && <p className="text-sm text-destructive" role="alert">{fieldErrors.coordinates}</p>}
              <AddressMap latitude={draft.latitude} longitude={draft.longitude} companyLatitude={companyLatitude} companyLongitude={companyLongitude} showCompanyMarker={hasCompanyCoordinates} onPositionChange={(latitude, longitude) => { setDraft((current) => current ? { ...current, latitude, longitude } : current); setApproximateLocation(false); setDirty(true); }} draggable height="320px" clientName={draft.name || "Cliente"} companyName="Unidade" distanceKm={distance} />
            </CardContent>
          </Card>
        </div>
      </div>

      {saveError && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div><p className="font-semibold">O endereço não foi salvo</p><p className="mt-1 text-sm text-muted-foreground">Os campos foram mantidos. Confira a conexão e tente novamente. {saveError}</p></div>
        </div>
      )}
      <div className="flex flex-col-reverse gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" className="min-h-11" onClick={onNext} disabled={isSaving}>{activeAddresses.length === 0 ? "Continuar sem endereço" : "Continuar sem alterar"}</Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {dirty && <Button type="button" variant="ghost" className="min-h-11" onClick={() => { clearScopedDraft(draftKey); setDirty(false); setFieldErrors({}); setSaveError(null); }} disabled={isSaving}>Descartar alterações</Button>}
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => void save(false)} disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Salvar endereço</Button>
          <Button type="button" className="min-h-11" onClick={() => void save(true)} disabled={isSaving}>Salvar e continuar</Button>
        </div>
      </div>

      <AlertDialog open={Boolean(addressToDelete)} onOpenChange={(open) => !open && setAddressToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este endereço definitivamente?</AlertDialogTitle><AlertDialogDescription>O registro será removido do cadastro e não poderá ser recuperado. Cópias de endereço já gravadas em ROLs e rotas anteriores permanecem nos respectivos históricos. Se este for o endereço padrão, outro endereço ativo será promovido automaticamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteAddress.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteAddress.isPending} onClick={() => { if (!addressToDelete) return; deleteAddress.mutate(addressToDelete.id, { onSuccess: () => { setAddressToDelete(null); setSelectedAddressId(null); setDraft(null); setDirty(false); } }); }}>{deleteAddress.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
