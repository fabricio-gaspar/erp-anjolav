import { useState } from "react";
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
} from "lucide-react";
import { gerarPreviewNFHtml, printNFPreview, downloadNFPreviewPdf } from "@/lib/nfPreviewPdf";
import { NFSePreviewOficial, type NFSeOficialData } from "./NFSePreviewOficial";
import { useConfiguracoesFiscais, useDescricoesServicosFiscais } from "@/hooks/useConfiguracoesFiscais";
import { useClienteById, useEnderecoCliente } from "@/hooks/useClientes";
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

interface EtapaNFProps {
  dados: DadosFaturamento;
  faturaId: string | null;
  onNext: () => void;
  onBack: () => void;
  onNFEmitida: (nf: string) => void;
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
  
  const { configuracaoAtiva, isLoading: isLoadingFiscal } = useConfiguracoesFiscais();
  const { descricoes, isLoading: isLoadingDescricoes } = useDescricoesServicosFiscais();
  const { data: cliente, isLoading: isLoadingCliente } = useClienteById(dados.clienteId);
  const { endereco, isLoading: isLoadingEndereco } = useEnderecoCliente(dados.clienteId);
  const { updateFatura } = useFaturas();

  const isLoading = isLoadingFiscal || isLoadingCliente || isLoadingEndereco || isLoadingDescricoes;
  
  // Filtrar apenas descrições ativas
  const descricoesAtivas = descricoes?.filter(d => d.ativo) || [];
  
  // Gerar descrição baseada na escolha
  const gerarDescricaoServico = () => {
    if (tipoDescricao === "padrao" && descricaoPadraoSelecionada) {
      return descricaoPadraoSelecionada;
    }
    return `Serviços de lavanderia industrial:\n${dados.itens.map(item => 
      `- ${item.produto}: ${item.quantidade} ${item.unidade}`
    ).join('\n')}`;
  };

  // Validar dados fiscais do cliente com validação aprimorada
  const validacaoCliente = cliente
    ? validarDadosFiscaisCliente(cliente, endereco)
    : { valid: false, erros: ["Cliente não encontrado"] };
  
  // Validação adicional do CPF/CNPJ
  const validacaoDocumento = cliente?.cpf_cnpj 
    ? validarCpfCnpj(cliente.cpf_cnpj)
    : { valid: false, tipo: null, erro: "Documento não informado" };
  
  if (!validacaoDocumento.valid && validacaoDocumento.erro && !validacaoCliente.erros.includes(validacaoDocumento.erro)) {
    validacaoCliente.erros.push(validacaoDocumento.erro);
    validacaoCliente.valid = false;
  }
  
  // Verificar modo de emissão
  const modoEmissao = (configuracaoAtiva as any)?.modo_emissao || "simulacao";

  const handleEmitirNF = async () => {
    if (!faturaId || !configuracaoAtiva || !cliente) return;

    setIsEmitting(true);
    try {
      // Gerar número da NF
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0");
      const nfNumber = `${year}${random}`;

      // Gerar chave de acesso (44 dígitos)
      const chaveAcesso = gerarChaveAcesso();

      // Gerar snapshots
      const snapshotCliente = gerarSnapshotCliente(
        {
          razao_social: cliente.razao_social,
          cpf_cnpj: cliente.cpf_cnpj,
          email: cliente.email,
          telefone: cliente.telefone,
          inscricao_municipal: cliente.inscricao_municipal,
        },
        endereco
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

      // Descrição do serviço baseada na escolha do usuário
      const descricaoServico = gerarDescricaoServico();

      // Update fatura com todos os dados da Etapa 2
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
        // Em produção, aqui teria o link_pdf_nf após integração real
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
    if (!configuracaoAtiva || !cliente) return;

    const enderecoConfig = configuracaoAtiva.endereco as Record<string, string> | null;

    const htmlContent = gerarPreviewNFHtml({
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
        razao_social: cliente.razao_social,
        cpf_cnpj: cliente.cpf_cnpj,
        tipo_pessoa: cliente.tipo_pessoa,
        inscricao_municipal: cliente.inscricao_municipal,
        inscricao_estadual: cliente.inscricao_estadual,
        email: cliente.email,
        telefone: cliente.telefone,
        endereco: endereco ? {
          logradouro: endereco.logradouro || undefined,
          numero: endereco.numero || undefined,
          bairro: endereco.bairro || undefined,
          cidade: endereco.cidade || undefined,
          uf: endereco.uf || undefined,
          cep: endereco.cep || undefined,
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
    });

    downloadNFPreviewPdf(htmlContent);
  };

  const handlePrintPreview = () => {
    if (!configuracaoAtiva || !cliente) return;

    const enderecoConfig = configuracaoAtiva.endereco as Record<string, string> | null;

    const htmlContent = gerarPreviewNFHtml({
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
        razao_social: cliente.razao_social,
        cpf_cnpj: cliente.cpf_cnpj,
        tipo_pessoa: cliente.tipo_pessoa,
        inscricao_municipal: cliente.inscricao_municipal,
        inscricao_estadual: cliente.inscricao_estadual,
        email: cliente.email,
        telefone: cliente.telefone,
        endereco: endereco ? {
          logradouro: endereco.logradouro || undefined,
          numero: endereco.numero || undefined,
          bairro: endereco.bairro || undefined,
          cidade: endereco.cidade || undefined,
          uf: endereco.uf || undefined,
          cep: endereco.cep || undefined,
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
    });

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

            {/* Tomador */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">TOMADOR</span>
                {!validacaoCliente.valid && (
                  <AlertTriangle className="w-4 h-4 text-amber-500 ml-auto" />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{cliente?.razao_social}</p>
                <p>
                  {cliente?.tipo_pessoa === "cnpj" ? "CNPJ" : "CPF"}:{" "}
                  {cliente?.cpf_cnpj || "Não informado"}
                </p>
                {cliente?.inscricao_municipal && (
                  <p>IM: {cliente.inscricao_municipal}</p>
                )}
                {endereco && (
                  <p className="text-muted-foreground">
                    {endereco.logradouro}, {endereco.numero}
                    {endereco.bairro && ` - ${endereco.bairro}`}
                    <br />
                    {endereco.cidade}/{endereco.uf} - CEP: {endereco.cep}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Tipo de Descrição */}
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
              {cliente && (
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
                      razao_social: cliente.razao_social,
                      cpf_cnpj: cliente.cpf_cnpj,
                      tipo_pessoa: cliente.tipo_pessoa,
                      inscricao_municipal: cliente.inscricao_municipal,
                      inscricao_estadual: cliente.inscricao_estadual,
                      email: cliente.email,
                      telefone: cliente.telefone,
                      endereco: endereco ? {
                        logradouro: endereco.logradouro,
                        numero: endereco.numero,
                        bairro: endereco.bairro,
                        cidade: endereco.cidade,
                        uf: endereco.uf,
                        cep: endereco.cep,
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
              )}
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
