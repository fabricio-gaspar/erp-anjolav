import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail } from "lucide-react";
import { useFornecedores, Fornecedor } from "@/hooks/useFornecedores";
import { buscarCnpj } from "@/services/apiServices";
import { toast } from "sonner";

const CATEGORIAS = [
  { value: "produtos_limpeza", label: "Produtos de Limpeza" },
  { value: "embalagens", label: "Embalagens" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

const categoriaLabel = (cat: string | null) =>
  CATEGORIAS.find((c) => c.value === cat)?.label || cat || "Outros";

export default function Fornecedores() {
  const { fornecedores, isLoading, criarFornecedor, atualizarFornecedor, excluirFornecedor } = useFornecedores();
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<Partial<Fornecedor>>({});
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);

  const filtered = fornecedores.filter((f) => {
    const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      f.cnpj_cpf?.includes(busca) || false;
    const matchCat = filtroCategoria === "todos" || f.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ativo: true, categoria: "outros", endereco: {} });
    setModalAberto(true);
  };

  const abrirEditar = (f: Fornecedor) => {
    setEditando(f);
    setForm({ ...f });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editando) {
      await atualizarFornecedor.mutateAsync({ id: editando.id, ...form });
    } else {
      await criarFornecedor.mutateAsync(form);
    }
    setModalAberto(false);
  };

  const buscarCNPJ = async () => {
    const cnpj = form.cnpj_cpf?.replace(/\D/g, "");
    if (!cnpj || cnpj.length !== 14) {
      toast.error("CNPJ inválido");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const dados = await consultarCNPJ(cnpj);
      if (dados) {
        setForm((prev) => ({
          ...prev,
          nome: dados.nome_fantasia || dados.razao_social || prev.nome,
          razao_social: dados.razao_social,
          telefone: dados.ddd_telefone_1 ? `(${dados.ddd_telefone_1?.substring(0, 2)}) ${dados.ddd_telefone_1?.substring(2)}` : prev.telefone,
          email: dados.email || prev.email,
          endereco: {
            cep: dados.cep,
            logradouro: dados.logradouro,
            numero: dados.numero,
            bairro: dados.bairro,
            cidade: dados.municipio,
            uf: dados.uf,
          },
        }));
        toast.success("Dados do CNPJ carregados!");
      }
    } catch {
      toast.error("Erro ao consultar CNPJ");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
            <p className="text-muted-foreground">Cadastro de fornecedores e parceiros comerciais</p>
          </div>
          <Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" />Novo Fornecedor</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" skipUppercase />
              </div>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {CATEGORIAS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {f.nome}
                        </div>
                      </TableCell>
                      <TableCell>{f.cnpj_cpf || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{categoriaLabel(f.categoria)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-sm">
                          {f.telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{f.telefone}</span>}
                          {f.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{f.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.ativo ? "default" : "outline"}>{f.ativo ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirEditar(f)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => excluirFornecedor.mutate(f.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>CNPJ/CPF</Label>
                <Input value={form.cnpj_cpf || ""} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <Button variant="outline" className="mt-6" onClick={buscarCNPJ} disabled={buscandoCnpj}>
                {buscandoCnpj ? "Buscando..." : "Consultar"}
              </Button>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Razão Social</Label>
              <Input value={form.razao_social || ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contato</Label>
                <Input value={form.contato_nome || ""} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria || "outros"} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criarFornecedor.isPending || atualizarFornecedor.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
