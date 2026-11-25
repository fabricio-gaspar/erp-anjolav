export const LISTA_DIA_TIPOS_RELATORIO = [
  "entrada",
  "cliente",
  "previsao",
  "entrega",
  "passadoria",
  "extrato",
  "coleta",
] as const;

export type ListaDiaTipoRelatorio = typeof LISTA_DIA_TIPOS_RELATORIO[number];

export const LISTA_DIA_SITUACOES = [
  "todos",
  "receber_ou_devolver",
  "receber",
  "pecas_a_devolver",
] as const;

export type ListaDiaSituacao = typeof LISTA_DIA_SITUACOES[number];
export type ListaDiaModelo = "com_valor" | "sem_valor";

export interface ListaDiaFiltros {
  tipoRelatorio: ListaDiaTipoRelatorio;
  dataEntradaInicio: string;
  dataEntradaFim: string;
  previsaoInicio: string;
  previsaoFim: string;
  modelo: ListaDiaModelo;
  situacao: ListaDiaSituacao;
  numeroRol: string;
  clienteId: string;
}

export interface ListaDiaItemOrigem {
  quantidade: number | null;
  quantidade_entregue?: number | null;
}

export interface ListaDiaRolOrigem {
  id: string;
  numero: string;
  status: string | null;
  status_logistica: string | null;
  status_pagamento: string | null;
  data_retirada: string | null;
  data_previsao_entrega: string | null;
  valor_total: number | null;
  valor_pago: number | null;
  cliente: {
    id: string;
    razao_social: string | null;
    nome_fantasia?: string | null;
    telefone: string | null;
  } | null;
  itens: ListaDiaItemOrigem[] | null;
}

export interface ListaDiaRol {
  id: string;
  numero: string;
  clienteId: string | null;
  clienteNome: string;
  telefone: string | null;
  status: string | null;
  statusLogistica: string | null;
  statusPagamento: string | null;
  dataEntrada: string | null;
  dataPrevisao: string | null;
  totalPecas: number;
  pecasAbertas: number;
  valorTotal: number;
  valorAberto: number;
}

export interface ListaDiaGrupo {
  chave: string;
  titulo: string;
  rols: ListaDiaRol[];
  totalPecas: number;
  pecasAbertas: number;
  valorTotal: number;
  valorAberto: number;
}

export interface ListaDiaTotais {
  rols: number;
  pecas: number;
  pecasAbertas: number;
  valorTotal: number;
  valorAberto: number;
}

export const LISTA_DIA_TITULOS: Record<ListaDiaTipoRelatorio, string> = {
  entrada: "ROLs por data de entrada",
  cliente: "ROLs por cliente",
  previsao: "ROLs por previsão de entrega",
  entrega: "ROLs a entregar",
  passadoria: "ROLs para passadoria",
  extrato: "Extrato do cliente",
  coleta: "ROLs a coletar",
};

function numeric(value: number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum<T>(items: readonly T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

/**
 * Deriva os campos de conferência usados pela lista sem inventar dados:
 * peças abertas vêm dos itens ainda não entregues e valor aberto vem do
 * valor do ROL menos o que já foi recebido.
 */
export function criarLinhaListaDia(rol: ListaDiaRolOrigem): ListaDiaRol {
  const itens = rol.itens ?? [];
  const totalPecas = sum(itens, (item) => Math.max(numeric(item.quantidade), 0));
  const pecasEntregues = sum(itens, (item) => Math.min(
    Math.max(numeric(item.quantidade_entregue), 0),
    Math.max(numeric(item.quantidade), 0),
  ));
  const finalizado = rol.status === "entregue" || rol.status_logistica === "entregue";
  const valorTotal = Math.max(numeric(rol.valor_total), 0);
  const valorAberto = Math.max(valorTotal - Math.max(numeric(rol.valor_pago), 0), 0);
  const clienteNome = rol.cliente?.nome_fantasia?.trim()
    || rol.cliente?.razao_social?.trim()
    || "Cliente não informado";

  return {
    id: rol.id,
    numero: rol.numero,
    clienteId: rol.cliente?.id ?? null,
    clienteNome,
    telefone: rol.cliente?.telefone ?? null,
    status: rol.status,
    statusLogistica: rol.status_logistica,
    statusPagamento: rol.status_pagamento,
    dataEntrada: rol.data_retirada,
    dataPrevisao: rol.data_previsao_entrega,
    totalPecas,
    pecasAbertas: finalizado ? 0 : Math.max(totalPecas - pecasEntregues, 0),
    valorTotal,
    valorAberto,
  };
}

export function possuiValorEmAberto(rol: ListaDiaRol): boolean {
  return rol.valorAberto > 0.004;
}

export function possuiPecasEmAberto(rol: ListaDiaRol): boolean {
  return rol.pecasAbertas > 0;
}

export function correspondeSituacaoListaDia(rol: ListaDiaRol, situacao: ListaDiaSituacao): boolean {
  if (situacao === "todos") return true;
  if (situacao === "receber") return possuiValorEmAberto(rol);
  if (situacao === "pecas_a_devolver") return possuiPecasEmAberto(rol);
  return possuiValorEmAberto(rol) || possuiPecasEmAberto(rol);
}

export function calcularTotaisListaDia(rols: readonly ListaDiaRol[]): ListaDiaTotais {
  return {
    rols: rols.length,
    pecas: sum(rols, (rol) => rol.totalPecas),
    pecasAbertas: sum(rols, (rol) => rol.pecasAbertas),
    valorTotal: sum(rols, (rol) => rol.valorTotal),
    valorAberto: sum(rols, (rol) => rol.valorAberto),
  };
}

export function agruparListaDia(
  rols: readonly ListaDiaRol[],
  tipoRelatorio: ListaDiaTipoRelatorio,
): ListaDiaGrupo[] {
  const grupos = new Map<string, ListaDiaGrupo>();
  const agruparPorCliente = tipoRelatorio === "cliente" || tipoRelatorio === "extrato";

  for (const rol of rols) {
    const chave = agruparPorCliente
      ? `cliente:${rol.clienteId ?? rol.clienteNome}`
      : `entrada:${rol.dataEntrada ?? "sem-data"}`;
    const titulo = agruparPorCliente
      ? rol.clienteNome
      : rol.dataEntrada || "Entrada sem data";
    const grupo = grupos.get(chave) ?? {
      chave,
      titulo,
      rols: [],
      totalPecas: 0,
      pecasAbertas: 0,
      valorTotal: 0,
      valorAberto: 0,
    };
    grupo.rols.push(rol);
    grupo.totalPecas += rol.totalPecas;
    grupo.pecasAbertas += rol.pecasAbertas;
    grupo.valorTotal += rol.valorTotal;
    grupo.valorAberto += rol.valorAberto;
    grupos.set(chave, grupo);
  }

  return [...grupos.values()]
    .map((grupo) => ({
      ...grupo,
      rols: [...grupo.rols].sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true })),
    }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true }));
}

export function usaPeriodoDePrevisao(tipoRelatorio: ListaDiaTipoRelatorio): boolean {
  return ["previsao", "entrega", "passadoria", "coleta"].includes(tipoRelatorio);
}
