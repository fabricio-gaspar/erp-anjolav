import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBeneficiosCatalogo,
  useUpsertBeneficioCatalogo,
  useDeleteBeneficioCatalogo,
  CORES_BENEFICIO,
  corDot,
  type BeneficioCatalogo,
} from "@/hooks/useBeneficiosCatalogo";

export function BeneficiosCatalogoTab() {
  const { data: lista = [], isLoading } = useBeneficiosCatalogo();
  const upsert = useUpsertBeneficioCatalogo();
  const del = useDeleteBeneficioCatalogo();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<BeneficioCatalogo> | null>(null);

  const novo = () => {
    setEdit({ nome: "", cor: "blue", ordem: lista.length + 1, ativo: true });
    setOpen(true);
  };
  const editar = (b: BeneficioCatalogo) => {
    setEdit(b);
    setOpen(true);
  };

  const salvar = async () => {
    if (!edit?.nome?.trim()) return;
    await upsert.mutateAsync(edit);
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Catálogo de Benefícios</h3>
            <p className="text-xs text-muted-foreground">
              Cadastre os benefícios que sua empresa oferece. Cada funcionário recebe seu valor próprio na Folha.
            </p>
          </div>
          <Button onClick={novo}>
            <Plus className="w-4 h-4 mr-1" /> Novo Benefício
          </Button>
        </div>
      </Card>

      <Card className="p-2">
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : lista.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum benefício cadastrado.</div>
        ) : (
          <div className="divide-y">
            {lista.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-2">
                <span className={cn("w-3 h-3 rounded-full", corDot(b.cor))} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{b.nome}</div>
                  <div className="text-xs text-muted-foreground">Ordem {b.ordem} · {b.ativo ? "Ativo" : "Inativo"}</div>
                </div>
                <Switch
                  checked={b.ativo}
                  onCheckedChange={(v) => upsert.mutate({ id: b.id, ativo: v })}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => editar(b)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => del.mutate(b.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Editar benefício" : "Novo benefício"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                value={edit?.nome || ""}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
                placeholder="Ex.: Vale Transporte"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CORES_BENEFICIO.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEdit({ ...edit, cor: c.value })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      c.dot,
                      edit?.cor === c.value ? "border-foreground scale-110" : "border-transparent",
                    )}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={edit?.ordem ?? 0}
                  onChange={(e) => setEdit({ ...edit, ordem: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={edit?.ativo ?? true}
                  onCheckedChange={(v) => setEdit({ ...edit, ativo: v })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={upsert.isPending || !edit?.nome?.trim()}>
              {upsert.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
