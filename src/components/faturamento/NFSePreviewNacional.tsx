import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  User,
  FileText,
  QrCode,
  Printer,
  Maximize2,
  X,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Hash,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/faturamentoUtils";
import type { DadosFaturamento } from "./FaturamentoModal";

interface EnderecoData {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

interface EmitenteData {
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: EnderecoData | null;
  codigo_servico?: string | null;
  aliquota_iss?: number | null;
  codigo_municipio_ibge?: string | null;
}

interface TomadorData {
  razao_social?: string | null;
  cpf_cnpj?: string | null;
  tipo_pessoa?: string;
  inscricao_municipal?: string | null;
  inscricao_estadual?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: EnderecoData | null;
}

interface NFSePreviewNacionalProps {
  emitente: EmitenteData;
  tomador: TomadorData;
  dados: DadosFaturamento;
  ambiente: "producao" | "homologacao" | "simulacao";
  naturezaOperacao: string;
  descricaoServico: string;
  onPrint?: () => void;
}

const NATUREZAS_LABELS: Record<string, string> = {
  tributacao_municipio: "Tributação no Município",
  tributacao_fora_municipio: "Tributação Fora do Município", 
  isencao: "Isenção",
  imunidade: "Imunidade",
  exigibilidade_suspensa_judicial: "Exigibilidade Suspensa por Decisão Judicial",
  exigibilidade_suspensa_administrativa: "Exigibilidade Suspensa por Processo Administrativo",
  exportacao_servicos: "Exportação de Serviços",
};

export function NFSePreviewNacional({
  emitente,
  tomador,
  dados,
  ambiente,
  naturezaOperacao,
  descricaoServico,
  onPrint,
}: NFSePreviewNacionalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const aliquotaIss = emitente.aliquota_iss || 5;
  const valorIss = dados.valorTotal * (aliquotaIss / 100);
  const codigoServico = emitente.codigo_servico || "14.10";
  const codigoIBGE = emitente.codigo_municipio_ibge || "3550605";
  
  const isPrevia = ambiente !== "producao";
  const ambienteLabel = ambiente === "producao" ? "PRODUÇÃO" : ambiente === "homologacao" ? "HOMOLOGAÇÃO" : "SIMULAÇÃO";

  // Chave simulada para prévia
  const chaveAcessoSimulada = "35260100000000000000550010000000011000000000";
  const codigoVerificacao = "ABCD-EFGH-1234";

  const formatEndereco = (endereco?: EnderecoData | null) => {
    if (!endereco) return "Endereço não informado";
    const parts = [
      endereco.logradouro,
      endereco.numero && `nº ${endereco.numero}`,
      endereco.bairro,
      endereco.cidade && endereco.uf && `${endereco.cidade}/${endereco.uf}`,
      endereco.cep && `CEP: ${endereco.cep}`,
    ].filter(Boolean);
    return parts.join(", ") || "Endereço não informado";
  };

  const PreviewContent = () => (
    <div className="relative bg-white text-black rounded-lg overflow-hidden shadow-lg border">
      {/* Marca d'água para prévia */}
      {isPrevia && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-red-500/10 text-7xl font-bold rotate-[-30deg] whitespace-nowrap select-none">
            PRÉVIA - SEM VALOR FISCAL
          </div>
        </div>
      )}

      {/* Cabeçalho estilo prefeitura */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">
                NOTA FISCAL DE SERVIÇO ELETRÔNICA
              </h1>
              <p className="text-blue-200 text-sm">NFS-e - Padrão Nacional</p>
              <p className="text-blue-200 text-xs mt-1">
                Prefeitura Municipal de São Roque - SP
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge 
              className={`text-xs px-3 py-1 ${
                ambiente === "producao" 
                  ? "bg-green-500 hover:bg-green-600" 
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {ambienteLabel}
            </Badge>
            <p className="text-white/80 text-xs mt-2">
              {new Date().toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Identificação da NFS-e */}
      <div className="bg-blue-50 border-b border-blue-200 p-3">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-blue-600 font-medium">NÚMERO</p>
            <p className="text-lg font-bold text-blue-900">PRÉVIA</p>
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium">DATA EMISSÃO</p>
            <p className="text-sm font-semibold text-blue-900">
              {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium">CÓD. VERIFICAÇÃO</p>
            <p className="text-sm font-mono font-semibold text-blue-900">{codigoVerificacao}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600 font-medium">COMPETÊNCIA</p>
            <p className="text-sm font-semibold text-blue-900">
              {formatDate(dados.periodoInicio)} a {formatDate(dados.periodoFim)}
            </p>
          </div>
        </div>
      </div>

      {/* Prestador de Serviços */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-blue-700" />
          <h2 className="font-bold text-blue-900 uppercase text-sm tracking-wide">
            Prestador de Serviços
          </h2>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-lg font-bold text-gray-900 mb-2">
            {emitente.razao_social || "Razão Social não informada"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">CNPJ</p>
              <p className="font-medium">{emitente.cnpj || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Inscrição Municipal</p>
              <p className="font-medium">{emitente.inscricao_municipal || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Código IBGE</p>
              <p className="font-medium">{codigoIBGE}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Regime Tributário</p>
              <p className="font-medium">Simples Nacional</p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600">{formatEndereco(emitente.endereco)}</p>
          </div>
        </div>
      </div>

      {/* Tomador do Serviço */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-blue-700" />
          <h2 className="font-bold text-blue-900 uppercase text-sm tracking-wide">
            Tomador do Serviço
          </h2>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-lg font-bold text-gray-900 mb-2">
            {tomador.razao_social || "Razão Social não informada"}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">
                {tomador.tipo_pessoa === "cnpj" ? "CNPJ" : "CPF"}
              </p>
              <p className="font-medium">{tomador.cpf_cnpj || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Inscrição Municipal</p>
              <p className="font-medium">{tomador.inscricao_municipal || "-"}</p>
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3 text-gray-400" />
              <p className="font-medium text-xs truncate">{tomador.email || "-"}</p>
            </div>
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-gray-400" />
              <p className="font-medium text-xs">{tomador.telefone || "-"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600">{formatEndereco(tomador.endereco)}</p>
          </div>
        </div>
      </div>

      {/* Discriminação dos Serviços */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-blue-700" />
          <h2 className="font-bold text-blue-900 uppercase text-sm tracking-wide">
            Discriminação dos Serviços
          </h2>
        </div>
        
        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-blue-50 rounded p-2">
            <p className="text-blue-600 text-xs font-medium">Código do Serviço (LC 116/03)</p>
            <p className="font-bold text-blue-900">{codigoServico}</p>
          </div>
          <div className="bg-blue-50 rounded p-2">
            <p className="text-blue-600 text-xs font-medium">Natureza da Operação</p>
            <p className="font-bold text-blue-900 text-xs">
              {NATUREZAS_LABELS[naturezaOperacao] || naturezaOperacao}
            </p>
          </div>
          <div className="bg-blue-50 rounded p-2">
            <p className="text-blue-600 text-xs font-medium">Município de Incidência</p>
            <p className="font-bold text-blue-900">São Roque - SP</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{descricaoServico}</p>
        </div>

        {/* Tabela de Itens */}
        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="bg-blue-100 text-blue-900">
              <th className="p-2 text-left font-semibold">#</th>
              <th className="p-2 text-left font-semibold">Descrição</th>
              <th className="p-2 text-center font-semibold">Qtd</th>
              <th className="p-2 text-center font-semibold">Unid.</th>
              <th className="p-2 text-right font-semibold">Valor Unit.</th>
              <th className="p-2 text-right font-semibold">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="p-2 text-gray-600">{index + 1}</td>
                <td className="p-2 font-medium">{item.produto}</td>
                <td className="p-2 text-center">{item.quantidade}</td>
                <td className="p-2 text-center">{item.unidade}</td>
                <td className="p-2 text-right">{formatCurrency(item.valorUnitario)}</td>
                <td className="p-2 text-right font-medium">{formatCurrency(item.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Valores e Tributos */}
      <div className="p-4 border-b bg-gradient-to-b from-gray-50 to-white">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="w-5 h-5 text-blue-700" />
          <h2 className="font-bold text-blue-900 uppercase text-sm tracking-wide">
            Valores e Tributos
          </h2>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase">Base de Cálculo</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(dados.valorTotal)}</p>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase">Alíquota ISS</p>
            <p className="text-lg font-bold text-gray-900">{aliquotaIss.toFixed(2)}%</p>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 uppercase">Valor ISS</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(valorIss)}</p>
          </div>
          <div className="bg-blue-600 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-100 uppercase">Valor Líquido NFS-e</p>
            <p className="text-xl font-bold text-white">{formatCurrency(dados.valorTotal)}</p>
          </div>
        </div>
      </div>

      {/* Chave de Acesso e QR Code */}
      <div className="p-4 bg-gray-50">
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center">
              <QrCode className="w-16 h-16 text-gray-400" />
            </div>
            <p className="text-xs text-center text-gray-500 mt-1">QR Code</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-medium mb-1">CHAVE DE ACESSO DA NFS-e</p>
            <div className="bg-white border rounded p-2 font-mono text-xs break-all text-gray-700">
              {chaveAcessoSimulada}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Consulte a autenticidade desta nota em: https://saoroque.govbr.cloud/NFSe.Portal
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      {isPrevia && (
        <div className="bg-red-50 border-t-2 border-red-200 p-3 text-center">
          <p className="text-red-600 font-bold text-sm">
            ⚠️ DOCUMENTO DE PRÉVIA - SEM VALOR FISCAL - NÃO É NOTA FISCAL VÁLIDA ⚠️
          </p>
          <p className="text-red-500 text-xs mt-1">
            Este documento foi gerado apenas para fins de conferência antes da emissão oficial.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Prévia da NFS-e - Padrão Nacional</h3>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onPrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)} className="gap-2">
              <Maximize2 className="w-4 h-4" />
              Tela Cheia
            </Button>
          </div>
        </div>
        
        <div className="p-4 max-h-[600px] overflow-y-auto bg-gray-100">
          <PreviewContent />
        </div>

        {/* Checklist de validação */}
        <div className="p-4 border-t bg-muted/20">
          <p className="text-sm font-medium mb-2">Checklist Pré-Emissão:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <ValidationItem 
              valid={!!emitente.cnpj} 
              label="CNPJ Prestador" 
            />
            <ValidationItem 
              valid={!!tomador.cpf_cnpj} 
              label="CPF/CNPJ Tomador" 
            />
            <ValidationItem 
              valid={!!tomador.endereco?.logradouro} 
              label="Endereço Tomador" 
            />
            <ValidationItem 
              valid={!!emitente.inscricao_municipal} 
              label="Inscrição Municipal" 
            />
          </div>
        </div>
      </Card>

      {/* Modal Fullscreen */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Prévia da NFS-e - Visualização Completa</span>
              <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <PreviewContent />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onPrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button onClick={() => setIsFullscreen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ValidationItem({ valid, label }: { valid: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded ${valid ? "bg-green-50" : "bg-red-50"}`}>
      {valid ? (
        <CheckCircle2 className="w-4 h-4 text-green-600" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-600" />
      )}
      <span className={valid ? "text-green-700" : "text-red-700"}>{label}</span>
    </div>
  );
}
