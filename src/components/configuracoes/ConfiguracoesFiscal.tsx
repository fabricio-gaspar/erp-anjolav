import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Building2,
  Plus,
  Trash2,
  Pencil,
  Upload,
  Shield,
  FileText,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useConfiguracoesFiscais,
  useDescricoesServicosFiscais,
  type ConfiguracaoFiscalInsert,
} from "@/hooks/useConfiguracoesFiscais";
import type { Json } from "@/integrations/supabase/types";

// Interface para formulário (camelCase)
interface FormData {
  nome: string;
  cnpj: string;
  razaoSocial: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  aliquotaIss: string;
  codigoServico: string;
  ambiente: "producao" | "homologacao";
  ativo: boolean;
  certificadoNome: string;
  senhaCertificado: string;
  validadeCertificado: string;
  urlHomologacao: string;
  urlProducao: string;
  urlWebServiceIM: string;
  serieNfse: string;
  proximoNfse: string;
  serieNfe: string;
  proximoNfe: string;
  idCsc: string;
  tokenCsc: string;
  regimeTributario: string;
}

const defaultFormData: FormData = {
  nome: "",
  cnpj: "",
  razaoSocial: "",
  inscricaoMunicipal: "",
  inscricaoEstadual: "ISENTO",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  aliquotaIss: "5.00",
  codigoServico: "14.01",
  ambiente: "homologacao",
  ativo: true,
  certificadoNome: "",
  senhaCertificado: "",
  validadeCertificado: "",
  urlHomologacao: "",
  urlProducao: "",
  urlWebServiceIM: "",
  serieNfse: "1",
  proximoNfse: "1",
  serieNfe: "1",
  proximoNfe: "1",
  idCsc: "1",
  tokenCsc: "",
  regimeTributario: "simples-nacional",
};

// Converte dados do banco para formulário
function databaseToForm(config: {
  id: string;
  nome: string;
  cnpj: string | null;
  razao_social: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  endereco: Json;
  aliquota_iss: number | null;
  codigo_servico: string | null;
  ambiente: string | null;
  ativo: boolean;
  certificado_url: string | null;
  validade_certificado: string | null;
  urls_webservice: Json;
  series_numeracao: Json;
  csc_dados: Json;
  regime_tributario: string | null;
}): FormData {
  const endereco = (config.endereco || {}) as Record<string, string>;
  const urls = (config.urls_webservice || {}) as Record<string, string>;
  const series = (config.series_numeracao || {}) as Record<string, string>;
  const csc = (config.csc_dados || {}) as Record<string, string>;

  return {
    nome: config.nome || "",
    cnpj: config.cnpj || "",
    razaoSocial: config.razao_social || "",
    inscricaoMunicipal: config.inscricao_municipal || "",
    inscricaoEstadual: config.inscricao_estadual || "ISENTO",
    rua: endereco.logradouro || "",
    numero: endereco.numero || "",
    bairro: endereco.bairro || "",
    cidade: endereco.cidade || "",
    estado: endereco.uf || "",
    cep: endereco.cep || "",
    aliquotaIss: config.aliquota_iss?.toString() || "5.00",
    codigoServico: config.codigo_servico || "14.01",
    ambiente: (config.ambiente as "producao" | "homologacao") || "homologacao",
    ativo: config.ativo,
    certificadoNome: config.certificado_url || "",
    senhaCertificado: "",
    validadeCertificado: config.validade_certificado || "",
    urlHomologacao: urls.homologacao || "",
    urlProducao: urls.producao || "",
    urlWebServiceIM: urls.webservice_im || "",
    serieNfse: series.serie_nfse || "1",
    proximoNfse: series.proximo_nfse || "1",
    serieNfe: series.serie_nfe || "1",
    proximoNfe: series.proximo_nfe || "1",
    idCsc: csc.id_csc || "1",
    tokenCsc: csc.token_csc || "",
    regimeTributario: config.regime_tributario || "simples-nacional",
  };
}

// Converte formulário para formato do banco
function formToDatabase(form: FormData): ConfiguracaoFiscalInsert {
  return {
    nome: form.nome,
    cnpj: form.cnpj || null,
    razao_social: form.razaoSocial || null,
    inscricao_municipal: form.inscricaoMunicipal || null,
    inscricao_estadual: form.inscricaoEstadual || null,
    endereco: {
      logradouro: form.rua,
      numero: form.numero,
      bairro: form.bairro,
      cidade: form.cidade,
      uf: form.estado,
      cep: form.cep,
    },
    aliquota_iss: parseFloat(form.aliquotaIss) || 5,
    codigo_servico: form.codigoServico || null,
    ambiente: form.ambiente,
    ativo: form.ativo,
    certificado_url: null,
    validade_certificado: form.validadeCertificado || null,
    urls_webservice: {
      homologacao: form.urlHomologacao,
      producao: form.urlProducao,
      webservice_im: form.urlWebServiceIM,
    },
    series_numeracao: {
      serie_nfse: form.serieNfse,
      proximo_nfse: form.proximoNfse,
      serie_nfe: form.serieNfe,
      proximo_nfe: form.proximoNfe,
    },
    csc_dados: {
      id_csc: form.idCsc,
      token_csc: form.tokenCsc,
    },
    regime_tributario: form.regimeTributario || null,
  };
}

export function ConfiguracoesFiscal() {
  const {
    configuracoes,
    isLoading: loadingConfigs,
    createConfiguracao,
    updateConfiguracao,
    deleteConfiguracao,
  } = useConfiguracoesFiscais();

  const {
    descricoes,
    isLoading: loadingDescricoes,
    addDescricao,
    updateDescricao,
    deleteDescricao,
  } = useDescricoesServicosFiscais();

  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    if (!formData.nome || !formData.cnpj) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome da configuração e o CNPJ.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const dbData = formToDatabase(formData);

      if (editingConfigId) {
        await updateConfiguracao.mutateAsync({ id: editingConfigId, ...dbData });
        toast({ title: "Configuração atualizada com sucesso!" });
      } else {
        await createConfiguracao.mutateAsync(dbData);
        toast({ title: "Configuração adicionada com sucesso!" });
      }

      setFormData(defaultFormData);
      setEditingConfigId(null);
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditConfig = (config: typeof configuracoes[0]) => {
    setFormData(databaseToForm(config));
    setEditingConfigId(config.id);
  };

  const handleCancelEdit = () => {
    setFormData(defaultFormData);
    setEditingConfigId(null);
  };

  const handleDeleteConfig = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta configuração?")) {
      await deleteConfiguracao.mutateAsync(id);
    }
  };

  const handleAddDescricao = async () => {
    const descricao = prompt("Digite a descrição do serviço:");
    if (descricao) {
      await addDescricao.mutateAsync(descricao.toUpperCase());
    }
  };

  const handleEditDescricao = async (id: string, descricaoAtual: string) => {
    const novaDescricao = prompt("Editar descrição:", descricaoAtual);
    if (novaDescricao && novaDescricao !== descricaoAtual) {
      await updateDescricao.mutateAsync({ id, descricao: novaDescricao.toUpperCase() });
    }
  };

  const handleDeleteDescricao = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta descrição?")) {
      await deleteDescricao.mutateAsync(id);
    }
  };

  if (loadingConfigs || loadingDescricoes) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando configurações fiscais...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CNPJs Cadastrados */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">CNPJs Cadastrados ({configuracoes.length})</h2>
        </div>

        {configuracoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma configuração fiscal cadastrada. Adicione uma abaixo.
          </p>
        ) : (
          <div className="space-y-3">
            {configuracoes.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{config.nome}</span>
                      <Badge variant={config.ativo ? "default" : "secondary"} className="text-xs">
                        {config.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {config.cnpj} · {config.razao_social}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ISS: {config.aliquota_iss}% · {config.ambiente === "homologacao" ? "Homologação" : "Produção"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditConfig(config)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteConfig(config.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Formulário Nova Configuração */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">
              {editingConfigId ? "Editar Configuração Fiscal" : "Nova Configuração Fiscal"}
            </h2>
          </div>
          {editingConfigId && (
            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
              Cancelar Edição
            </Button>
          )}
        </div>

        {/* Dados da Empresa */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Dados da Empresa</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                Nome da Configuração <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: CNPJ Matriz, CNPJ Filial SP, CNPJ Unidade RJ"
                value={formData.nome}
                onChange={(e) => handleInputChange("nome", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  CNPJ <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => handleInputChange("cnpj", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Razão Social <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Nome da empresa"
                  value={formData.razaoSocial}
                  onChange={(e) => handleInputChange("razaoSocial", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Inscrição Municipal <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Informe o número da IM"
                  value={formData.inscricaoMunicipal}
                  onChange={(e) => handleInputChange("inscricaoMunicipal", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A validação da IM ocorrerá automaticamente na primeira emissão de NFS-e bem-sucedida
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Inscrição Estadual</Label>
                <Input
                  placeholder="ISENTO"
                  value={formData.inscricaoEstadual}
                  onChange={(e) => handleInputChange("inscricaoEstadual", e.target.value)}
                  className="text-amber-600"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se não houver IE, será preenchido automaticamente como "ISENTO"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Endereço</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-[1fr_100px] gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Rua</Label>
                <Input
                  placeholder="Logradouro"
                  value={formData.rua}
                  onChange={(e) => handleInputChange("rua", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  placeholder="Nº"
                  value={formData.numero}
                  onChange={(e) => handleInputChange("numero", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Bairro</Label>
                <Input
                  placeholder="Bairro"
                  value={formData.bairro}
                  onChange={(e) => handleInputChange("bairro", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={formData.cidade}
                  onChange={(e) => handleInputChange("cidade", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Input
                  placeholder="UF"
                  value={formData.estado}
                  onChange={(e) => handleInputChange("estado", e.target.value)}
                  className="text-amber-600"
                />
              </div>
            </div>

            <div className="w-48">
              <Label className="text-xs text-muted-foreground">CEP</Label>
              <Input
                placeholder="00000-000"
                value={formData.cep}
                onChange={(e) => handleInputChange("cep", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Configurações de NFS-e */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Configurações de NFS-e</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Alíquota ISS (%)</Label>
              <Input
                placeholder="5.00"
                value={formData.aliquotaIss}
                onChange={(e) => handleInputChange("aliquotaIss", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Código do Serviço (LC 116)</Label>
              <Input
                placeholder="Ex: 14.01"
                value={formData.codigoServico}
                onChange={(e) => handleInputChange("codigoServico", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ambiente</Label>
              <Select
                value={formData.ambiente}
                onValueChange={(value) => handleInputChange("ambiente", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Status</h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.ativo}
              onCheckedChange={(checked) => handleInputChange("ativo", checked)}
            />
            <span className="text-sm text-muted-foreground">Ativo</span>
          </div>
        </div>

        {/* Certificado Digital */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Certificado Digital A1 <span className="text-muted-foreground font-normal">(.pfx ou .p12)</span>
            </h3>
          </div>

          <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors mb-4">
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Fazer Upload do Certificado (em breve)</span>
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              O certificado digital será armazenado de forma segura e criptografado no sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Senha do Certificado</Label>
              <Input
                type="password"
                placeholder="Senha do certificado digital"
                value={formData.senhaCertificado}
                onChange={(e) => handleInputChange("senhaCertificado", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Validade do Certificado</Label>
              <Input
                type="date"
                placeholder="dd/mm/aaaa"
                value={formData.validadeCertificado}
                onChange={(e) => handleInputChange("validadeCertificado", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* URLs de WebService */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">URLs de WebService</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-xs text-amber-600">URL Homologação</Label>
              <Input
                placeholder="https://homologacao.prefeitura..."
                value={formData.urlHomologacao}
                onChange={(e) => handleInputChange("urlHomologacao", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-amber-600">URL Produção</Label>
              <Input
                placeholder="https://nfse.prefeitura..."
                value={formData.urlProducao}
                onChange={(e) => handleInputChange("urlProducao", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-amber-600">URL WebService IM (SOAP WSDL)</Label>
            <Input
              placeholder="https://saoroque.ginfes.cloud/Nfse.PortalIntegracao/Services.svc?wsdl"
              value={formData.urlWebServiceIM}
              onChange={(e) => handleInputChange("urlWebServiceIM", e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL do WebService SOAP para consulta da Inscrição Municipal. Obrigatório para consulta automática.
            </p>
          </div>
        </div>

        {/* Série e Numeração */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Série e Numeração</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-amber-600">Série NFS-e</Label>
              <Input
                placeholder="1"
                value={formData.serieNfse}
                onChange={(e) => handleInputChange("serieNfse", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Próximo Nº NFS-e</Label>
              <Input
                placeholder="1"
                value={formData.proximoNfse}
                onChange={(e) => handleInputChange("proximoNfse", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-amber-600">Série NF-e</Label>
              <Input
                placeholder="1"
                value={formData.serieNfe}
                onChange={(e) => handleInputChange("serieNfe", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Próximo Nº NF-e</Label>
              <Input
                placeholder="1"
                value={formData.proximoNfe}
                onChange={(e) => handleInputChange("proximoNfe", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* CSC e Regime Tributário */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-amber-600 mb-4">CSC e Regime Tributário</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">ID do CSC</Label>
              <Input
                placeholder="1"
                value={formData.idCsc}
                onChange={(e) => handleInputChange("idCsc", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                Token <span className="text-amber-600">CSC</span>
              </Label>
              <Input
                placeholder="Token para NFC-e"
                value={formData.tokenCsc}
                onChange={(e) => handleInputChange("tokenCsc", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-amber-600">Regime Tributário</Label>
              <Select
                value={formData.regimeTributario}
                onValueChange={(value) => handleInputChange("regimeTributario", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples-nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro-presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="lucro-real">Lucro Real</SelectItem>
                  <SelectItem value="mei">MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button onClick={handleSaveConfig} className="bg-primary hover:bg-primary/90" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {editingConfigId ? "Salvar Alterações" : "Adicionar Configuração"}
        </Button>
      </Card>

      {/* Descrições de Serviços */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Descrições de Serviços para Notas Fiscais</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Cadastre descrições padrão que podem ser usadas nas notas fiscais. Ex: "HIGIENIZAÇÃO DE UNIFORMES", "HIGIENIZAÇÃO DE PEÇAS", etc.
        </p>

        <Button onClick={handleAddDescricao} className="w-full mb-4 bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Nova Descrição
        </Button>

        {descricoes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma descrição cadastrada.
          </p>
        ) : (
          <div className="space-y-2">
            {descricoes.map((desc) => (
              <div
                key={desc.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm text-foreground">{desc.descricao}</p>
                  <Badge variant={desc.ativo ? "default" : "secondary"} className="text-xs mt-1">
                    {desc.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditDescricao(desc.id, desc.descricao)}
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteDescricao(desc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
