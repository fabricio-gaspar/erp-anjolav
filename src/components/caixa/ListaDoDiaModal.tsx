import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import {
  CalendarDays,
  CircleAlert,
  Download,
  FileText,
  Loader2,
  Package,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientes } from "@/hooks/useClientes";
import { useListaDiaRols } from "@/hooks/useListaDiaRols";
import {
  LISTA_DIA_SITUACOES,
  LISTA_DIA_TIPOS_RELATORIO,
  LISTA_DIA_TITULOS,
  agruparListaDia,
  calcularTotaisListaDia,
  usaPeriodoDePrevisao,
  type ListaDiaFiltros,
  type ListaDiaModelo,
  type ListaDiaSituacao,
  type ListaDiaTipoRelatorio,
} from "@/lib/listaDiaRols";
import { imprimirListaDiaRols } from "@/lib/listaDiaRolsPrint";
import { downloadCsv } from "@/lib/csvExport";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface ListaDoDiaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAgenda?: () => void;
  embedded?: boolean;
}

const MODELO_LABELS: Record<ListaDiaModelo, string> = {
  com_valor: "Com valor",
  sem_valor: "Sem valor",
};

const SITUACAO_LABELS: Record<ListaDiaSituacao, string> = {
  todos: "Todos",
  receber_ou_devolver: "A receber ou peças a devolver",
  receber: "A receber",
  pecas_a_devolver: "Peças a devolver",
};

const ROLS_VAZIOS: never[] = [];

function criarFiltrosIniciais(): ListaDiaFiltros {
  const hoje = format(new Date(), "yyyy-MM-dd");
  return {
    tipoRelatorio: "entrada",
    dataEntradaInicio: hoje,
    dataEntradaFim: hoje,
    previsaoInicio: "",
    previsaoFim: "",
    modelo: "com_valor",
    situacao: "todos",
    numeroRol: "",
    clienteId: "",
  };
}

function formatarData(valor: string | null): string {
  if (!valor) return "—";
  const data = parseISO(valor);
  return isValid(data) ? format(data, "dd/MM/yyyy") : "—";
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function resumoPeriodo(filtros: ListaDiaFiltros): string {
  const descrever = (rotulo: string, inicio: string, fim: string) => {
    if (!inicio && !fim) return null;
    if (inicio && fim) return `${rotulo}: ${formatarData(inicio)} a ${formatarData(fim)}`;
    return inicio ? `${rotulo}: a partir de ${formatarData(inicio)}` : `${rotulo}: até ${formatarData(fim)}`;
  };
  const periodos = [
    descrever("Entrada", filtros.dataEntradaInicio, filtros.dataEntradaFim),
    descrever("Previsão", filtros.previsaoInicio, filtros.previsaoFim),
  ].filter(Boolean);
  return periodos.join(" · ") || "Todo o período";
}

function tituloGrupo(chave: string, titulo: string): string {
  return chave.startsWith("entrada:")
    ? `Data de entrada: ${formatarData(titulo)}`
    : `Cliente: ${titulo}`;
}

function FiltroData({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</Label>
      <Input id={id} type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="h-10" />
    </div>
  );
}

export function ListaDoDiaModal({ open, onOpenChange, onOpenAgenda, embedded = false }: ListaDoDiaModalProps) {
  const { activeTenant } = useAuth();
  const { activeArea } = useWorkspace();
  const [filtros, setFiltros] = useState<ListaDiaFiltros>(criarFiltrosIniciais);
  const [abaAtiva, setAbaAtiva] = useState("geral");
  const { clientes = [], isLoading: carregandoClientes } = useClientes({ enabled: open });
  const consulta = useListaDiaRols(filtros, open);
  const rols = consulta.data?.rols ?? ROLS_VAZIOS;
  const grupos = useMemo(() => agruparListaDia(rols, filtros.tipoRelatorio), [filtros.tipoRelatorio, rols]);
  const totais = useMemo(() => calcularTotaisListaDia(rols), [rols]);
  const comValor = filtros.modelo === "com_valor";
  const clienteSelecionado = clientes.find((cliente) => cliente.id === filtros.clienteId) ?? null;
  const totalColunas = comValor ? 9 : 7;
  const titulo = LISTA_DIA_TITULOS[filtros.tipoRelatorio];

  const atualizarFiltros = (atualizacao: Partial<ListaDiaFiltros>) => {
    setFiltros((atual) => ({ ...atual, ...atualizacao }));
  };

  const trocarTipoRelatorio = (tipoRelatorio: ListaDiaTipoRelatorio) => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    setFiltros((atual) => {
      const porPrevisao = usaPeriodoDePrevisao(tipoRelatorio);
      return {
        ...atual,
        tipoRelatorio,
        dataEntradaInicio: porPrevisao ? "" : (atual.dataEntradaInicio || hoje),
        dataEntradaFim: porPrevisao ? "" : (atual.dataEntradaFim || hoje),
        previsaoInicio: porPrevisao ? (atual.previsaoInicio || hoje) : "",
        previsaoFim: porPrevisao ? (atual.previsaoFim || hoje) : "",
      };
    });
  };

  const limparFiltros = () => setFiltros(criarFiltrosIniciais());

  const exportarCsv = () => {
    if (rols.length === 0 || consulta.data?.resultadoLimitado) return;
    const colunas = [
      { header: "ROL", value: (rol: typeof rols[number]) => rol.numero },
      { header: "Cliente", value: (rol: typeof rols[number]) => rol.clienteNome },
      { header: "Telefone", value: (rol: typeof rols[number]) => rol.telefone },
      { header: "Entrada", value: (rol: typeof rols[number]) => formatarData(rol.dataEntrada) },
      { header: "Previsão de entrega", value: (rol: typeof rols[number]) => formatarData(rol.dataPrevisao) },
      { header: "Peças", value: (rol: typeof rols[number]) => rol.totalPecas },
      { header: "Peças abertas", value: (rol: typeof rols[number]) => rol.pecasAbertas },
      ...(comValor ? [
        { header: "Valor total", value: (rol: typeof rols[number]) => rol.valorTotal.toFixed(2) },
        { header: "Valor aberto", value: (rol: typeof rols[number]) => rol.valorAberto.toFixed(2) },
      ] : []),
    ];
    downloadCsv(
      `lista-rols-${activeArea}-${filtros.tipoRelatorio}-${format(new Date(), "yyyy-MM-dd")}.csv`,
      rols,
      colunas,
    );
  };

  const imprimir = () => {
    if (rols.length === 0 || consulta.data?.resultadoLimitado) {
      toast.error("Não há ROLs para imprimir com os filtros atuais.");
      return;
    }
    const filtroDescricao = [
      resumoPeriodo(filtros),
      SITUACAO_LABELS[filtros.situacao],
      MODELO_LABELS[filtros.modelo],
      clienteSelecionado ? `Cliente: ${clienteSelecionado.nome_fantasia || clienteSelecionado.razao_social}` : null,
    ].filter(Boolean).join(" · ");
    const agendado = imprimirListaDiaRols({
      empresa: activeTenant?.name || "AnjoLav",
      titulo,
      filtroDescricao,
      grupos,
      totais,
      comValor,
    });
    if (!agendado) toast.error("O navegador bloqueou a janela de impressão. Libere os pop-ups e tente novamente.");
  };

  const abrirAgenda = () => {
    onOpenChange(false);
    onOpenAgenda?.();
  };

  const conteudo = (
      <>
        <header>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              {embedded ? <h3 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="h-5 w-5 text-primary" />Lista do dia</h3> : <DialogTitle className="flex items-center gap-2 text-xl"><CalendarDays className="h-5 w-5 text-primary" />Lista do dia</DialogTitle>}
              {embedded ? <p className="text-sm text-muted-foreground">Filtre os ROLs e imprima ou exporte a lista.</p> : <DialogDescription>Filtre os ROLs e imprima ou exporte a lista.</DialogDescription>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
                <RefreshCw className={consulta.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Atualizar
              </Button>
              <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={exportarCsv} disabled={rols.length === 0 || consulta.data?.resultadoLimitado}>
                <Download className="h-4 w-4" />CSV
              </Button>
              <Button type="button" className="min-h-10 gap-2" onClick={imprimir} disabled={rols.length === 0 || consulta.data?.resultadoLimitado}>
                <Printer className="h-4 w-4" />Imprimir
              </Button>
            </div>
          </div>
        </header>

        <div className="pdv-day-body space-y-3">
          <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
            <TabsList className="h-auto w-full justify-start sm:w-auto">
              <TabsTrigger value="geral" className="gap-2"><FileText className="h-4 w-4" />Geral</TabsTrigger>
              <TabsTrigger value="rol" className="gap-2"><Search className="h-4 w-4" />ROL</TabsTrigger>
              <TabsTrigger value="cliente" className="gap-2">Cliente</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="mt-4">
              <div className="pdv-day-filter-grid">
                <fieldset className="rounded-xl border bg-card p-4">
                  <legend className="px-1 text-sm font-semibold">Selecione o relatório</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {LISTA_DIA_TIPOS_RELATORIO.map((tipo) => (
                      <label key={tipo} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input
                          type="radio"
                          name="tipo-relatorio-lista-dia"
                          value={tipo}
                          checked={filtros.tipoRelatorio === tipo}
                          onChange={() => trocarTipoRelatorio(tipo)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{LISTA_DIA_TITULOS[tipo]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-4">
                  <section className="rounded-xl border bg-card p-4">
                    <h3 className="text-sm font-semibold">Períodos</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Filtre por entrada, previsão ou ambos.</p>
                    <div className="pdv-day-periods">
                      <fieldset className="rounded-lg border border-dashed p-3">
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">Data de entrada</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FiltroData id="lista-dia-entrada-inicio" label="Data inicial" value={filtros.dataEntradaInicio} max={filtros.dataEntradaFim || undefined} onChange={(dataEntradaInicio) => atualizarFiltros({ dataEntradaInicio })} />
                          <FiltroData id="lista-dia-entrada-fim" label="Data final" value={filtros.dataEntradaFim} min={filtros.dataEntradaInicio || undefined} onChange={(dataEntradaFim) => atualizarFiltros({ dataEntradaFim })} />
                        </div>
                      </fieldset>
                      <fieldset className="rounded-lg border border-dashed p-3">
                        <legend className="px-1 text-xs font-semibold text-muted-foreground">Previsão de entrega</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FiltroData id="lista-dia-previsao-inicio" label="Data inicial" value={filtros.previsaoInicio} max={filtros.previsaoFim || undefined} onChange={(previsaoInicio) => atualizarFiltros({ previsaoInicio })} />
                          <FiltroData id="lista-dia-previsao-fim" label="Data final" value={filtros.previsaoFim} min={filtros.previsaoInicio || undefined} onChange={(previsaoFim) => atualizarFiltros({ previsaoFim })} />
                        </div>
                      </fieldset>
                    </div>
                  </section>

                  <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
                    <fieldset>
                      <legend className="text-sm font-semibold">Modelo</legend>
                      <div className="mt-2 space-y-2">
                        {(Object.keys(MODELO_LABELS) as ListaDiaModelo[]).map((modelo) => (
                          <label key={modelo} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input type="radio" name="modelo-lista-dia" value={modelo} checked={filtros.modelo === modelo} onChange={() => atualizarFiltros({ modelo })} className="h-4 w-4 accent-primary" />
                            {MODELO_LABELS[modelo]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="grid gap-1.5">
                      <Label htmlFor="lista-dia-situacao" className="text-sm font-semibold">Situação</Label>
                      <Select value={filtros.situacao} onValueChange={(situacao) => atualizarFiltros({ situacao: situacao as ListaDiaSituacao })}>
                        <SelectTrigger id="lista-dia-situacao" className="h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LISTA_DIA_SITUACOES.map((situacao) => <SelectItem key={situacao} value={situacao}>{SITUACAO_LABELS[situacao]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </section>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rol" className="mt-4">
              <section className="rounded-xl border bg-card p-4">
                <Label htmlFor="lista-dia-numero-rol" className="text-sm font-semibold">Número do ROL</Label>
                <p className="mt-1 text-xs text-muted-foreground">Use este filtro para encontrar um ROL específico dentro do período selecionado.</p>
                <div className="mt-3 max-w-md">
                  <Input id="lista-dia-numero-rol" value={filtros.numeroRol} onChange={(event) => atualizarFiltros({ numeroRol: event.target.value })} placeholder="Ex.: 2026-000020" inputMode="numeric" />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="cliente" className="mt-4">
              <section className="rounded-xl border bg-card p-4">
                <Label htmlFor="lista-dia-cliente" className="text-sm font-semibold">Cliente</Label>
                <p className="mt-1 text-xs text-muted-foreground">O extrato do cliente exige esta seleção. Nos demais relatórios, ela limita a lista a um único cliente.</p>
                <Select value={filtros.clienteId || "__todos__"} onValueChange={(clienteId) => atualizarFiltros({ clienteId: clienteId === "__todos__" ? "" : clienteId })} disabled={carregandoClientes}>
                  <SelectTrigger id="lista-dia-cliente" className="mt-3 max-w-xl"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todos__">Todos os clientes</SelectItem>
                    {clientes.map((cliente) => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome_fantasia || cliente.razao_social}</SelectItem>)}
                  </SelectContent>
                </Select>
                {filtros.tipoRelatorio === "extrato" && !filtros.clienteId && (
                  <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">Selecione o cliente para gerar o extrato.</p>
                )}
              </section>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">{titulo}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{resumoPeriodo(filtros)} · {SITUACAO_LABELS[filtros.situacao]} · {MODELO_LABELS[filtros.modelo]}</p>
            </div>
            <Button type="button" variant="ghost" className="shrink-0 gap-2" onClick={limparFiltros}><RotateCcw className="h-4 w-4" />Limpar filtros</Button>
          </div>

          {consulta.isLoading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 rounded-xl border text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Carregando lista de ROLs...
            </div>
          ) : consulta.error ? (
            <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center">
              <CircleAlert className="h-6 w-6 text-destructive" />
              <div><p className="font-semibold">Não foi possível carregar a Lista do Dia.</p><p className="mt-1 text-sm text-muted-foreground">Nenhum total foi calculado enquanto a consulta falhou.</p></div>
              <Button type="button" variant="outline" onClick={() => void consulta.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
            </div>
          ) : consulta.data?.exigeCliente ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
              <p className="font-semibold">Selecione um cliente para consultar o extrato.</p>
              <p className="mt-1 text-sm text-muted-foreground">Abra a aba Cliente, escolha o cadastro e a lista será atualizada automaticamente.</p>
              <Button type="button" variant="link" onClick={() => setAbaAtiva("cliente")}>Escolher cliente</Button>
            </div>
          ) : rols.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center">
              <Package className="h-7 w-7 text-muted-foreground" />
              <p className="mt-3 font-semibold">Nenhum ROL encontrado</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">Não há ROLs que atendam aos filtros selecionados nesta operação.</p>
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${comValor ? "xl:grid-cols-5" : "xl:grid-cols-3"}`}>
                <Resumo titulo="ROLs" valor={String(totais.rols)} />
                <Resumo titulo="Peças" valor={String(totais.pecas)} />
                <Resumo titulo="Peças abertas" valor={String(totais.pecasAbertas)} />
                {comValor && <Resumo titulo="Valor total" valor={formatarMoeda(totais.valorTotal)} />}
                {comValor && <Resumo titulo="Valor em aberto" valor={formatarMoeda(totais.valorAberto)} destaque />}
              </div>

              {consulta.data?.resultadoLimitado && (
                <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  O período possui mais de 1.000 ROLs. Restrinja as datas ou um cliente para imprimir um relatório completo.
                </div>
              )}

              <div className="rounded-xl border">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ROL</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Prev. entrega</TableHead>
                      <TableHead className="text-right">Peças</TableHead>
                      <TableHead className="text-right">Abertas</TableHead>
                      {comValor && <TableHead className="text-right">Vlr. total</TableHead>}
                      {comValor && <TableHead className="text-right">Vlr. aberto</TableHead>}
                    </TableRow>
                  </TableHeader>
                  {grupos.map((grupo) => (
                    <TableBody key={grupo.chave}>
                      <TableRow className="bg-muted/45 hover:bg-muted/45">
                        <TableCell colSpan={totalColunas} className="py-2 text-xs font-bold uppercase tracking-wide text-primary">{tituloGrupo(grupo.chave, grupo.titulo)}</TableCell>
                      </TableRow>
                      {grupo.rols.map((rol) => (
                        <TableRow key={rol.id}>
                          <TableCell className="whitespace-nowrap font-semibold text-primary">{rol.numero}</TableCell>
                          <TableCell className="max-w-[240px] truncate font-medium" title={rol.clienteNome}>{rol.clienteNome}</TableCell>
                          <TableCell className="whitespace-nowrap">{rol.telefone || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatarData(rol.dataEntrada)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatarData(rol.dataPrevisao)}</TableCell>
                          <TableCell className="text-right tabular-nums">{rol.totalPecas}</TableCell>
                          <TableCell className="text-right tabular-nums">{rol.pecasAbertas}</TableCell>
                          {comValor && <TableCell className="text-right tabular-nums">{formatarMoeda(rol.valorTotal)}</TableCell>}
                          {comValor && <TableCell className="text-right tabular-nums font-medium">{formatarMoeda(rol.valorAberto)}</TableCell>}
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/25 hover:bg-muted/25">
                        <TableCell colSpan={5} className="py-2 text-right text-xs font-semibold uppercase">Total do grupo</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{grupo.totalPecas}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{grupo.pecasAbertas}</TableCell>
                        {comValor && <TableCell className="text-right font-semibold tabular-nums">{formatarMoeda(grupo.valorTotal)}</TableCell>}
                        {comValor && <TableCell className="text-right font-semibold tabular-nums">{formatarMoeda(grupo.valorAberto)}</TableCell>}
                      </TableRow>
                    </TableBody>
                  ))}
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-bold uppercase">Total geral</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{totais.pecas}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{totais.pecasAbertas}</TableCell>
                      {comValor && <TableCell className="text-right font-bold tabular-nums">{formatarMoeda(totais.valorTotal)}</TableCell>}
                      {comValor && <TableCell className="text-right font-bold tabular-nums">{formatarMoeda(totais.valorAberto)}</TableCell>}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </>
          )}
        </div>

        {(!embedded || onOpenAgenda) && <footer>
          {onOpenAgenda && <Button type="button" variant="outline" onClick={abrirAgenda}>Abrir agenda completa</Button>}
          {!embedded && <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>}
        </footer>}
      </>
  );
  return embedded ? <div className="space-y-4 border-t p-4">{conteudo}</div> : <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="pdv-compact-dialog pdv-day-dialog">{conteudo}</DialogContent></Dialog>;
}

function Resumo({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <article className="rounded-lg border bg-card px-2.5 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className={destaque ? "mt-0.5 text-base font-bold text-primary" : "mt-0.5 text-base font-bold"}>{valor}</p>
    </article>
  );
}
