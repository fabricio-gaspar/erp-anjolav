import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Lightbulb, Loader2, Search, MapPin, Building2, Navigation } from "lucide-react";
import { useEnderecoCliente } from "@/hooks/useClientes";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { toast } from "sonner";
import { 
  buscarCepComFallback, 
  geocodeEndereco, 
  montarEnderecoCompleto,
  calcularDistanciaKm,
  BrasilApiCnpjResponse 
} from "@/services/apiServices";
import { AddressMap } from "@/components/ui/AddressMap";

interface ClienteEnderecoProps {
  clienteId: string | null;
  onNext: () => void;
  onSave: () => void;
  cnpjData?: BrasilApiCnpjResponse | null;
}

export const ClienteEndereco = ({ clienteId, onNext, onSave, cnpjData }: ClienteEnderecoProps) => {
  const { endereco, isLoading, upsertEndereco } = useEnderecoCliente(clienteId);
  const { configuracao } = useConfiguracoesGerais();
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    pais: "Brasil",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Coordenadas da empresa
  const empresaLatitude = configuracao?.endereco_latitude ?? null;
  const empresaLongitude = configuracao?.endereco_longitude ?? null;
  const hasEmpresaCoordinates = empresaLatitude !== null && empresaLongitude !== null;

  // Calcular distância
  const distancia = formData.latitude && formData.longitude && hasEmpresaCoordinates
    ? calcularDistanciaKm(
        empresaLatitude!,
        empresaLongitude!,
        formData.latitude,
        formData.longitude
      )
    : null;

  // Carregar dados existentes
  useEffect(() => {
    if (endereco) {
      setFormData({
        cep: endereco.cep || "",
        logradouro: endereco.logradouro || "",
        numero: endereco.numero || "",
        complemento: endereco.complemento || "",
        bairro: endereco.bairro || "",
        cidade: endereco.cidade || "",
        uf: endereco.uf || "",
        pais: endereco.pais || "Brasil",
        latitude: endereco.latitude || null,
        longitude: endereco.longitude || null,
      });
    }
  }, [endereco]);

  // Preencher com dados do CNPJ quando disponível
  useEffect(() => {
    if (cnpjData && !endereco) {
      setFormData((prev) => ({
        ...prev,
        cep: cnpjData.cep || prev.cep,
        logradouro: cnpjData.logradouro || prev.logradouro,
        numero: cnpjData.numero || prev.numero,
        complemento: cnpjData.complemento || prev.complemento,
        bairro: cnpjData.bairro || prev.bairro,
        cidade: cnpjData.municipio || prev.cidade,
        uf: cnpjData.uf || prev.uf,
      }));
      
      // Auto-geocodificar endereço do CNPJ
      if (cnpjData.logradouro && cnpjData.municipio) {
        handleGeocode({
          logradouro: cnpjData.logradouro,
          numero: cnpjData.numero,
          bairro: cnpjData.bairro,
          cidade: cnpjData.municipio,
          uf: cnpjData.uf,
          cep: cnpjData.cep,
        });
      }
    }
  }, [cnpjData, endereco]);

  // Reset when clienteId changes to null
  useEffect(() => {
    if (!clienteId) {
      setFormData({
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
        pais: "Brasil",
        latitude: null,
        longitude: null,
      });
    }
  }, [clienteId]);

  // Auto-geocoding quando endereço está completo
  useEffect(() => {
    const { logradouro, cidade, uf, numero } = formData;
    
    // Só auto-geocodificar se tiver os campos principais e não tiver coordenadas
    if (logradouro && cidade && uf && numero && !formData.latitude) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => {
        handleGeocode();
      }, 1500);
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [formData.logradouro, formData.cidade, formData.uf, formData.numero]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Geocodificar endereço
  const handleGeocode = useCallback(async (addressData?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  }) => {
    const data = addressData || formData;
    const enderecoCompleto = montarEnderecoCompleto({
      logradouro: data.logradouro,
      numero: data.numero,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf,
      cep: data.cep,
    });

    if (!enderecoCompleto || enderecoCompleto === "Brasil") {
      return;
    }

    setIsGeocoding(true);
    try {
      const result = await geocodeEndereco(enderecoCompleto);
      if (result) {
        setFormData((prev) => ({
          ...prev,
          latitude: result.latitude,
          longitude: result.longitude,
        }));
        toast.success("Localização encontrada no mapa!");
      }
    } catch (error) {
      console.error("Erro ao geocodificar:", error);
    } finally {
      setIsGeocoding(false);
    }
  }, [formData]);

  const handleCepSearch = async () => {
    const cepLimpo = formData.cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      toast.error("CEP inválido. Digite 8 dígitos.");
      return;
    }

    setIsSearchingCep(true);
    try {
      const data = await buscarCepComFallback(cepLimpo);

      if (!data) {
        toast.error("CEP não encontrado.");
        return;
      }

      const newFormData = {
        ...formData,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      };

      setFormData(newFormData);
      toast.success("Endereço encontrado!");

      // Auto-geocodificar após buscar CEP
      await handleGeocode({
        logradouro: data.logradouro,
        numero: formData.numero,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
        cep: cepLimpo,
      });
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar CEP.");
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Atualizar coordenadas quando marcador é arrastado no mapa
  const handleMapPositionChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    toast.success("Localização atualizada no mapa");
  };

  const handleSave = async (goNext: boolean = false) => {
    if (!clienteId) {
      toast.error("Salve os dados básicos do cliente primeiro.");
      return;
    }

    upsertEndereco.mutate(
      {
        cliente_id: clienteId,
        cep: formData.cep || null,
        logradouro: formData.logradouro || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        uf: formData.uf || null,
        pais: formData.pais || "Brasil",
        latitude: formData.latitude,
        longitude: formData.longitude,
      },
      {
        onSuccess: () => {
          if (goNext) {
            onNext();
          } else {
            onSave();
          }
        },
      }
    );
  };

  const isSaving = upsertEndereco.isPending;
  const hasAddress = formData.logradouro && formData.cidade;

  if (isLoading && clienteId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando endereço...</span>
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
    <div className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Fields */}
        <div className="space-y-4">
          {/* CEP */}
          <div className="flex gap-2">
            <Input
              placeholder="CEP (digite para buscar)"
              value={formData.cep}
              onChange={(e) => handleChange("cep", e.target.value)}
              className="flex-1"
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCepSearch}
              disabled={isSearchingCep}
              title="Buscar CEP"
            >
              {isSearchingCep ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Logradouro */}
          <Input
            placeholder="LOGRADOURO"
            value={formData.logradouro}
            onChange={(e) => handleChange("logradouro", e.target.value)}
          />

          {/* Número + Complemento */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="NÚMERO"
              value={formData.numero}
              onChange={(e) => handleChange("numero", e.target.value)}
            />
            <Input
              placeholder="COMPLEMENTO"
              value={formData.complemento}
              onChange={(e) => handleChange("complemento", e.target.value)}
            />
          </div>

          {/* Bairro */}
          <Input
            placeholder="BAIRRO"
            value={formData.bairro}
            onChange={(e) => handleChange("bairro", e.target.value)}
          />

          {/* Cidade + UF */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Input
                placeholder="CIDADE"
                value={formData.cidade}
                onChange={(e) => handleChange("cidade", e.target.value)}
              />
            </div>
            <Input
              placeholder="UF"
              value={formData.uf}
              onChange={(e) => handleChange("uf", e.target.value)}
            />
          </div>

          {/* País */}
          <Input
            value={formData.pais}
            onChange={(e) => handleChange("pais", e.target.value)}
            disabled
            className="bg-muted/50"
          />

          {/* Botão Geocodificar */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => handleGeocode()}
            disabled={isGeocoding || !hasAddress}
          >
            {isGeocoding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MapPin className="w-4 h-4" />
            )}
            Localizar no Mapa
          </Button>

          {/* Coordenadas e Distância */}
          <div className="flex flex-wrap gap-2 items-center">
            {formData.latitude && formData.longitude && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Lat: {formData.latitude.toFixed(6)}</span>
                <span>Lng: {formData.longitude.toFixed(6)}</span>
              </div>
            )}
            
            {/* Badge de Distância */}
            {distancia !== null && (
              <Badge variant="secondary" className="gap-1.5 ml-auto">
                <Navigation className="w-3 h-3" />
                {distancia < 1 
                  ? `${(distancia * 1000).toFixed(0)} m da empresa`
                  : `${distancia.toFixed(1)} km da empresa`
                }
              </Badge>
            )}
          </div>

          {/* Dica */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-medium">Dica:</span> Arraste o marcador no mapa para ajustar a localização exata. 
              {hasEmpresaCoordinates && (
                <> O marcador <span className="text-blue-600 font-medium">azul</span> indica a empresa e o <span className="text-red-600 font-medium">vermelho</span> o cliente.</>
              )}
            </p>
          </div>

          {/* Legenda dos marcadores */}
          {hasEmpresaCoordinates && formData.latitude && formData.longitude && (
            <div className="flex gap-4 text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Empresa</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Cliente</span>
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <AddressMap
          latitude={formData.latitude}
          longitude={formData.longitude}
          companyLatitude={empresaLatitude}
          companyLongitude={empresaLongitude}
          showCompanyMarker={hasEmpresaCoordinates}
          onPositionChange={handleMapPositionChange}
          draggable={true}
          height="400px"
        />
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-between pt-6">
        <Button 
          variant="outline" 
          onClick={() => handleSave(true)}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Próximo: Pagamento
        </Button>
        <Button 
          onClick={() => handleSave(false)} 
          className="gap-2"
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salvar Endereço
        </Button>
      </div>
    </div>
  );
};
