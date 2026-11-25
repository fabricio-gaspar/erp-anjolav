import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useClientProfile } from "@/hooks/useClientProfile";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_PAYMENT_STATUS_LABELS } from "@/lib/clientProfile";

const PAGE_SIZE = 20;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type HistoryOrder = {
  id: string;
  numero: string;
  created_at: string;
  status_pagamento: string | null;
  itens: Array<{
    id: string;
    quantidade: number;
    subtotal: number;
    produto: { nome: string } | null;
  }>;
};

export function ClienteHistorico({ clienteId }: { clienteId: string | null }) {
  const { activeTenant, session } = useAuth();
  const [page, setPage] = useState(0);
  const profile = useClientProfile(clienteId);

  useEffect(() => setPage(0), [clienteId]);

  const history = useQuery({
    queryKey: ["client-order-history", session?.user.id, activeTenant?.id, clienteId, page],
    enabled: Boolean(clienteId && activeTenant?.id && session?.user.id && profile.data?.orders.allowed),
    queryFn: async () => {
      if (!clienteId || !activeTenant?.id) throw new Error("Cliente e empresa são obrigatórios");
      const { data, count, error } = await supabase
        .from("ordens_servico")
        .select(`
          id, numero, created_at, status_pagamento,
          itens:itens_ordem_servico!itens_ordem_servico_ordem_servico_id_fkey (
            id, quantidade, subtotal,
            produto:produtos!itens_ordem_servico_produto_id_fkey (nome)
          )
        `, { count: "exact" })
        .eq("cliente_id", clienteId)
        .eq("tenant_id", activeTenant.id)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { orders: (data ?? []) as unknown as HistoryOrder[], total: count ?? 0 };
    },
  });

  if (!clienteId) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Selecione um cliente para ver o histórico.</p>;
  if (profile.isLoading) return <p role="status" className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando histórico…</p>;
  if (profile.isError) return <Button variant="outline" onClick={() => void profile.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>;
  if (!profile.data?.orders.allowed) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Seu perfil não tem acesso ao histórico de ROLs deste cliente.</p>;

  const orders = history.data?.orders ?? [];
  const total = history.data?.total ?? 0;
  const rows = orders.flatMap((order) => (order.itens.length ? order.itens : [{ id: `${order.id}-empty`, quantidade: 0, subtotal: 0, produto: null }])
    .map((item) => ({ order, item })));

  return (
    <Card className="pdv-client-profile shadow-none" data-testid="client-history">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Histórico do cliente</CardTitle>
        <p className="text-sm text-muted-foreground">Peças lançadas em cada ROL e situação do pagamento.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.isLoading ? (
          <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando ROLs…</p>
        ) : history.isError ? (
          <div className="space-y-2" role="alert"><p>Não foi possível carregar o histórico.</p><Button variant="outline" onClick={() => void history.refetch()}>Tentar novamente</Button></div>
        ) : orders.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum ROL registrado para este cliente.</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map(({ order, item }) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold">ROL {order.numero}</span><span>{format(parseISO(order.created_at), "dd/MM/yyyy")}</span></div>
                  <p className="mt-2">{item.produto?.nome ?? "Peça indisponível"}</p>
                  <div className="mt-2 flex items-center justify-between"><span>{item.quantidade} peça(s) · {money.format(Number(item.subtotal))}</span><StatusBadge variant={order.status_pagamento === "pago" ? "success" : "warning"}>{CLIENT_PAYMENT_STATUS_LABELS[order.status_pagamento ?? "pendente"] ?? order.status_pagamento ?? "Pendente"}</StatusBadge></div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>ROL</TableHead><TableHead>Peça</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Pagamento</TableHead></TableRow></TableHeader>
                <TableBody>{rows.map(({ order, item }) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(order.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{order.numero}</TableCell>
                    <TableCell>{item.produto?.nome ?? "Peça indisponível"}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{money.format(Number(item.subtotal))}</TableCell>
                    <TableCell><StatusBadge variant={order.status_pagamento === "pago" ? "success" : "warning"}>{CLIENT_PAYMENT_STATUS_LABELS[order.status_pagamento ?? "pendente"] ?? order.status_pagamento ?? "Pendente"}</StatusBadge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{total} {total === 1 ? "ROL registrado" : "ROLs registrados"}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
                <span>Página {page + 1}</span>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((current) => current + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
