import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pdvPositionKey } from "@/lib/pdvPositionKey";
import {
  useDeletePdvStoragePosition,
  usePdvStoragePositions,
  useSavePdvStoragePosition,
  useSeedPdvStoragePositions,
  type PdvStoragePosition,
  type PdvStoragePositionType,
} from "@/hooks/usePdvStoragePositions";

type PdvArea = "residencial" | "industrial";

const typeLabels: Record<PdvStoragePositionType, string> = {
  cabideiro: "Cabideiro",
  balcao: "Balcão",
  prateleira: "Prateleira / apoio",
};

const emptyForm = {
  id: null as string | null,
  tipo: "cabideiro" as PdvStoragePositionType,
  codigo: "",
  nomeExibicao: "",
  ordem: "0",
  ativo: true,
};

export function ConfiguracoesPosicoesPdv() {
  const [area, setArea] = useState<PdvArea>("residencial");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const { data: positions = [], isLoading, isError, refetch } = usePdvStoragePositions(area, true, true);
  const save = useSavePdvStoragePosition();
  const remove = useDeletePdvStoragePosition();
  const seed = useSeedPdvStoragePositions();

  const filteredPositions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return positions;
    return positions.filter((position) => [position.codigo, position.nome_exibicao, typeLabels[position.tipo]]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [positions, search]);

  const duplicatePosition = useMemo(() => {
    const code = pdvPositionKey(form.codigo);
    const name = pdvPositionKey(form.nomeExibicao || `${typeLabels[form.tipo]} ${form.codigo}`);
    if (!code) return null;
    return positions.find((position) => position.id !== form.id && (
      (position.tipo === form.tipo && pdvPositionKey(position.codigo) === code)
      || pdvPositionKey(position.nome_exibicao) === name
    )) ?? null;
  }, [form, positions]);

  const resetForm = () => setForm(emptyForm);

  const editPosition = (position: PdvStoragePosition) => {
    setForm({
      id: position.id,
      tipo: position.tipo,
      codigo: position.codigo,
      nomeExibicao: position.nome_exibicao,
      ordem: String(position.ordem),
      ativo: position.ativo,
    });
  };

  const handleSave = async () => {
    if (!form.codigo.trim()) {
      toast.error("Informe o código da posição.");
      return;
    }
    if (duplicatePosition) {
      toast.error(`A posição “${duplicatePosition.nome_exibicao}” já está cadastrada neste setor.`);
      return;
    }
    try {
      await save.mutateAsync({
        id: form.id,
        area,
        tipo: form.tipo,
        codigo: form.codigo,
        nomeExibicao: form.nomeExibicao || `${typeLabels[form.tipo]} ${form.codigo}`,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
      });
      toast.success(form.id ? "Posição atualizada." : "Posição criada.");
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a posição.";
      toast.error(message.includes("Já existe uma posição") ? "Já existe uma posição com esse código ou nome neste setor." : message);
    }
  };

  const handleSeed = async () => {
    try {
      const count = await seed.mutateAsync(area);
      toast.success(count > 0 ? `${count} posições padrão adicionadas.` : "As posições padrão já estavam cadastradas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as posições padrão.");
    }
  };

  const handleDelete = async (position: PdvStoragePosition) => {
    if (!window.confirm(`Excluir a posição “${position.nome_exibicao}”? ROLs antigos continuarão com o texto salvo.`)) return;
    try {
      await remove.mutateAsync(position.id);
      if (form.id === position.id) resetForm();
      toast.success("Posição excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a posição.");
    }
  };

  return (
    <Card className="overflow-hidden rounded-2xl border-border/70">
      <div className="flex flex-col gap-3 border-b bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><MapPin className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="text-lg font-black">Posições do PDV</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre os locais de armazenamento usados na conferência e na disponibilização dos ROLs.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={area} onChange={(event) => { setArea(event.target.value as PdvArea); resetForm(); }} className="h-10 rounded-md border bg-background px-3 text-sm font-semibold">
            <option value="residencial">Doméstico</option>
            <option value="industrial">Industrial</option>
          </select>
          <Button variant="outline" onClick={() => void handleSeed()} disabled={seed.isPending}><Sparkles className="mr-2 h-4 w-4" />Carregar padrão</Button>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(280px,360px)_1fr]">
        <section className="space-y-4 rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <div><h3 className="font-black">{form.id ? "Editar posição" : "Nova posição"}</h3><p className="text-xs text-muted-foreground">A posição aparece como sugestão ao consultar o ROL.</p></div>
            {form.id && <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>}
          </div>
          <div className="space-y-2"><Label htmlFor="pdv-position-type">Tipo</Label><select id="pdv-position-type" value={form.tipo} onChange={(event) => setForm((current) => ({ ...current, tipo: event.target.value as PdvStoragePositionType }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="cabideiro">Cabideiro</option><option value="balcao">Balcão</option><option value="prateleira">Prateleira / apoio</option></select></div>
          <div className="space-y-2"><Label htmlFor="pdv-position-code">Código *</Label><Input id="pdv-position-code" value={form.codigo} onChange={(event) => setForm((current) => ({ ...current, codigo: event.target.value }))} placeholder="Ex.: 001, Vidro B5" /></div>
          <div className="space-y-2"><Label htmlFor="pdv-position-label">Nome exibido</Label><Input id="pdv-position-label" value={form.nomeExibicao} onChange={(event) => setForm((current) => ({ ...current, nomeExibicao: event.target.value }))} placeholder="Ex.: Cabideiro 001" /></div>
          {duplicatePosition && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>Já existe neste setor: <strong>{duplicatePosition.nome_exibicao}</strong> ({duplicatePosition.codigo}).</p><Button type="button" variant="outline" size="sm" onClick={() => { editPosition(duplicatePosition); setSearch(duplicatePosition.nome_exibicao); }}>Editar posição existente</Button></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="pdv-position-order">Ordem</Label><Input id="pdv-position-order" type="number" min="0" value={form.ordem} onChange={(event) => setForm((current) => ({ ...current, ordem: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="pdv-position-status">Status</Label><select id="pdv-position-status" value={form.ativo ? "ativo" : "inativo"} onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.value === "ativo" }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="ativo">Ativa</option><option value="inativo">Inativa</option></select></div>
          </div>
          <Button className="w-full" onClick={() => void handleSave()} disabled={save.isPending || Boolean(duplicatePosition)}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : form.id ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{form.id ? "Salvar alterações" : "Criar posição"}</Button>
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-black">Catálogo {area === "industrial" ? "industrial" : "doméstico"}</h3><p className="text-xs text-muted-foreground">{positions.length} posições cadastradas · {filteredPositions.length} exibidas</p></div><Input className="sm:max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar posição…" aria-label="Buscar posição" /></div>
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : isError ? <div className="space-y-2 rounded-xl border border-dashed p-8 text-center"><p className="text-sm text-destructive">Não foi possível carregar as posições.</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div> : positions.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><MapPin className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 font-semibold">Nenhuma posição cadastrada</p><p className="mt-1 text-sm text-muted-foreground">Use “Carregar padrão” para criar Cabideiros 001–510, Balcões 01–21 e os apoios informados.</p></div> : <div className="max-h-[560px] overflow-auto rounded-xl border"><div className="min-w-[620px] divide-y"><div className="grid grid-cols-[1.2fr_1fr_1.8fr_100px] gap-3 bg-muted/30 px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground"><span>Tipo</span><span>Código</span><span>Nome</span><span className="text-right">Ações</span></div>{filteredPositions.map((position) => <div key={position.id} className="grid grid-cols-[1.2fr_1fr_1.8fr_100px] items-center gap-3 px-4 py-3 text-sm"><div><p className="font-semibold">{typeLabels[position.tipo]}</p><Badge variant={position.ativo ? "default" : "secondary"}>{position.ativo ? "Ativa" : "Inativa"}</Badge></div><span className="font-mono">{position.codigo}</span><span className="truncate">{position.nome_exibicao}</span><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editPosition(position)} aria-label={`Editar ${position.nome_exibicao}`}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(position)} disabled={remove.isPending} aria-label={`Excluir ${position.nome_exibicao}`}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div></div>}
          {!isLoading && !isError && positions.length > 0 && filteredPositions.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma posição corresponde à busca.</p>}
        </section>
      </div>
    </Card>
  );
}
