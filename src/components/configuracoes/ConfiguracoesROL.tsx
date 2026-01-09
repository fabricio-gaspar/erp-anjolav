import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Palette, 
  Phone, 
  Image as ImageIcon, 
  Printer, 
  Type, 
  FileText,
  Save,
  RotateCcw,
  Mail,
  MapPin
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ROLConfig {
  // Identidade Visual
  nomeCurto: string;
  slogan: string;
  nomeCompleto: string;
  corPrimaria: string;
  corSecundaria: string;
  
  // Dados de Contato
  telefone: string;
  email: string;
  cnpj: string;
  endereco: string;
  
  // Logomarca
  exibirLogo: boolean;
  logoUrl: string;
  
  // Impressão
  larguraPapel: string;
  tipoImpressora: string;
  margemSuperior: number;
  margemLateral: number;
  
  // Tipografia
  fontePrincipal: string;
  tamanhoNome: number;
  tamanhoItem: number;
  tamanhoTotal: number;
  
  // Elementos do ROL
  previsaoEntrega: boolean;
  bloco: boolean;
  observacoes: boolean;
  assinaturaCliente: boolean;
  tipoPreco: boolean;
  linhaDesconto: boolean;
  textoRodape: string;
}

const defaultConfig: ROLConfig = {
  nomeCurto: "AnjoLav",
  slogan: "Sistema de Gestão de Lavanderia",
  nomeCompleto: "ANJOLAV SERVIÇOS DE LAVANDERIA",
  corPrimaria: "#3c62f6",
  corSecundaria: "#2583eb",
  telefone: "(11) 99520 3236",
  email: "anjolav@anjolav.com.br",
  cnpj: "00.000.000/0000-00",
  endereco: "",
  exibirLogo: true,
  logoUrl: "",
  larguraPapel: "80mm",
  tipoImpressora: "termica",
  margemSuperior: 10,
  margemLateral: 8,
  fontePrincipal: "courier",
  tamanhoNome: 14,
  tamanhoItem: 11,
  tamanhoTotal: 14,
  previsaoEntrega: true,
  bloco: false,
  observacoes: true,
  assinaturaCliente: true,
  tipoPreco: true,
  linhaDesconto: true,
  textoRodape: "",
};

export function ConfiguracoesROL() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ROLConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const updateConfig = <K extends keyof ROLConfig>(key: K, value: ROLConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Implement save to database
    toast({
      title: "Sucesso",
      description: "Configurações de ROL salvas com sucesso!",
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

  return (
    <div className="space-y-6">
      {/* Row 1: Identidade Visual + Dados de Contato */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Identidade Visual (White Label) */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-foreground">Identidade Visual (White Label)</h3>
          </div>

          <div className="space-y-4">
            {/* Nome Curto + Slogan */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium">Nome Curto (Menu/Login)</Label>
                <Input 
                  value={config.nomeCurto}
                  onChange={(e) => updateConfig("nomeCurto", e.target.value)}
                  placeholder="AnjoLav"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Slogan</Label>
                <Input 
                  value={config.slogan}
                  onChange={(e) => updateConfig("slogan", e.target.value)}
                  placeholder="Sistema de Gestão de Lavanderia"
                />
              </div>
            </div>

            {/* Nome Completo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Nome Completo (ROL/Notas)</Label>
              <Input 
                value={config.nomeCompleto}
                onChange={(e) => updateConfig("nomeCompleto", e.target.value)}
                placeholder="ANJOLAV SERVIÇOS DE LAVANDERIA"
              />
            </div>

            {/* Cores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cor Primária</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-md border flex-shrink-0 cursor-pointer"
                    style={{ backgroundColor: config.corPrimaria }}
                  >
                    <input
                      type="color"
                      value={config.corPrimaria}
                      onChange={(e) => updateConfig("corPrimaria", e.target.value)}
                      className="w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <Input 
                    value={config.corPrimaria}
                    onChange={(e) => updateConfig("corPrimaria", e.target.value)}
                    placeholder="#3c62f6"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cor Secundária</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-md border flex-shrink-0 cursor-pointer"
                    style={{ backgroundColor: config.corSecundaria }}
                  >
                    <input
                      type="color"
                      value={config.corSecundaria}
                      onChange={(e) => updateConfig("corSecundaria", e.target.value)}
                      className="w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <Input 
                    value={config.corSecundaria}
                    onChange={(e) => updateConfig("corSecundaria", e.target.value)}
                    placeholder="#2583eb"
                  />
                </div>
              </div>
            </div>

            {/* Preview Button */}
            <Button 
              className="w-full"
              style={{ 
                background: `linear-gradient(135deg, ${config.corPrimaria} 0%, ${config.corSecundaria} 100%)` 
              }}
            >
              Preview das cores do sistema
            </Button>
          </div>
        </Card>

        {/* Dados de Contato */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-foreground">Dados de Contato</h3>
          </div>

          <div className="space-y-4">
            {/* Telefone + E-mail */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Telefone
                </Label>
                <Input 
                  value={config.telefone}
                  onChange={(e) => updateConfig("telefone", e.target.value)}
                  placeholder="(11) 99520 3236"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  E-mail
                </Label>
                <Input 
                  value={config.email}
                  onChange={(e) => updateConfig("email", e.target.value)}
                  placeholder="anjolav@anjolav.com.br"
                />
              </div>
            </div>

            {/* CNPJ */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ</Label>
              <Input 
                value={config.cnpj}
                onChange={(e) => updateConfig("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            {/* Endereço */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Endereço
              </Label>
              <Textarea 
                value={config.endereco}
                onChange={(e) => updateConfig("endereco", e.target.value)}
                placeholder="Endereço completo da empresa"
                rows={3}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Logomarca + Impressão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logomarca */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-sm text-foreground">Logomarca</h3>
          </div>

          <div className="space-y-4">
            {/* Switch Exibir Logo */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">Exibir logo no ROL</Label>
              <Switch 
                checked={config.exibirLogo}
                onCheckedChange={(checked) => updateConfig("exibirLogo", checked)}
              />
            </div>

            {/* Upload Logo */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Upload da Logo</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs">
                  Escolher arquivo
                </Button>
                <span className="text-xs text-muted-foreground">
                  Nenhum arquivo escolhido
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Impressão */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Printer className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-foreground">Impressão</h3>
          </div>

          <div className="space-y-4">
            {/* Largura + Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Largura do Papel</Label>
                <Select 
                  value={config.larguraPapel}
                  onValueChange={(value) => updateConfig("larguraPapel", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58mm (Compacto)</SelectItem>
                    <SelectItem value="80mm">80mm (Cupom padrão)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="termica">Térmica (Bobina)</SelectItem>
                    <SelectItem value="matricial">Matricial</SelectItem>
                    <SelectItem value="jato">Jato de Tinta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Margens */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium">% Margem Superior (px)</Label>
                <Input 
                  type="number"
                  value={config.margemSuperior}
                  onChange={(e) => updateConfig("margemSuperior", Number(e.target.value))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium">% Margem Lateral (px)</Label>
                <Input 
                  type="number"
                  value={config.margemLateral}
                  onChange={(e) => updateConfig("margemLateral", Number(e.target.value))}
                  placeholder="8"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 3: Tipografia */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-4 h-4 text-violet-600" />
          <h3 className="font-semibold text-sm text-foreground">Tipografia</h3>
        </div>

        <div className="space-y-4">
          {/* Fonte Principal */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte Principal</Label>
            <Select 
              value={config.fontePrincipal}
              onValueChange={(value) => updateConfig("fontePrincipal", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="courier">Courier New (Monoespaçada)</SelectItem>
                <SelectItem value="arial">Arial</SelectItem>
                <SelectItem value="times">Times New Roman</SelectItem>
                <SelectItem value="consolas">Consolas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tamanhos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Nome (px)</Label>
              <Input 
                type="number"
                value={config.tamanhoNome}
                onChange={(e) => updateConfig("tamanhoNome", Number(e.target.value))}
                placeholder="14"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Item (px)</Label>
              <Input 
                type="number"
                value={config.tamanhoItem}
                onChange={(e) => updateConfig("tamanhoItem", Number(e.target.value))}
                placeholder="11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Total (px)</Label>
              <Input 
                type="number"
                value={config.tamanhoTotal}
                onChange={(e) => updateConfig("tamanhoTotal", Number(e.target.value))}
                placeholder="14"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Row 4: Elementos do ROL */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-foreground">Elementos do ROL</h3>
        </div>

        <div className="space-y-4">
          {/* Switches Grid */}
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-amber-600">Previsão de Entrega</Label>
              <Switch 
                checked={config.previsaoEntrega}
                onCheckedChange={(checked) => updateConfig("previsaoEntrega", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Bloco</Label>
              <Switch 
                checked={config.bloco}
                onCheckedChange={(checked) => updateConfig("bloco", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-blue-600">Observações</Label>
              <Switch 
                checked={config.observacoes}
                onCheckedChange={(checked) => updateConfig("observacoes", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm text-amber-600">Assinatura do Cliente</Label>
              <Switch 
                checked={config.assinaturaCliente}
                onCheckedChange={(checked) => updateConfig("assinaturaCliente", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Tipo de Preço</Label>
              <Switch 
                checked={config.tipoPreco}
                onCheckedChange={(checked) => updateConfig("tipoPreco", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-blue-600">Linha de Desconto</Label>
              <Switch 
                checked={config.linhaDesconto}
                onCheckedChange={(checked) => updateConfig("linhaDesconto", checked)}
              />
            </div>
          </div>

          {/* Texto do Rodapé */}
          <div className="space-y-1.5 pt-2">
            <Label className="text-xs text-amber-600 font-medium">Texto do Rodapé (opcional)</Label>
            <Input 
              value={config.textoRodape}
              onChange={(e) => updateConfig("textoRodape", e.target.value)}
              placeholder="Ex: Obrigado pela preferência!"
            />
          </div>
        </div>
      </Card>

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
