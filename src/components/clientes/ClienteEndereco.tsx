import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Check, Lightbulb } from "lucide-react";

interface ClienteEnderecoProps {
  onNext: () => void;
  onSave: () => void;
}

export const ClienteEndereco = ({ onNext, onSave }: ClienteEnderecoProps) => {
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Fields */}
        <div className="space-y-4">
          {/* CEP */}
          <Input
            placeholder="CEP (digite para buscar)"
            value={formData.cep}
            onChange={(e) => handleChange("cep", e.target.value)}
          />

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
        <Button variant="outline" onClick={onNext}>
          Próximo: Pagamento
        </Button>
        <Button onClick={onSave} className="gap-2">
          <Check className="w-4 h-4" />
          Salvar Cliente
        </Button>
      </div>
    </div>
  );
};
