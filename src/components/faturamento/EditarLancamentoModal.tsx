import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePrecosEspeciais, useProdutos } from "@/hooks/useProdutos";
import type { ItemLancamento, Lancamento } from "@/hooks/useLancamentos";
import type { PendingRolDesiredItem } from "@/hooks/usePendingRolQueue";
import { buildClientPriceCatalog, normalizeClientPriceMode } from "@/lib/clientPricing";

interface EditarLancamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Lancamento | null;
  itens: ItemLancamento[];
  onSave: (lancamento: Lancamento, data: {
    observacao: string | null;
    data_lancamento: string;
    data_entrega: string | null;
    itens: PendingRolDesiredItem[];
  }) => Promise<void>;
  isSaving?: boolean;
}

interface ItemEditavel extends ItemLancamento {
  isNew?: boolean;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

export function EditarLancamentoModal({
  open,
  onOpenChange,
  lancamento,
  itens,
  onSave,
  isSaving = false,
}: EditarLancamentoModalProps) {
  const { activeArea } = useWorkspace();
  const { produtos, error: produtosError } = useProdutos();
  const { precos: precosEspeciais, isLoading: isLoadingPrecos } = usePrecosEspeciais(lancamento?.cliente_id ?? null);
  const [dataLancamento, setDataLancamento] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itensEditaveis, setItensEditaveis] = useState<ItemEditavel[]>([]);
  const [novoProdutoId, setNovoProdutoId] = useState("");
  const [novaQuantidade, setNovaQuantidade] = useState("1");

  useEffect(() => {
    if (!lancamento) return;
    setDataLancamento(lancamento.data_lancamento);
    setDataEntrega(lancamento.data_entrega ?? "");
    setObservacao(lancamento.observacao ?? "");
    setItensEditaveis(itens.map((item) => ({ ...item, isNew: false })));
    setNovoProdutoId("");
    setNovaQuantidade("1");
  }, [lancamento, itens]);

  const catalogo = useMemo(() => buildClientPriceCatalog(
    produtos,
    precosEspeciais,
    normalizeClientPriceMode(lancamento?.cliente?.tabela_preco_tipo),
    activeArea === "residencial" ? "residencial" : "industrial",
  ), [activeArea, lancamento?.cliente?.tabela_preco_tipo, precosEspeciais, produtos]);

  const valorTotal = useMemo(() => itensEditaveis.reduce(
    (sum, item) => sum + Number(item.subtotal),
    0,
  ), [itensEditaveis]);

  const handleQuantidadeChange = (itemId: string, rawValue: string) => {
    const quantity = Number(rawValue);
    setItensEditaveis((current) => current.map((item) => item.id === itemId
      ? {
        ...item,
        quantidade: Number.isFinite(quantity) ? quantity : 0,
        subtotal: (Number.isFinite(quantity) ? quantity : 0) * Number(item.preco_unitario),
      }
      : item));
  };

  const handleAdicionarItem = () => {
    const product = catalogo.find((candidate) => candidate.id === novoProdutoId);
    const quantity = Number(novaQuantidade);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Selecione um produto e informe uma quantidade válida.");
      return;
    }

    setItensEditaveis((current) => [...current, {
      id: crypto.randomUUID(),
      lancamento_id: lancamento?.id ?? "",
      produto_id: product.id,
      produto_nome: product.nome,
      quantidade: quantity,
      unidade: product.unidade || "un",
      preco_unitario: product.precoAplicado,
      subtotal: product.precoAplicado * quantity,
      created_at: new Date().toISOString(),
      isNew: true,
    }]);
    setNovoProdutoId("");
    setNovaQuantidade("1");
  };

  const handleSave = async () => {
    if (!lancamento) return;
    if (!dataLancamento) {
      toast.error("Informe a data do lançamento.");
      return;
    }
    if (dataEntrega && dataEntrega < dataLancamento) {
      toast.error("A entrega não pode ser anterior ao lançamento.");
      return;
    }
    if (itensEditaveis.length === 0 || itensEditaveis.some((item) => !Number.isFinite(Number(item.quantidade)) || Number(item.quantidade) <= 0)) {
      toast.error("Mantenha pelo menos um item com quantidade válida.");
      return;
    }

    const desiredItems: PendingRolDesiredItem[] = itensEditaveis.map((item) => item.isNew
      ? {
        produto_id: item.produto_id ?? undefined,
        descricao: item.produto_nome,
        quantidade: Number(item.quantidade),
      }
      : {
        id: item.id,
        quantidade: Number(item.quantidade),
      });

    await onSave(lancamento, {
      observacao: observacao.trim() || null,
      data_lancamento: dataLancamento,
      data_entrega: dataEntrega || null,
      itens: desiredItems,
    });
    onOpenChange(false);
  };

  if (!lancamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto p-4 sm:w-full sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-primary" />
            Editar {lancamento.numero_rol || "ROL"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <Label>Cliente</Label>
              <Input value={lancamento.cliente?.razao_social || "Cliente"} disabled className="mt-1.5 bg-muted/50" />
            </div>
            <div>
              <Label htmlFor="edit-rol-date">Data do lançamento</Label>
              <Input id="edit-rol-date" type="date" value={dataLancamento} onChange={(event) => setDataLancamento(event.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="edit-rol-delivery">Previsão de entrega</Label>
              <Input id="edit-rol-delivery" type="date" value={dataEntrega} min={dataLancamento} onChange={(event) => setDataEntrega(event.target.value)} className="mt-1.5" />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="edit-rol-note">Observação</Label>
              <Textarea id="edit-rol-note" value={observacao} maxLength={2000} onChange={(event) => setObservacao(event.target.value)} placeholder="Informações úteis para a operação" className="mt-1.5" rows={3} />
            </div>
          </div>

          <section className="space-y-3" aria-labelledby="edit-rol-items-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 id="edit-rol-items-title" className="font-semibold">Itens do ROL</h3>
                <p className="text-sm text-muted-foreground">O valor dos itens existentes é preservado; novos itens usam a tabela vigente do cliente.</p>
              </div>
              <Badge variant="secondary">{itensEditaveis.length} item{itensEditaveis.length === 1 ? "" : "s"}</Badge>
            </div>

            <div className="hidden overflow-hidden rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-28 text-center">Quantidade</TableHead>
                    <TableHead className="w-20 text-center">Unidade</TableHead>
                    <TableHead className="w-32 text-right">Unitário</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-14"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensEditaveis.map((item) => (
                    <TableRow key={item.id} className={item.isNew ? "bg-success/5" : undefined}>
                      <TableCell className="font-medium">
                        {item.produto_nome}
                        {item.isNew && <Badge variant="outline" className="ml-2 border-success text-success">Novo</Badge>}
                      </TableCell>
                      <TableCell>
                        <Input aria-label={`Quantidade de ${item.produto_nome}`} type="number" step="0.01" min="0.01" value={item.quantidade} onChange={(event) => handleQuantidadeChange(item.id, event.target.value)} className="h-9 text-center" />
                      </TableCell>
                      <TableCell className="text-center">{item.unidade}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.preco_unitario))}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(Number(item.subtotal))}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" onClick={() => setItensEditaveis((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remover ${item.produto_nome}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {itensEditaveis.map((item) => (
                <article key={item.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.produto_nome}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(Number(item.preco_unitario))} / {item.unidade}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-destructive" onClick={() => setItensEditaveis((current) => current.filter((candidate) => candidate.id !== item.id))} aria-label={`Remover ${item.produto_nome}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="max-w-36">
                      <Label htmlFor={`quantity-${item.id}`}>Quantidade</Label>
                      <Input id={`quantity-${item.id}`} type="number" step="0.01" min="0.01" value={item.quantidade} onChange={(event) => handleQuantidadeChange(item.id, event.target.value)} className="mt-1.5" />
                    </div>
                    <p className="pb-2 text-right text-lg font-bold tabular-nums">{formatCurrency(Number(item.subtotal))}</p>
                  </div>
                </article>
              ))}
            </div>

            {itensEditaveis.length === 0 && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
                <AlertCircle className="h-4 w-4 text-warning" />
                Adicione pelo menos um item antes de salvar.
              </div>
            )}

            <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
              <div>
                <Label htmlFor="edit-rol-add-product">Adicionar produto</Label>
                <Select value={novoProdutoId} onValueChange={setNovoProdutoId} disabled={isLoadingPrecos || Boolean(produtosError)}>
                  <SelectTrigger id="edit-rol-add-product" className="mt-1.5 min-h-11">
                    <SelectValue placeholder={isLoadingPrecos ? "Carregando tabela..." : "Selecione um produto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogo.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.nome} · {formatCurrency(product.precoAplicado)} / {product.unidade || "un"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-rol-new-quantity">Quantidade</Label>
                <Input id="edit-rol-new-quantity" type="number" step="0.01" min="0.01" value={novaQuantidade} onChange={(event) => setNovaQuantidade(event.target.value)} className="mt-1.5" />
              </div>
              <Button type="button" variant="outline" onClick={handleAdicionarItem} disabled={!novoProdutoId || isLoadingPrecos} className="min-h-11 gap-2">
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </section>

          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
            <span className="font-medium">Total estimado</span>
            <span className="text-xl font-bold tabular-nums text-primary">{formatCurrency(valorTotal)}</span>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Voltar</Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || itensEditaveis.length === 0} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
