import { CreditCard, Settings2, Tag } from "lucide-react";
import { ClientePagamento } from "@/components/clientes/ClientePagamento";
import { ClienteTabelaPrecos } from "@/components/clientes/ClienteTabelaPrecos";
import { ClienteConfiguracao } from "@/components/clientes/ClienteConfiguracao";

interface ClienteCondicoesProps {
  clienteId: string | null;
}

const secoes = [
  { id: "pdv-client-prices", label: "Tabela de preços", icon: Tag },
  { id: "pdv-client-payment", label: "Pagamento", icon: CreditCard },
  { id: "pdv-client-operation", label: "Operação e portal", icon: Settings2 },
] as const;

export const ClienteCondicoes = ({ clienteId }: ClienteCondicoesProps) => {
  const navegarPara = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Configuração do cliente</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Condições e operação</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Organize preços, pagamento, faturamento, retirada, entrega e acesso ao portal no mesmo espaço.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Seções de condições e operação">
            {secoes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/5"
                onClick={() => navegarPara(id)}
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section id="pdv-client-prices" className="scroll-mt-24 rounded-xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3 border-b pb-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
          <div>
            <h3 className="text-lg font-bold text-foreground">Tabela de preços</h3>
            <p className="text-sm text-muted-foreground">Defina a tabela aplicada e os preços personalizados deste cliente.</p>
          </div>
        </div>
        <ClienteTabelaPrecos clienteId={clienteId} />
      </section>

      <section id="pdv-client-payment" className="scroll-mt-24 rounded-xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3 border-b pb-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
          <div>
            <h3 className="text-lg font-bold text-foreground">Pagamento e faturamento</h3>
            <p className="text-sm text-muted-foreground">Configure a condição comercial, o método preferido e os padrões fiscais.</p>
          </div>
        </div>
        <ClientePagamento clienteId={clienteId} onBack={() => navegarPara("pdv-client-prices")} onSave={() => undefined} />
      </section>

      <section id="pdv-client-operation" className="scroll-mt-24 rounded-xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3 border-b pb-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
          <div>
            <h3 className="text-lg font-bold text-foreground">Operação e portal</h3>
            <p className="text-sm text-muted-foreground">Defina relatórios, acesso do cliente e a agenda recorrente de retirada e entrega.</p>
          </div>
        </div>
        <ClienteConfiguracao clienteId={clienteId} onSave={() => undefined} />
      </section>
    </div>
  );
};
