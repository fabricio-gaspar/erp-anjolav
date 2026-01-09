import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  MapPin,
  Eye,
  Upload,
  X
} from "lucide-react";
import { useROLConfig, useUpdateROLConfig, useUploadLogo } from "@/hooks/useROLConfig";
import { ROLPreview, printROL } from "./ROLPreview";
import { useToast } from "@/hooks/use-toast";

interface LocalROLConfig {
  nomeCurto: string;
  slogan: string;
  nomeCompleto: string;
  corPrimaria: string;
  corSecundaria: string;
  telefone: string;
  email: string;
  cnpj: string;
  endereco: string;
  exibirLogo: boolean;
  logoUrl: string;
  larguraPapel: string;
  tipoImpressora: string;
  margemSuperior: number;
  margemLateral: number;
  fontePrincipal: string;
  tamanhoNome: number;
  tamanhoItem: number;
  tamanhoTotal: number;
  previsaoEntrega: boolean;
  bloco: boolean;
  observacoes: boolean;
  assinaturaCliente: boolean;
  tipoPreco: boolean;
  linhaDesconto: boolean;
  textoRodape: string;
}

const defaultConfig: LocalROLConfig = {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: dbConfig, isLoading } = useROLConfig();
  const updateConfig = useUpdateROLConfig();
  const uploadLogo = useUploadLogo();
  
  const [config, setConfig] = useState<LocalROLConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Sync from DB
  useEffect(() => {
    if (dbConfig) {
      setConfig({
        nomeCurto: dbConfig.nome_curto || defaultConfig.nomeCurto,
        slogan: dbConfig.slogan || defaultConfig.slogan,
        nomeCompleto: dbConfig.nome_completo || defaultConfig.nomeCompleto,
        corPrimaria: dbConfig.cor_primaria || defaultConfig.corPrimaria,
        corSecundaria: dbConfig.cor_secundaria || defaultConfig.corSecundaria,
        telefone: dbConfig.telefone || defaultConfig.telefone,
        email: dbConfig.email || defaultConfig.email,
        cnpj: dbConfig.cnpj || defaultConfig.cnpj,
        endereco: dbConfig.endereco || defaultConfig.endereco,
        exibirLogo: dbConfig.exibir_logo ?? defaultConfig.exibirLogo,
        logoUrl: dbConfig.logo_url || defaultConfig.logoUrl,
        larguraPapel: dbConfig.largura_papel || defaultConfig.larguraPapel,
        tipoImpressora: dbConfig.tipo_impressora || defaultConfig.tipoImpressora,
        margemSuperior: dbConfig.margem_superior ?? defaultConfig.margemSuperior,
        margemLateral: dbConfig.margem_lateral ?? defaultConfig.margemLateral,
        fontePrincipal: dbConfig.fonte_principal || defaultConfig.fontePrincipal,
        tamanhoNome: dbConfig.tamanho_nome ?? defaultConfig.tamanhoNome,
        tamanhoItem: dbConfig.tamanho_item ?? defaultConfig.tamanhoItem,
        tamanhoTotal: dbConfig.tamanho_total ?? defaultConfig.tamanhoTotal,
        previsaoEntrega: dbConfig.previsao_entrega ?? defaultConfig.previsaoEntrega,
        bloco: dbConfig.bloco ?? defaultConfig.bloco,
        observacoes: dbConfig.observacoes ?? defaultConfig.observacoes,
        assinaturaCliente: dbConfig.assinatura_cliente ?? defaultConfig.assinaturaCliente,
        tipoPreco: dbConfig.tipo_preco ?? defaultConfig.tipoPreco,
        linhaDesconto: dbConfig.linha_desconto ?? defaultConfig.linhaDesconto,
        textoRodape: dbConfig.texto_rodape || defaultConfig.textoRodape,
      });
    }
  }, [dbConfig]);

  const updateLocalConfig = <K extends keyof LocalROLConfig>(key: K, value: LocalROLConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!dbConfig) return;
    
    await updateConfig.mutateAsync({
      id: dbConfig.id,
      updates: {
        nome_curto: config.nomeCurto,
        slogan: config.slogan,
        nome_completo: config.nomeCompleto,
        cor_primaria: config.corPrimaria,
        cor_secundaria: config.corSecundaria,
        telefone: config.telefone,
        email: config.email,
        cnpj: config.cnpj,
        endereco: config.endereco,
        exibir_logo: config.exibirLogo,
        logo_url: config.logoUrl,
        largura_papel: config.larguraPapel,
        tipo_impressora: config.tipoImpressora,
        margem_superior: config.margemSuperior,
        margem_lateral: config.margemLateral,
        fonte_principal: config.fontePrincipal,
        tamanho_nome: config.tamanhoNome,
        tamanho_item: config.tamanhoItem,
        tamanho_total: config.tamanhoTotal,
        previsao_entrega: config.previsaoEntrega,
        bloco: config.bloco,
        observacoes: config.observacoes,
        assinatura_cliente: config.assinaturaCliente,
        tipo_preco: config.tipoPreco,
        linha_desconto: config.linhaDesconto,
        texto_rodape: config.textoRodape,
      }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadLogo.mutateAsync(file);
    updateLocalConfig("logoUrl", url);
  };

  const handleRemoveLogo = () => {
    updateLocalConfig("logoUrl", "");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium">Nome Curto (Menu/Login)</Label>
                <Input 
                  value={config.nomeCurto}
                  onChange={(e) => updateLocalConfig("nomeCurto", e.target.value)}
                  placeholder="AnjoLav"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Slogan</Label>
                <Input 
                  value={config.slogan}
                  onChange={(e) => updateLocalConfig("slogan", e.target.value)}
                  placeholder="Sistema de Gestão de Lavanderia"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Nome Completo (ROL/Notas)</Label>
              <Input 
                value={config.nomeCompleto}
                onChange={(e) => updateLocalConfig("nomeCompleto", e.target.value)}
                placeholder="ANJOLAV SERVIÇOS DE LAVANDERIA"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cor Primária</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-md border flex-shrink-0 cursor-pointer relative overflow-hidden"
                    style={{ backgroundColor: config.corPrimaria }}
                  >
                    <input
                      type="color"
                      value={config.corPrimaria}
                      onChange={(e) => updateLocalConfig("corPrimaria", e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <Input 
                    value={config.corPrimaria}
                    onChange={(e) => updateLocalConfig("corPrimaria", e.target.value)}
                    placeholder="#3c62f6"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cor Secundária</Label>
                <div className="flex gap-2">
                  <div 
                    className="w-10 h-10 rounded-md border flex-shrink-0 cursor-pointer relative overflow-hidden"
                    style={{ backgroundColor: config.corSecundaria }}
                  >
                    <input
                      type="color"
                      value={config.corSecundaria}
                      onChange={(e) => updateLocalConfig("corSecundaria", e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <Input 
                    value={config.corSecundaria}
                    onChange={(e) => updateLocalConfig("corSecundaria", e.target.value)}
                    placeholder="#2583eb"
                  />
                </div>
              </div>
            </div>

            <Button 
              className="w-full text-white"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Telefone
                </Label>
                <Input 
                  value={config.telefone}
                  onChange={(e) => updateLocalConfig("telefone", e.target.value)}
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
                  onChange={(e) => updateLocalConfig("email", e.target.value)}
                  placeholder="anjolav@anjolav.com.br"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ</Label>
              <Input 
                value={config.cnpj}
                onChange={(e) => updateLocalConfig("cnpj", e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Endereço
              </Label>
              <Textarea 
                value={config.endereco}
                onChange={(e) => updateLocalConfig("endereco", e.target.value)}
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
            <div className="flex items-center justify-between">
              <Label className="text-sm">Exibir logo no ROL</Label>
              <Switch 
                checked={config.exibirLogo}
                onCheckedChange={(checked) => updateLocalConfig("exibirLogo", checked)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Upload da Logo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              
              {config.logoUrl ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <img 
                    src={config.logoUrl} 
                    alt="Logo" 
                    className="h-12 w-auto object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">Logo carregada</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleRemoveLogo}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLogo.isPending}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadLogo.isPending ? "Enviando..." : "Escolher arquivo"}
                </Button>
              )}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Largura do Papel</Label>
                <Select 
                  value={config.larguraPapel}
                  onValueChange={(value) => updateLocalConfig("larguraPapel", value)}
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
                  onValueChange={(value) => updateLocalConfig("tipoImpressora", value)}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium">% Margem Superior (px)</Label>
                <Input 
                  type="number"
                  value={config.margemSuperior}
                  onChange={(e) => updateLocalConfig("margemSuperior", Number(e.target.value))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-600 font-medium">% Margem Lateral (px)</Label>
                <Input 
                  type="number"
                  value={config.margemLateral}
                  onChange={(e) => updateLocalConfig("margemLateral", Number(e.target.value))}
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
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fonte Principal</Label>
            <Select 
              value={config.fontePrincipal}
              onValueChange={(value) => updateLocalConfig("fontePrincipal", value)}
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Nome (px)</Label>
              <Input 
                type="number"
                value={config.tamanhoNome}
                onChange={(e) => updateLocalConfig("tamanhoNome", Number(e.target.value))}
                placeholder="14"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Item (px)</Label>
              <Input 
                type="number"
                value={config.tamanhoItem}
                onChange={(e) => updateLocalConfig("tamanhoItem", Number(e.target.value))}
                placeholder="11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-amber-600 font-medium">Total (px)</Label>
              <Input 
                type="number"
                value={config.tamanhoTotal}
                onChange={(e) => updateLocalConfig("tamanhoTotal", Number(e.target.value))}
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
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-amber-600">Previsão de Entrega</Label>
              <Switch 
                checked={config.previsaoEntrega}
                onCheckedChange={(checked) => updateLocalConfig("previsaoEntrega", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Bloco</Label>
              <Switch 
                checked={config.bloco}
                onCheckedChange={(checked) => updateLocalConfig("bloco", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-blue-600">Observações</Label>
              <Switch 
                checked={config.observacoes}
                onCheckedChange={(checked) => updateLocalConfig("observacoes", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm text-amber-600">Assinatura do Cliente</Label>
              <Switch 
                checked={config.assinaturaCliente}
                onCheckedChange={(checked) => updateLocalConfig("assinaturaCliente", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Tipo de Preço</Label>
              <Switch 
                checked={config.tipoPreco}
                onCheckedChange={(checked) => updateLocalConfig("tipoPreco", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-blue-600">Linha de Desconto</Label>
              <Switch 
                checked={config.linhaDesconto}
                onCheckedChange={(checked) => updateLocalConfig("linhaDesconto", checked)}
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label className="text-xs text-amber-600 font-medium">Texto do Rodapé (opcional)</Label>
            <Input 
              value={config.textoRodape}
              onChange={(e) => updateLocalConfig("textoRodape", e.target.value)}
              placeholder="Ex: Obrigado pela preferência!"
            />
          </div>
        </div>
      </Card>

      {/* Footer Actions */}
      <div className="flex justify-between">
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Visualizar ROL
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Preview do ROL</DialogTitle>
            </DialogHeader>
            <div className="py-4 bg-gray-100 rounded-lg flex justify-center">
              <ROLPreview config={config} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline"
                onClick={() => setPreviewOpen(false)}
              >
                Fechar
              </Button>
              <Button 
                onClick={() => printROL(config)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateConfig.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateConfig.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
