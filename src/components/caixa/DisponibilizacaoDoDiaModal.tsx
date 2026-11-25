import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Clock3, MapPin, MessageCircle, PackageCheck, Pencil, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useItensDisponibilizacaoDia, type DisponibilizacaoFilter, type ItemDisponibilizacaoDia } from "@/hooks/useHistoricoProducao";
import { usePdvStoragePositions } from "@/hooks/usePdvStoragePositions";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isRolReadyForNotification } from "@/lib/rolAvailability";

interface DisponibilizacaoDoDiaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviarDisponibilidade: (ordemId: string, modalidade: string, ordemNumero?: string) => Promise<boolean>;
}

interface PosicaoRolResult {
  orderId: string;
  allItemsPositioned: boolean;
  readyForCustomer: boolean;
  deliveryQueueUpdated: boolean;
}

function formatDate(value: string | null) {
  if (!value) return "Sem prazo";
  return format(parseISO(value), "dd/MM/yyyy", { locale: ptBR });
}

export function DisponibilizacaoDoDiaModal({ open, onOpenChange, onEnviarDisponibilidade }: DisponibilizacaoDoDiaModalProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [filter, setFilter] = useState<DisponibilizacaoFilter>("todos");
  const [editingPosition, setEditingPosition] = useState<{ itemId: string; value: string } | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const { activeArea } = useWorkspace();
  const positionArea = activeArea === "industrial" ? "industrial" : "residencial";
  const { data: storagePositions = [] } = usePdvStoragePositions(positionArea, open);
  const queryClient = useQueryClient();
  const invalidRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const { data: allItems = [], isLoading, isError } = useItensDisponibilizacaoDia(
    open && !invalidRange,
    dateFrom,
    dateTo,
    "todos",
  );
  const items = allItems.filter((item) => filter === "todos" || (filter === "disponiveis" ? item.disponivel : !item.disponivel));

  const grouped = useMemo(() => {
    const groups = new Map<string, { orderId: string; orderNumber: string; clientName: string; date: string | null; mode: string; items: ItemDisponibilizacaoDia[] }>();
    items.forEach((item) => {
      const current = groups.get(item.ordemId);
      if (current) current.items.push(item);
      else groups.set(item.ordemId, {
        orderId: item.ordemId,
        orderNumber: item.numeroRol,
        clientName: item.clienteNome,
        date: item.dataPrevisaoEntrega,
        mode: item.entregaModalidade,
        items: [item],
      });
    });
    return [...groups.values()];
  }, [items]);

  const totalPieces = items.reduce((total, item) => total + Number(item.quantidade || 0), 0);

  const savePosition = async () => {
    if (!editingPosition || savingItemId) return;
    setSavingItemId(editingPosition.itemId);
    try {
      const { data, error } = await supabase.rpc("registrar_posicao_item_rol", {
        _item_id: editingPosition.itemId,
        _posicao_prateleira: editingPosition.value.trim() || null,
      });
      if (error) throw error;

      const result = data as unknown as PosicaoRolResult;
      if (!result?.orderId) throw new Error("O sistema não confirmou a posição deste item.");

      setEditingPosition(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["itens-disponibilizacao-dia"] }),
        queryClient.invalidateQueries({ queryKey: ["consulta-os"] }),
        queryClient.invalidateQueries({ queryKey: ["route-stop-candidates"] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-rols-in-progress"] }),
      ]);
      toast.success("Local de disponibilização salvo.");
      if (result.readyForCustomer && result.deliveryQueueUpdated) {
        toast.success("ROL incluído na fila de Entregas e Coletas.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o local do item.");
    } finally {
      setSavingItemId(null);
    }
  };

  const sendAvailabilityNotice = async (group: { orderId: string; orderNumber: string; mode: string; items: ItemDisponibilizacaoDia[] }) => {
    if (sendingOrderId || !isRolReadyForNotification(allItems, group.orderId)) return;
    setSendingOrderId(group.orderId);
    try {
      await onEnviarDisponibilidade(group.orderId, group.mode, group.orderNumber);
    } finally {
      setSendingOrderId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pdv-compact-dialog pdv-availability-dialog flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5" /> Itens para disponibilização</DialogTitle>
          <DialogDescription>Selecione o prazo, informe o local das peças e avise o cliente.</DialogDescription>
        </DialogHeader>

        <div className="grid shrink-0 gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_minmax(190px,0.8fr)] sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="pdv-availability-date-from" className="text-xs font-semibold">Data inicial</label>
            <Input id="pdv-availability-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-invalid={invalidRange} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pdv-availability-date-to" className="text-xs font-semibold">Data final</label>
            <Input id="pdv-availability-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-invalid={invalidRange} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="pdv-availability-filter" className="text-xs font-semibold">Situação da peça</label>
            <Select value={filter} onValueChange={(value) => setFilter(value as DisponibilizacaoFilter)}>
              <SelectTrigger id="pdv-availability-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os itens</SelectItem>
                <SelectItem value="pendentes">Aguardando posição</SelectItem>
                <SelectItem value="disponiveis">Já disponíveis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {invalidRange && <p className="text-xs font-medium text-destructive sm:col-span-3">A data inicial não pode ser posterior à data final.</p>}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{grouped.length} ROLs</Badge>
          <Badge variant="secondary">{totalPieces} peças</Badge>
          <Badge variant="outline">{items.filter((item) => item.disponivel).length} com posição</Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando itens…</div>
          ) : isError ? (
            <div role="alert" className="py-12 text-center text-sm text-destructive">Não foi possível carregar os itens para disponibilização.</div>
          ) : grouped.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum item encontrado no período selecionado.</div>
          ) : (
            <div className="space-y-3 pb-2">
              {grouped.map((group) => (
                <section key={group.orderNumber} className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2.5">
                    <div>
                      <p className="font-semibold">ROL {group.orderNumber} · {group.clientName}</p>
                      <p className="text-xs text-muted-foreground">Prazo {formatDate(group.date)} · {group.mode === "entrega" ? "Delivery" : "Retirada"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{group.items.length} {group.items.length === 1 ? "item" : "itens"}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 gap-2"
                        disabled={!isRolReadyForNotification(allItems, group.orderId) || !onEnviarDisponibilidade || Boolean(sendingOrderId)}
                        title={isRolReadyForNotification(allItems, group.orderId) ? "Avisar o cliente que o ROL está disponível" : "Salve o local de todas as peças antes de avisar o cliente"}
                        onClick={() => void sendAvailabilityNotice(group)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {sendingOrderId === group.orderId ? "Enviando…" : "Aviso WhatsApp"}
                      </Button>
                    </div>
                  </div>
                  <div className="divide-y">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">{item.nomeProduto} <span className="text-muted-foreground">× {item.quantidade}{item.unidade ? ` ${item.unidade}` : ""}</span></p>
                          {(item.corItem || item.observacoes) && <p className="truncate text-xs text-muted-foreground">{[item.corItem && `Cor: ${item.corItem}`, item.observacoes].filter(Boolean).join(" · ")}</p>}
                        </div>
                        {editingPosition?.itemId === item.id ? (
                          <div className="flex w-full min-w-0 items-center gap-1 sm:w-auto sm:max-w-[380px]">
                            <Input
                              list={`pdv-availability-storage-${positionArea}`}
                              value={editingPosition.value}
                              onChange={(event) => setEditingPosition({ ...editingPosition, value: event.target.value })}
                              placeholder="Local ou posição da peça"
                              aria-label={`Local de disponibilização de ${item.nomeProduto}`}
                              className="h-9 min-w-0"
                              autoFocus
                            />
                            <Button type="button" size="icon" className="h-9 w-9 shrink-0" aria-label={`Salvar local de ${item.nomeProduto}`} disabled={savingItemId === item.id} onClick={() => void savePosition()}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Cancelar edição de ${item.nomeProduto}`} disabled={savingItemId === item.id} onClick={() => setEditingPosition(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {item.disponivel ? (
                              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><MapPin className="h-3 w-3" />{item.posicaoPrateleira}</Badge>
                            ) : (
                              <Badge variant="outline" className={cn("gap-1 border-amber-300 bg-amber-50 text-amber-700")}><Clock3 className="h-3 w-3" />Sem posição</Badge>
                            )}
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              aria-label={`Editar local de ${item.nomeProduto}`}
                              title="Informar local de disponibilização"
                              onClick={() => setEditingPosition({ itemId: item.id, value: item.posicaoPrateleira || "" })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        <datalist id={`pdv-availability-storage-${positionArea}`}>
          {storagePositions.map((position) => <option key={position.id} value={position.nome_exibicao} />)}
        </datalist>
      </DialogContent>
    </Dialog>
  );
}
