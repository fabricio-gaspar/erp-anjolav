import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Printer, 
  Tag, 
  Save,
  RotateCcw,
  Settings2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PrinterSpec {
  id: string;
  modelo: string;
  nome: string;
  resolucao: string;
  larguraMaxima: string;
  tecnologia: string;
  interface: string;
  idealPara: string;
}

const IMPRESSORAS: PrinterSpec[] = [
  {
    id: "elgin-l42-pro",
    modelo: "Elgin L42 Pro (Código de Barras)",
    nome: "Elgin L42 Pro - Impressora de Etiquetas",
    resolucao: "203 DPI (8 dots/mm)",
    larguraMaxima: "104mm",
    tecnologia: "Térmica Direta",
    interface: "USB",
    idealPara: "Etiquetas de código de barras, localização, expedição"
  },
  {
    id: "zebra-gc420t",
    modelo: "Zebra GC420t",
    nome: "Zebra GC420t - Impressora de Etiquetas",
    resolucao: "203 DPI (8 dots/mm)",
    larguraMaxima: "104mm",
    tecnologia: "Térmica Direta / Transferência Térmica",
    interface: "USB / Serial / Paralela",
    idealPara: "Etiquetas de produtos, código de barras, identificação"
  },
  {
    id: "argox-os214",
    modelo: "Argox OS-214 Plus",
    nome: "Argox OS-214 Plus - Impressora de Etiquetas",
    resolucao: "203 DPI (8 dots/mm)",
    larguraMaxima: "104mm",
    tecnologia: "Térmica Direta / Transferência Térmica",
    interface: "USB / Serial",
    idealPara: "Etiquetas de expedição, inventário, produtos"
  },
  {
    id: "brother-ql820",
    modelo: "Brother QL-820NWB",
    nome: "Brother QL-820NWB - Impressora de Etiquetas",
    resolucao: "300 DPI (12 dots/mm)",
    larguraMaxima: "62mm",
    tecnologia: "Térmica Direta",
    interface: "USB / WiFi / Bluetooth",
    idealPara: "Etiquetas de endereçamento, identificação, organização"
  },
];

const TIPOS_IMPRESSORA = [
  { value: "termica-etiquetas", label: "Térmica - Etiquetas (Código de Barras)" },
  { value: "termica-bobina", label: "Térmica - Bobina (Cupom)" },
  { value: "jato-tinta", label: "Jato de Tinta" },
  { value: "laser", label: "Laser" },
];

const TAMANHOS_ETIQUETA = [
  { value: "10x15", label: "10cm × 15cm (Etiqueta padrão)" },
  { value: "10x10", label: "10cm × 10cm" },
  { value: "5x2.5", label: "5cm × 2.5cm (Código de barras)" },
  { value: "10x5", label: "10cm × 5cm (Endereço)" },
  { value: "3x2", label: "3cm × 2cm (Preço)" },
];

interface EtiquetaConfig {
  modeloImpressora: string;
  tipoImpressora: string;
  tamanhoEtiqueta: string;
  margemSuperior: number;
  margemLateral: number;
  tamanhoFonte: number;
  alturaCodigoBarras: number;
}

const defaultConfig: EtiquetaConfig = {
  modeloImpressora: "elgin-l42-pro",
  tipoImpressora: "termica-etiquetas",
  tamanhoEtiqueta: "10x15",
  margemSuperior: 5,
  margemLateral: 5,
  tamanhoFonte: 12,
  alturaCodigoBarras: 50,
};

export function ConfiguracoesEtiquetas() {
  const { toast } = useToast();
  const [config, setConfig] = useState<EtiquetaConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const updateConfig = <K extends keyof EtiquetaConfig>(key: K, value: EtiquetaConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Implement save to database
    toast({
      title: "Sucesso",
      description: "Configurações de etiquetas salvas com sucesso!",
    });
    setHasChanges(false);
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setHasChanges(true);
    toast({
      title: "Padrão restaurado",
      description: "As configurações foram restauradas para o padrão.",
    });
  };

  const selectedPrinter = IMPRESSORAS.find(p => p.id === config.modeloImpressora);

  return (
    <div className="space-y-6">
      {/* Row 1: Impressora + Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Impressora de Etiquetas */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Printer className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-foreground">Impressora de Etiquetas</h3>
          </div>

          <div className="space-y-4">
            {/* Modelo da Impressora */}
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Modelo da Impressora</Label>
              <Select 
                value={config.modeloImpressora}
                onValueChange={(value) => updateConfig("modeloImpressora", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPRESSORAS.map((impressora) => (
                    <SelectItem key={impressora.id} value={impressora.id}>
                      {impressora.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecione o modelo exato da sua impressora para otimização
              </p>
            </div>

            {/* Tipo de Impressora */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de Impressora</Label>
              <Select 
                value={config.tipoImpressora}
                onValueChange={(value) => updateConfig("tipoImpressora", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_IMPRESSORA.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tamanho da Etiqueta */}
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Tamanho da Etiqueta</Label>
              <Select 
                value={config.tamanhoEtiqueta}
                onValueChange={(value) => updateConfig("tamanhoEtiqueta", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAMANHOS_ETIQUETA.map((tamanho) => (
                    <SelectItem key={tamanho.value} value={tamanho.value}>
                      {tamanho.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Layout e Margens */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-sm text-foreground">Layout e Margens</h3>
          </div>

          <div className="space-y-4">
            {/* Margens */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Margem <span className="text-amber-600 font-medium">Superior</span> <span className="text-violet-600">(mm)</span>
                </Label>
                <Input 
                  type="number"
                  value={config.margemSuperior}
                  onChange={(e) => updateConfig("margemSuperior", Number(e.target.value))}
                  placeholder="5"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Margem <span className="text-amber-600 font-medium">Lateral</span> <span className="text-violet-600">(mm)</span>
                </Label>
                <Input 
                  type="number"
                  value={config.margemLateral}
                  onChange={(e) => updateConfig("margemLateral", Number(e.target.value))}
                  placeholder="5"
                />
              </div>
            </div>

            {/* Tamanho da Fonte */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Tamanho da <span className="text-amber-600 font-medium">Fonte</span> <span className="text-violet-600">(px)</span>
              </Label>
              <Input 
                type="number"
                value={config.tamanhoFonte}
                onChange={(e) => updateConfig("tamanhoFonte", Number(e.target.value))}
                placeholder="12"
              />
            </div>

            {/* Altura do Código de Barras */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Altura do <span className="text-amber-600 font-medium">Código de Barras</span> <span className="text-violet-600">(px)</span>
              </Label>
              <Input 
                type="number"
                value={config.alturaCodigoBarras}
                onChange={(e) => updateConfig("alturaCodigoBarras", Number(e.target.value))}
                placeholder="50"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Especificações da Impressora */}
      {selectedPrinter && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-amber-600">Especificações da Impressora Selecionada</h3>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">
              {selectedPrinter.nome}
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><span className="text-amber-600">Resolução:</span> {selectedPrinter.resolucao}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><span className="text-amber-600">Largura máxima:</span> {selectedPrinter.larguraMaxima}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><span className="text-amber-600">Tecnologia:</span> {selectedPrinter.tecnologia}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><span className="text-amber-600">Interface:</span> {selectedPrinter.interface}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><span className="text-amber-600">Ideal para:</span> {selectedPrinter.idealPara}</span>
              </li>
            </ul>
          </div>
        </Card>
      )}

      {/* Footer Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Restaurar Padrão
        </Button>
        <Button 
          onClick={handleSave}
          disabled={!hasChanges}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Save className="w-4 h-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
