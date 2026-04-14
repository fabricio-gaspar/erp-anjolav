import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  SkipForward,
  AlertTriangle,
  FileDown,
  Eye,
  FileText,
  List,
  MapPin,
  Gavel,
  Info,
} from "lucide-react";
import { gerarPreviewNFHtml, printNFPreview, downloadNFPreviewPdf } from "@/lib/nfPreviewPdf";
import { NFSePreviewOficial, type NFSeOficialData } from "./NFSePreviewOficial";
import { useConfiguracoesFiscais, useDescricoesServicosFiscais } from "@/hooks/useConfiguracoesFiscais";
import { useFaturas } from "@/hooks/useFaturas";
import {
  formatCurrency,
  gerarSnapshotCliente,
  gerarSnapshotEmitente,
  gerarChaveAcesso,
  validarDadosFiscaisCliente,
} from "@/lib/faturamentoUtils";
import { NATUREZAS_OPERACAO, type NaturezaOperacao, validarCpfCnpj } from "@/lib/validacoesFiscais";
import type { DadosFaturamento } from "./FaturamentoModal";
import { ConfigBadge } from "./ConfigBadge";

interface EtapaNFProps {
  dados: DadosFaturamento;
  faturaId: string | null;
  onNext: () => void;
  onBack: () => void;
  onNFEmitida: (nf: string) => void;
}

// Extracted: builds NF preview data to avoid duplication
function buildNFPreviewData(
  configuracaoAtiva: any,
  dados: DadosFaturamento,
) {
  const enderecoConfig = configuracaoAtiva.endereco as Record<string, string> | null;
  const clienteEndereco = dados.clienteEndereco;

  return {
    emitente: {
      razao_social: configuracaoAtiva.razao_social,
      cnpj: configuracaoAtiva.cnpj,
      inscricao_municipal: configuracaoAtiva.inscricao_municipal,
      inscricao_estadual: configuracaoAtiva.inscricao_estadual,
      email: null,
      telefone: null,
      endereco: enderecoConfig ? {
        logradouro: enderecoConfig.logradouro,
        numero: enderecoConfig.numero,
        bairro: enderecoConfig.bairro,
        cidade: enderecoConfig.cidade,
        uf: enderecoConfig.uf,
        cep: enderecoConfig.cep,
      } : null,
      codigo_servico: configuracaoAtiva.codigo_servico,
      aliquota_iss: configuracaoAtiva.aliquota_iss,
    },
    tomador: {
      razao_social: dados.clienteNome,
      cpf_cnpj: dados.clienteDocumento || null,
      tipo_pessoa: dados.clienteTipoPessoa || "cnpj",
      inscricao_municipal: dados.clienteInscricaoMunicipal || null,
      inscricao_estadual: dados.clienteInscricaoEstadual || null,
      email: dados.clienteEmail,
      telefone: dados.clienteTelefone,
      endereco: clienteEndereco ? {
        logradouro: clienteEndereco.logradouro || undefined,
        numero: clienteEndereco.numero || undefined,
        bairro: clienteEndereco.bairro || undefined,
        cidade: clienteEndereco.cidade || undefined,
        uf: clienteEndereco.uf || undefined,
        cep: clienteEndereco.cep || undefined,
      } : null,
    },
    itens: dados.itens.map(item => ({
      id: item.id,
      produto: item.produto,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
    })),
    valorTotal: dados.valorTotal,
    periodoInicio: dados.periodoInicio,
    periodoFim: dados.periodoFim,
    ambiente: configuracaoAtiva.ambiente as "producao" | "homologacao" | undefined,
  };
}

export function EtapaNF({
  dados,
  faturaId,
  onNext,
  onBack,
  onNFEmitida,
}: EtapaNFProps) {
  const [isEmitting, setIsEmitting] = useState(false);
  const [tipoDescricao, setTipoDescricao] = useState<"itens" | "padrao">("itens");
  const [descricaoPadraoSelecionada, setDescricaoPadraoSelecionada] = useState<string>("");
  const [naturezaOperacao, setNaturezaOperacao] = useState<NaturezaOperacao>("tributacao_municipio");
  const [naturezaAutoSelected, setNaturezaAutoSelected] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  const { configuracaoAtiva: configuracaoAtivaGlobal, configuracoes, isLoading: isLoadingFiscal } = useConfiguracoesFiscais();
  const { descricoes, isLoading: isLoadingDescricoes } = useDescricoesServicosFiscais();
  const { updateFatura } = useFaturas();

  const isLoading = isLoadingFiscal || isLoadingDescricoes;
  
  // Use client's preferred CNPJ emissor if configured, otherwise use global active config
  const configuracaoAtiva = useMemo(() => {
    const cnpjEmissorId = dados.configPagamento?.cnpj_emissor_id;
    if (cnpjEmissorId && configuracoes) {
      const configCliente = configuracoes.find(c => c.id === cnpjEmissorId);
      if (configCliente) return configCliente;
    }
    return configuracaoAtivaGlobal;
  }, [dados.configPagamento?.cnpj_emissor_id, configuracoes, configuracaoAtivaGlobal]);

  // Filtrar apenas descrições ativas
  const descricoesAtivas = descricoes?.filter(d => d.ativo) || [];
  
  // Inicializar valores com base nas preferências do cliente (from centralized data)
  useEffect(() => {
    if (!initialized && !isLoading) {
      const configPag = dados.configPagamento;
      
      // Se o cliente tem uma descrição padrão configurada
      if (configPag?.descricao_nf_id) {
        const descricaoPadrao = descricoes?.find(d => d.id === configPag.descricao_nf_id);
        if (descricaoPadrao) {
          setDescricaoPadraoSelecionada(descricaoPadrao.descricao);
          setTipoDescricao("padrao");
        }
      }
      
      // Configurar o tipo de descrição baseado na preferência do cliente
      if (configPag?.listar_itens_detalhados === false) {
        setTipoDescricao("padrao");
      } else if (configPag?.listar_itens_detalhados === true) {
        setTipoDescricao("itens");
      }

      // Auto-selecionar natureza da operação baseado no regime tributário e localidade
      if (!naturezaAutoSelected && configuracaoAtiva) {
        const enderecoConfig = configuracaoAtiva.endereco as Record<string, string> | null;
        const clienteEndereco = dados.clienteEndereco;
        const cidadeEmitente = enderecoConfig?.cidade?.toLowerCase().trim();
        const cidadeTomador = clienteEndereco?.cidade?.toLowerCase().trim();
        
        // Se municípios são diferentes, tributar fora do município
        if (cidadeEmitente && cidadeTomador && cidadeEmitente !== cidadeTomador) {
          setNaturezaOperacao("tributacao_fora");
        } else {
          // Padrão: tributação no município
          setNaturezaOperacao("tributacao_municipio");
        }
        setNaturezaAutoSelected(true);
      }
      
      setInitialized(true);
    }
  }, [dados.configPagamento, isLoading, initialized, descricoes, configuracaoAtiva, naturezaAutoSelected, dados.clienteEndereco]);
  
  // Gerar descrição baseada na escolha
  const gerarDescricaoServico = () => {
    if (tipoDescricao === "padrao" && descricaoPadraoSelecionada) {
      return descricaoPadraoSelecionada;
    }
    return `Serviços de lavanderia industrial:\n${dados.itens.map(item => 
      `- ${item.produto}: ${item.quantidade} ${item.unidade}`
    ).join('\n')}`;
  };

  // Validar dados fiscais do cliente using centralized data
  const validacaoCliente = validarDadosFiscaisCliente(
    { cpf_cnpj: dados.clienteDocumento || null },
    dados.clienteEndereco || null
  );
  
  // Validação adicional do CPF/CNPJ
  const validacaoDocumento = dados.clienteDocumento 
    ? validarCpfCnpj(dados.clienteDocumento)
    : { valid: false, tipo: null, erro: "Documento não informado" };
  
  if (!validacaoDocumento.valid && validacaoDocumento.erro && !validacaoCliente.erros.includes(validacaoDocumento.erro)) {
    validacaoCliente.erros.push(validacaoDocumento.erro);
    validacaoCliente.valid = false;
  }
  
  // Verificar modo de emissão
  const modoEmissao = (configuracaoAtiva as any)?.modo_emissao || "simulacao";

  const handleEmitirNF = async () => {
    if (!faturaId || !configuracaoAtiva) return;

    setIsEmitting(true);
    try {
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
      const nfNumber = `${year}${random}`;
      const chaveAcesso = gerarChaveAcesso();

      // Gerar snapshots using centralized data
      const snapshotCliente = gerarSnapshotCliente(
        {
          razao_social: dados.clienteNome,
          cpf_cnpj: dados.clienteDocumento || null,
          email: dados.clienteEmail,
          telefone: dados.clienteTelefone,
          inscricao_municipal: dados.clienteInscricaoMunicipal,
        },
        dados.clienteEndereco
      );

      const snapshotEmitente = gerarSnapshotEmitente({
        razao_social: configuracaoAtiva.razao_social,
        cnpj: configuracaoAtiva.cnpj,
        inscricao_municipal: configuracaoAtiva.inscricao_municipal,
        inscricao_estadual: configuracaoAtiva.inscricao_estadual,
        endereco: configuracaoAtiva.endereco as Record<string, string> | null,
        codigo_servico: configuracaoAtiva.codigo_servico,
        aliquota_iss: configuracaoAtiva.aliquota_iss,
      });

      const descricaoServico = gerarDescricaoServico();

      await updateFatura.mutateAsync({
        id: faturaId,
        numero_nf: nfNumber,
        status: "nota_emitida",
        chave_acesso: chaveAcesso,
        data_emissao_nf: new Date().toISOString(),
        snapshot_cliente: snapshotCliente,
        snapshot_emitente: snapshotEmitente,
        descricao_servico: descricaoServico,
        natureza_operacao: naturezaOperacao,
        status_sefaz: modoEmissao === "simulacao" ? "nao_enviada" : "processando",
      });

      onNFEmitida(nfNumber);
      onNext();
    } catch (error) {
      console.error("Erro ao emitir NF:", error);
    } finally {
      setIsEmitting(false);
    }
  };

  const handleSkip = () => {
    onNext();
  };

  const handlePreviewPdf = () => {
    if (!configuracaoAtiva) return;
    const htmlContent = gerarPreviewNFHtml(buildNFPreviewData(configuracaoAtiva, dados));
    downloadNFPreviewPdf(htmlContent);
  };

  const handlePrintPreview = () => {
    if (!configuracaoAtiva) return;
    const htmlContent = gerarPreviewNFHtml(buildNFPreviewData(configuracaoAtiva, dados));
    printNFPreview(htmlContent);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const enderecoConfig = configuracaoAtiva?.endereco as Record<string, string> | null;
  const clienteEndereco = dados.clienteEndereco;

  return (
    <div className="space-y-6">
      {!configuracaoAtiva ? (
        <Card className="p-6 border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">
                Configuração Fiscal não encontrada
              </h3>
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                Configure os dados fiscais em Configurações &gt; Fiscal para emitir
                notas fiscais.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Alerta de dados incompletos do cliente */}
          {!validacaoCliente.valid && (
            <Alert variant="destructive" className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Dados do cliente incompletos:</strong>
                <ul className="list-disc list-inside mt-1">
                  {validacaoCliente.erros.map((erro, i) => (
                    <li key={i} className="text-sm">{erro}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Prévia da Nota Fiscal</h3>
             <Badge variant="outline" className="ml-auto">
              {configuracaoAtiva.ambiente === "producao" ? "Produção" : "Homologação"}
            </Badge>
            {/* Show which CNPJ emissor is being used */}
            {dados.configPagamento?.cnpj_emissor_id && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {configuracaoAtiva.nome || configuracaoAtiva.razao_social}
                </Badge>
                <span className="text-xs text-green-600">✓ Cadastro</span>
              </>
            )}
          </div>

          {/* Seletor de Natureza de Operação */}
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-sm">NATUREZA DA OPERAÇÃO</h4>
            </div>
            <Select 
              value={naturezaOperacao} 
              onValueChange={(value) => setNaturezaOperacao(value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a natureza da operação" />
              </SelectTrigger>
              <SelectContent>
                {NATUREZAS_OPERACAO.map((nat) => (
                  <SelectItem key={nat.value} value={nat.value}>
                    {nat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Tabs: Dados e Prévia */}
          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="dados" className="gap-2">
                <FileText className="w-4 h-4" />
                Dados da Nota
              </TabsTrigger>
              <TabsTrigger value="previa" className="gap-2">
                <Eye className="w-4 h-4" />
                Prévia Visual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
            {/* Emitente */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">EMITENTE</span>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{configuracaoAtiva.razao_social}</p>
                <p>CNPJ: {configuracaoAtiva.cnpj}</p>
                {configuracaoAtiva.inscricao_municipal && (
                  <p>IM: {configuracaoAtiva.inscricao_municipal}</p>
                )}
                {enderecoConfig && (
                  <p className="text-muted-foreground">
                    {enderecoConfig.logradouro}, {enderecoConfig.numero}
                    {enderecoConfig.bairro && ` - ${enderecoConfig.bairro}`}
                    <br />
                    {enderecoConfig.cidade}/{enderecoConfig.uf} - CEP:{" "}
                    {enderecoConfig.cep}
                  </p>
                )}
              </div>
            </Card>

            {/* Tomador - using centralized data */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">TOMADOR</span>
                {!validacaoCliente.valid && (
                  <AlertTriangle className="w-4 h-4 text-amber-500 ml-auto" />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{dados.clienteNome}</p>
                <p>
                  {(dados.clienteTipoPessoa || "cnpj") === "cnpj" ? "CNPJ" : "CPF"}:{" "}
                  {dados.clienteDocumento || "Não informado"}
                </p>
                {dados.clienteInscricaoMunicipal && (
                  <p>IM: {dados.clienteInscricaoMunicipal}</p>
                )}
                {dados.clienteInscricaoEstadual && (
                  <p>IE: {dados.clienteInscricaoEstadual}</p>
                )}
                {dados.clienteRegimeTributario && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {dados.clienteRegimeTributario === "simples_nacional" ? "Simples Nacional" :
                     dados.clienteRegimeTributario === "lucro_presumido" ? "Lucro Presumido" :
                     dados.clienteRegimeTributario === "lucro_real" ? "Lucro Real" :
                     dados.clienteRegimeTributario}
                  </Badge>
                )}
                {clienteEndereco && (
                  <p className="text-muted-foreground">
                    {clienteEndereco.logradouro}, {clienteEndereco.numero}
                    {clienteEndereco.bairro && ` - ${clienteEndereco.bairro}`}
                    <br />
                    {clienteEndereco.cidade}/{clienteEndereco.uf} - CEP: {clienteEndereco.cep}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Tipo de Descrição */}
          {dados.configPagamento?.listar_itens_detalhados !== null && dados.configPagamento?.listar_itens_detalhados !== undefined && dados.configPagamento?.descricao_nf_id ? (
            <ConfigBadge
              label="Descrição NF"
              value={tipoDescricao === "itens" ? "Itens detalhados" : (descricaoPadraoSelecionada || "Descrição pré-cadastrada")}
            />
          ) : (
            <>
              {!dados.configPagamento?.descricao_nf_id && (
                <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
                  <Info className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                    Configure a Descrição NF padrão no cadastro do cliente para agilizar o faturamento.
                  </AlertDescription>
                </Alert>
              )}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">TIPO DE DESCRIÇÃO PARA NOTA FISCAL</h4>
                </div>
                
                <RadioGroup 
                  value={tipoDescricao} 
                  onValueChange={(value) => setTipoDescricao(value as "itens" | "padrao")}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="itens" id="itens" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="itens" className="flex items-center gap-2 cursor-pointer font-medium">
                        <List className="w-4 h-4" />
                        Listar itens detalhados
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cada item será listado com nome, quantidade e valor unitário
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="padrao" id="padrao" className="mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="padrao" className="flex items-center gap-2 cursor-pointer font-medium">
                        <FileText className="w-4 h-4" />
                        Usar descrição pré-cadastrada
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Usar uma descrição padrão configurada em Configurações &gt; Fiscal
                      </p>
                      
                      {tipoDescricao === "padrao" && (
                        <div className="pt-2">
                          {descricoesAtivas.length > 0 ? (
                            <Select 
                              value={descricaoPadraoSelecionada} 
                              onValueChange={setDescricaoPadraoSelecionada}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione uma descrição..." />
                              </SelectTrigger>
                              <SelectContent>
                                {descricoesAtivas.map((desc) => (
                                  <SelectItem key={desc.id} value={desc.descricao}>
                                    {desc.descricao}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                              <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                                Nenhuma descrição pré-cadastrada. Configure em Configurações &gt; Fiscal.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </RadioGroup>
              </Card>
            </>
          )}

              {/* Serviços */}
              <Card className="p-4">
                <h4 className="font-medium text-sm mb-3">DESCRIÇÃO DOS SERVIÇOS</h4>
                
                {tipoDescricao === "padrao" && descricaoPadraoSelecionada ? (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <p className="text-sm font-medium">{descricaoPadraoSelecionada}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Serviços de lavanderia industrial conforme itens abaixo:
                    </p>
                    <div className="space-y-2">
                      {dados.itens.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm py-1 border-b last:border-0"
                        >
                          <span>
                            {index + 1}. {item.produto} - {item.quantidade} {item.unidade}
                          </span>
                          <span className="font-medium">{formatCurrency(item.valorTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator className="my-4" />

                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    <p>Código do Serviço: {configuracaoAtiva.codigo_servico || "7.04"}</p>
                    <p>Alíquota ISS: {configuracaoAtiva.aliquota_iss || 5}%</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Valor Total</span>
                    <p className="text-xl font-bold">{formatCurrency(dados.valorTotal)}</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="previa">
              <NFSePreviewOficial
                data={{
                  emitente: {
                    razao_social: configuracaoAtiva.razao_social,
                    cnpj: configuracaoAtiva.cnpj,
                    inscricao_municipal: configuracaoAtiva.inscricao_municipal,
                    inscricao_estadual: configuracaoAtiva.inscricao_estadual,
                    endereco: enderecoConfig ? {
                      logradouro: enderecoConfig.logradouro,
                      numero: enderecoConfig.numero,
                      bairro: enderecoConfig.bairro,
                      cidade: enderecoConfig.cidade,
                      uf: enderecoConfig.uf,
                      cep: enderecoConfig.cep,
                    } : null,
                    codigo_servico: configuracaoAtiva.codigo_servico,
                    aliquota_iss: configuracaoAtiva.aliquota_iss,
                  },
                  tomador: {
                    razao_social: dados.clienteNome,
                    cpf_cnpj: dados.clienteDocumento || null,
                    tipo_pessoa: dados.clienteTipoPessoa || "cnpj",
                    inscricao_municipal: dados.clienteInscricaoMunicipal || null,
                    inscricao_estadual: dados.clienteInscricaoEstadual || null,
                    email: dados.clienteEmail,
                    telefone: dados.clienteTelefone,
                    endereco: clienteEndereco ? {
                      logradouro: clienteEndereco.logradouro,
                      numero: clienteEndereco.numero,
                      bairro: clienteEndereco.bairro,
                      cidade: clienteEndereco.cidade,
                      uf: clienteEndereco.uf,
                      cep: clienteEndereco.cep,
                    } : null,
                  },
                  descricao_servico: gerarDescricaoServico(),
                  valor_servico: dados.valorTotal,
                  aliquota_iss: configuracaoAtiva.aliquota_iss || 0,
                  valor_iss: dados.valorTotal * ((configuracaoAtiva.aliquota_iss || 0) / 100),
                  natureza_operacao: naturezaOperacao,
                  ambiente: modoEmissao as "producao" | "homologacao",
                  isPrevia: true,
                }}
                onPrint={handlePrintPreview}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleSkip} className="gap-2">
            <SkipForward className="w-4 h-4" />
            Pular Etapa
          </Button>

          {configuracaoAtiva && (
            <Button
              onClick={handleEmitirNF}
              disabled={isEmitting || !validacaoCliente.valid || (tipoDescricao === "padrao" && !descricaoPadraoSelecionada)}
              className="gap-2"
            >
              {isEmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Emitir Nota Fiscal
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
