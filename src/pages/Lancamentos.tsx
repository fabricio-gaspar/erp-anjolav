import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Plus,
  ShoppingCart,
  ArrowRight,
  Search,
  ClipboardList,
  Printer,
  Check,
  User,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";

interface LancamentoItem {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

interface ClienteSelecionado {
  nome: string;
  documento: string;
  telefone: string;
}

const Lancamentos = () => {
  const [items, setItems] = useState<LancamentoItem[]>([
    {
      id: "1",
      produto: "FRONHA",
      quantidade: 10,
      unidade: "peça",
      valorUnitario: 3.5,
      valorTotal: 35.0,
    },
  ]);

  const [clienteSelecionado] = useState<ClienteSelecionado | null>({
    nome: "FABRICIO GASPAR",
    documento: "276.343.258-13",
    telefone: "(11) 99744-1875",
  });

  const [dataEmissao, setDataEmissao] = useState("2026-01-09");
  const [dataEntrega, setDataEntrega] = useState("2026-01-09");

  const totalValue = items.reduce((sum, item) => sum + item.valorTotal, 0);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  return (
    <AppLayout title="Lançamentos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Lançamentos de Consumo
            </h1>
            <p className="text-sm text-muted-foreground">
              Registre a produção diária por cliente
            </p>
          </div>

          <Button variant="outline" className="gap-2">
            <ArrowRight className="w-4 h-4" />
            Ir para Faturamento
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="novo" className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            <TabsTrigger
              value="novo"
              className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
            >
              <FileText className="w-4 h-4" />
              Novo Lançamento
            </TabsTrigger>
            <TabsTrigger
              value="conferencia"
              className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
            >
              <ClipboardList className="w-4 h-4" />
              Conferência & Divergências
            </TabsTrigger>
          </TabsList>

          <TabsContent value="novo" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel - Form */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">Novo Lançamento</h2>
                </div>

                <div className="space-y-4">
                  {/* Data de Emissão */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Data de Emissão
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        type="date"
                        value={dataEmissao}
                        onChange={(e) => setDataEmissao(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Data de Entrega */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Data de Entrega
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        type="date"
                        value={dataEntrega}
                        onChange={(e) => setDataEntrega(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Observação / Informação
                    </Label>
                    <Input
                      placeholder="Ex: Entregar até sexta, Roupa de cama extra..."
                      className="mt-1.5"
                    />
                  </div>

                  {/* Cliente */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Cliente
                    </Label>
                    <div className="relative mt-1.5">
                      {clienteSelecionado ? (
                        <div className="flex items-center justify-between border rounded-md px-3 py-2.5 bg-background">
                          <div>
                            <p className="font-medium text-foreground">
                              {clienteSelecionado.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {clienteSelecionado.documento} •{" "}
                              {clienteSelecionado.telefone}
                            </p>
                          </div>
                          <Search className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="relative">
                          <Input placeholder="Buscar por nome, CNPJ, telefone, cidade..." />
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Produto/Serviço */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Produto/Serviço
                    </Label>
                    <div className="relative mt-1.5">
                      <Input placeholder="Selecione o produto" />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Quantidade (un)
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      className="mt-1.5"
                      min={0}
                    />
                  </div>

                  {/* Adicionar Item Button */}
                  <Button className="w-full gap-2 mt-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </Button>
                </div>
              </Card>

              {/* Right Panel - Items */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-lg">Itens do Lançamento</h2>
                  </div>
                  {items.length > 0 && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {items.length} item
                    </Badge>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">Selecione um cliente para começar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Client Info */}
                    {clienteSelecionado && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {clienteSelecionado.nome}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(dataEmissao)}
                        </span>
                      </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-3 border-b"
                        >
                          <div>
                            <p className="font-semibold text-foreground">
                              {item.produto}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantidade} {item.unidade} ×{" "}
                              {formatCurrency(item.valorUnitario)} ={" "}
                              <span className="font-medium text-foreground">
                                {formatCurrency(item.valorTotal)}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total Card */}
                    <Card className="bg-success/10 border-success/20 p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          Valor Total:
                        </span>
                        <span className="text-xl font-bold text-success">
                          {formatCurrency(totalValue)}
                        </span>
                      </div>
                    </Card>

                    {/* Action Buttons */}
                    <div className="space-y-3 mt-4">
                      <Button
                        variant="outline"
                        className="w-full gap-2 bg-violet-500 hover:bg-violet-600 text-white border-violet-500 hover:border-violet-600"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir ROL
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white border-amber-500 hover:border-amber-600"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir Etiqueta
                      </Button>

                      <Button className="w-full gap-2 bg-success hover:bg-success/90">
                        <Check className="w-4 h-4" />
                        Finalizar Lançamento
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conferencia" className="mt-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">Conferência & Divergências</h2>
              </div>
              <p className="text-center text-muted-foreground py-12">
                Nenhuma divergência encontrada no período selecionado
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
