import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Movement { id: string; tipo: "recebimento" | "estorno"; origem: "manual" | "asaas"; valor: number; data: string; forma: string; motivo: string | null; estorno_de: string | null }
interface InvoiceDetails { valor_total: number; valor_recebido: number; status: string; data_recebimento: string | null; recebimentos: Movement[]; rols: Array<{ id: string; numero: string; data: string; valor: number; situacao: string; pagamento: string }> }
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const displayDate = (date: string) => date.split("-").reverse().join("/");
const failureMessage = (error: unknown, fallback: string) => error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : fallback;

export function RecebimentosFaturaPanel({ invoiceId, boletoEmProcessamento, onChanged }: { invoiceId: string; boletoEmProcessamento: boolean; onChanged: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState("pix");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [reversal, setReversal] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const details = useQuery({
    queryKey: ["invoice-payment-details", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_recebimentos_fatura" as never, { _fatura_id: invoiceId } as never);
      if (error) throw error;
      if (!data || typeof data !== "object") throw new Error("Não foi possível conferir os recebimentos.");
      return data as unknown as InvoiceDetails;
    },
  });
  const invoice = details.data;
  const balance = invoice ? Math.max(0, Number(invoice.valor_total) - Number(invoice.valor_recebido)) : 0;
  const reversed = new Set(invoice?.recebimentos.filter((entry) => entry.tipo === "estorno").map((entry) => entry.estorno_de));
  const keyFor = (fingerprint: string) => {
    if (requestKey.current?.fingerprint !== fingerprint) requestKey.current = { fingerprint, key: `fatura-recebimento:${crypto.randomUUID()}` };
    return requestKey.current.key;
  };
  const refresh = async () => {
    requestKey.current = null;
    await Promise.all([
      details.refetch(), onChanged(),
      queryClient.invalidateQueries({ queryKey: ["accounts-receivable-directory"] }),
      queryClient.invalidateQueries({ queryKey: ["consulta-os"] }),
      queryClient.invalidateQueries({ queryKey: ["ordens-servico"] }),
      queryClient.invalidateQueries({ queryKey: ["financeiro-agregado"] }),
    ]);
  };
  const submit = async () => {
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || value > balance || !date) { toast.error("Informe um valor válido até o saldo da fatura e a data do recebimento."); return; }
    const fingerprint = JSON.stringify([invoiceId, value, date, method, reference.trim()]);
    setBusy(true);
    try {
      const { error } = await supabase.rpc("registrar_recebimento_fatura" as never, { _fatura_id: invoiceId, _valor: value, _data: date, _forma: method, _referencia: reference.trim() || null, _idempotency_key: keyFor(fingerprint) } as never);
      if (error) throw error;
      setAmount(""); setReference("");
      await refresh();
      toast.success("Recebimento registrado.");
    } catch (error) { toast.error(failureMessage(error, "Não foi possível registrar o recebimento.")); }
    finally { setBusy(false); }
  };
  const submitReversal = async () => {
    if (!reversal || reason.trim().length < 5) { toast.error("Informe um motivo com pelo menos 5 caracteres."); return; }
    const fingerprint = JSON.stringify([reversal, reason.trim()]);
    setBusy(true);
    try {
      const { error } = await supabase.rpc("estornar_recebimento_fatura" as never, { _recebimento_id: reversal, _motivo: reason.trim(), _idempotency_key: keyFor(fingerprint) } as never);
      if (error) throw error;
      setReversal(null); setReason("");
      await refresh();
      toast.success("Recebimento estornado.");
    } catch (error) { toast.error(failureMessage(error, "Não foi possível estornar o recebimento.")); }
    finally { setBusy(false); }
  };
  if (details.isLoading) return <p role="status" className="text-sm">Consultando recebimentos...</p>;
  if (details.error || !invoice) return <div role="alert" className="rounded-lg border p-4 text-sm">Não foi possível consultar os recebimentos. <Button variant="outline" size="sm" onClick={() => void details.refetch()}>Tentar novamente</Button></div>;
  return <section className="space-y-3 rounded-lg border p-4" aria-label="Recebimentos da fatura">
    <h3 className="font-semibold">Recebimentos da fatura</h3>
    <div className="grid gap-2 text-sm sm:grid-cols-3"><p>Total: <strong>{money.format(Number(invoice.valor_total))}</strong></p><p>Recebido: <strong>{money.format(Number(invoice.valor_recebido))}</strong></p><p>Saldo: <strong>{money.format(balance)}</strong></p></div>
    <p className="text-sm text-muted-foreground">{invoice.status === "cancelado" ? "Fatura cancelada; consulte o histórico antes de novo fechamento." : balance === 0 ? "Fatura quitada." : Number(invoice.valor_recebido) > 0 ? "Pagamento parcial; os ROLs permanecem pendentes até a quitação integral." : "Aguardando pagamento."}</p>
    {boletoEmProcessamento && <p role="status" className="text-sm text-amber-700">Boleto em processamento. Confira o resultado ou tente novamente com o mesmo vencimento antes de registrar baixa manual.</p>}
    {balance > 0 && invoice.status !== "cancelado" && !boletoEmProcessamento && <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor="invoice-received-amount">Valor recebido</Label><Input id="invoice-received-amount" type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><Label htmlFor="invoice-received-date">Data do pagamento</Label><Input id="invoice-received-date" type="date" max={format(new Date(), "yyyy-MM-dd")} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><Label htmlFor="invoice-received-method">Forma de pagamento</Label><Select value={method} onValueChange={setMethod}><SelectTrigger id="invoice-received-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="transferencia">Transferência</SelectItem></SelectContent></Select></div>
      <div><Label htmlFor="invoice-received-reference">Referência (opcional)</Label><Input id="invoice-received-reference" maxLength={200} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      <div className="sm:col-span-2"><Button type="button" disabled={busy || !amount} onClick={() => void submit()}>Registrar recebimento</Button></div>
    </div>}
    <div className="space-y-2"><h4 className="text-sm font-semibold">Histórico</h4>{invoice.recebimentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum recebimento registrado nesta versão.</p> : invoice.recebimentos.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>{entry.tipo === "estorno" ? "Estorno" : "Recebimento"} · {displayDate(entry.data)} · {money.format(Number(entry.valor))} · {entry.forma}{entry.origem === "asaas" ? " · Asaas" : ""}{entry.motivo ? ` · ${entry.motivo}` : ""}</span>{entry.tipo === "recebimento" && entry.origem === "manual" && !reversed.has(entry.id) && <Button type="button" variant="outline" size="sm" onClick={() => { setReversal(entry.id); setReason(""); }}>Estornar</Button>}</div>)}</div>
    {reversal && <div className="flex flex-wrap items-end gap-2"><div className="min-w-48 flex-1"><Label htmlFor="invoice-reversal-reason">Motivo do estorno</Label><Input id="invoice-reversal-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></div><Button type="button" variant="destructive" disabled={busy || reason.trim().length < 5} onClick={() => void submitReversal()}>Confirmar estorno</Button><Button type="button" variant="outline" onClick={() => setReversal(null)}>Cancelar</Button></div>}
    <div className="space-y-2"><h4 className="text-sm font-semibold">ROLs vinculados</h4>{invoice.rols.map((rol) => <p key={rol.id} className="text-sm">ROL {rol.numero} · {displayDate(rol.data)} · {money.format(Number(rol.valor))} · entrega: {rol.situacao} · pagamento: {rol.pagamento || "pendente"}</p>)}</div>
  </section>;
}
