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
import { Plus, Pencil, Trash2, Loader2, Tag } from "lucide-react";
import { useCategoriasFinanceiras, CategoriaFinanceira } from "@/hooks/useCategoriasFinanceiras";

const cores = ["slate", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "blue", "indigo", "violet", "purple", "pink", "rose"];

export function ConfiguracoesCategorias() {
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const { categorias, isLoading, createCategoria, updateCategoria, deleteCategoria } = useCategoriasFinanceiras(tipo);
  const [editing, setEditing] = useState<CategoriaFinanceira | null>(null);
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
    if (editing) {
      await updateCategoria.mutateAsync({ id: editing.id, ...form });
    } else {
      await createCategoria.mutateAsync({ ...form, tipo });
    }
    setOpen(false);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Categorias Financeiras</h3>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nova</Button>
      </div>

      <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
        <TabsList>
          <TabsTrigger value="despesa">Despesas</TabsTrigger>
          <TabsTrigger value="receita">Receitas</TabsTrigger>
        </TabsList>
        <TabsContent value={tipo} className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <Table>
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
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma categoria</TableCell></TableRow>
                ) : categorias.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell><Badge variant="outline">{c.cor}</Badge></TableCell>
                    <TableCell>{c.ordem}</TableCell>
                    <TableCell>{c.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir "${c.nome}"?`)) deleteCategoria.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Categoria ({tipo})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Cor</Label>
                <Select value={form.cor} onValueChange={(v) => setForm({ ...form, cor: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Ordem</Label><Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createCategoria.isPending || updateCategoria.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
