import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Loader2,
  Package,
  Calendar,
  DollarSign,
  Save
} from "lucide-react";
import { 
  useContratoCliente, 
  useItensContrato, 
  useContratosAluguel,
  useCalculoContrato,
  type ContratoAluguel,
  type ItemContratoAluguel
} from "@/hooks/useContratosAluguel";
import { useProdutos } from "@/hooks/useProdutos";
import { format } from "date-fns";

interface ClienteContratoProps {
  clienteId: string | null;
}

export function ClienteContrato({ clienteId }: ClienteContratoProps) {
  const { data: contrato, isLoading: loadingContrato } = useContratoCliente(clienteId);
  const { data: itens = [], isLoading: loadingItens } = useItensContrato(contrato?.id ?? null);
  const { produtos, isLoading: loadingProdutos } = useProdutos();
  const { createContrato, updateContrato, addItemContrato, removeItemContrato } = useContratosAluguel();
  const calculo = useCalculoContrato(contrato ?? null, itens);

  // Form state
  const [temContrato, setTemContrato] = useState(false);
  const [descricao, setDescricao] = useState("Contrato de Aluguel");
  const [valorServico, setValorServico] = useState("");
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ativo, setAtivo] = useState(true);

  // Item form
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorUnitario, setValorUnitario] = useState("0");

  // Sync form with existing contract
  useEffect(() => {
    if (contrato) {
      setTemContrato(true);
      setDescricao(contrato.descricao);
      setValorServico(contrato.valor_servico.toString());
      setDataInicio(contrato.data_inicio);
      setDataFim(contrato.data_fim || "");
      setObservacoes(contrato.observacoes || "");
      setAtivo(contrato.ativo);
    } else {
      setTemContrato(false);
      setDescricao("Contrato de Aluguel");
      setValorServico("");
      setDataInicio(format(new Date(), "yyyy-MM-dd"));
      setDataFim("");
      setObservacoes("");
      setAtivo(true);
    }
  }, [contrato]);

  // Reset when clienteId changes
  useEffect(() => {
    setSelectedProdutoId("");
    setQuantidade("1");
    setValorUnitario("0");
  }, [clienteId]);

  const handleSaveContrato = () => {
    if (!clienteId) return;

    const data = {
      descricao,
      valor_servico: parseFloat(valorServico) || 0,
      data_inicio: dataInicio,
      data_fim: dataFim || null,
      observacoes: observacoes || null,
      ativo,
    };

    if (contrato) {
      updateContrato.mutate({ id: contrato.id, ...data });
    } else {
      createContrato.mutate({ cliente_id: clienteId, ...data });
    }
  };

  const handleAddItem = () => {
    if (!contrato || !selectedProdutoId) return;

    addItemContrato.mutate({
      contrato_id: contrato.id,
      produto_id: selectedProdutoId,
      quantidade: parseInt(quantidade) || 1,
      valor_unitario: parseFloat(valorUnitario) || 0,
    });

    setSelectedProdutoId("");
    setQuantidade("1");
    setValorUnitario("0");
  };

  const handleRemoveItem = (item: ItemContratoAluguel) => {
    if (!contrato) return;
    removeItemContrato.mutate({ id: item.id, contratoId: contrato.id });
  };

  const handleProdutoChange = (produtoId: string) => {
    setSelectedProdutoId(produtoId);
    // Não preenche valor automaticamente - aluguel geralmente é 0
    setValorUnitario("0");
  };

  // Produtos disponíveis (exclui já adicionados)
  const produtosDisponiveis = produtos.filter(
    (p) => p.status === "ativo" && !itens.some((i) => i.produto_id === p.id)
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (!clienteId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Selecione um cliente para gerenciar o contrato</p>
        </CardContent>
      </Card>
    );
  }

  if (loadingContrato) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Carregando contrato...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle principal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Contrato de Aluguel Mensal
              </CardTitle>
              <CardDescription>
                Configure um valor fixo mensal e quantidade de produtos incluídos
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="tem-contrato" className="text-sm">
                Cliente possui contrato
              </Label>
              <Switch
                id="tem-contrato"
                checked={temContrato}
                onCheckedChange={setTemContrato}
              />
            </div>
          </div>
        </CardHeader>

        {temContrato && (
          <CardContent className="space-y-6">
            {/* Formulário do contrato */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição do Contrato</Label>
                <Input
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Aluguel de Uniformes"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor-servico">Valor Mensal do Serviço (R$)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="valor-servico"
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorServico}
                    onChange={(e) => setValorServico(e.target.value)}
                    className="pl-9"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-inicio">Data de Início</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="data-inicio"
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-fim">Data de Fim (Opcional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="data-fim"
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="pl-9"
                    placeholder="Indeterminado"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais sobre o contrato..."
                  rows={2}
                />
              </div>
            </div>

            {/* Status e ações */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ativo"
                    checked={ativo}
                    onCheckedChange={setAtivo}
                  />
                  <Label htmlFor="ativo" className="text-sm">
                    Contrato Ativo
                  </Label>
                </div>
                {contrato && (
                  <StatusBadge variant={ativo ? "success" : "warning"}>
                    {ativo ? "Ativo" : "Inativo"}
                  </StatusBadge>
                )}
              </div>
              <Button 
                onClick={handleSaveContrato}
                disabled={createContrato.isPending || updateContrato.isPending}
              >
                {(createContrato.isPending || updateContrato.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {contrato ? "Atualizar Contrato" : "Criar Contrato"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Itens do contrato - só aparece se já existe contrato */}
      {temContrato && contrato && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Itens do Contrato
            </CardTitle>
            <CardDescription>
              Produtos incluídos no aluguel mensal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adicionar item */}
            <div className="flex gap-3 items-end p-4 bg-muted/50 rounded-lg">
              <div className="flex-1 space-y-2">
                <Label>Produto</Label>
                <Select value={selectedProdutoId} onValueChange={handleProdutoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingProdutos ? (
                      <SelectItem value="loading" disabled>Carregando...</SelectItem>
                    ) : produtosDisponiveis.length === 0 ? (
                      <SelectItem value="empty" disabled>Nenhum produto disponível</SelectItem>
                    ) : (
                      produtosDisponiveis.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.nome} - {formatCurrency(produto.preco)}/{produto.unidade}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-2">
                <Label>Qtd</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
              <div className="w-32 space-y-2">
                <Label>Valor Unit. (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(e.target.value)}
                  placeholder="0 = incluído"
                />
              </div>
              <Button 
                onClick={handleAddItem}
                disabled={!selectedProdutoId || addItemContrato.isPending}
              >
                {addItemContrato.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Tabela de itens */}
            {loadingItens ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Carregando itens...</span>
              </div>
            ) : itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhum item adicionado ao contrato</p>
                <p className="text-xs">Adicione produtos incluídos no aluguel</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.produto?.nome || item.descricao_item || "Produto removido"}
                        </TableCell>
                        <TableCell className="text-center">{item.quantidade}</TableCell>
                        <TableCell className="text-right">
                          {item.valor_unitario === 0 ? (
                            <StatusBadge variant="info">Incluído</StatusBadge>
                          ) : (
                            formatCurrency(item.valor_unitario)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.valor_unitario === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            formatCurrency(item.quantidade * item.valor_unitario)
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveItem(item)}
                            disabled={removeItemContrato.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Resumo */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                Resumo do Contrato
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Valor do Serviço</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculo.valorServico)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor dos Itens</p>
                  <p className="text-lg font-semibold">{formatCurrency(calculo.valorItens)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Peças</p>
                  <p className="text-lg font-semibold">{calculo.totalPecas}</p>
                </div>
                <div className="bg-primary/10 -m-2 p-2 rounded">
                  <p className="text-xs text-primary font-medium">TOTAL MENSAL</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(calculo.totalMensal)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
