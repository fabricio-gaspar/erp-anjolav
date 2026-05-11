import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, TrendingUp, TrendingDown, Wallet, Users } from "lucide-react";
import { useRelatorioMensal, type SetorRelatorio } from "@/hooks/useRelatorioMensal";
import { formatNumberToCurrency } from "@/lib/currencyUtils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const RelatorioMensal = () => {
  const today = new Date();
  const [mes, setMes] = useState(format(today, "yyyy-MM"));
  const [setor, setSetor] = useState<SetorRelatorio>("todos");

  const mesRef = parseISO(`${mes}-01`);
  const { data, isLoading } = useRelatorioMensal(mesRef, setor);

  const exportCSV = () => {
    if (!data) return;
    const lines: string[] = [];
    lines.push(`Relatório Mensal — ${format(mesRef, "MMMM 'de' yyyy", { locale: ptBR })}`);
    lines.push(`Setor: ${setor}`);
    lines.push("");
    lines.push("RECEITAS");
    lines.push(`Faturas Pagas;${data.receitasFaturasCount};R$ ${formatNumberToCurrency(data.receitasFaturas)}`);
    lines.push(`Vendas Loja (Caixa);${data.receitasLojaCount};R$ ${formatNumberToCurrency(data.receitasLoja)}`);
    lines.push(`Total Receitas;;R$ ${formatNumberToCurrency(data.receitasTotais)}`);
    lines.push("");
    lines.push("DESPESAS");
    lines.push(`Folha de Funcionários;;R$ ${formatNumberToCurrency(data.despesasFolha)}`);
    lines.push(`Produtos / Insumos;;R$ ${formatNumberToCurrency(data.despesasProdutos)}`);
    lines.push(`Contas Mensais;;R$ ${formatNumberToCurrency(data.despesasContasMensais)}`);
    lines.push(`Impostos;;R$ ${formatNumberToCurrency(data.despesasImpostos)}`);
    lines.push(`Outras;;R$ ${formatNumberToCurrency(data.despesasOutras)}`);
    lines.push(`Total Despesas;;R$ ${formatNumberToCurrency(data.despesasTotais)}`);
    lines.push("");
    lines.push(`LUCRO LÍQUIDO;;R$ ${formatNumberToCurrency(data.lucro)}`);
    lines.push(`MARGEM;;${data.margem.toFixed(2)}%`);

    lines.push("");
    lines.push("DETALHE FOLHA");
    lines.push("Funcionário;Cargo;Salário+Comissão;Benefícios;Descontos;Líquido;Custo Total");
    data.folhaItens.forEach((f) => {
      lines.push(
        `${f.funcionario};${f.cargo};${formatNumberToCurrency(f.salario)};${formatNumberToCurrency(f.beneficios)};${formatNumberToCurrency(f.descontos)};${formatNumberToCurrency(f.liquido)};${formatNumberToCurrency(f.custoTotal)}`,
      );
    });

    lines.push("");
    lines.push("DETALHE CONTAS A PAGAR");
    lines.push("Descrição;Fornecedor;Categoria;Valor;Vencimento;Status");
    data.contasItens.forEach((c) => {
      lines.push(
        `${c.descricao};${c.fornecedor};${c.categoria};${formatNumberToCurrency(c.valor)};${c.vencimento};${c.status}`,
      );
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-mensal-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Relatório Mensal" subtitle="Despesas, faturamento e lucro do mês">
      <div className="content-panel space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Mês de Referência</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={setor} onValueChange={(v) => setSetor(v as SetorRelatorio)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="loja">Loja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportCSV} disabled={!data}>
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        </Card>

        {isLoading || !data ? (
          <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        ) : (
          <>
            {/* Cards resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">FATURAMENTO</span>
                </div>
                <div className="text-2xl font-bold mt-1">R$ {formatNumberToCurrency(data.receitasTotais)}</div>
              </Card>
              <Card className="p-4 bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-medium">DESPESAS</span>
                </div>
                <div className="text-2xl font-bold mt-1">R$ {formatNumberToCurrency(data.despesasTotais)}</div>
              </Card>
              <Card className={`p-4 ${data.lucro >= 0 ? "bg-blue-50 dark:bg-blue-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs font-medium">{data.lucro >= 0 ? "LUCRO" : "PREJUÍZO"}</span>
                </div>
                <div className="text-2xl font-bold mt-1">R$ {formatNumberToCurrency(Math.abs(data.lucro))}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs font-medium text-muted-foreground">MARGEM</div>
                <div className="text-2xl font-bold mt-1">{data.margem.toFixed(2)}%</div>
              </Card>
            </div>

            {/* Receitas */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" />Receitas</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Faturas Pagas (Industrial)</TableCell>
                    <TableCell className="text-center">{data.receitasFaturasCount}</TableCell>
                    <TableCell className="text-right">R$ {formatNumberToCurrency(data.receitasFaturas)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Vendas Loja (Caixa)</TableCell>
                    <TableCell className="text-center">{data.receitasLojaCount}</TableCell>
                    <TableCell className="text-right">R$ {formatNumberToCurrency(data.receitasLoja)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">R$ {formatNumberToCurrency(data.receitasTotais)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>

            {/* Despesas - Folha */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-orange-600" />Folha de Funcionários — R$ {formatNumberToCurrency(data.despesasFolha)}</h3>
              {data.folhaPorEmpregador && data.folhaPorEmpregador.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  {data.folhaPorEmpregador.map((e) => (
                    <Card key={e.cnpj || e.nome} className="p-2 bg-muted/30">
                      <div className="text-xs text-muted-foreground">{e.nome} {e.cnpj && `— ${e.cnpj}`}</div>
                      <div className="text-sm font-bold">R$ {formatNumberToCurrency(e.total)} <span className="text-xs font-normal text-muted-foreground">({e.count} func.)</span></div>
                    </Card>
                  ))}
                </div>
              )}
              {data.folhaItens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum lançamento de folha neste mês. Gere a folha em Configurações → Equipe → Folha de Pagamento.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Salário</TableHead>
                      <TableHead className="text-right">Benefícios</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.folhaItens.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{f.funcionario}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.cargo}</TableCell>
                        <TableCell className="text-right">R$ {formatNumberToCurrency(f.salario)}</TableCell>
                        <TableCell className="text-right">R$ {formatNumberToCurrency(f.beneficios)}</TableCell>
                        <TableCell className="text-right text-destructive">R$ {formatNumberToCurrency(f.descontos)}</TableCell>
                        <TableCell className="text-right font-semibold">R$ {formatNumberToCurrency(f.liquido)}</TableCell>
                        <TableCell className="text-right font-bold">R$ {formatNumberToCurrency(f.custoTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            {/* Despesas - Outras */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-600" />Despesas Operacionais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card className="p-3"><div className="text-xs text-muted-foreground">Produtos / Insumos</div><div className="text-lg font-bold">R$ {formatNumberToCurrency(data.despesasProdutos)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Contas Mensais</div><div className="text-lg font-bold">R$ {formatNumberToCurrency(data.despesasContasMensais)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Impostos</div><div className="text-lg font-bold">R$ {formatNumberToCurrency(data.despesasImpostos)}</div></Card>
                <Card className="p-3"><div className="text-xs text-muted-foreground">Outras</div><div className="text-lg font-bold">R$ {formatNumberToCurrency(data.despesasOutras)}</div></Card>
              </div>
              {data.contasItens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta a pagar registrada para este mês.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contasItens.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.descricao}</TableCell>
                        <TableCell>{c.fornecedor}</TableCell>
                        <TableCell><Badge variant="outline">{c.categoria}</Badge></TableCell>
                        <TableCell>{format(parseISO(c.vencimento), "dd/MM/yyyy")}</TableCell>
                        <TableCell><Badge variant={c.status === "pago" ? "secondary" : "outline"}>{c.status}</Badge></TableCell>
                        <TableCell className="text-right">R$ {formatNumberToCurrency(c.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            {/* Benefícios extras da folha */}
            {data.beneficiosExtrasItens.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                  Benefícios Extras da Folha
                  <Badge variant="outline" className="ml-2">Total: R$ {formatNumberToCurrency(data.despesasBeneficiosExtras)}</Badge>
                </h3>
                {data.beneficiosExtrasPorCategoria.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {data.beneficiosExtrasPorCategoria.map((cat) => (
                      <Card key={cat.categoria} className="p-3">
                        <div className="text-xs text-muted-foreground">{cat.categoria} ({cat.count})</div>
                        <div className={`text-lg font-bold ${cat.total < 0 ? "text-destructive" : ""}`}>
                          R$ {formatNumberToCurrency(cat.total)}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Empregador</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.beneficiosExtrasItens.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{b.funcionario}</TableCell>
                        <TableCell className="text-xs">{b.empregador}</TableCell>
                        <TableCell>{b.nome}</TableCell>
                        <TableCell><Badge variant="outline">{b.categoria}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={b.tipo === "desconto" ? "destructive" : "secondary"}>
                            {b.tipo === "desconto" ? "Desconto" : "Benefício"}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right ${b.tipo === "desconto" ? "text-destructive" : ""}`}>
                          {b.tipo === "desconto" ? "-" : "+"} R$ {formatNumberToCurrency(b.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10">
              <h3 className="font-semibold mb-3">Resultado Final</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Faturamento</span><span className="font-mono">R$ {formatNumberToCurrency(data.receitasTotais)}</span></div>
                <div className="flex justify-between text-destructive"><span>(-) Folha de Funcionários</span><span className="font-mono">R$ {formatNumberToCurrency(data.despesasFolha)}</span></div>
                <div className="flex justify-between text-destructive"><span>(-) Produtos / Insumos</span><span className="font-mono">R$ {formatNumberToCurrency(data.despesasProdutos)}</span></div>
                <div className="flex justify-between text-destructive"><span>(-) Contas Mensais</span><span className="font-mono">R$ {formatNumberToCurrency(data.despesasContasMensais)}</span></div>
                <div className="flex justify-between text-destructive"><span>(-) Impostos</span><span className="font-mono">R$ {formatNumberToCurrency(data.despesasImpostos)}</span></div>
                <div className="flex justify-between text-destructive"><span>(-) Outras Despesas</span><span className="font-mono">R$ {formatNumberToCurrency(data.despesasOutras)}</span></div>
                <div className="flex justify-between text-destructive"><span>(-) Benefícios Extras Folha</span><span className="font-mono">R$ {formatNumberToCurrency(data.despesasBeneficiosExtras)}</span></div>
                <div className="border-t-2 border-primary pt-2 mt-2 flex justify-between text-lg font-bold">
                  <span>= Lucro Líquido</span>
                  <span className={`font-mono ${data.lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}>R$ {formatNumberToCurrency(data.lucro)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Margem</span>
                  <span className="font-mono">{data.margem.toFixed(2)}%</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default RelatorioMensal;
