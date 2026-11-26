import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { CentralReportSelector } from "@/components/relatorios/CentralReportSelector";

export default function AdminReportsHub() {
  return <AppLayout title="Central de relatórios" subtitle="Consultas e análises da empresa"><div className="page-shell space-y-4">
    <PageHeader eyebrow="Relatórios" title="Central de relatórios" description="Consulte os dados por assunto, período e operação, conforme suas permissões." />
    <CentralReportSelector />
  </div></AppLayout>;
}
