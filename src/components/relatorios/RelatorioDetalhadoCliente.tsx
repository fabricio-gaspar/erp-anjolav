import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import type { LancamentoComItens } from "@/hooks/useRelatorioCliente";

interface RelatorioDetalhadoClienteProps {
  clienteNome: string;
  clienteDocumento?: string | null;
  lancamentos: LancamentoComItens[];
  periodoInicio: string;
  periodoFim: string;
  valorContrato?: number;
  empresaNome?: string;
  empresaSubtitulo?: string;
  logoUrl?: string | null;
  onPrint?: () => void;
}

interface PecaAgregada {
  nome: string;
  quantidadePorData: Record<string, number>;
  quantidadeTotal: number;
  valorUnitario: number;
  valorTotal: number;
}

export function RelatorioDetalhadoCliente({
  clienteNome,
  clienteDocumento,
  lancamentos,
  periodoInicio,
  periodoFim,
  valorContrato = 0,
  empresaNome = "ANJOLAV",
  empresaSubtitulo = "ANJOLAV SERVIÇOS DE LAVANDERIA",
  logoUrl,
  onPrint,
}: RelatorioDetalhadoClienteProps) {
  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Extrair mês/ano do período
  const periodoDate = new Date(periodoInicio);
  const mesNome = format(periodoDate, "MMMM", { locale: ptBR }).toUpperCase();
  const ano = format(periodoDate, "yyyy");

  // Agregar: linhas = peças, colunas = datas (dd/mmm) com nº ROL
  const agregarDados = () => {
    const mapaFinal = new Map<string, PecaAgregada>();
    const datasUnicas: { chave: string; dataFormatada: string; rolNumber: number }[] = [];

    lancamentos.forEach((lanc, index) => {
      const dataLanc = new Date(lanc.data_lancamento);
      const chave = format(dataLanc, "yyyy-MM-dd");
      const dataFormatada = format(dataLanc, "dd/MMM", { locale: ptBR }).toUpperCase();
      const rolNumber = 5000 + index;

      // Avoid duplicate dates
      if (!datasUnicas.find(d => d.chave === chave)) {
        datasUnicas.push({ chave, dataFormatada, rolNumber });
      } else {
        // Update rolNumber for existing date entry
        const existing = datasUnicas.find(d => d.chave === chave);
        if (existing) existing.rolNumber = rolNumber;
      }

      lanc.itens.forEach((item) => {
        const nomePeca = item.produto_nome.toUpperCase();
        if (!mapaFinal.has(nomePeca)) {
          mapaFinal.set(nomePeca, {
            nome: nomePeca,
            quantidadePorData: {},
            quantidadeTotal: 0,
            valorUnitario: item.preco_unitario,
            valorTotal: 0,
          });
        }
        const peca = mapaFinal.get(nomePeca)!;
        peca.quantidadePorData[chave] = (peca.quantidadePorData[chave] || 0) + item.quantidade;
        peca.quantidadeTotal += item.quantidade;
        peca.valorTotal += item.subtotal;
        if (item.preco_unitario > 0) peca.valorUnitario = item.preco_unitario;
      });
    });

    datasUnicas.sort((a, b) => a.chave.localeCompare(b.chave));
    const pecas = Array.from(mapaFinal.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    return { pecas, datas: datasUnicas };
  };

  const { pecas, datas } = agregarDados();

  const totalPecas = pecas.reduce((a, p) => ({
    quantidade: a.quantidade + p.quantidadeTotal,
    valor: a.valor + p.valorTotal,
  }), { quantidade: 0, valor: 0 });

  const totalGeral = totalPecas.valor + valorContrato;

  // Blue header color
  const azulHeader = "#4472C4";

  const handlePrint = () => {
    const printContent = document.getElementById("relatorio-detalhado-print");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head>
        <title>Relatório de Higienização - ${clienteNome}</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 9px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; }
        </style>
      </head><body>${printContent.innerHTML}</body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    }
    onPrint?.();
  };

  if (lancamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>Nenhum lançamento encontrado no período selecionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Download className="w-4 h-4" /> Exportar PDF
        </Button>
      </div>

      <div
        id="relatorio-detalhado-print"
        className="bg-white border rounded-lg p-4 text-[9px] overflow-x-auto"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* ============ CABEÇALHO AZUL ============ */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr>
              {/* Logo */}
              <td style={{
                border: "1px solid #000",
                width: "100px",
                textAlign: "center",
                verticalAlign: "middle",
                padding: "6px",
                background: azulHeader,
                color: "#fff",
              }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>{empresaNome}</div>
                <div style={{ fontSize: "7px" }}>LAVANDERIA</div>
              </td>
              {/* Título */}
              <td style={{
                border: "1px solid #000",
                textAlign: "center",
                verticalAlign: "middle",
                padding: "6px",
                background: azulHeader,
                color: "#fff",
              }}>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                  RELATÓRIO DE HIGIENIZAÇÃO
                </div>
                <div style={{ fontSize: "10px", fontWeight: "bold", marginTop: "2px" }}>
                  {clienteNome.toUpperCase()}
                </div>
              </td>
              {/* Mês/Ano */}
              <td style={{
                border: "1px solid #000",
                width: "160px",
                textAlign: "center",
                verticalAlign: "middle",
                padding: "6px",
                background: azulHeader,
                color: "#fff",
              }}>
                <div style={{ fontSize: "10px", fontWeight: "bold" }}>
                  MÊS {mesNome}
                </div>
                <div style={{ fontSize: "10px", fontWeight: "bold" }}>
                  DE {ano}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ TABELA PRINCIPAL ============ */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
          <thead>
            {/* Sub-cabeçalho: DATA com ROL */}
            <tr>
              <th style={{
                border: "1px solid #000",
                background: azulHeader,
                color: "#fff",
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                width: "30px",
              }}>
                ITEM
              </th>
              <th style={{
                border: "1px solid #000",
                background: azulHeader,
                color: "#fff",
                padding: "4px",
                textAlign: "left",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "120px",
              }}>
                DESCRIÇÃO
              </th>
              {datas.map((d) => (
                <th key={d.chave} style={{
                  border: "1px solid #000",
                  background: azulHeader,
                  color: "#fff",
                  padding: "2px",
                  textAlign: "center",
                  fontSize: "7px",
                  fontWeight: "bold",
                  minWidth: "30px",
                }}>
                  <div>{d.dataFormatada}</div>
                  <div style={{ fontSize: "6px", marginTop: "1px" }}>ROL {d.rolNumber}</div>
                </th>
              ))}
              <th style={{
                border: "1px solid #000",
                background: azulHeader,
                color: "#fff",
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "45px",
              }}>
                QTDE<br/>TOTAL
              </th>
              <th style={{
                border: "1px solid #000",
                background: azulHeader,
                color: "#fff",
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "55px",
              }}>
                VALOR<br/>UNIT R$
              </th>
              <th style={{
                border: "1px solid #000",
                background: azulHeader,
                color: "#fff",
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "65px",
              }}>
                VALOR<br/>TOTAL R$
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Linhas de peças */}
            {pecas.map((peca, idx) => (
              <tr key={peca.nome}>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "center",
                  fontSize: "9px",
                }}>
                  {idx + 1}
                </td>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "left",
                  fontSize: "9px",
                }}>
                  {peca.nome}
                </td>
                {datas.map((d) => (
                  <td key={d.chave} style={{
                    border: "1px solid #000",
                    padding: "2px",
                    textAlign: "center",
                    fontSize: "9px",
                  }}>
                    {peca.quantidadePorData[d.chave] || ""}
                  </td>
                ))}
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "9px",
                  fontWeight: "bold",
                }}>
                  {peca.quantidadeTotal}
                </td>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "9px",
                }}>
                  R$ {formatCurrency(peca.valorUnitario)}
                </td>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "9px",
                  fontWeight: "bold",
                }}>
                  R$ {formatCurrency(peca.valorTotal)}
                </td>
              </tr>
            ))}

            {/* Linha CONTRATO */}
            {valorContrato > 0 && (
              <tr>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "center",
                  fontSize: "9px",
                }}>
                  {pecas.length + 1}
                </td>
                <td colSpan={datas.length + 1} style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "left",
                  fontSize: "9px",
                  fontWeight: "bold",
                  background: "#FEF9C3",
                }}>
                  CONTRATO
                </td>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "9px",
                  background: "#FEF9C3",
                }}>
                </td>
                <td style={{
                  border: "1px solid #000",
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "9px",
                  fontWeight: "bold",
                  background: "#FEF9C3",
                }}>
                  R$ {formatCurrency(valorContrato)}
                </td>
              </tr>
            )}

            {/* TOTAL */}
            <tr>
              <td colSpan={datas.length + 2} style={{
                border: "1px solid #000",
                padding: "6px 8px",
                textAlign: "right",
                fontSize: "11px",
                fontWeight: "bold",
                background: azulHeader,
                color: "#fff",
              }}>
                TOTAL
              </td>
              <td style={{
                border: "1px solid #000",
                padding: "6px 4px",
                textAlign: "right",
                fontSize: "10px",
                fontWeight: "bold",
                background: azulHeader,
                color: "#fff",
              }}>
                {totalPecas.quantidade}
              </td>
              <td style={{
                border: "1px solid #000",
                padding: "6px 4px",
                background: azulHeader,
                color: "#fff",
              }}>
              </td>
              <td style={{
                border: "1px solid #000",
                padding: "6px 4px",
                textAlign: "right",
                fontSize: "11px",
                fontWeight: "bold",
                background: "#FFC000",
                color: "#000",
              }}>
                R$ {formatCurrency(totalGeral)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}