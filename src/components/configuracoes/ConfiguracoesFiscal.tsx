import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ConfiguracaoFiscal {
  id: string;
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
  ambiente: string;
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

interface DescricaoServico {
  id: string;
  descricao: string;
  ativo: boolean;
}

const defaultConfig: ConfiguracaoFiscal = {
  id: "",
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
  urlHomologacao: "https://homologacao.prefeitura...",
  urlProducao: "https://nfse.prefeitura...",
  urlWebServiceIM: "https://saoroque.ginfes.cloud/Nfse.PortalIntegracao/Services.svc?wsdl",
  serieNfse: "1",
  proximoNfse: "1",
  serieNfe: "1",
  proximoNfe: "1",
  idCsc: "1",
  tokenCsc: "",
  regimeTributario: "simples-nacional",
};

export function ConfiguracoesFiscal() {
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoFiscal[]>([
    {
      ...defaultConfig,
      id: "1",
      nome: "Lavanderia São Roque Ltda",
      cnpj: "25.127.025/0001-06",
      razaoSocial: "Lavanderia São Roque Ltda",
      ambiente: "homologacao",
    },
  ]);

  const [descricoes, setDescricoes] = useState<DescricaoServico[]>([
    { id: "1", descricao: "HIGIENIZAÇÃO DE UNIFORMES", ativo: true },
    { id: "2", descricao: "HIGIENIZAÇÃO DE PEÇAS", ativo: true },
    { id: "3", descricao: "HIGIENIZAÇÃO DE TOALHAS", ativo: true },
    { id: "4", descricao: "LAVAGEM DE ROUPAS PROFISSIONAIS", ativo: true },
  ]);

  const [editingConfig, setEditingConfig] = useState<ConfiguracaoFiscal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ConfiguracaoFiscal>(defaultConfig);

  const handleInputChange = (field: keyof ConfiguracaoFiscal, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = () => {
    if (!formData.nome || !formData.cnpj) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome da configuração e o CNPJ.",
        variant: "destructive",
      });
      return;
    }

    if (editingConfig) {
      setConfiguracoes((prev) =>
        prev.map((c) => (c.id === editingConfig.id ? { ...formData, id: editingConfig.id } : c))
      );
      toast({ title: "Configuração atualizada com sucesso!" });
    } else {
      const newConfig = { ...formData, id: Date.now().toString() };
      setConfiguracoes((prev) => [...prev, newConfig]);
      toast({ title: "Configuração adicionada com sucesso!" });
    }

    setFormData(defaultConfig);
    setEditingConfig(null);
    setShowForm(false);
  };

  const handleEditConfig = (config: ConfiguracaoFiscal) => {
    setFormData(config);
    setEditingConfig(config);
    setShowForm(true);
  };

  const handleDeleteConfig = (id: string) => {
    setConfiguracoes((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Configuração removida!" });
  };

  const handleAddDescricao = () => {
    const descricao = prompt("Digite a descrição do serviço:");
    if (descricao) {
      setDescricoes((prev) => [
        ...prev,
        { id: Date.now().toString(), descricao: descricao.toUpperCase(), ativo: true },
      ]);
      toast({ title: "Descrição adicionada!" });
    }
  };

  const handleEditDescricao = (id: string) => {
    const desc = descricoes.find((d) => d.id === id);
    if (desc) {
      const novaDescricao = prompt("Editar descrição:", desc.descricao);
      if (novaDescricao) {
        setDescricoes((prev) =>
          prev.map((d) => (d.id === id ? { ...d, descricao: novaDescricao.toUpperCase() } : d))
        );
        toast({ title: "Descrição atualizada!" });
      }
    }
  };

  const handleDeleteDescricao = (id: string) => {
    setDescricoes((prev) => prev.filter((d) => d.id !== id));
    toast({ title: "Descrição removida!" });
  };

  return (
    <div className="space-y-6">
      {/* CNPJs Cadastrados */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">CNPJs Cadastrados ({configuracoes.length})</h2>
        </div>

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
                    {config.cnpj} · {config.razaoSocial}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ISS: {config.aliquotaIss}% · {config.ambiente === "homologacao" ? "Homologação" : "Produção"}
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
      </Card>

      {/* Formulário Nova Configuração */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">
            {editingConfig ? "Editar Configuração Fiscal" : "Nova Configuração Fiscal"}
          </h2>
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

          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors mb-4"
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Fazer Upload do Certificado</span>
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

        <Button onClick={handleSaveConfig} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          {editingConfig ? "Salvar Alterações" : "Adicionar Configuração"}
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

        <Button
          onClick={handleAddDescricao}
          className="w-full mb-4 bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Nova Descrição
        </Button>

        <div className="space-y-2">
          {descricoes.map((desc) => (
            <div
              key={desc.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/30 transition-colors"
            >
              <div>
                <p className="font-medium text-sm text-foreground">{desc.descricao}</p>
                <Badge variant="default" className="text-xs mt-1">
                  Ativo
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEditDescricao(desc.id)}
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
      </Card>
    </div>
  );
}
