import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRelatorioMensal } from "@/hooks/useRelatorioMensal";
import { downloadCsv } from "@/lib/csvExport";
import { canSeeCompanyReport } from "@/lib/companyReportAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ResultadoMensal() {
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selected, setSelected] = useState<string | null>(null);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const report = useRelatorioMensal(parseISO(`${selected || format(new Date(), "yyyy-MM")}-01`), "todos", Boolean(selected));
  const data = report.data;
  const rows = data ? [
    { label: "Faturas recebidas", amount: data.receitasFaturas },
    { label: "Vendas registradas no caixa", amount: data.receitasLoja },
    { label: "Total de receitas", amount: data.receitasTotais },
    { label: "Salários da folha", amount: data.despesasFolha },
    { label: "Benefícios da folha", amount: data.despesasBeneficiosExtras },
    { label: "Produtos e insumos", amount: data.despesasProdutos },
    { label: "Contas mensais", amount: data.despesasContasMensais },
    { label: "Impostos", amount: data.despesasImpostos },
    { label: "Outras despesas", amount: data.despesasOutras },
    { label: "Total de despesas", amount: data.despesasTotais },
    { label: "Diferença gerencial", amount: data.lucro },
  ] : [];
  return <div className="space-y-4 border-t p-5">
    <p className="text-sm text-muted-foreground">Consolidado da empresa, incluindo as duas operações. Receitas usam faturas recebidas e vendas do caixa; despesas usam contas pelo vencimento e folha pela competência. A diferença é gerencial e não substitui o lucro contábil.</p>
    <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="central-month">Mês de referência</Label><Input id="central-month" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div><Button disabled={!valid} onClick={() => setSelected(month)}>Consultar resultado</Button><Button variant="outline" disabled={!data || report.isFetching || report.isError} onClick={() => downloadCsv(`resultado-mensal-${selected}.csv`, rows, [{header:"Indicador", value:r=>r.label},{header:"Valor (R$)", value:r=>r.amount}])}>Exportar resumo CSV</Button></div>
    {report.isFetching && <p role="status">Carregando resultado…</p>}
    {report.isError && <p role="alert" className="text-destructive">Não foi possível totalizar o mês com segurança. Verifique os dados e tente novamente.</p>}
    {data && !report.isFetching && !report.isError && <><div className="grid gap-3 sm:grid-cols-3">{[{label:"Receitas",value:data.receitasTotais},{label:"Despesas",value:data.despesasTotais},{label:"Diferença gerencial",value:data.lucro}].map(item => <div className="rounded-md border bg-muted/20 p-3" key={item.label}><p className="text-sm text-muted-foreground">{item.label}</p><p className="text-lg font-semibold">{money(item.value)}</p></div>)}</div><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2">Composição</th><th className="px-3 py-2 text-right">Valor</th></tr></thead><tbody>{rows.map(row => <tr className="border-t" key={row.label}><td className="px-3 py-2">{row.label}</td><td className="px-3 py-2 text-right">{money(row.amount)}</td></tr>)}</tbody></table></div>
      <details><summary className="cursor-pointer text-sm font-medium">Detalhes de contas e folha</summary><div className="mt-3 space-y-4"><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2">Conta</th><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2 text-right">Valor</th></tr></thead><tbody>{data.contasItens.map(row=><tr className="border-t" key={row.id}><td className="px-3 py-2">{row.descricao} · {row.fornecedor}</td><td className="px-3 py-2">{row.vencimento.split("-").reverse().join("/")}</td><td className="px-3 py-2">{row.status}</td><td className="px-3 py-2 text-right">{money(row.valor)}</td></tr>)}</tbody></table>{!data.contasItens.length && <p className="p-3 text-sm">Nenhuma conta no período.</p>}</div><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2">Funcionário</th><th className="px-3 py-2">Cargo</th><th className="px-3 py-2 text-right">Valor operacional</th></tr></thead><tbody>{data.folhaItens.map((row,i)=><tr className="border-t" key={`${row.funcionario}-${i}`}><td className="px-3 py-2">{row.funcionario}</td><td className="px-3 py-2">{row.cargo}</td><td className="px-3 py-2 text-right">{money(row.custoTotal)}</td></tr>)}</tbody></table>{!data.folhaItens.length && <p className="p-3 text-sm">Nenhuma folha no período.</p>}</div></div></details></>}
  </div>;
}

export function ConsultaResultadoMensal() {
  const { activeTenant, security } = useAuth();
  if (!canSeeCompanyReport(activeTenant, security)) return null;
  return <details open className="rounded-lg border bg-card text-card-foreground"><summary className="cursor-pointer px-5 py-4 font-semibold">Resultado mensal da empresa</summary><ResultadoMensal /></details>;
}
