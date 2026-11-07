import { CircleCheck, ShieldCheck, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}

export function AuthShell({ children, title, subtitle, badge }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#062443] font-sans text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(460px,1.2fr)_minmax(420px,0.8fr)]">
        {/* Left Aside - Desktop Only */}
        <aside className="hidden flex-col justify-between border-r border-white/10 bg-[radial-gradient(circle_at_18%_15%,rgba(25,127,195,0.34),transparent_32%),linear-gradient(145deg,#04192f,#08395d)] px-10 py-12 lg:flex xl:px-16">
          <div className="space-y-16">
            {/* Logo Section */}
            <div className="flex items-center gap-3 text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 shadow-md shadow-slate-950/20">
                <Shirt className="h-6 w-6 text-emerald-300" />
              </span>
              <div>
                <p className="text-2xl font-black tracking-[-0.05em]">Anjo<span className="text-emerald-300">Lav</span></p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a9d8f2]">Gestão para lavanderias</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="max-w-xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#79c9ef]">Ambiente operacional</p>
              <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-[-0.045em] text-white xl:text-5xl">
                O cuidado que suas roupas merecem. A gestão que sua lavanderia precisa.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate-200">
                Acesse as rotinas autorizadas para atendimento, produção e operação, com dados reais e rastreáveis.
              </p>

              {/* Checkmarks */}
              <div className="mt-10 space-y-4">
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-emerald-300" />
                  <span className="text-sm text-slate-100">Navegação separada por operação</span>
                </div>
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-emerald-300" />
                  <span className="text-sm text-slate-100">Dados reais e rastreáveis</span>
                </div>
                <div className="flex items-center gap-3">
                  <CircleCheck className="h-5 w-5 text-emerald-300" />
                  <span className="text-sm text-slate-100">Acesso controlado por permissões</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Badge */}
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            <span>Acesso privado e protegido por permissões</span>
          </div>
        </aside>

        {/* Right Section - Login Form */}
        <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_100%_0%,rgba(19,110,170,0.28),transparent_30%)] px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo Only */}
            <div className="mb-10 flex items-center gap-3 text-white lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10">
                <Shirt className="h-5 w-5 text-emerald-300" />
              </span>
              <div>
                <p className="font-black tracking-[-0.04em]">Anjo<span className="text-emerald-300">Lav</span></p>
                <p className="text-[10px] font-medium text-slate-300">Gestão para lavanderias</p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-7 text-white">
              {badge && (
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#81cff4]">
                  {badge}
                </p>
              )}
              <h2 className="text-3xl font-black tracking-[-0.045em] text-white">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {subtitle}
              </p>
            </div>

            {/* Card Content */}
            <div className="rounded-xl border border-white/20 bg-white p-6 text-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:p-8">
              {children}
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-[11px] text-slate-300">
              © {new Date().getFullYear()} AnjoLav. Todos os direitos reservados.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
