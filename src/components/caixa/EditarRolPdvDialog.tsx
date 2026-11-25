import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, PackagePlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProdutos } from "@/hooks/useProdutos";
import { useEnderecosCliente } from "@/hooks/useClientes";
import type { OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface EditarRolPdvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServicoConsulta | null;
  onSaved: () => void;
}

interface DraftItem {
  id?: string;
  produto_id: string;
  nome: string;
  unidade: string;
  quantidade: string;
  preco_unitario: string;
  cor_item: string;
  marca_item: string;
  avarias: string;
  observacoes: string;
  posicao_prateleira: string;
  processada: number;
}

interface DraftOrder {
  data_retirada: string;
  data_previsao_entrega: string;
  observacoes: string;
  prioridade: string;
  urgente: boolean;
  percentual_urgencia: string;
  recebimento_modalidade: string;
  entrega_modalidade: string;
  valor_desconto: string;
}

const parseNumber = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatInputMoney = (value: number | null | undefined) =>
  Number(value ?? 0).toFixed(2).replace(".", ",");

const toDraftItem = (item: OrdemServicoConsulta["itens"][number]): DraftItem => ({
  id: item.id,
  produto_id: item.produto_id,
  nome: item.produto?.nome || "Produto",
  unidade: "un",
  quantidade: String(item.quantidade),
  preco_unitario: formatInputMoney(item.preco_unitario),
  cor_item: item.cor_item || "",
  marca_item: item.marca_item || "",
  avarias: item.avarias || "",
  observacoes: item.observacoes || "",
  posicao_prateleira: item.posicao_prateleira || "",
  processada: Math.max(
    Number(item.quantidade_aprovada ?? 0),
    Number(item.quantidade_retida ?? 0),
    Number(item.quantidade_retrabalho ?? 0),
    Number(item.quantidade_entregue ?? 0),
  ),
});

export function EditarRolPdvDialog({ open, onOpenChange, ordem, onSaved }: EditarRolPdvDialogProps) {
  const queryClient = useQueryClient();
  const { produtos = [], isLoading: isLoadingProdutos } = useProdutos({ enabled: open });
  const [draftOrder, setDraftOrder] = useState<DraftOrder | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [newProductId, setNewProductId] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [addressId, setAddressId] = useState("");
  const addresses = useEnderecosCliente(open ? ordem?.cliente.id ?? null : null);
  const changingToDelivery = draftOrder?.entrega_modalidade === "entrega" && (ordem?.entrega_modalidade || "balcao") !== "entrega";
  const deliveryQuote = useQuery({
    queryKey: ["editar-rol-cotacao-delivery", ordem?.id, addressId],
    enabled: Boolean(open && changingToDelivery && ordem?.id && addressId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cotar_entrega_edicao_rol", { _ordem_servico_id: ordem!.id, _endereco_id: addressId });
      if (error) throw error;
      return data as { fee: number; distanceKm: number | null };
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (!open || !ordem) return;
    setDraftOrder({
      data_retirada: format(parseISO(ordem.data_retirada), "yyyy-MM-dd"),
      data_previsao_entrega: ordem.data_previsao_entrega || "",
      observacoes: ordem.observacoes || "",
      prioridade: ordem.prioridade || "normal",
      urgente: Boolean(ordem.urgente),
      percentual_urgencia: formatInputMoney(ordem.percentual_urgencia),
      recebimento_modalidade: ordem.recebimento_modalidade || "balcao",
      entrega_modalidade: ordem.entrega_modalidade || "balcao",
      valor_desconto: formatInputMoney(ordem.valor_desconto),
    });
    setItems(ordem.itens.map(toDraftItem));
    setNewProductId("");
    setReason("");
    setAddressId("");
  }, [open, ordem]);

  const totalItens = useMemo(
    () => items.reduce((total, item) => total + (parseNumber(item.quantidade) * parseNumber(item.preco_unitario)), 0),
    [items],
  );
  const discount = parseNumber(draftOrder?.valor_desconto || "0");
  const urgencyPercent = draftOrder?.urgente ? parseNumber(draftOrder.percentual_urgencia) : 0;
  const deliveryFee = draftOrder?.entrega_modalidade === "entrega"
    ? changingToDelivery ? Number(deliveryQuote.data?.fee ?? 0) : Number(ordem?.taxa_entrega ?? 0)
    : 0;
  const totalRol = Math.max(0, (totalItens - discount) * (1 + urgencyPercent / 100) + deliveryFee);
  const hasInvalidItem = items.some((item) => parseNumber(item.quantidade) <= 0 || parseNumber(item.preco_unitario) < 0);
  const canSave = Boolean(draftOrder && items.length > 0 && !hasInvalidItem && reason.trim().length >= 5 && !isSaving && (!changingToDelivery || (addressId && deliveryQuote.data && !deliveryQuote.isFetching && !deliveryQuote.isError)));

  const updateItem = (index: number, field: keyof DraftItem, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addProduct = () => {
    const product = produtos.find((candidate) => candidate.id === newProductId);
    if (!product) return;
    setItems((current) => [...current, {
      produto_id: product.id,
      nome: product.nome,
      unidade: product.unidade || "un",
      quantidade: "1",
      preco_unitario: formatInputMoney(product.preco),
      cor_item: "",
      marca_item: "",
      avarias: "",
      observacoes: "",
      posicao_prateleira: "",
      processada: 0,
    }]);
    setNewProductId("");
  };

  const removeItem = (index: number) => {
    if (items[index]?.processada > 0) {
      toast.error("Este item já foi processado e não pode ser removido.");
      return;
    }
    setItems((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  };

  const save = async () => {
    if (!ordem || !draftOrder || !canSave) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("editar_ordem_servico_pdv", {
        _ordem_servico_id: ordem.id,
        _ordem: {
          data_retirada: draftOrder.data_retirada,
          data_previsao_entrega: draftOrder.data_previsao_entrega || null,
          observacoes: draftOrder.observacoes || null,
          prioridade: draftOrder.prioridade,
          urgente: draftOrder.urgente,
          percentual_urgencia: parseNumber(draftOrder.percentual_urgencia),
          recebimento_modalidade: draftOrder.recebimento_modalidade,
          entrega_modalidade: draftOrder.entrega_modalidade,
          ...(changingToDelivery ? { endereco_id: addressId } : {}),
          valor_desconto: discount,
        },
        _itens: items.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          produto_id: item.produto_id,
          quantidade: parseNumber(item.quantidade),
          preco_unitario: parseNumber(item.preco_unitario),
          cor_item: item.cor_item || null,
          marca_item: item.marca_item || null,
          avarias: item.avarias || null,
          observacoes: item.observacoes || null,
          posicao_prateleira: item.posicao_prateleira || null,
        })),
        _motivo: reason.trim(),
      });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consulta-os"] }),
        queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
        queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] }),
      ]);
      toast.success(`ROL ${ordem.numero} atualizado com sucesso.`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o ROL.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar ROL {ordem?.numero}</DialogTitle>
          <DialogDescription>
            Corrija os dados do atendimento sem apagar o histórico. O servidor valida empresa, setor, permissões, pagamentos e itens processados.
          </DialogDescription>
        </DialogHeader>

        {draftOrder && ordem && (
          <div className="space-y-5">
            <section className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Data de entrada
                <Input type="date" value={draftOrder.data_retirada} onChange={(event) => setDraftOrder({ ...draftOrder, data_retirada: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Previsão de entrega
                <Input type="date" min={draftOrder.data_retirada} value={draftOrder.data_previsao_entrega} onChange={(event) => setDraftOrder({ ...draftOrder, data_previsao_entrega: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Prioridade
                <Select value={draftOrder.prioridade} onValueChange={(value) => setDraftOrder({ ...draftOrder, prioridade: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Desconto
                <Input inputMode="decimal" value={draftOrder.valor_desconto} onChange={(event) => setDraftOrder({ ...draftOrder, valor_desconto: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Recebimento
                <Select value={draftOrder.recebimento_modalidade} onValueChange={(value) => setDraftOrder({ ...draftOrder, recebimento_modalidade: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="balcao">Balcão</SelectItem><SelectItem value="coleta">Coleta</SelectItem></SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Entrega
                <Select value={draftOrder.entrega_modalidade} onValueChange={(value) => setDraftOrder({ ...draftOrder, entrega_modalidade: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="balcao">Retirada no balcão</SelectItem><SelectItem value="entrega">Delivery</SelectItem></SelectContent>
                </Select>
              </label>
              {changingToDelivery && <div className="grid gap-1.5 text-sm font-medium sm:col-span-2 lg:col-span-4">
                <label htmlFor="edit-delivery-address">Endereço de entrega</label>
                <Select value={addressId} onValueChange={setAddressId}>
                  <SelectTrigger id="edit-delivery-address"><SelectValue placeholder={addresses.isLoading ? "Carregando endereços..." : "Selecione um endereço do cliente"} /></SelectTrigger>
                  <SelectContent>{addresses.enderecos.filter(address => address.ativo).map(address => <SelectItem key={address.id} value={address.id}>{[address.logradouro, address.numero, address.bairro, address.cidade].filter(Boolean).join(", ")}</SelectItem>)}</SelectContent>
                </Select>
                {addresses.isError && <span className="text-xs text-destructive">Não foi possível carregar os endereços do cliente.</span>}
                {!addresses.isLoading && addresses.enderecos.every(address => !address.ativo) && <span className="text-xs text-destructive">Cadastre um endereço ativo para este cliente antes de selecionar delivery.</span>}
                {deliveryQuote.isFetching && <span className="text-xs text-muted-foreground">Calculando taxa de entrega...</span>}
                {deliveryQuote.isError && <span role="alert" className="text-xs text-destructive">{deliveryQuote.error instanceof Error ? deliveryQuote.error.message : "Não foi possível calcular a taxa de entrega."}</span>}
                {deliveryQuote.data && <span className="text-xs text-muted-foreground">Taxa calculada: {deliveryFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{deliveryQuote.data.distanceKm != null ? ` · ${Number(deliveryQuote.data.distanceKm).toFixed(2).replace(".", ",")} km em linha reta` : ""}. Será confirmada ao salvar.</span>}
              </div>}
              <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm font-medium">
                <input type="checkbox" checked={draftOrder.urgente} onChange={(event) => setDraftOrder({ ...draftOrder, urgente: event.target.checked })} />
                Lavagem Expressa
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Percentual de urgência
                <Input inputMode="decimal" value={draftOrder.percentual_urgencia} onChange={(event) => setDraftOrder({ ...draftOrder, percentual_urgencia: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 lg:col-span-4">
                Observações gerais do ROL
                <Textarea rows={3} value={draftOrder.observacoes} onChange={(event) => setDraftOrder({ ...draftOrder, observacoes: event.target.value })} maxLength={3000} />
              </label>
            </section>

            <section className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Itens e detalhes</h3>
                  <p className="text-xs text-muted-foreground">Altere quantidade, preço, observações, avarias, cor, marca e posição.</p>
                </div>
                <div className="text-right text-sm font-semibold">
                  <span className="block text-xs font-normal text-muted-foreground">Total do ROL</span>
                  {totalRol.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  {deliveryFee > 0 && <span className="block text-xs font-normal text-muted-foreground">Inclui delivery: {deliveryFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger aria-label="Produto para adicionar ao ROL">
                    <SelectValue placeholder={isLoadingProdutos ? "Carregando produtos..." : "Adicionar produto ao ROL"} />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.filter((product) => product.status === "ativo").map((product) => (
                      <SelectItem key={product.id} value={product.id}>{product.nome} · {formatInputMoney(product.preco)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addProduct} disabled={!newProductId} className="gap-2"><PackagePlus className="h-4 w-4" />Adicionar item</Button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <article key={item.id || `${item.produto_id}-${index}`} className="space-y-3 rounded-lg border bg-muted/10 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.nome}</p>
                        {item.processada > 0 && <p className="text-xs text-amber-700">Processado: {item.processada}. A quantidade não pode ficar abaixo desse valor.</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(index)} disabled={item.processada > 0} aria-label={`Remover ${item.nome}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="grid gap-1 text-xs font-semibold">Quantidade<Input inputMode="decimal" value={item.quantidade} onChange={(event) => updateItem(index, "quantidade", event.target.value)} /></label>
                      <label className="grid gap-1 text-xs font-semibold">Preço unitário<Input inputMode="decimal" value={item.preco_unitario} onChange={(event) => updateItem(index, "preco_unitario", event.target.value)} /></label>
                      <label className="grid gap-1 text-xs font-semibold">Cor<Input value={item.cor_item} onChange={(event) => updateItem(index, "cor_item", event.target.value)} /></label>
                      <label className="grid gap-1 text-xs font-semibold">Marca<Input value={item.marca_item} onChange={(event) => updateItem(index, "marca_item", event.target.value)} /></label>
                      <label className="grid gap-1 text-xs font-semibold">Avarias<Textarea rows={2} value={item.avarias} onChange={(event) => updateItem(index, "avarias", event.target.value)} /></label>
                      <label className="grid gap-1 text-xs font-semibold">Observações do item<Textarea rows={2} value={item.observacoes} onChange={(event) => updateItem(index, "observacoes", event.target.value)} /></label>
                      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Posição da prateleira<Input value={item.posicao_prateleira} onChange={(event) => updateItem(index, "posicao_prateleira", event.target.value)} /></label>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50/60 p-4 text-sm">
              <label className="font-semibold" htmlFor="pdv-edit-rol-reason">Motivo da alteração *</label>
              <Textarea id="pdv-edit-rol-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: cliente solicitou correção da quantidade e observação da peça" maxLength={1000} />
              <p className="text-xs text-muted-foreground">O motivo fica registrado na operação e é obrigatório para preservar a rastreabilidade.</p>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={!canSave} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
