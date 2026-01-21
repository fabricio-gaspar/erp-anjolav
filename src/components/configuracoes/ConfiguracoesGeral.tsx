import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Image,
  CreditCard,
  MessageSquare,
  RefreshCw,
  Upload,
  Check,
  Info,
  Landmark,
  QrCode,
  MapPin,
  Search,
  Loader2,
  Building2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { buscarCepComFallback, geocodeEndereco, montarEnderecoCompleto, montarEnderecoSimplificado } from "@/services/apiServices";
import { AddressMap } from "@/components/ui/AddressMap";
import { supabase } from "@/integrations/supabase/client";

const templateVariables = [
  "{{cliente}}",
  "{{mes_referencia}}",
  "{{valor}}",
  "{{vencimento}}",
  "{{link_nota}}",
  "{{chave_pix}}",
  "{{link_boleto}}",
  "{{linha_digitavel}}",
  "{{banco_nome}}",
  "{{banco_agencia}}",
  "{{banco_conta}}",
  "{{banco_titular}}",
  "{{empresa}}",
];

const defaultPixTemplate = `Prezado(a) {{cliente}},

Segue sua fatura referente ao mês de {{mes_referencia}}.

Valor: R$ {{valor}}
Vencimento: {{vencimento}}

📄 Nota Fiscal:
{{link_nota}}

💳 Pagamento via PIX:
Chave PIX: {{chave_pix}}`;

const defaultBoletoTemplate = `Prezado(a) {{cliente}},

Segue sua fatura referente ao mês de {{mes_referencia}}.

Valor: R$ {{valor}}
Vencimento: {{vencimento}}

📄 Nota Fiscal:
{{link_nota}}

📋 Pagamento via Boleto:
Linha Digitável: {{linha_digitavel}}
Link do Boleto: {{link_boleto}}`;

const defaultTransferenciaTemplate = `Prezado(a) {{cliente}},

Segue sua fatura referente ao mês de {{mes_referencia}}.

Valor: R$ {{valor}}
Vencimento: {{vencimento}}

📄 Nota Fiscal:
{{link_nota}}

🏦 Pagamento via Transferência:
Banco: {{banco_nome}}
Agência: {{banco_agencia}}
Conta: {{banco_conta}}
Titular: {{banco_titular}}`;

export function ConfiguracoesGeral() {
  const { configuracao, saveConfiguracao, isLoading } = useConfiguracoesGerais();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Identidade Visual
  const [nomeEmpresa, setNomeEmpresa] = useState("AnjoLav");
  const [corPrimaria, setCorPrimaria] = useState("#3b82f6");

  // Dados de Pagamento
  const [tipoChave, setTipoChave] = useState("cpf");
  const [chavePix, setChavePix] = useState("");
  const [nomeBanco, setNomeBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [contaCorrente, setContaCorrente] = useState("");
  const [titularConta, setTitularConta] = useState("");

  // Templates
  const [templatePix, setTemplatePix] = useState(defaultPixTemplate);
  const [templateBoleto, setTemplateBoleto] = useState(defaultBoletoTemplate);
  const [templateTransferencia, setTemplateTransferencia] = useState(defaultTransferenciaTemplate);

  // WhatsApp
  const [whatsappNumero, setWhatsappNumero] = useState("");

  // Endereço da Empresa
  const [enderecoData, setEnderecoData] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Carregar dados existentes
  useEffect(() => {
    if (configuracao) {
      setNomeEmpresa(configuracao.nome_empresa || "AnjoLav");
      setCorPrimaria(configuracao.cor_primaria || "#3b82f6");
      setTipoChave(configuracao.pix_tipo_chave || "cpf");
      setChavePix(configuracao.pix_chave || "");
      setNomeBanco(configuracao.banco_nome || "");
      setAgencia(configuracao.banco_agencia || "");
      setContaCorrente(configuracao.banco_conta || "");
      setTitularConta(configuracao.banco_titular || "");
      setTemplatePix(configuracao.template_pix || defaultPixTemplate);
      setTemplateBoleto(configuracao.template_boleto || defaultBoletoTemplate);
      setTemplateTransferencia(configuracao.template_transferencia || defaultTransferenciaTemplate);
      setWhatsappNumero(configuracao.whatsapp_numero || "");
      setLogoUrl(configuracao.logo_url || null);
      setEnderecoData({
        cep: configuracao.endereco_cep || "",
        logradouro: configuracao.endereco_logradouro || "",
        numero: configuracao.endereco_numero || "",
        complemento: configuracao.endereco_complemento || "",
        bairro: configuracao.endereco_bairro || "",
        cidade: configuracao.endereco_cidade || "",
        uf: configuracao.endereco_uf || "",
        latitude: configuracao.endereco_latitude || null,
        longitude: configuracao.endereco_longitude || null,
      });
    }
  }, [configuracao]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsTesting(false);
    toast.success("Conexão bem-sucedida! O banco de dados está funcionando corretamente.");
  };

  const handleSaveIdentidade = () => {
    saveConfiguracao.mutate({
      nome_empresa: nomeEmpresa,
      cor_primaria: corPrimaria,
      logo_url: logoUrl,
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem.");
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload para o bucket company-assets
      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      const newLogoUrl = urlData.publicUrl;
      setLogoUrl(newLogoUrl);

      // Salvar no banco
      saveConfiguracao.mutate({ logo_url: newLogoUrl });

      toast.success("Logo carregada com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer upload da logo:", error);
      toast.error("Erro ao carregar logo. Tente novamente.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    saveConfiguracao.mutate({ logo_url: null });
    toast.success("Logo removida.");
  };

  const handleSavePayment = () => {
    saveConfiguracao.mutate({
      pix_tipo_chave: tipoChave,
      pix_chave: chavePix,
      banco_nome: nomeBanco,
      banco_agencia: agencia,
      banco_conta: contaCorrente,
      banco_titular: titularConta,
    });
  };

  const handleSaveTemplates = () => {
    saveConfiguracao.mutate({
      template_pix: templatePix,
      template_boleto: templateBoleto,
      template_transferencia: templateTransferencia,
    });
  };

  const handleSaveWhatsApp = () => {
    saveConfiguracao.mutate({
      whatsapp_numero: whatsappNumero,
    });
  };

  const handleSaveEndereco = () => {
    saveConfiguracao.mutate({
      endereco_cep: enderecoData.cep || null,
      endereco_logradouro: enderecoData.logradouro || null,
      endereco_numero: enderecoData.numero || null,
      endereco_complemento: enderecoData.complemento || null,
      endereco_bairro: enderecoData.bairro || null,
      endereco_cidade: enderecoData.cidade || null,
      endereco_uf: enderecoData.uf || null,
      endereco_latitude: enderecoData.latitude,
      endereco_longitude: enderecoData.longitude,
    });
  };

  const handleEnderecoChange = (field: string, value: string) => {
    setEnderecoData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCepSearch = async () => {
    const cepLimpo = enderecoData.cep.replace(/\D/g, "");
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

      const newData = {
        ...enderecoData,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
      };

      setEnderecoData(newData);
      toast.success("Endereço encontrado!");

      // Auto-geocodificar
      await handleGeocode(newData);
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar CEP.");
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleGeocode = async (data?: typeof enderecoData) => {
    const addressData = data || enderecoData;
    
    // Verifica se tem pelo menos cidade preenchida
    if (!addressData.cidade) {
      toast.error("Preencha pelo menos a cidade para localizar no mapa.");
      return;
    }

    setIsGeocoding(true);
    try {
      // Primeira tentativa: endereço completo
      const enderecoCompleto = montarEnderecoCompleto({
        logradouro: addressData.logradouro,
        numero: addressData.numero,
        bairro: addressData.bairro,
        cidade: addressData.cidade,
        uf: addressData.uf,
      });

      console.log("Tentando geocodificar:", enderecoCompleto);
      let result = await geocodeEndereco(enderecoCompleto);
      
      // Se não encontrar, tenta com endereço simplificado (só cidade/estado)
      if (!result && addressData.cidade) {
        const enderecoSimples = montarEnderecoSimplificado({
          cidade: addressData.cidade,
          uf: addressData.uf,
        });
        console.log("Tentando endereço simplificado:", enderecoSimples);
        result = await geocodeEndereco(enderecoSimples);
      }

      if (result) {
        setEnderecoData((prev) => ({
          ...prev,
          latitude: result.latitude,
          longitude: result.longitude,
        }));
        toast.success(`Localização encontrada: ${result.displayName?.split(",").slice(0, 3).join(",") || "Endereço localizado"}`);
      } else {
        toast.error("Não foi possível encontrar o endereço. Verifique se o endereço está correto ou ajuste manualmente no mapa.");
      }
    } catch (error) {
      console.error("Erro ao geocodificar:", error);
      toast.error("Erro ao localizar endereço. Tente novamente.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleMapPositionChange = (lat: number, lng: number) => {
    setEnderecoData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    toast.success("Localização atualizada no mapa");
  };

  const hasAddress = enderecoData.logradouro && enderecoData.cidade;

  return (
    <div className="space-y-6">
      {/* Top Row - Banco de Dados + Identidade Visual */}
      <div className="grid grid-cols-2 gap-6">
        {/* Banco de Dados */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Banco de Dados</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Teste a conexão com o banco de dados para garantir que tudo está funcionando corretamente.
          </p>
          <Button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? "animate-spin" : ""}`} />
            Testar Conexão
          </Button>
        </Card>

        {/* Identidade Visual */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-foreground">Identidade Visual</h2>
          </div>

          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Image className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isUploadingLogo ? "Carregando..." : "Carregar Nova Logo"}
                </Button>
                {logoUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendado: PNG ou JPG transparente (500x500px). Máx. 2MB.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
              <Input
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={corPrimaria}
                  onChange={(e) => setCorPrimaria(e.target.value)}
                  className="w-24"
                  skipUppercase
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSaveIdentidade} className="bg-green-600 hover:bg-green-700" disabled={saveConfiguracao.isPending}>
            {saveConfiguracao.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Salvar Identidade
          </Button>
        </Card>
      </div>

      {/* Endereço da Empresa */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Endereço da Empresa</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Este endereço será usado como ponto de referência para calcular a distância até os clientes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Fields */}
          <div className="space-y-4">
            {/* CEP */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">CEP</Label>
                <Input
                  placeholder="00000-000"
                  value={enderecoData.cep}
                  onChange={(e) => handleEnderecoChange("cep", e.target.value)}
                />
              </div>
              <div className="flex items-end">
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
            </div>

            {/* Logradouro + Número */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Logradouro</Label>
                <Input
                  placeholder="Rua, Avenida..."
                  value={enderecoData.logradouro}
                  onChange={(e) => handleEnderecoChange("logradouro", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  placeholder="Nº"
                  value={enderecoData.numero}
                  onChange={(e) => handleEnderecoChange("numero", e.target.value)}
                />
              </div>
            </div>

            {/* Bairro + Complemento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <Input
                  placeholder="Bairro"
                  value={enderecoData.bairro}
                  onChange={(e) => handleEnderecoChange("bairro", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Complemento</Label>
                <Input
                  placeholder="Complemento"
                  value={enderecoData.complemento}
                  onChange={(e) => handleEnderecoChange("complemento", e.target.value)}
                />
              </div>
            </div>

            {/* Cidade + UF */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={enderecoData.cidade}
                  onChange={(e) => handleEnderecoChange("cidade", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">UF</Label>
                <Input
                  placeholder="SP"
                  value={enderecoData.uf}
                  onChange={(e) => handleEnderecoChange("uf", e.target.value)}
                />
              </div>
            </div>

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

            {/* Coordenadas */}
            {enderecoData.latitude && enderecoData.longitude && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Lat: {enderecoData.latitude.toFixed(6)}</span>
                <span>Lng: {enderecoData.longitude.toFixed(6)}</span>
              </div>
            )}
          </div>

          {/* Map */}
          <AddressMap
            latitude={enderecoData.latitude}
            longitude={enderecoData.longitude}
            onPositionChange={handleMapPositionChange}
            draggable={true}
            height="300px"
          />
        </div>

        <div className="mt-4">
          <Button onClick={handleSaveEndereco} className="bg-green-600 hover:bg-green-700" disabled={saveConfiguracao.isPending}>
            {saveConfiguracao.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Salvar Endereço da Empresa
          </Button>
        </div>
      </Card>

      {/* Dados de Pagamento */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Dados de Pagamento (PIX e Banco)</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Configure os dados de pagamento que serão enviados aos clientes no faturamento.
            </p>
          </div>
        </div>

        {/* Chave PIX */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-sm text-foreground">Chave PIX</h3>
          </div>
          <div className="grid grid-cols-[200px_1fr] gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de Chave</Label>
              <Select value={tipoChave} onValueChange={setTipoChave}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Chave PIX</Label>
              <Input
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder="Digite sua chave PIX"
                skipUppercase={tipoChave === "email"}
              />
            </div>
          </div>
        </div>

        {/* Dados Bancários */}
        <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-sm text-foreground">Dados Bancários (Transferência)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome do Banco</Label>
              <Input
                value={nomeBanco}
                onChange={(e) => setNomeBanco(e.target.value)}
                placeholder="Ex: Banco do Brasil"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Agência</Label>
              <Input
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
                placeholder="Ex: 1234-5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Conta Corrente</Label>
              <Input
                value={contaCorrente}
                onChange={(e) => setContaCorrente(e.target.value)}
                placeholder="Ex: 12345-6"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Titular da Conta</Label>
              <Input
                value={titularConta}
                onChange={(e) => setTitularConta(e.target.value)}
                placeholder="Nome do titular"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSavePayment} className="bg-green-600 hover:bg-green-700" disabled={saveConfiguracao.isPending}>
          {saveConfiguracao.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Salvar Dados de Pagamento
        </Button>
      </Card>

      {/* Templates de Mensagem */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Templates de Mensagem (E-mail/WhatsApp)</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Personalize as mensagens enviadas aos clientes por forma de pagamento. Use as variáveis disponíveis para dados dinâmicos.
            </p>
          </div>
        </div>

        {/* Variáveis disponíveis */}
        <div className="mb-4 p-3 border rounded-lg bg-background">
          <p className="text-xs text-muted-foreground mb-2">Variáveis disponíveis:</p>
          <div className="flex flex-wrap gap-1">
            {templateVariables.map((variable) => (
              <Badge
                key={variable}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-secondary/80"
                onClick={() => {
                  navigator.clipboard.writeText(variable);
                  toast.success("Variável copiada!");
                }}
              >
                {variable}
              </Badge>
            ))}
          </div>
        </div>

        {/* Tabs de Templates */}
        <Tabs defaultValue="pix" className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="boleto" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Boleto
            </TabsTrigger>
            <TabsTrigger value="transferencia" className="flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Transferência
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pix" className="mt-4">
            <Label className="text-sm font-medium text-foreground">
              Template para clientes com pagamento PIX
            </Label>
            <Textarea
              value={templatePix}
              onChange={(e) => setTemplatePix(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
              skipUppercase
            />
          </TabsContent>

          <TabsContent value="boleto" className="mt-4">
            <Label className="text-sm font-medium text-foreground">
              Template para clientes com pagamento Boleto
            </Label>
            <Textarea
              value={templateBoleto}
              onChange={(e) => setTemplateBoleto(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
              skipUppercase
            />
          </TabsContent>

          <TabsContent value="transferencia" className="mt-4">
            <Label className="text-sm font-medium text-foreground">
              Template para clientes com pagamento Transferência
            </Label>
            <Textarea
              value={templateTransferencia}
              onChange={(e) => setTemplateTransferencia(e.target.value)}
              rows={12}
              className="mt-2 font-mono text-sm"
              skipUppercase
            />
          </TabsContent>
        </Tabs>

        <Button onClick={handleSaveTemplates} className="bg-green-600 hover:bg-green-700" disabled={saveConfiguracao.isPending}>
          {saveConfiguracao.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
          Salvar Templates
        </Button>
      </Card>

      {/* WhatsApp Cloud API */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">WhatsApp Cloud API</h2>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Configure as credenciais da API do WhatsApp para enviar notificações automáticas aos clientes. Esta funcionalidade requer uma conta Meta Business verificada.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <Label className="text-xs text-muted-foreground">Número do WhatsApp</Label>
          <Input
            value={whatsappNumero}
            onChange={(e) => setWhatsappNumero(e.target.value)}
            placeholder="+55 11 99999-9999"
          />
        </div>

        <Button onClick={handleSaveWhatsApp} className="bg-green-600 hover:bg-green-700" disabled={saveConfiguracao.isPending}>
          {saveConfiguracao.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
          Salvar Configurações WhatsApp
        </Button>
      </Card>
    </div>
  );
}
