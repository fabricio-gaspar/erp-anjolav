import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CircleDollarSign, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumberToCurrency } from "@/lib/currencyUtils";
import { format, parseISO } from "date-fns";

interface UnallocatedPayment {
  id: string;
  metodo: string;
  valor: number;
  valor_alocado: number;
  valor_nao_alocado: number;
  status: string;
  status_provedor: string | null;
  provedor_pagamento_id: string | null;
  created_at: string;
  confirmado_em: string | null;
  ordem: {
    numero: string;
    origem: string;
    cliente: { razao_social: string; nome_fantasia: string | null } | null;
  } | null;
}

export function ConciliacaoFinanceiraContent() {
  const { activeArea } = useWorkspace();
  const query = useQuery({
    queryKey: ["financeiro", "conciliacao", activeArea],
    queryFn: async () => {
      let request = supabase
        .from("pdv_pagamentos")
        .select(`
          id, metodo, valor, valor_alocado, valor_nao_alocado, status,
          status_provedor, provedor_pagamento_id, created_at, confirmado_em,
          ordem:ordens_servico!pdv_pagamentos_ordem_servico_id_fkey!inner(
            numero, origem,
            cliente:clientes!ordens_servico_cliente_id_fkey(razao_social, nome_fantasia)
          )
        `)
        .gt("valor_nao_alocado", 0)
        .order("created_at", { ascending: false });

      if (activeArea !== "central") {
        request = request.eq("ordem.origem", activeArea);
      }

      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as unknown as UnallocatedPayment[];
    },
  });

  const payments = query.data ?? [];
  const unallocatedTotal = payments.reduce(
    (total, payment) => total + Number(payment.valor_nao_alocado || 0),
    0,
  );

  if (query.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Carregando conciliação financeira</span>
      </div>
    );
  }

  if (query.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Não foi possível consultar a conciliação</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>A falha foi mantida como erro; nenhum valor foi apresentado como zero.</span>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex min-h-28 items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor não alocado</p>
            <p className="mt-1 text-2xl font-black text-amber-600">R$ {formatNumberToCurrency(unallocatedTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Recebido sem obrigação disponível</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <CircleDollarSign className="h-5 w-5" />
          </span>
        </Card>
        <Card className="flex min-h-28 items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ocorrências</p>
            <p className="mt-1 text-2xl font-black text-foreground">{payments.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Exigem decisão e autorização</p>
          </div>
          <Badge variant="outline">Não vira receita novamente</Badge>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <h2 className="font-bold">Pendências de conciliação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Devolução ou conversão em crédito depende de uma regra autorizada; o sistema preserva o recebimento original.
          </p>
        </div>
        {payments.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <CircleDollarSign className="mb-3 h-10 w-10 text-success/60" />
            <p className="font-semibold">Nenhum valor pendente de conciliação</p>
            <p className="mt-1 text-sm text-muted-foreground">Todos os recebimentos visíveis estão integralmente alocados.</p>
          </div>
        ) : (
          <div className="divide-y">
            {payments.map((payment) => {
              const customerName = payment.ordem?.cliente?.nome_fantasia
                || payment.ordem?.cliente?.razao_social
                || "Cliente";
              return (
                <article key={payment.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">Pedido {payment.ordem?.numero ?? "não identificado"}</p>
                      <Badge variant="outline">{payment.metodo}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {customerName} · recebido em {format(parseISO(payment.confirmado_em || payment.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Referência: {payment.provedor_pagamento_id || payment.status_provedor || payment.id.slice(0, 8)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-black text-amber-600">R$ {formatNumberToCurrency(payment.valor_nao_alocado)}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {formatNumberToCurrency(payment.valor_alocado)} alocado de R$ {formatNumberToCurrency(payment.valor)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
