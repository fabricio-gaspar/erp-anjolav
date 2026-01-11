import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Check, Lightbulb, Loader2, Search } from "lucide-react";
import { useEnderecoCliente } from "@/hooks/useClientes";
import { toast } from "sonner";

interface ClienteEnderecoProps {
  clienteId: string | null;
  onNext: () => void;
  onSave: () => void;
}

export const ClienteEndereco = ({ clienteId, onNext, onSave }: ClienteEnderecoProps) => {
  const { endereco, isLoading, upsertEndereco } = useEnderecoCliente(clienteId);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const [formData, setFormData] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    pais: "Brasil",
  });

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
      });
    }
  }, [endereco]);

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
      });
    }
  }, [clienteId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCepSearch = async () => {
    const cepLimpo = formData.cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) {
      toast.error("CEP inválido. Digite 8 dígitos.");
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      }));
      toast.success("Endereço encontrado!");
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setIsSearchingCep(false);
    }
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
        latitude: null,
        longitude: null,
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

          {/* Dica */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-medium">Dica:</span> Arraste o marcador azul no mapa para ajustar a localização exata da entrada.
            </p>
          </div>
        </div>

        {/* Map Placeholder */}
        <Card className="h-[400px] overflow-hidden">
          <div className="w-full h-full bg-muted/30 flex items-center justify-center relative">
            {/* Placeholder map with styling similar to the reference */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100 via-green-50 to-amber-50">
              <div className="absolute inset-0" style={{
                backgroundImage: `
                  linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }} />
              {/* Map marker */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full">
                <div className="w-8 h-8 bg-destructive rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-destructive mx-auto -mt-1" />
              </div>
              {/* Zoom controls */}
              <div className="absolute top-4 left-4 flex flex-col gap-0 bg-white rounded shadow">
                <button className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-muted border-b">+</button>
                <button className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-muted">−</button>
              </div>
              {/* Attribution */}
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-white/80 px-2 py-1 rounded">
                Leaflet | © OpenStreetMap
              </div>
            </div>
          </div>
        </Card>
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
