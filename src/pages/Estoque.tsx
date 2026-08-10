import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useEstoque, EstoqueProduto } from "@/hooks/useEstoque";
import { useFornecedores } from "@/hooks/useFornecedores";
import { EstoqueDashboard } from "@/components/estoque/EstoqueDashboard";
import { EntradaEstoqueModal } from "@/components/estoque/EntradaEstoqueModal";
import { SaidaEstoqueModal } from "@/components/estoque/SaidaEstoqueModal";
import { toast } from "sonner";

const CATEGORIAS = [
  { value: "quimico", label: "Químico" },
  { value: "embalagem", label: "Embalagem" },
  { value: "epi", label: "EPI" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

const getStatus = (p: EstoqueProduto) => {
  if (p.quantidade_minima <= 0) return { label: "OK", variant: "default" as const };
  if (p.quantidade_atual <= 0) return { label: "Zerado", variant: "destructive" as const };
  if (p.quantidade_atual <= p.quantidade_minima) return { label: "Baixo", variant: "destructive" as const };
  if (p.quantidade_atual <= p.quantidade_minima * 1.5) return { label: "Atenção", variant: "secondary" as const };
  return { label: "OK", variant: "default" as const };
};

export default function Estoque() {
  const { produtos, isLoading, criarProduto, atualizarProduto, excluirProduto, totalItens, itensBaixos, valorTotal } = useEstoque();
  const { fornecedores } = useFornecedores();
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [modalProduto, setModalProduto] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [editando, setEditando] = useState<EstoqueProduto | null>(null);
  const [form, setForm] = useState<Partial<EstoqueProduto>>({});

  const filtered = produtos.filter((p) => {
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCat = filtroCategoria === "todos" || p.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ativo: true, categoria: "outros", unidade: "unidade", quantidade_atual: 0, quantidade_minima: 0, preco_custo: 0 });
    setModalProduto(true);
  };

  const abrirEditar = (p: EstoqueProduto) => {
    setEditando(p);
    setForm({ ...p });
    setModalProduto(true);
  };

  const salvar = async () => {
    if (!form.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editando) {
      await atualizarProduto.mutateAsync({ id: editando.id, ...form });
    } else {
      await criarProduto.mutateAsync(form);
    }
    setModalProduto(false);
  };

  return (
    <AppLayout title="Estoque" subtitle="Controle de insumos e materiais">
      <div className="w-full space-y-8">
        {/* Visual Content Header mirroring high-fidelity layout */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500/90">GESTÃO DE INSUMOS</span>
          </div>
          <h1 className="text-5xl font-black tracking-tightest text-slate-900 leading-[0.95] uppercase">
            Controle de Estoque
          </h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase tracking-wider">
            Monitoramento de níveis, validades e reposição técnica
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 flex-wrap w-full sm:w-auto">
          <Button variant="outline" onClick={() => setModalEntrada(true)} className="flex-1 sm:flex-none border-slate-200 text-slate-700 bg-slate-50/50 hover:bg-slate-100 h-10"><ArrowDownToLine className="w-4 h-4 mr-2" />Entrada</Button>
          <Button variant="outline" onClick={() => setModalSaida(true)} className="flex-1 sm:flex-none border-slate-200 text-slate-700 bg-slate-50/50 hover:bg-slate-100 h-10"><ArrowUpFromLine className="w-4 h-4 mr-2" />Saída</Button>
          <Button onClick={abrirNovo} className="flex-1 sm:flex-none bg-[#009ee3] hover:bg-[#008dcb] text-white border-none font-black text-[11px] uppercase tracking-[0.1em] shadow-sm h-10 px-6"><Plus className="w-4 h-4 mr-2" />Novo Insumo</Button>
        </div>

        <EstoqueDashboard totalItens={totalItens} itensBaixos={itensBaixos.length} valorTotal={valorTotal} />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar insumo..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" skipUppercase />
              </div>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead className="text-right">Qtd. Atual</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Mínimo</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Custo Unit.</TableHead>
                  <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] sm:w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum insumo encontrado</TableCell></TableRow>
                ) : (
                  filtered.map((p) => {
                    const status = getStatus(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium truncate max-w-[150px]">{p.nome}</TableCell>
                        <TableCell className="hidden sm:table-cell"><Badge variant="secondary">{CATEGORIAS.find(c => c.value === p.categoria)?.label || p.categoria}</Badge></TableCell>
                        <TableCell className="text-right">{p.quantidade_atual} {p.unidade}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{p.quantidade_minima} {p.unidade}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell">R$ {p.preco_custo?.toFixed(2)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{p.fornecedores?.nome || "—"}</TableCell>
                        <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => abrirEditar(p)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => excluirProduto.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Novo/Editar Produto */}
      <Dialog open={modalProduto} onOpenChange={setModalProduto}>
        <DialogContent className="wide-form-dialog">
          <DialogHeader><DialogTitle>{editando ? "Editar Insumo" : "Novo Insumo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria || "outros"} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade || "unidade"} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label>Qtd. Atual</Label><Input type="number" value={form.quantidade_atual ?? 0} onChange={(e) => setForm({ ...form, quantidade_atual: Number(e.target.value) })} /></div>
              <div><Label>Qtd. Mínima</Label><Input type="number" value={form.quantidade_minima ?? 0} onChange={(e) => setForm({ ...form, quantidade_minima: Number(e.target.value) })} /></div>
              <div><Label>Custo Unit.</Label><Input type="number" step="0.01" value={form.preco_custo ?? 0} onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Fornecedor</Label>
                <Select value={form.fornecedor_id || ""} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{fornecedores.filter(f => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Localização</Label><Input value={form.localizacao || ""} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Ex: Prateleira A3" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalProduto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criarProduto.isPending || atualizarProduto.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntradaEstoqueModal open={modalEntrada} onOpenChange={setModalEntrada} produtos={produtos} />
      <SaidaEstoqueModal open={modalSaida} onOpenChange={setModalSaida} produtos={produtos} />
    </AppLayout>
  );
}
