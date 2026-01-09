import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Plus, ShoppingCart, ArrowRight, Search } from "lucide-react";

interface LancamentoItem {
  id: string;
  produto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

const Lancamentos = () => {
  const [items, setItems] = useState<LancamentoItem[]>([]);
  const [dataEmissao, setDataEmissao] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dataEntrega, setDataEntrega] = useState(
    new Date().toISOString().split("T")[0]
  );

  const totalValue = items.reduce((sum, item) => sum + item.valorTotal, 0);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
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

        <Tabs defaultValue="novo" className="w-full">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="novo" className="gap-2">
              <Calendar className="w-4 h-4" />
              Novo Lançamento
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="gap-2">
              <Search className="w-4 h-4" />
              Conferência & Divergências
            </TabsTrigger>
          </TabsList>

          <TabsContent value="novo" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel - Form */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">Novo Lançamento</h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Data de Emissão
                      </Label>
                      <Input
                        type="date"
                        value={dataEmissao}
                        onChange={(e) => setDataEmissao(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        Data de Entrega
                      </Label>
                      <Input
                        type="date"
                        value={dataEntrega}
                        onChange={(e) => setDataEntrega(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Observação / Informação
                    </Label>
                    <Textarea
                      placeholder="Ex: Entregar até sexta, Roupa de cama extra..."
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Cliente</Label>
                    <div className="relative mt-1">
                      <Input placeholder="Buscar por nome, CNPJ, telefone, cidade..." />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Produto/Serviço
                    </Label>
                    <Select>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="toalha">Toalha</SelectItem>
                        <SelectItem value="lencol">Lençol</SelectItem>
                        <SelectItem value="cobertor">Cobertor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Quantidade (un)
                    </Label>
                    <Input type="number" placeholder="0" className="mt-1" />
                  </div>

                  <Button className="w-full gap-2 bg-primary/80 hover:bg-primary">
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </Button>
                </div>
              </div>

              {/* Right Panel - Items */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-6">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold text-lg">Itens do Lançamento</h2>
                </div>

                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm">Selecione um cliente para começar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{item.produto}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantidade} × R$ {item.valorUnitario.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-semibold currency">
                          R$ {item.valorTotal.toFixed(2)}
                        </span>
                      </div>
                    ))}

                    <div className="pt-4 border-t mt-4">
                      <div className="flex justify-between items-baseline">
                        <span className="font-medium">Total:</span>
                        <span className="text-2xl font-bold text-primary currency">
                          R$ {totalValue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="conferencia" className="mt-6">
            <div className="bg-card border rounded-lg p-6">
              <p className="text-center text-muted-foreground py-12">
                Nenhuma divergência encontrada no período selecionado
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
