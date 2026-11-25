import type { ListaDiaGrupo, ListaDiaTotais } from "@/lib/listaDiaRols";
import { escapeHtml, openPrintDocument, printDocumentWhenReady } from "@/lib/safePrint";

function formatarData(valor: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function linhaTotal(
  grupo: Pick<ListaDiaTotais, "pecas" | "pecasAbertas" | "valorTotal" | "valorAberto">,
  comValor: boolean,
  texto: string,
): string {
  const cells = [
    `<td colspan="5" class="total-label">${escapeHtml(texto)}</td>`,
    `<td class="numeric">${grupo.pecas}</td>`,
    `<td class="numeric">${grupo.pecasAbertas}</td>`,
  ];
  if (comValor) {
    cells.push(`<td class="numeric">${formatarMoeda(grupo.valorTotal)}</td>`);
    cells.push(`<td class="numeric">${formatarMoeda(grupo.valorAberto)}</td>`);
  }
  return `<tr class="total-row">${cells.join("")}</tr>`;
}

export interface ImpressaoListaDiaOptions {
  empresa: string;
  titulo: string;
  filtroDescricao: string;
  grupos: ListaDiaGrupo[];
  totais: ListaDiaTotais;
  comValor: boolean;
}

/** Gera uma página isolada para impressão sem reutilizar o DOM do PDV. */
export function imprimirListaDiaRols({
  empresa,
  titulo,
  filtroDescricao,
  grupos,
  totais,
  comValor,
}: ImpressaoListaDiaOptions): boolean {
  const printWindow = openPrintDocument(
    criarHtmlListaDia({ empresa, titulo, filtroDescricao, grupos, totais, comValor }),
    "width=1280,height=900,noopener,noreferrer",
  );
  if (!printWindow) return false;
  return printDocumentWhenReady(printWindow);
}

export function criarHtmlListaDia({
  empresa,
  titulo,
  filtroDescricao,
  grupos,
  totais,
  comValor,
}: ImpressaoListaDiaOptions): string {
  const cabecalhoValores = comValor
    ? "<th>VLR. TOTAL</th><th>VLR. ABERTO</th>"
    : "";
  const gruposHtml = grupos.map((grupo) => {
    const linhas = grupo.rols.map((rol) => {
      const valores = comValor
        ? `<td class="numeric">${formatarMoeda(rol.valorTotal)}</td><td class="numeric">${formatarMoeda(rol.valorAberto)}</td>`
        : "";
      return `<tr>
        <td>${escapeHtml(rol.numero)}</td>
        <td>${escapeHtml(rol.clienteNome)}</td>
        <td>${escapeHtml(rol.telefone || "—")}</td>
        <td>${formatarData(rol.dataEntrada)}</td>
        <td>${formatarData(rol.dataPrevisao)}</td>
        <td class="numeric">${rol.totalPecas}</td>
        <td class="numeric">${rol.pecasAbertas}</td>
        ${valores}
      </tr>`;
    }).join("");
    const textoGrupo = grupo.chave.startsWith("entrada:")
      ? `DT. ENTRADA: ${formatarData(grupo.titulo)}`
      : `CLIENTE: ${grupo.titulo}`;
    return `<tbody>
      <tr class="group-row"><td colspan="${comValor ? 9 : 7}">${escapeHtml(textoGrupo)}</td></tr>
      ${linhas}
      ${linhaTotal({
        pecas: grupo.totalPecas,
        pecasAbertas: grupo.pecasAbertas,
        valorTotal: grupo.valorTotal,
        valorAberto: grupo.valorAberto,
      }, comValor, "TOTAL DO GRUPO")}
    </tbody>`;
  }).join("");

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(titulo)}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 9px; }
        header { border-bottom: 2px solid #1d4f91; margin-bottom: 12px; padding-bottom: 8px; }
        .company { color: #153e75; font-size: 14px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; }
        h1 { font-size: 16px; margin: 5px 0 3px; text-transform: uppercase; }
        .meta { display: flex; flex-wrap: wrap; gap: 4px 16px; color: #374151; }
        table { border-collapse: collapse; margin-top: 8px; width: 100%; }
        th, td { border: 1px solid #64748b; padding: 4px 5px; text-align: left; vertical-align: middle; }
        thead { display: table-header-group; }
        th { background: #dbeafe; color: #123a6b; font-size: 8px; font-weight: 700; white-space: nowrap; }
        .numeric { text-align: right; white-space: nowrap; }
        .group-row td { background: #eaf2ff; color: #123a6b; font-weight: 700; padding: 5px; }
        .total-row td { background: #f1f5f9; font-weight: 700; }
        .total-label { text-align: right; }
        footer { border-top: 1px solid #94a3b8; color: #475569; font-size: 8px; margin-top: 12px; padding-top: 6px; text-align: right; }
      </style>
    </head>
    <body>
      <header>
        <div class="company">${escapeHtml(empresa)}</div>
        <h1>${escapeHtml(titulo)}</h1>
        <div class="meta"><span>${escapeHtml(filtroDescricao)}</span><span>Emissão: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}</span></div>
      </header>
      <table>
        <thead><tr>
          <th>ROL</th>
          <th>CLIENTE</th>
          <th>TELEFONE</th>
          <th>ENTRADA</th>
          <th>PREV. ENTR.</th>
          <th>PEÇAS</th>
          <th>ABERTAS</th>
          ${cabecalhoValores}
        </tr></thead>
        ${gruposHtml}
        <tfoot>${linhaTotal(totais, comValor, "TOTAL GERAL")}</tfoot>
      </table>
      <footer>Lista operacional gerada pelo AnjoLav ERP</footer>
    </body>
  </html>`;
}
