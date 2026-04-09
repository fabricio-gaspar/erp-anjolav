import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { Loader2, DollarSign, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";

export function CaixaResumoCard() {
  const { data: caixa, isLoading } = useCaixaAberto();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!caixa) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            Resumo do Caixa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Badge variant="secondary">Fechado</Badge>
            <p className="text-xs text-muted-foreground mt-2">Nenhum caixa aberto no momento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: "Abertura", value: caixa.valor_abertura, icon: DollarSign, color: "text-muted-foreground" },
    { label: "Vendas", value: caixa.valor_vendas, icon: ArrowUpCircle, color: "text-success" },
    { label: "Sangrias", value: caixa.valor_sangrias, icon: ArrowDownCircle, color: "text-destructive" },
    { label: "Reforços", value: caixa.valor_reforcos, icon: ArrowUpCircle, color: "text-info" },
    { label: "Esperado", value: caixa.valor_esperado, icon: Wallet, color: "text-primary" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            Resumo do Caixa
          </CardTitle>
          <Badge variant="default" className="bg-success text-success-foreground">Aberto</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Operador: {caixa.operador}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                {item.label}
              </span>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
