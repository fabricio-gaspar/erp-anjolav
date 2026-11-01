import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Archive, RotateCcw, Loader2, Building2 } from "lucide-react";
import { useCentrosCusto, type CentroCusto } from "@/hooks/useCentrosCusto";

export function ConfiguracoesCentrosCusto() {
  const { centros, isLoading, createCentro, updateCentro, setCentroAtivo } = useCentrosCusto();
  const [editing, setEditing] = useState<CentroCusto | null>(null);
  const [statusTarget, setStatusTarget] = useState<CentroCusto | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", descricao: "", ativo: true });

  const openNew = () => { setEditing(null); setForm({ nome: "", descricao: "", ativo: true }); setOpen(true); };
  const openEdit = (c: CentroCusto) => { setEditing(c); setForm({ nome: c.nome, descricao: c.descricao || "", ativo: c.ativo }); setOpen(true); };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    try {
      if (editing) await updateCentro.mutateAsync({ id: editing.id, ...form });
      else await createCentro.mutateAsync({ nome: form.nome, descricao: form.descricao || null });
      setOpen(false);
    } catch {
      // The mutation presents the actionable error and keeps the form open.
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    try {
      await setCentroAtivo.mutateAsync({ id: statusTarget.id, ativo: !statusTarget.ativo });
      setStatusTarget(null);
    } catch {
      // The mutation presents the actionable error and keeps the confirmation open.
    }
  };

  const actions = (costCenter: CentroCusto) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => openEdit(costCenter)}
        aria-label={`Editar centro de custo ${costCenter.nome}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setStatusTarget(costCenter)}
        aria-label={`${costCenter.ativo ? "Arquivar" : "Reativar"} centro de custo ${costCenter.nome}`}
      >
        {costCenter.ativo
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
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black">Centros de Custo</h3>
            <p className="text-xs text-muted-foreground">Classifique a operação mantendo os lançamentos anteriores intactos.</p>
          </div>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo centro</Button>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border md:block">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centros.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum centro de custo cadastrado</TableCell></TableRow>
                  ) : centros.map((costCenter) => (
                    <TableRow key={costCenter.id}>
                      <TableCell className="font-bold">{costCenter.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{costCenter.descricao || "—"}</TableCell>
                      <TableCell>{costCenter.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Arquivado</Badge>}</TableCell>
                      <TableCell>{actions(costCenter)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {centros.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum centro de custo cadastrado</div>
              ) : centros.map((costCenter) => (
                <article key={costCenter.id} className="rounded-xl border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black">{costCenter.nome}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{costCenter.descricao || "Sem descrição"}</p>
                      <div className="mt-2">{costCenter.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Arquivado</Badge>}</div>
                    </div>
                    {actions(costCenter)}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Centro de Custo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label htmlFor="cost-center-name">Nome *</Label><Input id="cost-center-name" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="cost-center-description">Descrição</Label><Textarea id="cost-center-description" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createCentro.isPending || updateCentro.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(statusTarget)} onOpenChange={(nextOpen) => { if (!nextOpen) setStatusTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.ativo ? "Arquivar centro de custo?" : "Reativar centro de custo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.ativo
                ? `“${statusTarget?.nome}” deixará de aparecer em novos lançamentos, mas continuará ligado ao histórico.`
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
              disabled={setCentroAtivo.isPending}
            >
              {statusTarget?.ativo ? "Arquivar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
