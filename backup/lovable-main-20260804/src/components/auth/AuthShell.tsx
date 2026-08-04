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
    <main className="min-h-screen bg-slate-100 text-slate-950 font-sans">
      <div className="grid min-h-screen lg:grid-cols-[minmax(320px,38%)_1fr]">
        {/* Left Aside - Desktop Only */}
        <aside className="hidden flex-col justify-between bg-[#0b1f33] px-10 py-12 text-white lg:flex xl:px-16">
          <div className="space-y-12">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500 shadow-lg shadow-sky-500/20">
                <Droplets className="h-6 w-6 text-white" />
              </span>
              <div>
                <p className="text-xl font-bold tracking-tight text-white">AnjoLav ERP</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">Gestão integrada de lavanderias</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="max-w-md pt-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Ambiente Operacional</p>
              <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl text-white">
                Central, Industrial e Residencial em uma plataforma segura.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
                Cada operação mantém seu próprio contexto de trabalho, com visão consolidada reservada ao Painel Central.
              </p>

              {/* Checkmarks */}
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-slate-200">Navegação separada por operação</span>
                </div>
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-slate-200">Dados reais e rastreáveis</span>
                </div>
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-slate-200">Acesso controlado por permissões</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Acesso privado e protegido</span>
          </div>
        </aside>

        {/* Right Section - Login Form */}
        <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo Only */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-white shadow-lg shadow-sky-500/20">
                <Droplets className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold text-slate-900">AnjoLav ERP</p>
                <p className="text-[10px] text-slate-500 font-medium">Gestão integrada de lavanderias</p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-8">
              {badge && (
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary mb-2">
                  {badge}
                </p>
              )}
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {subtitle}
              </p>
            </div>

            {/* Card Content */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {children}
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-[11px] text-slate-400">
              © {new Date().getFullYear()} AnjoLav. Todos os direitos reservados.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
