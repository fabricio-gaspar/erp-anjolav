import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Archive, RotateCcw, Loader2, Tag } from "lucide-react";
import { useCategoriasFinanceiras, type CategoriaFinanceira } from "@/hooks/useCategoriasFinanceiras";

const cores = ["slate", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "blue", "indigo", "violet", "purple", "pink", "rose"];

export function ConfiguracoesCategorias() {
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const { categorias, isLoading, createCategoria, updateCategoria, setCategoriaAtiva } = useCategoriasFinanceiras(tipo);
  const [editing, setEditing] = useState<CategoriaFinanceira | null>(null);
  const [statusTarget, setStatusTarget] = useState<CategoriaFinanceira | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cor: "slate", ordem: 100, ativo: true });

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", cor: "slate", ordem: 100, ativo: true });
    setOpen(true);
  };
  const openEdit = (c: CategoriaFinanceira) => {
    setEditing(c);
    setForm({ nome: c.nome, cor: c.cor, ordem: c.ordem, ativo: c.ativo });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    try {
      if (editing) {
        await updateCategoria.mutateAsync({ id: editing.id, ...form });
      } else {
        await createCategoria.mutateAsync({ ...form, tipo });
      }
      setOpen(false);
    } catch {
      // The mutation presents the actionable error and keeps the form open.
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    try {
      await setCategoriaAtiva.mutateAsync({ id: statusTarget.id, ativo: !statusTarget.ativo });
      setStatusTarget(null);
    } catch {
      // The mutation presents the actionable error and keeps the confirmation open.
    }
  };

  const actions = (category: CategoriaFinanceira) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => openEdit(category)}
        aria-label={`Editar categoria ${category.nome}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setStatusTarget(category)}
        aria-label={`${category.ativo ? "Arquivar" : "Reativar"} categoria ${category.nome}`}
      >
        {category.ativo
          ? <Archive className="h-4 w-4 text-amber-600" />
          : <RotateCcw className="h-4 w-4 text-emerald-600" />}
      </Button>
    </div>
  );

  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <div className="flex flex-col gap-3 border-b bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black">Categorias Financeiras</h3>
            <p className="text-xs text-muted-foreground">Organize receitas e despesas sem apagar vínculos históricos.</p>
          </div>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Nova categoria</Button>
      </div>

      <Tabs value={tipo} onValueChange={(value) => setTipo(value as "receita" | "despesa")} className="p-4 sm:p-5">
        <TabsList className="grid w-full grid-cols-2 sm:w-80">
          <TabsTrigger value="despesa">Despesas</TabsTrigger>
          <TabsTrigger value="receita">Receitas</TabsTrigger>
        </TabsList>
        <TabsContent value={tipo} className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border md:block">
                <Table className="min-w-[680px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorias.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma categoria cadastrada</TableCell></TableRow>
                    ) : categorias.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-bold">{category.nome}</TableCell>
                        <TableCell><Badge variant="outline">{category.cor || "slate"}</Badge></TableCell>
                        <TableCell>{category.ordem}</TableCell>
                        <TableCell>{category.ativo ? <Badge>Ativa</Badge> : <Badge variant="secondary">Arquivada</Badge>}</TableCell>
                        <TableCell>{actions(category)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {categorias.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada</div>
                ) : categorias.map((category) => (
                  <article key={category.id} className="rounded-xl border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black">{category.nome}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{category.cor || "slate"}</Badge>
                          <Badge variant="outline">Ordem {category.ordem}</Badge>
                          {category.ativo ? <Badge>Ativa</Badge> : <Badge variant="secondary">Arquivada</Badge>}
                        </div>
                      </div>
                      {actions(category)}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Categoria ({tipo})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="financial-category-name">Nome *</Label><Input id="financial-category-name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="financial-category-color">Cor</Label>
                <Select value={form.cor} onValueChange={(v) => setForm({ ...form, cor: v })}>
                  <SelectTrigger id="financial-category-color"><SelectValue /></SelectTrigger>
                  <SelectContent>{cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="financial-category-order">Ordem</Label><Input id="financial-category-order" type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createCategoria.isPending || updateCategoria.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(statusTarget)} onOpenChange={(nextOpen) => { if (!nextOpen) setStatusTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.ativo ? "Arquivar categoria?" : "Reativar categoria?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.ativo
                ? `“${statusTarget?.nome}” deixará de aparecer em novos lançamentos, mas continuará vinculada ao histórico.`
                : `“${statusTarget?.nome}” voltará a ficar disponível para novos lançamentos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleStatusChange();
              }}
              disabled={setCategoriaAtiva.isPending}
            >
              {statusTarget?.ativo ? "Arquivar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
