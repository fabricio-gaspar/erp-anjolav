import { ShieldCheck } from "lucide-react";
import { AdministracaoSaas } from "@/components/configuracoes/AdministracaoSaas";
import { AppLayout } from "@/components/layout/AppLayout";

export default function AdministracaoSaasPage() {
  return (
    <AppLayout title="Administração SaaS" subtitle="Planos, empresas e ciclo de vida da plataforma">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Plataforma</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Administração SaaS</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Controle interno de empresas e limites contratados. Cobranças e integrações externas permanecem fora desta área.
            </p>
          </div>
        </header>
        <AdministracaoSaas />
      </div>
    </AppLayout>
  );
}
