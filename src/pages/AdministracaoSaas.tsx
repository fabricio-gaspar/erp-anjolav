import { AdministracaoSaas } from "@/components/configuracoes/AdministracaoSaas";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AdministracaoSaasPage() {
  return (
    <AppLayout title="Empresas e planos" subtitle="Empresas, assinaturas e limites da plataforma">
      <div className="page-shell mx-auto max-w-7xl">
        <PageHeader
          eyebrow="Plataforma"
          title="Empresas e planos"
          description="Controle interno de empresas e limites contratados. Cobranças e integrações externas permanecem fora desta área."
        />
        <AdministracaoSaas />
      </div>
    </AppLayout>
  );
}
