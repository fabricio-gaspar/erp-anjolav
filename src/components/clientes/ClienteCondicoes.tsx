import { ClientePagamento } from "@/components/clientes/ClientePagamento";
import { ClienteTabelaPrecos } from "@/components/clientes/ClienteTabelaPrecos";
import { ClienteConfiguracao } from "@/components/clientes/ClienteConfiguracao";

interface ClienteCondicoesProps {
  clienteId: string | null;
}

export const ClienteCondicoes = ({ clienteId }: ClienteCondicoesProps) => {
  return (
    <div className="pdv-client-form pdv-client-conditions space-y-5">
      <div className="pdv-client-form-heading">
        <h2>Condições e operação</h2>
        <span>Configure preços, pagamento, faturamento, retirada, entrega e portal.</span>
      </div>

      <section id="pdv-client-prices" className="pdv-client-form__identity surface-panel overflow-hidden scroll-mt-24">
        <div className="flex items-start gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
          <div>
            <h3 className="text-lg font-bold text-foreground">Tabela de preços</h3>
            <p className="text-sm text-muted-foreground">Defina a tabela aplicada e os preços personalizados deste cliente.</p>
          </div>
        </div>
        <div className="p-4 sm:p-5"><ClienteTabelaPrecos clienteId={clienteId} /></div>
      </section>

      <section id="pdv-client-payment" className="pdv-client-form__contact surface-panel overflow-hidden scroll-mt-24">
        <div className="flex items-start gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
          <div>
            <h3 className="text-lg font-bold text-foreground">Pagamento e faturamento</h3>
            <p className="text-sm text-muted-foreground">Configure a condição comercial, o método preferido e os padrões fiscais.</p>
          </div>
        </div>
        <div className="p-4 sm:p-5"><ClientePagamento clienteId={clienteId} onBack={() => document.getElementById("pdv-client-prices")?.scrollIntoView({ behavior: "smooth", block: "start" })} onSave={() => undefined} /></div>
      </section>

      <section id="pdv-client-operation" className="pdv-client-form__details surface-panel overflow-hidden scroll-mt-24">
        <div className="flex items-start gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
          <div>
            <h3 className="text-lg font-bold text-foreground">Operação e portal</h3>
            <p className="text-sm text-muted-foreground">Defina relatórios, acesso do cliente e a agenda recorrente de retirada e entrega.</p>
          </div>
        </div>
        <div className="p-4 sm:p-5"><ClienteConfiguracao clienteId={clienteId} onSave={() => undefined} /></div>
      </section>
    </div>
  );
};
