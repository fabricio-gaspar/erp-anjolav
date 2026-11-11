import { ClientePagamento } from "@/components/clientes/ClientePagamento";
import { ClienteTabelaPrecos } from "@/components/clientes/ClienteTabelaPrecos";
import { ClienteConfiguracao } from "@/components/clientes/ClienteConfiguracao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ClienteCondicoesProps {
  clienteId: string | null;
}

export const ClienteCondicoes = ({ clienteId }: ClienteCondicoesProps) => {
  const { activeTenant } = useAuth();
  const queryClient = useQueryClient();
  const preferenceKey = ["cliente-whatsapp", activeTenant?.id, clienteId];
  const preference = useQuery({
    queryKey: preferenceKey,
    enabled: Boolean(clienteId && activeTenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes")
        .select("whatsapp_opt_out")
        .eq("tenant_id", activeTenant!.id).eq("id", clienteId!).single();
      if (error) throw error;
      return data.whatsapp_opt_out;
    },
  });
  const updatePreference = useMutation({
    mutationFn: async (blocked: boolean) => {
      if (!clienteId || !activeTenant?.id) throw new Error("Salve o cliente primeiro");
      const { data, error } = await supabase.from("clientes")
        .update({ whatsapp_opt_out: blocked })
        .eq("tenant_id", activeTenant.id).eq("id", clienteId)
        .select("id").single();
      if (error || !data) throw error || new Error("Não foi possível alterar a preferência");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: preferenceKey });
      toast.success("Preferência de WhatsApp salva");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="pdv-client-form pdv-client-conditions space-y-5">
      <div className="pdv-client-form-heading">
        <h2>Tabela de preços</h2>
        <span>Configure a tabela do cliente, pagamento, faturamento, retirada, entrega e portal.</span>
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
      <section className="surface-panel rounded-lg border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Mensagens por WhatsApp</h3>
            <p className="text-sm text-muted-foreground">Bloqueie avisos automáticos e manuais quando o cliente não desejar recebê-los.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={preference.data === true}
              onCheckedChange={(checked) => updatePreference.mutate(checked)}
              disabled={!clienteId || preference.isLoading || preference.isError || updatePreference.isPending}
              aria-label="Bloquear mensagens por WhatsApp para este cliente"
            />
            Bloquear WhatsApp
          </label>
        </div>
        {preference.isError && <p className="mt-2 text-sm text-destructive">Não foi possível carregar a preferência do cliente.</p>}
      </section>
    </div>
  );
};
