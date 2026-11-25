import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useConfiguracoesFiscais,
  useDescricoesServicosFiscais,
  type ConfiguracaoFiscal,
  type ConfiguracaoFiscalInsert,
} from "@/hooks/useConfiguracoesFiscais";
import { formatCnpj } from "@/lib/nfsePolicy";
import {
  MUNICIPIOS_SP,
  validarCEP,
  validarCNPJ,
  normalizarCnpj,
  validarCodigoIBGE,
} from "@/lib/validacoesFiscais";

type FiscalOperation = "none" | "domestico" | "industrial";
type FiscalEnvironment = "homologacao" | "producao";
type FiscalMode = "simulacao" | "homologacao" | "producao";

interface FiscalFormData {
  nome: string;
  cnpj: string;
  razaoSocial: string;
  inscricaoMunicipal: string;
  inscricaoEstadual: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  codigoMunicipioIbge: string;
  codigoServico: string;
  aliquotaIss: string;
  regimeTributario: string;
  operationType: FiscalOperation;
  ambiente: FiscalEnvironment;
  modoEmissao: FiscalMode;
  ativo: boolean;
}

const EMPTY_FORM: FiscalFormData = {
  nome: "",
  cnpj: "",
  razaoSocial: "",
  inscricaoMunicipal: "",
  inscricaoEstadual: "ISENTO",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "SP",
  cep: "",
  codigoMunicipioIbge: "",
  codigoServico: "",
  aliquotaIss: "",
  regimeTributario: "",
  operationType: "none",
  ambiente: "homologacao",
  modoEmissao: "simulacao",
  ativo: true,
};

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

function configToForm(config: ConfiguracaoFiscal): FiscalFormData {
  const address = asStringRecord(config.endereco);
  return {
    nome: config.nome || "",
    cnpj: config.cnpj || "",
    razaoSocial: config.razao_social || "",
    inscricaoMunicipal: config.inscricao_municipal || "",
    inscricaoEstadual: config.inscricao_estadual || "ISENTO",
    logradouro: address.logradouro || "",
    numero: address.numero || "",
    bairro: address.bairro || "",
    cidade: address.cidade || "",
    uf: address.uf || "SP",
    cep: address.cep || "",
    codigoMunicipioIbge: config.codigo_municipio_ibge || "",
    codigoServico: config.codigo_servico || "",
    aliquotaIss: config.aliquota_iss?.toString() ?? "",
    regimeTributario: config.regime_tributario || "",
    operationType: config.operation_type || "none",
    ambiente: config.ambiente || "homologacao",
    modoEmissao: config.modo_emissao || "simulacao",
    ativo: config.ativo,
  };
}

function formToConfig(form: FiscalFormData): ConfiguracaoFiscalInsert {
  return {
    nome: form.nome.trim(),
    cnpj: normalizarCnpj(form.cnpj),
    razao_social: form.razaoSocial.trim(),
    inscricao_municipal: form.inscricaoMunicipal.trim(),
    inscricao_estadual: form.inscricaoEstadual.trim() || "ISENTO",
    endereco: {
      logradouro: form.logradouro.trim(),
      numero: form.numero.trim(),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf.trim().toUpperCase(),
      cep: form.cep.replace(/\D/g, ""),
    },
    aliquota_iss: Number(form.aliquotaIss),
    codigo_servico: form.codigoServico.trim(),
    codigo_municipio_ibge: form.codigoMunicipioIbge.replace(/\D/g, ""),
    regime_tributario: form.regimeTributario,
    operation_type: form.operationType === "none" ? null : form.operationType,
    ambiente: form.ambiente,
    modo_emissao: form.modoEmissao,
    provedor_nfse: "nacional",
    emitir_automaticamente: false,
    ativo: form.ativo,
    certificado_url: null,
    senha_certificado_encrypted: null,
    url_api_nfse: null,
    urls_webservice: {},
    csc_dados: {},
    series_numeracao: {},
  };
}

function operationLabel(value: ConfiguracaoFiscal["operation_type"]): string {
  if (value === "domestico") return "Padrão do PDV doméstico";
  if (value === "industrial") return "Padrão do PDV industrial";
  return "Selecionado por cliente";
}

function credentialLabel(status: ConfiguracaoFiscal["credencial_status"]): string {
  const labels: Record<ConfiguracaoFiscal["credencial_status"], string> = {
    nao_configurada: "Credencial não configurada",
    configurada: "Credencial configurada",
    homologada: "Credencial homologada",
    expirada: "Credencial expirada",
    erro: "Erro na credencial",
  };
  return labels[status] || "Credencial não configurada";
}

function validateForm(form: FiscalFormData): string | null {
  if (!form.nome.trim() || !form.razaoSocial.trim()) return "Informe o nome e a razão social do emitente.";
  if (!validarCNPJ(form.cnpj)) return "Informe um CNPJ válido para o emitente.";
  if (!form.inscricaoMunicipal.trim()) return "Informe a inscrição municipal do emitente.";
  if (!form.logradouro.trim() || !form.numero.trim() || !form.bairro.trim() || !form.cidade.trim() || form.uf.trim().length !== 2) {
    return "Preencha o endereço fiscal completo do emitente.";
  }
  if (!validarCEP(form.cep)) return "Informe um CEP válido com 8 dígitos.";
  if (!validarCodigoIBGE(form.codigoMunicipioIbge)) return "Informe o código IBGE do município com 7 dígitos.";
  if (!/^\d{6}$/.test(form.codigoServico.replace(/[.\s]/g, ""))) return "Informe o código nacional de tributação com 6 dígitos.";
  if (!form.regimeTributario) return "Selecione o regime tributário do emitente.";
  if (!form.aliquotaIss.trim()) return "Informe a alíquota de ISS confirmada pelo responsável fiscal.";
  const rate = Number(form.aliquotaIss);
  if (!Number.isFinite(rate) || rate < 0 || rate > 5) return "A alíquota de ISS deve estar entre 0% e 5%.";
  return null;
}

export function ConfiguracoesFiscal() {
  const {
    configuracoes,
    isLoading: loadingConfigs,
    error: configsError,
    createConfiguracao,
    updateConfiguracao,
    deleteConfiguracao,
  } = useConfiguracoesFiscais();
  const {
    descricoes,
    isLoading: loadingDescriptions,
    addDescricao,
    updateDescricao,
    deleteDescricao,
  } = useDescricoesServicosFiscais();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FiscalFormData>(EMPTY_FORM);

  const editingConfig = configuracoes.find((config) => config.id === editingId) || null;
  const saving = createConfiguracao.isPending || updateConfiguracao.isPending;
  const productionAllowed = editingConfig?.credencial_status === "homologada";

  const setField = <K extends keyof FiscalFormData>(field: K, value: FiscalFormData[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "cidade" && typeof value === "string") {
        const city = MUNICIPIOS_SP.find((item) => item.nome.toLocaleLowerCase("pt-BR") === value.trim().toLocaleLowerCase("pt-BR"));
        if (city) {
          next.codigoMunicipioIbge = city.codigo;
          next.uf = city.uf;
        }
      }
      if (field === "ambiente" && value === "homologacao" && current.modoEmissao === "producao") {
        next.modoEmissao = "homologacao";
      }
      return next;
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if ((form.ambiente === "producao" || form.modoEmissao === "producao") && !productionAllowed) {
      toast.error("A produção só pode ser ativada depois que este CNPJ tiver a credencial homologada no backend fiscal.");
      return;
    }
    if ((form.ambiente === "producao") !== (form.modoEmissao === "producao")) {
      toast.error("Ambiente e modo de emissão precisam estar ambos em Produção ou ambos fora de Produção.");
      return;
    }

    try {
      const payload = formToConfig(form);
      if (editingId) await updateConfiguracao.mutateAsync({ id: editingId, ...payload });
      else await createConfiguracao.mutateAsync(payload);
      resetForm();
    } catch {
      // O hook exibe a mensagem segura retornada pelo banco.
    }
  };

  const edit = (config: ConfiguracaoFiscal) => {
    setEditingId(config.id);
    setForm(configToForm(config));
  };

  const remove = async (config: ConfiguracaoFiscal) => {
    if (!window.confirm(`Excluir o emitente ${config.nome}? Configurações já usadas em documentos fiscais não podem ser excluídas.`)) return;
    try {
      await deleteConfiguracao.mutateAsync(config.id);
      if (editingId === config.id) resetForm();
    } catch {
      // O hook apresenta o motivo sem remover o histórico fiscal.
    }
  };

  const addDescription = async () => {
    const description = window.prompt("Descrição padrão do serviço para a NFS-e:")?.trim();
    if (description) await addDescricao.mutateAsync(description.toUpperCase());
  };

  const editDescription = async (id: string, current: string) => {
    const description = window.prompt("Editar descrição:", current)?.trim();
    if (description && description !== current) await updateDescricao.mutateAsync({ id, descricao: description.toUpperCase() });
  };

  const removeDescription = async (id: string) => {
    if (window.confirm("Excluir esta descrição fiscal padrão?")) await deleteDescricao.mutateAsync(id);
  };

  if (loadingConfigs || loadingDescriptions) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando configuração fiscal...</div>;
  }

  if (configsError) {
    return <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar os emitentes fiscais. Reabra a página ou confira sua permissão administrativa.</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /><h2 className="font-semibold">NFS-e Nacional · emitentes</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre os dois CNPJs separadamente. Cada um conserva credencial, homologação, numeração e histórico próprios.</p>
          </div>
          <Badge variant="outline">{configuracoes.length} CNPJ(s)</Badge>
        </div>
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-3">
          <p><strong>1. Cliente:</strong> prevalece o CNPJ escolhido no cadastro.</p>
          <p><strong>2. Operação:</strong> usa o padrão doméstico ou industrial.</p>
          <p><strong>3. Segurança:</strong> com dois emitentes e sem regra, a emissão fica bloqueada para escolha explícita.</p>
        </div>

        {configuracoes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Building2 className="mx-auto mb-2 h-8 w-8" />Nenhum CNPJ emissor cadastrado. Cadastre o primeiro emitente abaixo e depois repita para o segundo CNPJ.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {configuracoes.map((config) => (
              <div key={config.id} className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{config.nome}</p>
                      <Badge variant={config.ativo ? "default" : "secondary"}>{config.ativo ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatCnpj(config.cnpj)} · {config.razao_social || "Razão social não informada"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Editar ${config.nome}`} onClick={() => edit(config)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Excluir ${config.nome}`} className="text-destructive hover:text-destructive" onClick={() => void remove(config)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <p className="rounded-md bg-muted px-2 py-1.5">{operationLabel(config.operation_type)}</p>
                  <p className="rounded-md bg-muted px-2 py-1.5">{config.ambiente === "producao" ? "Produção" : "Homologação"} · {config.modo_emissao || "simulação"}</p>
                </div>
                <div className={`flex items-center gap-2 text-sm ${config.credencial_status === "homologada" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {config.credencial_status === "homologada" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {credentialLabel(config.credencial_status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">{editingId ? "Editar CNPJ emissor" : "Adicionar CNPJ emissor"}</h2><p className="text-sm text-muted-foreground">Os dados abaixo compõem a identificação fiscal enviada ao provedor homologado.</p></div>
          {editingId && <Button variant="outline" size="sm" onClick={resetForm}><X className="mr-1 h-4 w-4" />Cancelar edição</Button>}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="fiscal-name">Nome interno *</Label><Input id="fiscal-name" value={form.nome} onChange={(event) => setField("nome", event.target.value)} placeholder="Ex.: AnjoLav Serviços" /></div>
          <div className="space-y-1.5"><Label htmlFor="fiscal-cnpj">CNPJ *</Label><Input id="fiscal-cnpj" value={form.cnpj} onChange={(event) => setField("cnpj", event.target.value)} placeholder="00.000.000/0000-00" /></div>
          <div className="space-y-1.5"><Label htmlFor="fiscal-company">Razão social *</Label><Input id="fiscal-company" value={form.razaoSocial} onChange={(event) => setField("razaoSocial", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="fiscal-im">Inscrição municipal *</Label><Input id="fiscal-im" value={form.inscricaoMunicipal} onChange={(event) => setField("inscricaoMunicipal", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="fiscal-ie">Inscrição estadual</Label><Input id="fiscal-ie" value={form.inscricaoEstadual} onChange={(event) => setField("inscricaoEstadual", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Regime tributário *</Label><Select value={form.regimeTributario} onValueChange={(value) => setField("regimeTributario", value)}><SelectTrigger><SelectValue placeholder="Selecione o regime" /></SelectTrigger><SelectContent><SelectItem value="simples-nacional">Simples Nacional</SelectItem><SelectItem value="lucro-presumido">Lucro Presumido</SelectItem><SelectItem value="lucro-real">Lucro Real</SelectItem><SelectItem value="mei">MEI</SelectItem></SelectContent></Select></div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Endereço fiscal</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2"><Label htmlFor="fiscal-street">Logradouro *</Label><Input id="fiscal-street" value={form.logradouro} onChange={(event) => setField("logradouro", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-number">Número *</Label><Input id="fiscal-number" value={form.numero} onChange={(event) => setField("numero", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-district">Bairro *</Label><Input id="fiscal-district" value={form.bairro} onChange={(event) => setField("bairro", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-city">Cidade *</Label><Input id="fiscal-city" value={form.cidade} onChange={(event) => setField("cidade", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-state">UF *</Label><Input id="fiscal-state" maxLength={2} value={form.uf} onChange={(event) => setField("uf", event.target.value.toUpperCase())} /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-zip">CEP *</Label><Input id="fiscal-zip" inputMode="numeric" value={form.cep} onChange={(event) => setField("cep", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-ibge">Código IBGE *</Label><Input id="fiscal-ibge" inputMode="numeric" maxLength={7} value={form.codigoMunicipioIbge} onChange={(event) => setField("codigoMunicipioIbge", event.target.value)} /></div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Regra de emissão</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5"><Label>CNPJ padrão para</Label><Select value={form.operationType} onValueChange={(value) => setField("operationType", value as FiscalOperation)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Selecionar por cliente</SelectItem><SelectItem value="domestico">PDV doméstico</SelectItem><SelectItem value="industrial">PDV industrial</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Só pode existir um CNPJ padrão ativo por operação.</p></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-service">Código nacional do serviço *</Label><Input id="fiscal-service" value={form.codigoServico} onChange={(event) => setField("codigoServico", event.target.value)} placeholder="6 dígitos" /></div>
            <div className="space-y-1.5"><Label htmlFor="fiscal-rate">Alíquota ISS (%) *</Label><Input id="fiscal-rate" type="number" min="0" max="5" step="0.01" value={form.aliquotaIss} onChange={(event) => setField("aliquotaIss", event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Ambiente</Label><Select value={form.ambiente} onValueChange={(value) => setField("ambiente", value as FiscalEnvironment)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="homologacao">Homologação</SelectItem><SelectItem value="producao" disabled={!productionAllowed}>Produção</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Modo de emissão</Label><Select value={form.modoEmissao} onValueChange={(value) => setField("modoEmissao", value as FiscalMode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="simulacao">Simulação / prévia</SelectItem><SelectItem value="homologacao">Homologação</SelectItem><SelectItem value="producao" disabled={!productionAllowed}>Produção</SelectItem></SelectContent></Select></div>
            <div className="flex items-center gap-3 rounded-lg border p-3"><Switch id="fiscal-active" checked={form.ativo} onCheckedChange={(checked) => setField("ativo", checked)} /><Label htmlFor="fiscal-active">Emitente ativo</Label></div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Certificado e senha ficam fora do navegador</p><p className="mt-1">A tela cadastra somente dados públicos do emitente. Cada CNPJ recebe uma referência de credencial no bridge fiscal seguro. Produção e emissão automática permanecem bloqueadas até homologação individual.</p>{editingConfig?.homologado_em && <p className="mt-1 text-xs">Homologado em {new Date(editingConfig.homologado_em).toLocaleString("pt-BR")}.</p>}</div>
        </div>

        <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{editingId ? "Salvar emitente" : "Adicionar emitente"}</Button>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="font-semibold">Descrições fiscais padrão</h2></div><p className="mt-1 text-sm text-muted-foreground">Textos reutilizáveis para serviços faturados sem detalhamento item a item.</p></div>
          <Button variant="outline" onClick={() => void addDescription()}><Plus className="mr-2 h-4 w-4" />Adicionar descrição</Button>
        </div>
        {descricoes.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma descrição fiscal cadastrada.</p> : <div className="space-y-2">{descricoes.map((description) => <div key={description.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{description.descricao}</p><Badge variant={description.ativo ? "default" : "secondary"} className="mt-1">{description.ativo ? "Ativa" : "Inativa"}</Badge></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" aria-label="Editar descrição" onClick={() => void editDescription(description.id, description.descricao)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Excluir descrição" className="text-destructive hover:text-destructive" onClick={() => void removeDescription(description.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}
      </Card>
    </div>
  );
}
