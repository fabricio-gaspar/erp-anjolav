import { useDeferredValue, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Archive, Gift, Loader2, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBeneficiosCatalogo,
  useUpsertBeneficioCatalogo,
  CORES_BENEFICIO,
  corDot,
  type BeneficioCatalogo,
  type BeneficioCatalogoInput,
} from "@/hooks/useBeneficiosCatalogo";

const createDraft = (position: number): BeneficioCatalogoInput => ({
  nome: "",
  cor: "blue",
  ordem: position,
  ativo: true,
});

export function BeneficiosCatalogoTab() {
  const { data: list = [], isLoading, isFetching, error, refetch } = useBeneficiosCatalogo();
  const saveBenefit = useUpsertBeneficioCatalogo();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("pt-BR"));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BeneficioCatalogoInput | null>(null);

  const filtered = useMemo(() => list.filter((benefit) =>
    !deferredQuery || benefit.nome.toLocaleLowerCase("pt-BR").includes(deferredQuery)
  ), [deferredQuery, list]);
  const activeCount = list.filter((benefit) => benefit.ativo).length;

  const startNew = () => {
    setDraft(createDraft(list.length + 1));
    setOpen(true);
  };
  const startEdit = (benefit: BeneficioCatalogo) => {
    setDraft({
      id: benefit.id,
      versao: benefit.versao,
      nome: benefit.nome,
      cor: benefit.cor,
      ordem: benefit.ordem,
      ativo: benefit.ativo,
    });
    setOpen(true);
  };
  const submit = async () => {
    if (!draft?.nome.trim()) return;
    await saveBenefit.mutateAsync({ ...draft, nome: draft.nome.trim() });
    setOpen(false);
    setDraft(null);
  };
  const toggleStatus = (benefit: BeneficioCatalogo, active: boolean) => {
    saveBenefit.mutate({
      id: benefit.id,
      versao: benefit.versao,
      nome: benefit.nome,
      cor: benefit.cor,
      ordem: benefit.ordem,
      ativo: active,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">Catálogo de benefícios</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Defina as opções usadas na folha. Arquivar preserva competências anteriores.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeCount} ativo(s) de {list.length} cadastrado(s)
              </p>
            </div>
          </div>
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={startNew}>
            <Plus className="h-4 w-4" />
            Novo benefício
          </Button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar benefício..."
              aria-label="Buscar benefício no catálogo"
              className="min-h-11 pl-10 text-base md:text-sm"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isFetching && !isLoading && (
          <div className="h-1 w-full animate-pulse bg-primary/60" aria-label="Atualizando benefícios" />
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <Gift className="h-10 w-10 text-muted-foreground/50" />
            <div>
              <p className="font-medium">Não foi possível carregar os benefícios</p>
              <p className="text-sm text-muted-foreground">Tente novamente sem perder sua busca.</p>
            </div>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void refetch()}>
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <Gift className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="font-medium text-foreground">
              {query ? "Nenhum benefício corresponde à busca" : "Nenhum benefício cadastrado"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query ? "Ajuste o nome pesquisado." : "Crie o primeiro item do catálogo da empresa."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((benefit) => (
              <article
                key={benefit.id}
                className={cn(
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                  !benefit.ativo && "bg-muted/20",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={cn("h-3 w-3 shrink-0 rounded-full", corDot(benefit.cor))} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">{benefit.nome}</p>
                      <Badge variant={benefit.ativo ? "secondary" : "outline"}>
                        {benefit.ativo ? "Ativo" : "Arquivado"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">Ordem de exibição: {benefit.ordem}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <div className="flex min-h-11 items-center gap-2 rounded-lg border px-3">
                    <Switch
                      checked={benefit.ativo}
                      disabled={saveBenefit.isPending}
                      onCheckedChange={(active) => toggleStatus(benefit, active)}
                      aria-label={`${benefit.ativo ? "Arquivar" : "Reativar"} ${benefit.nome}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {benefit.ativo ? "Disponível" : "Preservado"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-11 w-11"
                    onClick={() => startEdit(benefit)}
                    aria-label={`Editar benefício ${benefit.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!benefit.ativo && <Archive className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next && !saveBenefit.isPending) setDraft(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar benefício" : "Novo benefício"}</DialogTitle>
            <DialogDescription>
              Nome, cor e ordem ficam disponíveis para todas as folhas desta empresa.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="benefit-name">Nome</Label>
                <Input
                  id="benefit-name"
                  value={draft.nome}
                  maxLength={120}
                  autoFocus
                  onChange={(event) => setDraft({ ...draft, nome: event.target.value })}
                  placeholder="Ex.: Vale alimentação"
                  className="min-h-11 text-base md:text-sm"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Cor de identificação</legend>
                <div className="flex flex-wrap gap-2">
                  {CORES_BENEFICIO.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, cor: color.value })}
                      className={cn(
                        "h-11 w-11 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        color.dot,
                        draft.cor === color.value ? "scale-105 border-foreground" : "border-transparent",
                      )}
                      aria-label={`Cor ${color.label}`}
                      aria-pressed={draft.cor === color.value}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="benefit-order">Ordem</Label>
                  <Input
                    id="benefit-order"
                    type="number"
                    min={0}
                    max={9999}
                    value={draft.ordem}
                    onChange={(event) => setDraft({ ...draft, ordem: Number(event.target.value) })}
                    className="min-h-11"
                  />
                </div>
                <div className="flex min-h-11 items-center gap-3 self-end rounded-lg border px-3">
                  <Switch
                    checked={draft.ativo}
                    onCheckedChange={(active) => setDraft({ ...draft, ativo: active })}
                    aria-label="Benefício disponível"
                  />
                  <Label>Disponível nas folhas</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)} disabled={saveBenefit.isPending}>
              Cancelar
            </Button>
            <Button type="button" className="min-h-11" onClick={() => void submit()} disabled={saveBenefit.isPending || !draft?.nome.trim()}>
              {saveBenefit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar benefício
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
