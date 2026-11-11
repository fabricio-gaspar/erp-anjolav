import { useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, ChevronRight, ClipboardList, History,
  Mail, MapPin, Pencil, Phone, Plus, Search, UserRound, Users,
} from "lucide-react";

import { StandardField, StandardPanel, StandardSplit } from "@/components/design-system/StandardScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type DemoClient = {
  id: string;
  name: string;
  kind: "PF" | "PJ";
  email: string;
  phone: string;
  document: string;
  city: string;
  status: "Ativo" | "Inativo";
  priceTable: string;
  lastVisit: string;
};

const CLIENTS: DemoClient[] = [
  { id: "0001", name: "CLIENTE EXEMPLO 01", kind: "PF", email: "exemplo01@exemplo.test", phone: "(11) 90000-0001", document: "Documento de exemplo", city: "São Roque / SP", status: "Ativo", priceTable: "Padrão", lastVisit: "06/11/2026" },
  { id: "0002", name: "LAVANDERIA EXEMPLO LTDA", kind: "PJ", email: "contato@exemplo.test", phone: "(11) 90000-0002", document: "Documento de exemplo", city: "São Roque / SP", status: "Ativo", priceTable: "Personalizada", lastVisit: "04/11/2026" },
  { id: "0003", name: "CLIENTE EXEMPLO 03", kind: "PF", email: "exemplo03@exemplo.test", phone: "(11) 90000-0003", document: "Documento de exemplo", city: "Mairinque / SP", status: "Inativo", priceTable: "Padrão", lastVisit: "24/10/2026" },
  { id: "0004", name: "CLIENTE EXEMPLO 04", kind: "PF", email: "exemplo04@exemplo.test", phone: "(11) 90000-0004", document: "Documento de exemplo", city: "São Roque / SP", status: "Ativo", priceTable: "Cesto", lastVisit: "07/11/2026" },
  { id: "0005", name: "HOTEL EXEMPLO LTDA", kind: "PJ", email: "financeiro@exemplo.test", phone: "(11) 90000-0005", document: "Documento de exemplo", city: "Ibiúna / SP", status: "Ativo", priceTable: "Personalizada", lastVisit: "07/11/2026" },
];

function Status({ value }: { value: DemoClient["status"] }) {
  return (
    <Badge
      variant="outline"
      className={value === "Ativo"
        ? "border-success/30 bg-success-light text-success"
        : "border-border bg-muted text-muted-foreground"}
    >
      {value}
    </Badge>
  );
}

/**
 * Reference ONLY: all values are fictitious; no data source, mutation or route
 * navigation. Once approved, apply the structure to the REAL Clients screen
 * keeping all existing tabs, permissions and business logic.
 */
export function ClientsWorkScreen() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [selectedId, setSelectedId] = useState(CLIENTS[0].id);
  const [dialog, setDialog] = useState<"details" | "new" | null>(null);
  const [dialogTab, setDialogTab] = useState("dados");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const filtered = useMemo(() => CLIENTS.filter(client =>
    (kind === "todos" || client.kind === kind)
    && (status === "todos" || client.status === status)
    && [client.name, client.id, client.email, client.phone]
      .join(" ").toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR"))
  ), [query, kind, status]);
  const selected = CLIENTS.find(client => client.id === selectedId) ?? CLIENTS[0];

  const startNew = () => {
    setName(""); setEmail(""); setPhone(""); setNotes(""); setConfirmed(false);
    setDialog("new");
  };

  const openDetails = (id: string) => {
    setSelectedId(id);
    setDialogTab("dados");
    setDialog("details");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {/* Independent operational reference preview: does not replace the app header. */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#102b47] px-4 py-3 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-base font-black tracking-tight">ANJOLAV</span>
          <span className="hidden h-5 w-px bg-white/25 sm:inline-block" />
          <span className="hidden rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/90 sm:inline-block">
            Lavanderia São Roque
          </span>
        </div>
        <span className="text-xs text-white/70">Prévia da tela interna · dados fictícios</span>
      </div>

      <div className="space-y-4 p-3 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Cadastros / Clientes</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Consulta de clientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Localize, consulte e edite sem percorrer telas desnecessárias.
            </p>
          </div>
          <Button className="shrink-0 gap-2" type="button" onClick={startNew}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Clientes:</span>
          <strong className="text-sm tabular-nums">{CLIENTS.length} exemplos</strong>
          <span className="hidden h-4 w-px bg-border sm:inline-block" />
          <span className="text-xs text-muted-foreground">
            {CLIENTS.filter(client => client.status === "Ativo").length} ativos · {CLIENTS.filter(client => client.status === "Inativo").length} inativo
          </span>
          <span className="ml-auto text-xs font-semibold text-muted-foreground">Industrial e Doméstico</span>
        </div>

        <StandardSplit
          primary={
            <StandardPanel title="Lista de clientes" description="Pesquisa, filtros e resultados juntos.">
              <div className="mb-3 flex flex-col gap-2 lg:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Pesquisar clientes de exemplo"
                    placeholder="Buscar por nome, código, contato..."
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    className="pl-9"
                    skipUppercase
                  />
                </div>
                <select aria-label="Tipo de cliente" value={kind} onChange={event => setKind(event.target.value)}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm lg:w-32">
                  <option value="todos">PF e PJ</option>
                  <option value="PF">Pessoa física</option>
                  <option value="PJ">Pessoa jurídica</option>
                </select>
                <select aria-label="Situação do cliente" value={status} onChange={event => setStatus(event.target.value)}
                  className="h-10 rounded-lg border border-input bg-card px-3 text-sm lg:w-32">
                  <option value="todos">Todos</option>
                  <option value="Ativo">Ativos</option>
                  <option value="Inativo">Inativos</option>
                </select>
                <Button type="button" variant="outline" onClick={() => {setQuery("");setKind("todos");setStatus("todos");}}>
                  Limpar
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Código</TableHead>
                    <TableHead>Nome / razão social</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Contato</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Abrir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length ? filtered.map(client => (
                    <TableRow
                      key={client.id}
                      data-state={client.id === selectedId ? "selected" : undefined}
                      className={client.id === selectedId ? "border-l-[3px] border-l-primary bg-primary/5" : "border-l-[3px] border-l-transparent"}
                    >
                      <TableCell className="font-bold tabular-nums">{client.id}</TableCell>
                      <TableCell>
                        <button className="text-left text-xs font-bold hover:text-primary hover:underline sm:text-sm"
                          onClick={() => setSelectedId(client.id)} type="button">{client.name}</button>
                        <p className="mt-0.5 text-xs text-muted-foreground lg:hidden">{client.phone}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell"><Badge variant="outline">{client.kind}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="block text-xs">{client.email}</span>
                        <span className="block text-xs text-muted-foreground">{client.phone}</span>
                      </TableCell>
                      <TableCell><Status value={client.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button aria-label={`Abrir ficha de ${client.name}`} type="button" variant="ghost" size="sm"
                          className="gap-1 text-primary" onClick={() => openDetails(client.id)}>
                          <span className="hidden md:inline">Ver ficha</span><ChevronRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Nenhum cliente de exemplo encontrado. Ajuste os filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">{filtered.length} de {CLIENTS.length} registros demonstrativos.</p>
            </StandardPanel>
          }
          aside={
            <StandardPanel title="Resumo do cliente" description="Ações próximas do registro selecionado.">
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-primary/5 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">Código {selected.id} · {selected.kind}</p>
                </div>
              </div>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Situação</dt><dd className="mt-1"><Status value={selected.status} /></dd></div>
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" /> E-mail</dt><dd className="mt-1 break-all text-xs font-medium">{selected.email}</dd></div>
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" /> Telefone</dt><dd className="mt-1 font-semibold">{selected.phone}</dd></div>
                <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> Cidade</dt><dd className="mt-1 font-semibold">{selected.city}</dd></div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <dt className="text-xs text-muted-foreground">Tabela de preço</dt>
                  <dd className="text-xs font-bold">{selected.priceTable}</dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                <Button type="button" className="w-full gap-2" onClick={() => openDetails(selected.id)}>
                  <Pencil className="h-4 w-4" /> Abrir cadastro
                </Button>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={() => {setDialogTab("historico");setDialog("details");}}>
                  <History className="h-4 w-4" /> Histórico
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">Abertura de ROL disponível apenas no sistema real.</p>
              </div>
            </StandardPanel>
          }
        />
      </div>

      <Dialog open={dialog !== null} onOpenChange={open => {if (!open) setDialog(null);}}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "new" ? "Novo cliente · exemplo" : selected.name}</DialogTitle>
            <DialogDescription>
              {dialog === "new"
                ? "Exemplo de formulário agrupado. Nada será salvo no sistema."
                : "Ficha de referência, sem acesso a dados reais ou alterações."}
            </DialogDescription>
          </DialogHeader>
          {dialog === "new" ? (
            <form className="space-y-4" onSubmit={event => {event.preventDefault();setConfirmed(true);}}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StandardField id="demo-new-name" label="Nome / razão social" required>
                  <Input id="demo-new-name" required value={name} onChange={event => {setName(event.target.value);setConfirmed(false);}} />
                </StandardField>
                <StandardField id="demo-new-email" label="E-mail">
                  <Input id="demo-new-email" type="email" value={email} onChange={event => {setEmail(event.target.value);setConfirmed(false);}} />
                </StandardField>
                <StandardField id="demo-new-phone" label="Telefone">
                  <Input id="demo-new-phone" value={phone} onChange={event => {setPhone(event.target.value);setConfirmed(false);}} />
                </StandardField>
                <StandardField id="demo-new-type" label="Pessoa">
                  <select id="demo-new-type" className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm">
                    <option>Física</option><option>Jurídica</option>
                  </select>
                </StandardField>
              </div>
              <StandardField id="demo-new-notes" label="Observações">
                <Textarea id="demo-new-notes" value={notes} onChange={event => {setNotes(event.target.value);setConfirmed(false);}} rows={3}/>
              </StandardField>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
                <Button type="submit">Validar formulário de exemplo</Button>
              </div>
              {confirmed && <p className="rounded-lg border border-success/30 bg-success-light p-3 text-xs text-success" role="status">
                Demonstração validada. Nenhum cliente foi cadastrado.
              </p>}
            </form>
          ) : selected && (
            <Tabs value={dialogTab} onValueChange={setDialogTab}>
              <div className="overflow-x-auto">
                <TabsList className="min-w-max">
                  <TabsTrigger value="dados">Dados e contato</TabsTrigger>
                  <TabsTrigger value="endereco">Endereço</TabsTrigger>
                  <TabsTrigger value="comercial">Condições comerciais</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="dados" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground">Identificação, tipo de pessoa e contatos em um único grupo.</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <StandardField id="detail-name" label="Cliente"><Input id="detail-name" value={selected.name} readOnly /></StandardField>
                  <StandardField id="detail-document" label="CPF / CNPJ"><Input id="detail-document" value={selected.document} readOnly /></StandardField>
                  <StandardField id="detail-mail" label="E-mail"><Input id="detail-mail" value={selected.email} readOnly /></StandardField>
                  <StandardField id="detail-phone" label="Telefone"><Input id="detail-phone" value={selected.phone} readOnly /></StandardField>
                </div>
              </TabsContent>
              <TabsContent value="endereco" className="pt-3">
                <div className="rounded-lg border border-border bg-muted/30 p-4"><MapPin className="mb-2 h-5 w-5 text-primary" />
                  <p className="font-semibold">{selected.city}</p><p className="mt-1 text-xs text-muted-foreground">Dados adicionais de endereço no cadastro real.</p>
                </div>
              </TabsContent>
              <TabsContent value="comercial" className="pt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Tabela aplicada</p><p className="mt-1 font-bold">{selected.priceTable}</p></div>
                  <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Condições de pagamento</p><p className="mt-1 text-sm">Conforme cadastro real</p></div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">O sistema funcional preservará Contrato, Preços, Configurações e Pagamento, sem omitir campos.</p>
              </TabsContent>
              <TabsContent value="historico" className="pt-3">
                <div className="flex gap-3 rounded-lg border border-border p-4"><CalendarDays className="h-5 w-5 text-primary" />
                  <div><p className="text-sm font-semibold">Último atendimento ilustrativo</p><p className="text-sm text-muted-foreground">{selected.lastVisit}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Histórico real será exibido somente após integração com permissões e dados.</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          {dialog === "details" && <div className="flex justify-between border-t border-border pt-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><ClipboardList className="h-3 w-3" /> Protótipo isolado</p>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}><ArrowLeft className="h-4 w-4" /> Voltar à lista</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
