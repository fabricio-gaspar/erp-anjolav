import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import ContasPagarContent from "@/components/contas/ContasPagarContent";
import ContasReceberContent from "@/components/contas/ContasReceberContent";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";

const Contas = () => {
  const location = useLocation();
  const receber = usePermissaoModulo("contas_receber");
  const pagar = usePermissaoModulo("contas_pagar");
  const isAdminPath = location.pathname.startsWith("/admin/");
  const isLegacyRoute = ["/central/contas", "/admin/financeiro/contas"].includes(location.pathname);

  if (isLegacyRoute) {
    if (receber.isLoading || pagar.isLoading) {
      return (
        <AppLayout title="Contas financeiras">
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando acesso financeiro…
          </div>
        </AppLayout>
      );
    }

    if (receber.isError || pagar.isError) {
      return (
        <AppLayout title="Contas financeiras">
          <div role="alert" className="page-shell rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
            Não foi possível validar suas permissões financeiras. Atualize a página ou tente novamente mais tarde.
          </div>
        </AppLayout>
      );
    }

    const requested = new URLSearchParams(location.search).get("tab");
    const preferred = requested === "pagar" ? "pagar" : requested === "receber" ? "receber" : null;
    const destination = preferred === "pagar" && pagar.allowed
      ? "pagar"
      : preferred === "receber" && receber.allowed
        ? "receber"
        : receber.allowed
          ? "receber"
          : pagar.allowed
            ? "pagar"
            : null;

    if (!destination) {
      return (
        <AppLayout title="Contas financeiras">
          <div role="alert" className="page-shell rounded-lg border bg-card p-5 text-sm text-muted-foreground">
            Seu usuário não possui acesso a contas a receber nem a contas a pagar.
          </div>
        </AppLayout>
      );
    }

    const query = new URLSearchParams(location.search);
    query.delete("tab");
    const base = isAdminPath ? "/admin/financeiro/contas" : "/central/contas";
    const search = query.toString();
    return (
      <Navigate
        replace
        to={`${base}-${destination}${search ? `?${search}` : ""}`}
      />
    );
  }

  const isPayable = location.pathname.endsWith("/contas-pagar");
  const title = isPayable ? "Contas a pagar" : "Contas a receber";
  const subtitle = isPayable
    ? "Obrigações, vencimentos e pagamentos a fornecedores"
    : "Cobranças, faturas e recebimentos de clientes";

  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="page-shell">
        <PageHeader
          eyebrow="Gestão financeira"
          title={title}
          description={subtitle}
        />
        <div className="content-panel min-w-0">
          {isPayable ? <ContasPagarContent /> : <ContasReceberContent />}
        </div>
      </div>
    </AppLayout>
  );
};

export default Contas;
