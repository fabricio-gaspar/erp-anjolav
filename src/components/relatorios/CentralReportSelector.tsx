import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { canSeeCompanyReport } from "@/lib/companyReportAccess";
import { ConsultaAuditoria } from "@/components/relatorios/ConsultaAuditoria";
import { ConsultaCaixa } from "@/components/relatorios/ConsultaCaixa";
import { ConsultaClientes } from "@/components/relatorios/ConsultaClientes";
import { ConsultaCompras } from "@/components/relatorios/ConsultaCompras";
import { ConsultaContas } from "@/components/relatorios/ConsultaContas";
import { ConsultaEstoque } from "@/components/relatorios/ConsultaEstoque";
import { ConsultaFaturamento } from "@/components/relatorios/ConsultaFaturamento";
import { ConsultaListaDia } from "@/components/relatorios/ConsultaListaDia";
import { ConsultaMovimentosEstoque } from "@/components/relatorios/ConsultaMovimentosEstoque";
import { ConsultaProdutos } from "@/components/relatorios/ConsultaProdutos";
import { ConsultaQuilometragem } from "@/components/relatorios/ConsultaQuilometragem";
import { ConsultaResultadoMensal } from "@/components/relatorios/ConsultaResultadoMensal";
import { ConsultaRols, type RolsReportKind } from "@/components/relatorios/ConsultaRols";
import { ConsultaDelivery } from "@/components/relatorios/ConsultaDelivery";

type ReportOption = {
  value: string;
  label: string;
  allowed: boolean;
  render: () => ReactNode;
};

export function CentralReportSelector() {
  const { activeTenant, security } = useAuth();
  const orders = usePermissaoModulo("ordens");
  const agenda = usePermissaoModulo("agenda");
  const clients = usePermissaoModulo("clientes");
  const products = usePermissaoModulo("produtos");
  const productSales = usePermissaoModulo(["relatorios", "caixa", "faturamento"]);
  const cash = usePermissaoModulo(["caixa", "faturamento"]);
  const billing = usePermissaoModulo("faturamento");
  const receivables = usePermissaoModulo("contas_receber");
  const payables = usePermissaoModulo("contas_pagar");
  const mileage = usePermissaoModulo("relatorios");
  const companyReport = canSeeCompanyReport(activeTenant, security);
  const [selected, setSelected] = useState("rols");

  const options: ReportOption[] = [
    { value: "rols", label: "Todos os ROLs", allowed: orders.allowed, render: () => <ConsultaRols key="rols" selectedKind="rols" /> },
    { value: "a_retirar", label: "ROLs a retirar", allowed: orders.allowed, render: () => <ConsultaRols key="a_retirar" selectedKind="a_retirar" /> },
    { value: "abertos", label: "ROLs não entregues", allowed: orders.allowed, render: () => <ConsultaRols key="abertos" selectedKind="abertos" /> },
    { value: "producao", label: "Produção por prazo", allowed: orders.allowed, render: () => <ConsultaRols key="producao" selectedKind="producao" /> },
    { value: "delivery", label: "Entregas agendadas", allowed: orders.allowed, render: () => <ConsultaDelivery /> },
    { value: "taxas", label: "Taxas de delivery e KM cobrado", allowed: orders.allowed, render: () => <ConsultaRols key="taxas" selectedKind="taxas" /> },
    { value: "lista-dia", label: "Lista do dia", allowed: agenda.allowed, render: () => <ConsultaListaDia /> },
    { value: "clientes", label: "Clientes", allowed: clients.allowed, render: () => <ConsultaClientes /> },
      { value: "produtos", label: "Catálogo de produtos", allowed: productSales.allowed, render: () => <ConsultaProdutos /> },
    { value: "estoque", label: "Estoque", allowed: products.allowed, render: () => <ConsultaEstoque /> },
    { value: "movimentos-estoque", label: "Movimentações de estoque", allowed: products.allowed, render: () => <ConsultaMovimentosEstoque /> },
    { value: "compras", label: "Compras da empresa", allowed: products.allowed, render: () => <ConsultaCompras /> },
    { value: "caixa", label: "Caixa e recebimentos", allowed: cash.allowed, render: () => <ConsultaCaixa /> },
    { value: "faturamento", label: "Clientes a faturar", allowed: billing.allowed, render: () => <ConsultaFaturamento /> },
    { value: "contas", label: "Contas a pagar e receber", allowed: receivables.allowed || payables.allowed, render: () => <ConsultaContas /> },
    { value: "resultado-mensal", label: "Resultado mensal", allowed: companyReport, render: () => <ConsultaResultadoMensal /> },
    { value: "quilometragem", label: "Quilometragem percorrida", allowed: mileage.allowed, render: () => <ConsultaQuilometragem /> },
    { value: "auditoria", label: "Auditoria da empresa", allowed: companyReport, render: () => <ConsultaAuditoria /> },
  ];
  const visibleOptions = options.filter(option => option.allowed);
  const permissionsLoading = [orders, agenda, clients, products, productSales, cash, billing, receivables, payables, mileage].some(permission => permission.isLoading);
  const effectiveSelection = visibleOptions.some(option => option.value === selected)
    ? selected
    : visibleOptions[0]?.value ?? "";

  useEffect(() => {
    if (!permissionsLoading && selected !== effectiveSelection) setSelected(effectiveSelection);
  }, [permissionsLoading, selected, effectiveSelection]);

  const activeOption = visibleOptions.find(option => option.value === effectiveSelection);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Montar consulta</CardTitle>
        <p className="text-sm text-muted-foreground">Escolha o relatório; os filtros e resultados correspondentes aparecem abaixo.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xl space-y-1.5">
          <Label htmlFor="central-report-type">O que consultar</Label>
          <select
            id="central-report-type"
            value={effectiveSelection}
            disabled={permissionsLoading || visibleOptions.length === 0}
            onChange={event => setSelected(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            {visibleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {permissionsLoading ? (
          <p role="status" className="border-t pt-4 text-sm text-muted-foreground">Carregando relatórios disponíveis…</p>
        ) : activeOption ? (
          <div key={activeOption.value} className="border-t pt-4">{activeOption.render()}</div>
        ) : (
          <p className="border-t pt-4 text-sm text-muted-foreground">Nenhum relatório está disponível para este perfil.</p>
        )}
      </CardContent>
    </Card>
  );
}

export type { RolsReportKind };
