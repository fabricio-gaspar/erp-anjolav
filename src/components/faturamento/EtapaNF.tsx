import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  SkipForward,
} from "lucide-react";
import { useConfiguracoesFiscais } from "@/hooks/useConfiguracoesFiscais";
import { useClienteById, useEnderecoCliente } from "@/hooks/useClientes";
import { useFaturas } from "@/hooks/useFaturas";
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
  const { configuracaoAtiva, isLoading: isLoadingFiscal } = useConfiguracoesFiscais();
  const { data: cliente, isLoading: isLoadingCliente } = useClienteById(dados.clienteId);
  const { endereco, isLoading: isLoadingEndereco } = useEnderecoCliente(dados.clienteId);
  const { updateFatura } = useFaturas();

  const isLoading = isLoadingFiscal || isLoadingCliente || isLoadingEndereco;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const handleEmitirNF = async () => {
    if (!faturaId || !configuracaoAtiva) return;

    setIsEmitting(true);
    try {
      // Generate NF number (simplified - in production would call NF API)
      const year = new Date().getFullYear();
      const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0");
      const nfNumber = `${year}${random}`;

      // Update fatura with NF number
      await updateFatura.mutateAsync({
        id: faturaId,
        numero_nf: nfNumber,
        status: "nota_emitida",
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
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Prévia da Nota Fiscal</h3>
            <Badge variant="outline" className="ml-auto">
              {configuracaoAtiva.ambiente === "producao" ? "Produção" : "Homologação"}
            </Badge>
          </div>

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

          {/* Serviços */}
          <Card className="p-4">
            <h4 className="font-medium text-sm mb-3">DESCRIÇÃO DOS SERVIÇOS</h4>
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
              disabled={isEmitting}
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
