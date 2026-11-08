import { useMemo, useState } from "react";
import {
  ArrowRight, CheckCircle2, CircleAlert, ClipboardList, FilePlus2,
  Layers3, PackageCheck, Search, SlidersHorizontal, Users, X,
} from "lucide-react";

import { StandardField, StandardMetric, StandardPanel, StandardScreen, StandardSplit } from "@/components/design-system/StandardScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Status = "Aguardando" | "Em produção" | "Pronto";
type DemoRow = {
  id: string;
  cliente: string;
  servico: string;
  entrega: string;
  pecas: number;
  total: string;
  status: Status;
};

/** Illustrative records ONLY. This page never reads/writes customer or order data. */
const DEMO_ROWS: DemoRow[] = [
  { id: "ROL-1001", cliente: "CLIENTE EXEMPLO 01", servico: "Lavagem por peça", entrega: "09/11/2026", pecas: 7, total: "R$ 86,00", status: "Em produção" },
  { id: "ROL-1002", cliente: "CLIENTE EXEMPLO 02", servico: "Lavagem de edredom", entrega: "10/11/2026", pecas: 2, total: "R$ 78,00", status: "Aguardando" },
  { id: "ROL-1003", cliente: "CLIENTE EXEMPLO 03", servico: "Lavagem por cesto", entrega: "08/11/2026", pecas: 12, total: "R$ 115,00", status: "Pronto" },
  { id: "ROL-1004", cliente: "CLIENTE EXEMPLO 04", servico: "Passadoria", entrega: "11/11/2026", pecas: 5, total: "R$ 55,00", status: "Aguardando" },
];

const statusClasses: Record<Status, string> = {
  Aguardando: "border-border bg-muted text-foreground",
  "Em produção": "border-warning/30 bg-warning-light text-warning",
  Pronto: "border-success/30 bg-success-light text-success",
};

function StatusBadge({ status }: { status: Status }) {
  return <Badge variant="outline" className={statusClasses[status]}>{status}</Badge>;
}

function TokenSample({ name, cssVariable, swatch }: { name: string; cssVariable: string; swatch: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3">
      <span className={"h-9 w-9 shrink-0 rounded-lg border border-border " + swatch} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{name}</p>
        <code className="block truncate text-xs text-muted-foreground">{cssVariable}</code>
      </div>
    </div>
  );
}

export default function BibliotecaVisual() {
  const [tab, setTab] = useState("lista");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selected, setSelected] = useState<DemoRow | null>(null);
  const [focused, setFocused] = useState<DemoRow>(DEMO_ROWS[0]);
  const [form, setForm] = useState({ cliente: "", tipo: "residencial", entrega: "", observacao: "" });
  const [simulated, setSimulated] = useState(false);

  const filtered = useMemo(() => DEMO_ROWS.filter((row) => {
    const matchesText = [row.id, row.cliente, row.servico].join(" ").toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR"));
    return matchesText && (statusFilter === "todos" || row.status === statusFilter);
  }), [search, statusFilter]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("todos");
  };

  return (
    <StandardScreen
      eyebrow="Biblioteca de interface · versão inicial"
      title="Tela-padrão ANJOLAV"
      description="Referência de componentes e comportamento para padronizar o Administrativo. Registros e ações desta página são apenas demonstrativos."
      actions={
        <>
          <Badge variant="outline" className="self-start border-primary/30 bg-primary/5 text-primary sm:self-auto">
            Protótipo isolado
          </Badge>
          <Button type="button" onClick={() => setTab("formulario")}>
            <FilePlus2 className="h-4 w-4" /> Novo exemplo
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <Layers3 className="h-4 w-4 shrink-0 text-primary" />
          <span><strong>Uma linguagem visual.</strong> Mesmos componentes, distâncias e estados para todos os cadastros e módulos administrativos.</span>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">Sem acesso ao banco de dados</span>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0">
        <div className="scrollbar-hide overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="lista">Lista e atendimento</TabsTrigger>
            <TabsTrigger value="formulario">Formulário padrão</TabsTrigger>
            <TabsTrigger value="componentes">Componentes e cores</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lista" className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StandardMetric label="Registros ilustrativos" value="04" hint="Exemplo de indicador" icon={ClipboardList} />
            <StandardMetric label="Em produção" value="01" hint="Status demonstrativo" icon={SlidersHorizontal} tone="warning" />
            <StandardMetric label="Concluídos" value="01" hint="Status demonstrativo" icon={PackageCheck} tone="success" />
            <StandardMetric label="Clientes de exemplo" value="04" hint="Nenhum cliente real" icon={Users} />
          </div>

          <StandardSplit
            primary={
              <StandardPanel
            title="Lista de atendimento"
            description="Filtro, tabela, status e ação na mesma área visual."
            actions={<Button type="button" variant="outline" size="sm" onClick={() => setTab("formulario")}><FilePlus2 className="h-4 w-4" /> Novo exemplo</Button>}
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Buscar registro demonstrativo"
                  placeholder="Buscar ROL, cliente ou serviço..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  skipUppercase
                />
              </div>
              <select
                aria-label="Filtrar por situação"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground sm:w-44"
              >
                <option value="todos">Todos os status</option>
                <option value="Aguardando">Aguardando</option>
                <option value="Em produção">Em produção</option>
                <option value="Pronto">Pronto</option>
              </select>
              <Button type="button" variant="outline" onClick={resetFilters}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ROL</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Serviço</TableHead>
                  <TableHead className="hidden sm:table-cell">Entrega</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Peças</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length ? filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap font-bold text-primary">{row.id}</TableCell>
                    <TableCell className="max-w-[220px] truncate font-semibold">{row.cliente}</TableCell>
                    <TableCell className="hidden lg:table-cell">{row.servico}</TableCell>
                    <TableCell className="hidden whitespace-nowrap sm:table-cell">{row.entrega}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{row.pecas}</TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{row.total}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setFocused(row); setSelected(row); }}>
                        <span className="hidden sm:inline">Visualizar</span><ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="page-empty-state min-h-[160px]">
                        <Search className="mb-2 h-6 w-6" />
                        <strong>Nenhum registro demonstrativo encontrado</strong>
                        <span className="mt-1 text-xs">Ajuste os filtros ou limpe a pesquisa.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">Mostrando {filtered.length} de {DEMO_ROWS.length} exemplos fictícios.</p>
              </StandardPanel>
            }
            aside={
              <StandardPanel title="Resumo selecionado" description="Painel contextual próximo à tabela.">
                <div className="space-y-4">
                  <div className="rounded-lg bg-primary/5 p-3">
                    <p className="text-xs font-bold text-muted-foreground">ROL ativo · exemplo</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{focused.id}</p>
                    <p className="mt-1 text-sm font-semibold">{focused.cliente}</p>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Situação</span>
                      <StatusBadge status={focused.status} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Peças</span>
                      <strong className="tabular-nums">{focused.pecas}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Entrega</span>
                      <strong>{focused.entrega}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="font-semibold">Total</span>
                      <strong className="text-lg tabular-nums">{focused.total}</strong>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <Button type="button" className="w-full" onClick={() => setSelected(focused)}>
                      Visualizar exemplo <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => setTab("formulario")}>
                      Novo exemplo
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => setTab("componentes")}>
                      Biblioteca de componentes
                    </Button>
                  </div>
                </div>
              </StandardPanel>
            }
          />
        </TabsContent>

        <TabsContent value="formulario" className="space-y-5">
          <StandardPanel title="Novo atendimento · formulário padrão" description="Exemplo de grupos, rótulos, campos, validação e ações em sequência lógica.">
            <form onSubmit={(event) => { event.preventDefault(); setSimulated(true); }} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <StandardField id="demo-cliente" label="Cliente" required>
                  <Input
                    id="demo-cliente"
                    placeholder="Digite o nome do cliente"
                    value={form.cliente}
                    onChange={(event) => { setForm((current) => ({ ...current, cliente: event.target.value })); setSimulated(false); }}
                    required
                    maxLength={120}
                  />
                </StandardField>
                <StandardField id="demo-tipo" label="Tipo de atendimento">
                  <select
                    id="demo-tipo"
                    className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
                    value={form.tipo}
                    onChange={(event) => { setForm((current) => ({ ...current, tipo: event.target.value })); setSimulated(false); }}
                  >
                    <option value="residencial">Doméstico</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </StandardField>
                <StandardField id="demo-entrega" label="Data de entrega" required hint="No sistema real, a data precisa respeitar a capacidade diária configurada.">
                  <Input id="demo-entrega" type="date" value={form.entrega}
                    onChange={(event) => { setForm((current) => ({ ...current, entrega: event.target.value })); setSimulated(false); }} required />
                </StandardField>
                <div className="flex items-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  Esta biblioteca mostra o padrão de campos. Não agenda produção nem registra pagamentos.
                </div>
              </div>
              <StandardField id="demo-observacao" label="Observações">
                <Textarea id="demo-observacao" placeholder="Informações relevantes para o atendimento..." rows={3}
                  value={form.observacao}
                  onChange={(event) => { setForm((current) => ({ ...current, observacao: event.target.value })); setSimulated(false); }} />
              </StandardField>
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => { setForm({ cliente: "", tipo: "residencial", entrega: "", observacao: "" }); setSimulated(false); }}>
                  Limpar exemplo
                </Button>
                <Button type="submit"><CheckCircle2 className="h-4 w-4" /> Validar demonstração</Button>
              </div>
              {simulated && (
                <p role="status" className="flex items-start gap-2 rounded-lg border border-success/30 bg-success-light p-3 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Campos obrigatórios preenchidos. Simulação concluída localmente; nenhuma informação foi gravada.
                </p>
              )}
            </form>
          </StandardPanel>
        </TabsContent>

        <TabsContent value="componentes" className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <StandardPanel title="Paleta semântica" description="Cores ligadas aos tokens já existentes do tema.">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <TokenSample name="Principal" cssVariable="--primary" swatch="bg-primary" />
                <TokenSample name="Secundária" cssVariable="--secondary" swatch="bg-secondary" />
                <TokenSample name="Sucesso" cssVariable="--success" swatch="bg-success" />
                <TokenSample name="Atenção" cssVariable="--warning" swatch="bg-warning" />
                <TokenSample name="Erro" cssVariable="--destructive" swatch="bg-destructive" />
                <TokenSample name="Superfície" cssVariable="--card" swatch="bg-card" />
              </div>
            </StandardPanel>
            <StandardPanel title="Botões e estados" description="Hierarquia de ações consistente em todo o ERP.">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => setTab("formulario")}>Ação principal</Button>
                <Button type="button" variant="outline" onClick={() => setTab("lista")}>Ação secundária</Button>
                <Button type="button" variant="ghost" onClick={() => setTab("lista")}>Ação discreta</Button>
                <Button type="button" disabled>Desabilitado</Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <StatusBadge status="Aguardando" />
                <StatusBadge status="Em produção" />
                <StatusBadge status="Pronto" />
              </div>
              <div className="mt-5 flex gap-2 rounded-lg border border-warning/30 bg-warning-light p-3 text-xs text-warning">
                <CircleAlert className="h-4 w-4 shrink-0" />
                Utilize cores de estado apenas quando houver significado operacional.
              </div>
            </StandardPanel>
          </div>
          <StandardPanel title="Tipografia e ritmo visual" description="Regras para títulos, textos, respiros e densidade operacional.">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Título da página</p><p className="mt-2 text-[28px] font-bold tracking-tight">Clientes e atendimentos</p></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Título do card</p><p className="mt-2 text-base font-bold">Lista do dia</p><p className="mt-1 text-sm text-muted-foreground">Descrição objetiva da seção.</p></div>
              <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Escala de espaços</p><p className="mt-2 text-sm font-semibold">4 · 8 · 12 · 16 · 24 · 32 px</p><p className="mt-1 text-sm text-muted-foreground">Campos de 40 px e alvos clicáveis acessíveis.</p></div>
            </div>
          </StandardPanel>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes demonstrativos do ROL</DialogTitle>
            <DialogDescription>Exemplo de modal padrão; nenhuma operação real é executada.</DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-muted-foreground">Número</dt><dd className="font-bold">{selected.id}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Situação</dt><dd className="mt-1"><StatusBadge status={selected.status} /></dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">Cliente</dt><dd className="font-semibold">{selected.cliente}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Entrega</dt><dd className="font-semibold">{selected.entrega}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Total</dt><dd className="font-semibold">{selected.total}</dd></div>
            </dl>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </StandardScreen>
  );
}
