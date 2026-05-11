import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Play, Lock, Trash2 } from "lucide-react";
import {
  useFolhaPagamento,
  useGerarFolhaMes,
  useFecharFolhaMes,
  useUpdateFolha,
  useDeleteFolha,
} from "@/hooks/useFolhaPagamento";
import {
  formatCurrencyInput,
  parseCurrencyToNumber,
  formatNumberToCurrency,
} from "@/lib/currencyUtils";
import { format } from "date-fns";

export function FolhaPagamentoTab() {
  const today = new Date();
  const [mes, setMes] = useState(format(today, "yyyy-MM"));
  const competencia = `${mes}-01`;
  const [dataPagamento, setDataPagamento] = useState(format(today, "yyyy-MM-dd"));
  const [showFechar, setShowFechar] = useState(false);
  const [empregadorFiltro, setEmpregadorFiltro] = useState<string>("todos");

  const { data: folhasAll = [], isLoading } = useFolhaPagamento(competencia);
  const gerar = useGerarFolhaMes();
  const fechar = useFecharFolhaMes();
  const update = useUpdateFolha();
  const del = useDeleteFolha();

  const empregadores = Array.from(
    new Set(folhasAll.map((f) => f.funcionario?.empregador_cnpj).filter(Boolean))
  ) as string[];
  const folhas = empregadorFiltro === "todos"
    ? folhasAll
    : folhasAll.filter((f) => f.funcionario?.empregador_cnpj === empregadorFiltro);

  const totalProventos = folhas.reduce((s, f) => s + Number(f.total_proventos || 0), 0);
  const totalDescontos = folhas.reduce((s, f) => s + Number(f.total_descontos || 0), 0);
  const totalLiquido = folhas.reduce((s, f) => s + Number(f.liquido || 0), 0);
  const totalCusto = folhas.reduce((s, f) => s + Number(f.custo_total_empresa || 0), 0);

  const updateField = (id: string, field: string, raw: string) => {
    const valor = parseCurrencyToNumber(formatCurrencyInput(raw));
    const f = folhas.find((x) => x.id === id);
    if (!f) return;
    update.mutate({ ...f, [field]: valor, id } as any);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Competência</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          {empregadores.length > 0 && (
            <div>
              <Label>Empregador (CNPJ)</Label>
              <select
                className="border rounded h-10 px-2 bg-background text-sm"
                value={empregadorFiltro}
                onChange={(e) => setEmpregadorFiltro(e.target.value)}
              >
                <option value="todos">Todos</option>
                {empregadores.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => gerar.mutate(competencia)}
            disabled={gerar.isPending}
          >
            {gerar.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Gerar Folha do Mês
          </Button>
          <Button
            variant="default"
            onClick={() => setShowFechar(true)}
            disabled={folhas.filter((f) => f.status === "aberto").length === 0}
          >
            <Lock className="w-4 h-4 mr-2" />
            Fechar Folha (lança em Contas a Pagar)
          </Button>
        </div>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Proventos</div>
          <div className="text-lg font-bold">R$ {formatNumberToCurrency(totalProventos)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Descontos</div>
          <div className="text-lg font-bold text-destructive">R$ {formatNumberToCurrency(totalDescontos)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Líquido a Pagar</div>
          <div className="text-lg font-bold text-primary">R$ {formatNumberToCurrency(totalLiquido)}</div>
        </Card>
        <Card className="p-3 bg-orange-50 dark:bg-orange-950/20">
          <div className="text-xs text-muted-foreground">Custo Total Empresa</div>
          <div className="text-lg font-bold">R$ {formatNumberToCurrency(totalCusto)}</div>
        </Card>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : folhas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma folha para esta competência. Clique em "Gerar Folha do Mês".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>H. Extras</TableHead>
                  <TableHead>Comissões</TableHead>
                  <TableHead>Benefícios</TableHead>
                  <TableHead>Descontos</TableHead>
                  <TableHead>Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folhas.map((f) => {
                  const beneficios =
                    Number(f.vale_transporte || 0) +
                    Number(f.vale_alimentacao || 0) +
                    Number(f.vale_refeicao || 0) +
                    Number(f.plano_saude || 0) +
                    Number(f.plano_odontologico || 0);
                  const isAberto = f.status === "aberto";
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium">{f.funcionario?.nome}</div>
                        <div className="text-xs text-muted-foreground">{f.funcionario?.cargo}</div>
                        {f.funcionario?.empregador_cnpj && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {f.funcionario.empregador_nome || f.funcionario.empregador_cnpj}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>R$ {formatNumberToCurrency(Number(f.salario_base))}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {Number(f.horas_extras_50 || 0) > 0 && <div>50%: R$ {formatNumberToCurrency(Number(f.horas_extras_50))}</div>}
                          {Number(f.horas_extras_70 || 0) > 0 && <div>70%: R$ {formatNumberToCurrency(Number(f.horas_extras_70))}</div>}
                          {Number(f.horas_extras_100 || 0) > 0 && <div>100%: R$ {formatNumberToCurrency(Number(f.horas_extras_100))}</div>}
                          {Number(f.reflexo_dsr || 0) > 0 && <div className="text-muted-foreground">DSR: R$ {formatNumberToCurrency(Number(f.reflexo_dsr))}</div>}
                          {Number(f.horas_extras || 0) > 0 && <div>Outras: R$ {formatNumberToCurrency(Number(f.horas_extras))}</div>}
                          {!Number(f.horas_extras_50) && !Number(f.horas_extras_70) && !Number(f.horas_extras_100) && !Number(f.horas_extras) && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAberto ? (
                          <Input
                            className="w-24 h-8"
                            defaultValue={formatNumberToCurrency(Number(f.comissoes))}
                            onBlur={(e) => updateField(f.id, "comissoes", e.target.value)}
                          />
                        ) : (
                          `R$ ${formatNumberToCurrency(Number(f.comissoes))}`
                        )}
                      </TableCell>
                      <TableCell>R$ {formatNumberToCurrency(beneficios)}</TableCell>
                      <TableCell className="text-destructive">R$ {formatNumberToCurrency(Number(f.total_descontos))}</TableCell>
                      <TableCell className="font-semibold">R$ {formatNumberToCurrency(Number(f.liquido))}</TableCell>
                      <TableCell>
                        <Badge variant={isAberto ? "outline" : "secondary"}>{f.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {isAberto && (
                          <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={showFechar} onOpenChange={setShowFechar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar folha de {mes}?</AlertDialogTitle>
            <AlertDialogDescription>
              Será criada uma conta a pagar (categoria "folha_pagamento") por funcionário em aberto, com vencimento na data informada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Data de Pagamento</Label>
            <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await fechar.mutateAsync({ competencia, dataPagamento });
                setShowFechar(false);
              }}
            >
              Confirmar Fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
