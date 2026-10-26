import { Droplets, ShieldCheck, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}

export function AuthShell({ children, title, subtitle, badge }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <div className="grid min-h-screen lg:grid-cols-[minmax(320px,38%)_1fr]">
        {/* Left Aside - Desktop Only */}
        <aside className="hidden flex-col justify-between bg-gradient-to-br from-[#F1F0FE] via-[#FDFCFA] to-[#EBF5FE] px-10 py-12 text-foreground lg:flex xl:px-16">
          <div className="space-y-12">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/20">
                <Droplets className="h-6 w-6 text-primary-foreground" />
              </span>
              <div>
                <p className="text-xl font-bold tracking-tight text-foreground">AnjoLav ERP</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Gestão integrada de lavanderias</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="max-w-md pt-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Ambiente Operacional</p>
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl text-foreground">
                Central, Industrial e Residencial em uma plataforma segura.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
                Cada operação mantém seu próprio contexto de trabalho, com visão consolidada reservada ao Painel Central.
              </p>

              {/* Checkmarks */}
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-success" />
                  <span className="text-sm text-foreground">Navegação separada por operação</span>
                </div>
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-success" />
                  <span className="text-sm text-foreground">Dados reais e rastreáveis</span>
                </div>
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-success" />
                  <span className="text-sm text-foreground">Acesso controlado por permissões</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Badge */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            <span>Acesso privado e protegido</span>
          </div>
        </aside>

        {/* Right Section - Login Form */}
        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo Only */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Droplets className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-foreground">AnjoLav ERP</p>
                <p className="text-[10px] text-muted-foreground font-medium">Gestão integrada de lavanderias</p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-8">
              {badge && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary mb-2">
                  {badge}
                </p>
              )}
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {subtitle}
              </p>
            </div>

            {/* Card Content */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
              {children}
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} AnjoLav. Todos os direitos reservados.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
