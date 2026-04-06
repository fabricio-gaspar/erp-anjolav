import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail, CalendarClock, Receipt, MapPin } from "lucide-react";
import { useFornecedores, Fornecedor } from "@/hooks/useFornecedores";
import { useContasPagar } from "@/hooks/useContasPagar";
import { supabase } from "@/integrations/supabase/client";
import { buscarCnpj } from "@/services/apiServices";
import { toast } from "sonner";
import { formatCurrencyInput, parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";

const CATEGORIAS = [
  { value: "produtos_limpeza", label: "Produtos de Limpeza" },
  { value: "quimicos", label: "Químicos / Solventes" },
  { value: "embalagens", label: "Embalagens" },
  { value: "energia_agua", label: "Energia / Água / Gás" },
  { value: "aluguel", label: "Aluguel" },
  { value: "transporte", label: "Transporte / Logística" },
  { value: "equipamentos", label: "Equipamentos / Máquinas" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

const FREQUENCIAS: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  anual: "Anual",
  avulso: "Avulso",
};

const categoriaLabel = (cat: string | null) =>
  CATEGORIAS.find((c) => c.value === cat)?.label || cat || "Outros";

export default function Fornecedores() {
  const { fornecedores, isLoading, criarFornecedor, atualizarFornecedor, excluirFornecedor } = useFornecedores();
  const { createConta } = useContasPagar();
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<Partial<Fornecedor>>({});
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [excluirDialogOpen, setExcluirDialogOpen] = useState(false);
  const [fornecedorParaExcluir, setFornecedorParaExcluir] = useState<Fornecedor | null>(null);

  const filtered = fornecedores.filter((f) => {
    const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase()) ||
      f.cnpj_cpf?.includes(busca) || false;
    const matchCat = filtroCategoria === "todos" || f.categoria === filtroCategoria;
    const matchStatus = filtroStatus === "todos" || (filtroStatus === "ativo" ? f.ativo : !f.ativo);
    return matchBusca && matchCat && matchStatus;
  });

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ativo: true, categoria: "outros", endereco: {}, frequencia_pagamento: "mensal" });
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
    const dadosSalvar = { ...form };
    if (typeof dadosSalvar.valor_recorrente === "string") {
      const parsed = parseCurrencyToNumber(dadosSalvar.valor_recorrente as string);
      dadosSalvar.valor_recorrente = parsed > 0 ? parsed : null;
    }
    if (editando) {
      await atualizarFornecedor.mutateAsync({ id: editando.id, ...dadosSalvar });
    } else {
      await criarFornecedor.mutateAsync(dadosSalvar);
    }
    setModalAberto(false);
  };

  const gerarContaMes = async (f: Fornecedor) => {
    if (!f.valor_recorrente || !f.dia_vencimento) {
      toast.error("Configure valor e dia de vencimento primeiro");
      return;
    }
    const hoje = new Date();
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), f.dia_vencimento);
    if (vencimento < hoje) {
      vencimento.setMonth(vencimento.getMonth() + 1);
    }
    const mesAno = vencimento.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const vencStr = vencimento.toISOString().split("T")[0];

    // Verificar duplicata
    const inicioMes = new Date(vencimento.getFullYear(), vencimento.getMonth(), 1).toISOString().split("T")[0];
    const fimMes = new Date(vencimento.getFullYear(), vencimento.getMonth() + 1, 0).toISOString().split("T")[0];
    const { data: existente } = await supabase
      .from("contas_pagar")
      .select("id")
      .eq("fornecedor_id", f.id)
      .gte("vencimento", inicioMes)
      .lte("vencimento", fimMes)
      .limit(1);

    if (existente && existente.length > 0) {
      toast.error(`Já existe uma conta gerada para ${mesAno}`);
      return;
    }

    await createConta.mutateAsync({
      descricao: `Pagamento ${f.nome} — ${mesAno}`,
      fornecedor: f.nome,
      fornecedor_id: f.id,
      valor: f.valor_recorrente,
      vencimento: vencStr,
      categoria: categoriaLabel(f.categoria),
      observacoes: `Gerado automaticamente do fornecedor ${f.nome}`,
      status: "pendente",
      data_pagamento: null,
    });
    toast.success(`Conta gerada para ${mesAno}!`);
  };

  const buscarCNPJ = async () => {
    const cnpj = form.cnpj_cpf?.replace(/\D/g, "");
    if (!cnpj || cnpj.length !== 14) {
      toast.error("CNPJ inválido");
      return;
    }
    setBuscandoCnpj(true);
    try {
      const dados = await buscarCnpj(cnpj);
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

  const confirmarExclusao = (f: Fornecedor) => {
    setFornecedorParaExcluir(f);
    setExcluirDialogOpen(true);
  };

  const executarExclusao = () => {
    if (fornecedorParaExcluir) {
      excluirFornecedor.mutate(fornecedorParaExcluir.id);
    }
    setExcluirDialogOpen(false);
    setFornecedorParaExcluir(null);
  };

  const endereco = (form.endereco || {}) as Record<string, string>;
  const updateEndereco = (field: string, value: string) => {
    setForm({ ...form, endereco: { ...endereco, [field]: value } });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
            <p className="text-muted-foreground">Cadastro de fornecedores e parceiros comerciais</p>
          </div>
          <Button onClick={abrirNovo} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" />Novo Fornecedor</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" skipUppercase />
              </div>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {CATEGORIAS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
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
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Pagamento Recorrente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum fornecedor encontrado</TableCell></TableRow>
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
                        {f.valor_recorrente ? (
                          <div className="flex flex-col gap-0.5 text-sm">
                            <span className="font-medium text-foreground">
                              R$ {formatNumberToCurrency(Number(f.valor_recorrente))}
                            </span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              Dia {f.dia_vencimento} • {FREQUENCIAS[f.frequencia_pagamento || "mensal"] || f.frequencia_pagamento}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
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
                          {f.valor_recorrente && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Gerar conta do mês"
                              onClick={() => gerarContaMes(f)}
                              disabled={createConta.isPending}
                            >
                              <Receipt className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => abrirEditar(f)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => confirmarExclusao(f)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="wide-form-dialog">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>CNPJ/CPF</Label>
                <div className="flex gap-2">
                  <Input value={form.cnpj_cpf || ""} onChange={(e) => setForm({ ...form, cnpj_cpf: e.target.value })} placeholder="00.000.000/0000-00" className="flex-1" />
                  <Button variant="outline" onClick={buscarCNPJ} disabled={buscandoCnpj}>
                    {buscandoCnpj ? "Buscando..." : "Consultar"}
                  </Button>
                </div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>Razão Social</Label>
                <Input value={form.razao_social || ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Contato</Label>
                <Input value={form.contato_nome || ""} onChange={(e) => setForm({ ...form, contato_nome: e.target.value })} />
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4" />
                Endereço
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input value={endereco.cep || ""} onChange={(e) => updateEndereco("cep", e.target.value)} placeholder="00000-000" />
                </div>
                <div className="md:col-span-2">
                  <Label>Logradouro</Label>
                  <Input value={endereco.logradouro || ""} onChange={(e) => updateEndereco("logradouro", e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={endereco.numero || ""} onChange={(e) => updateEndereco("numero", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <div>
                  <Label>Bairro</Label>
                  <Input value={endereco.bairro || ""} onChange={(e) => updateEndereco("bairro", e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={endereco.cidade || ""} onChange={(e) => updateEndereco("cidade", e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={endereco.uf || ""} onChange={(e) => updateEndereco("uf", e.target.value)} maxLength={2} />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4" />
                Pagamento Recorrente
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Valor</Label>
                  <Input
                    skipUppercase
                    value={
                      form.valor_recorrente != null
                        ? typeof form.valor_recorrente === "number"
                          ? formatNumberToCurrency(form.valor_recorrente)
                          : String(form.valor_recorrente)
                        : ""
                    }
                    onChange={(e) => {
                      const v = formatCurrencyInput(e.target.value);
                      setForm({ ...form, valor_recorrente: v as any });
                    }}
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <Label>Dia Vencimento</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={form.dia_vencimento ?? ""}
                    onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Ex: 10"
                  />
                </div>
                <div>
                  <Label>Frequência</Label>
                  <Select value={form.frequencia_pagamento || "mensal"} onValueChange={(v) => setForm({ ...form, frequencia_pagamento: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQUENCIAS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Configure para gerar contas a pagar automaticamente e receber alertas no Dashboard.
              </p>
            </div>

            <Separator />

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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={excluirDialogOpen} onOpenChange={setExcluirDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{fornecedorParaExcluir?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executarExclusao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
