import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Download, ChevronRight, Loader2, AlertTriangle, Map, List, Info } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFaturas, useValidateLancamentosForFatura } from "@/hooks/useFaturas";
import { useLinkLancamentosToFatura } from "@/hooks/useLancamentos";
import { gerarSnapshotItens, formatCurrency } from "@/lib/faturamentoUtils";
import type { DadosFaturamento } from "./FaturamentoModal";
import { ConfigBadge } from "./ConfigBadge";

interface EtapaRelatorioProps {
  dados: DadosFaturamento;
  onNext: () => void;
  onFaturaCreated: (id: string) => void;
}

export function EtapaRelatorio({
  dados,
  onNext,
  onFaturaCreated,
}: EtapaRelatorioProps) {
  const [revisado, setRevisado] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [observacaoFatura, setObservacaoFatura] = useState(
    dados.configPagamento?.observacao_faturamento || dados.observacao || ""
  );
  // Use centralized data: tipo_relatorio from dados.configCliente
  const tipoRelatorioConfigurado = !!dados.configCliente?.tipo_relatorio;
  const [tipoRelatorio, setTipoRelatorio] = useState<string>(
    dados.configCliente?.tipo_relatorio || "detalhado"
  );
  const observacaoConfigurada = !!dados.configPagamento?.observacao_faturamento;

  const { createFatura } = useFaturas();
  const linkLancamentos = useLinkLancamentosToFatura();
  const validateLancamentos = useValidateLancamentosForFatura();

  // Validar ROLs duplicados ao montar
  useEffect(() => {
    const validar = async () => {
      if (!dados.lancamentoIds || dados.lancamentoIds.length === 0) return;

      setIsValidating(true);
      try {
        const result = await validateLancamentos.mutateAsync(dados.lancamentoIds);
        if (!result.valid) {
          setValidationError(result.message);
        } else {
          setValidationError(null);
        }
      } catch (error) {
        console.error("Erro na validação:", error);
      } finally {
        setIsValidating(false);
      }
    };

    validar();
  }, [dados.lancamentoIds]);

  const handleGenerateReport = async () => {
    const reportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Faturamento</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; }
          .info { margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; }
          .total { font-weight: bold; text-align: right; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Relatório de Faturamento</h1>
        <div class="info">
          <p><strong>Cliente:</strong> ${dados.clienteNome}</p>
          <p><strong>Documento:</strong> ${dados.clienteDocumento || "Não informado"}</p>
          <p><strong>Período:</strong> ${format(new Date(dados.periodoInicio), "dd/MM/yyyy", { locale: ptBR })} a ${format(new Date(dados.periodoFim), "dd/MM/yyyy", { locale: ptBR })}</p>
          <p><strong>Tipo:</strong> ${tipoRelatorio}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Produto/Serviço</th>
              <th>Qtd</th>
              <th>Unidade</th>
              <th>Valor Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${dados.itens
              .map(
                (item) => `
              <tr>
                <td>${item.produto}</td>
                <td>${item.quantidade}</td>
                <td>${item.unidade}</td>
                <td>${formatCurrency(item.valorUnitario)}</td>
                <td>${formatCurrency(item.valorTotal)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <p class="total">TOTAL: ${formatCurrency(dados.valorTotal)}</p>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(reportHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleNext = async () => {
    // Validar novamente antes de prosseguir
    if (dados.lancamentoIds && dados.lancamentoIds.length > 0) {
      const validation = await validateLancamentos.mutateAsync(dados.lancamentoIds);
      if (!validation.valid) {
        setValidationError(validation.message);
        return;
      }
    }

    setIsGenerating(true);
    try {
      // Gerar snapshot dos itens
      const itensSnapshot = gerarSnapshotItens(dados);

      // Create fatura in database com dados da Etapa 1
      const result = await createFatura.mutateAsync({
        cliente_id: dados.clienteId,
        periodo_inicio: dados.periodoInicio,
        periodo_fim: dados.periodoFim,
        valor_total: dados.valorTotal,
        status: "pendente",
        // Campos da Etapa 1
        relatorio_gerado: true,
        relatorio_data: new Date().toISOString(),
        tipo_relatorio: tipoRelatorio,
        itens_snapshot: itensSnapshot,
        observacao_fatura: observacaoFatura || null,
      });

      // Link lancamentos to fatura if we have lancamentoIds
      if (dados.lancamentoIds && dados.lancamentoIds.length > 0) {
        await linkLancamentos.mutateAsync({
          lancamentoIds: dados.lancamentoIds,
          faturaId: result.id,
        });
      }

      // Primeiro seta o faturaId, depois avança
      onFaturaCreated(result.id);
      
      // Usar setTimeout para garantir que o estado do faturaId seja propagado antes de avançar
      setTimeout(() => {
        onNext();
      }, 100);
    } catch (error) {
      console.error("Erro ao criar fatura:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de validação de ROLs duplicados */}
      {validationError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {validationError}
            <br />
            <span className="text-sm">
              Remova os lançamentos duplicados antes de prosseguir.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de campos não configurados */}
      {(!tipoRelatorioConfigurado || !observacaoConfigurada) && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <Info className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
            {!tipoRelatorioConfigurado && !observacaoConfigurada
              ? "Configure o Tipo de Relatório e a Observação da Fatura no cadastro do cliente para agilizar o faturamento."
              : !tipoRelatorioConfigurado
              ? "Configure o Tipo de Relatório no cadastro do cliente para agilizar o faturamento."
              : "Configure a Observação da Fatura no cadastro do cliente para agilizar o faturamento."}
          </AlertDescription>
        </Alert>
      )}

      {/* Seletor de Tipo de Relatório */}
      {tipoRelatorioConfigurado ? (
        <ConfigBadge
          label="Tipo de Relatório"
          value={tipoRelatorio === "mapa" ? "Mapa de Peças" : "Relatório Detalhado"}
        />
      ) : (
        <Card className="p-4">
          <Label className="text-sm font-medium mb-3 block">Tipo de Relatório</Label>
          <RadioGroup
            value={tipoRelatorio}
            onValueChange={setTipoRelatorio}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2 bg-muted/50 px-4 py-3 rounded-lg border border-transparent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="mapa" id="tipo-mapa" />
              <Label htmlFor="tipo-mapa" className="cursor-pointer flex items-center gap-2">
                <Map className="w-4 h-4" />
                Mapa de Peças
              </Label>
            </div>
            <div className="flex items-center space-x-2 bg-muted/50 px-4 py-3 rounded-lg border border-transparent has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="detalhado" id="tipo-detalhado" />
              <Label htmlFor="tipo-detalhado" className="cursor-pointer flex items-center gap-2">
                <List className="w-4 h-4" />
                Relatório Detalhado
              </Label>
            </div>
          </RadioGroup>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Resumo do Faturamento</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-sm text-muted-foreground">Cliente</span>
            <p className="font-medium">{dados.clienteNome}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Documento</span>
            <p className="font-medium">{dados.clienteDocumento || "Não informado"}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Período</span>
            <p className="font-medium">
              {format(new Date(dados.periodoInicio), "dd/MM/yyyy", {
                locale: ptBR,
              })}{" "}
              a{" "}
              {format(new Date(dados.periodoFim), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Tipo Relatório</span>
            <p className="font-medium capitalize">{tipoRelatorio === "mapa" ? "Mapa de Peças" : "Detalhado"}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Lançamentos</span>
            <p className="font-medium">
              {dados.lancamentoIds?.length || 1} lançamento(s) • {dados.itens.length} item(ns)
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto/Serviço</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Valor Unit.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.produto}</TableCell>
                <TableCell className="text-right">{item.quantidade}</TableCell>
                <TableCell>{item.unidade}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.valorUnitario)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.valorTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end mt-4 pt-4 border-t">
          <div className="text-right">
            <span className="text-sm text-muted-foreground">Valor Total</span>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(dados.valorTotal)}
            </p>
          </div>
        </div>
      </Card>

      {/* Campo de Observação */}
      {observacaoConfigurada ? (
        <ConfigBadge
          label="Observação da Fatura"
          value={observacaoFatura}
        />
      ) : (
        <Card className="p-4">
          <Label className="text-sm font-medium mb-2 block">Observação da Fatura (opcional)</Label>
          <Textarea
            value={observacaoFatura}
            onChange={(e) => setObservacaoFatura(e.target.value)}
            placeholder="Adicione observações que serão salvas junto com a fatura..."
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Essas observações ficarão registradas na fatura para consulta futura.
          </p>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="revisado"
          checked={revisado}
          onCheckedChange={(checked) => setRevisado(checked === true)}
          disabled={!!validationError}
        />
        <label htmlFor="revisado" className="text-sm cursor-pointer">
          Confirmo que revisei os dados do relatório
        </label>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={handleGenerateReport} className="gap-2">
          <Download className="w-4 h-4" />
          Gerar PDF
        </Button>

        <Button
          onClick={handleNext}
          disabled={!revisado || isGenerating || !!validationError || isValidating}
          className="gap-2"
        >
          {isGenerating || isValidating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Próxima Etapa
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
