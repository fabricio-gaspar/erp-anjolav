import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import type { LancamentoComItens } from "@/hooks/useRelatorioCliente";

interface MapaMensalPecasProps {
  clienteNome: string;
  clienteDocumento?: string | null;
  clienteCodigo?: number;
  lancamentos: LancamentoComItens[];
  periodoInicio: string;
  periodoFim: string;
  numeroCobranca?: number;
  empresaNome?: string;
  empresaSubtitulo?: string;
  logoUrl?: string | null;
  onPrint?: () => void;
}

interface PecaAgregada {
  nome: string;
  quantidadePorDia: Record<string, number>;
  quantidadeTotal: number;
  valorUnitario: number;
  valorTotal: number;
}

export function MapaMensalPecas({
  clienteNome,
  clienteDocumento,
  clienteCodigo = 10,
  lancamentos,
  periodoInicio,
  periodoFim,
  numeroCobranca = 119,
  empresaNome = "ANJOLAV",
  empresaSubtitulo = "ANJOLAV SERVICOS DE LAVANDERIA",
  logoUrl,
  onPrint,
}: MapaMensalPecasProps) {
  // Função para formatar moeda
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Agregar lançamentos por peça e por dia
  const agregarPorDia = () => {
    const mapaFinal = new Map<string, PecaAgregada>();
    const diasUnicos = new Set<string>();

    lancamentos.forEach((lanc) => {
      const dataLanc = new Date(lanc.data_lancamento);
      const dia = format(dataLanc, "dd", { locale: ptBR });
      const mes = format(dataLanc, "MM", { locale: ptBR });
      const chave = `${dia}/${mes}`;
      diasUnicos.add(chave);

      lanc.itens.forEach((item) => {
        const nomePeca = item.produto_nome.toUpperCase();
        
        if (!mapaFinal.has(nomePeca)) {
          mapaFinal.set(nomePeca, {
            nome: nomePeca,
            quantidadePorDia: {},
            quantidadeTotal: 0,
            valorUnitario: item.preco_unitario,
            valorTotal: 0,
          });
        }

        const peca = mapaFinal.get(nomePeca)!;
        peca.quantidadePorDia[chave] = (peca.quantidadePorDia[chave] || 0) + item.quantidade;
        peca.quantidadeTotal += item.quantidade;
        peca.valorTotal += item.subtotal;
        // Atualiza o valor unitário médio se necessário
        if (item.preco_unitario > 0) {
          peca.valorUnitario = item.preco_unitario;
        }
      });
    });

    // Ordenar dias cronologicamente
    const diasOrdenados = Array.from(diasUnicos).sort((a, b) => {
      const [diaA, mesA] = a.split("/").map(Number);
      const [diaB, mesB] = b.split("/").map(Number);
      if (mesA !== mesB) return mesA - mesB;
      return diaA - diaB;
    });

    // Ordenar peças alfabeticamente
    const pecasOrdenadas = Array.from(mapaFinal.values()).sort((a, b) => 
      a.nome.localeCompare(b.nome)
    );

    return { pecas: pecasOrdenadas, dias: diasOrdenados };
  };

  const { pecas, dias } = agregarPorDia();

  // Calcular total geral
  const totalGeral = pecas.reduce(
    (acc, peca) => ({
      quantidade: acc.quantidade + peca.quantidadeTotal,
      valor: acc.valor + peca.valorTotal,
    }),
    { quantidade: 0, valor: 0 }
  );

  // Informações do período
  const getMesAno = () => {
    const date = new Date(periodoInicio);
    const mes = format(date, "M", { locale: ptBR });
    const ano = format(date, "yyyy", { locale: ptBR });
    return `${mes}/${ano}`;
  };

  const now = new Date();
  const dataEmissao = format(now, "dd/MM/yyyy");

  // Função de impressão
  const handlePrint = () => {
    const printContent = document.getElementById("mapa-mensal-print");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Mapa Mensal de Peças - ${clienteNome}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              font-size: 8px; 
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
            }
            th, td { 
              border: 1px solid #000; 
              padding: 2px 4px; 
              vertical-align: middle;
            }
            .header-row td {
              height: 40px;
            }
            .logo-cell {
              width: 100px;
              text-align: center;
              vertical-align: middle;
            }
            .logo-text {
              font-weight: bold;
              font-size: 14px;
              color: #0066cc;
            }
            .logo-subtitle {
              font-size: 8px;
              margin-top: 2px;
            }
            .title-cell {
              text-align: center;
              font-weight: bold;
              font-size: 14px;
            }
            .page-cell {
              width: 60px;
              text-align: right;
              font-size: 9px;
            }
            .info-row td {
              font-size: 9px;
              padding: 4px 8px;
            }
            .cliente-row td {
              font-size: 9px;
              padding: 4px 8px;
            }
            .matriz-header th {
              background: #f0f0f0 !important;
              font-size: 7px;
              font-weight: bold;
              text-align: center;
              padding: 2px;
              min-width: 22px;
            }
            .matriz-header th:first-child {
              text-align: left;
              min-width: 140px;
            }
            .matriz-row td {
              font-size: 8px;
              text-align: center;
              padding: 2px;
            }
            .matriz-row td:first-child {
              text-align: left;
              font-weight: 500;
            }
            .text-right { text-align: right !important; }
            .font-bold { font-weight: bold !important; }
            .total-row td {
              font-weight: bold;
              font-size: 9px;
              background: #e0e0e0 !important;
            }
            .total-geral-row td {
              font-weight: bold;
              font-size: 10px;
              background: #d0d0d0 !important;
            }
            .col-quant { min-width: 45px; }
            .col-unit { min-width: 50px; }
            .col-total { min-width: 65px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
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
      {/* Botões de ação */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" />
          Imprimir
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Conteúdo do relatório */}
      <div
        id="mapa-mensal-print"
        className="bg-white border rounded-lg p-4 text-[8px] overflow-x-auto"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* ============ CABEÇALHO ============ */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr className="header-row">
              {/* Logo */}
              <td 
                className="logo-cell"
                style={{ 
                  border: "1px solid #000", 
                  width: "100px", 
                  textAlign: "center",
                  verticalAlign: "middle"
                }}
              >
                <div className="logo-text" style={{ fontWeight: "bold", fontSize: "14px", color: "#0066cc" }}>
                  {empresaNome}
                </div>
                <div className="logo-subtitle" style={{ fontSize: "7px" }}>
                  LAVANDERIA
                </div>
              </td>
              {/* Título */}
              <td 
                className="title-cell"
                style={{ 
                  border: "1px solid #000", 
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                  verticalAlign: "middle"
                }}
              >
                <div>Mapa Mensal de Peças</div>
                <div style={{ fontSize: "10px", fontWeight: "normal", marginTop: "2px" }}>
                  {empresaSubtitulo}
                </div>
              </td>
              {/* Página */}
              <td 
                className="page-cell"
                style={{ 
                  border: "1px solid #000", 
                  width: "60px", 
                  textAlign: "right",
                  verticalAlign: "middle",
                  paddingRight: "8px",
                  fontSize: "9px"
                }}
              >
                Página: 1
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ INFORMAÇÕES DE COBRANÇA ============ */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr className="info-row">
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px" }}>
                Cobrança: {numeroCobranca}
              </td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px", textAlign: "right" }}>
                Dt.Emissão: {dataEmissao}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ CLIENTE ============ */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr className="cliente-row">
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px", width: "70%" }}>
                Cliente: {clienteCodigo}&nbsp;&nbsp;&nbsp;&nbsp;{clienteNome.toUpperCase()}
              </td>
              <td style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px", width: "30%", textAlign: "right" }}>
                Ref. Mês/Ano: {getMesAno()}
              </td>
            </tr>
            <tr className="cliente-row">
              <td colSpan={2} style={{ border: "1px solid #000", padding: "4px 8px", fontSize: "9px" }}>
                Departamento:
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ MATRIZ DE PEÇAS POR DIA ============ */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
          <thead>
            <tr className="matriz-header">
              <th style={{ 
                border: "1px solid #000", 
                background: "#f0f0f0", 
                padding: "4px", 
                textAlign: "left",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "140px"
              }}>
                Descrição da Peça
              </th>
              {/* Colunas de dias */}
              {dias.map((dia) => {
                const [d, m] = dia.split("/");
                return (
                  <th 
                    key={dia} 
                    style={{ 
                      border: "1px solid #000", 
                      background: "#f0f0f0", 
                      padding: "2px",
                      textAlign: "center",
                      fontSize: "7px",
                      fontWeight: "bold",
                      minWidth: "22px"
                    }}
                  >
                    <div>DIA</div>
                    <div>{d}</div>
                    <div style={{ fontSize: "6px" }}>MÊS {m}</div>
                  </th>
                );
              })}
              {/* Colunas finais */}
              <th style={{ 
                border: "1px solid #000", 
                background: "#f0f0f0", 
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "45px"
              }}>
                Quant.
              </th>
              <th style={{ 
                border: "1px solid #000", 
                background: "#f0f0f0", 
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "50px"
              }}>
                Vlr.Unit
              </th>
              <th style={{ 
                border: "1px solid #000", 
                background: "#f0f0f0", 
                padding: "4px",
                textAlign: "center",
                fontSize: "8px",
                fontWeight: "bold",
                minWidth: "65px"
              }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {pecas.map((peca) => (
              <tr key={peca.nome} className="matriz-row">
                <td style={{ 
                  border: "1px solid #000", 
                  padding: "3px 4px",
                  textAlign: "left",
                  fontSize: "8px",
                  fontWeight: "500"
                }}>
                  {peca.nome}
                </td>
                {/* Quantidades por dia */}
                {dias.map((dia) => (
                  <td 
                    key={dia} 
                    style={{ 
                      border: "1px solid #000", 
                      padding: "2px",
                      textAlign: "center",
                      fontSize: "8px"
                    }}
                  >
                    {peca.quantidadePorDia[dia] || ""}
                  </td>
                ))}
                {/* Totais da linha */}
                <td style={{ 
                  border: "1px solid #000", 
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "8px",
                  fontWeight: "bold"
                }}>
                  {peca.quantidadeTotal}
                </td>
                <td style={{ 
                  border: "1px solid #000", 
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "8px"
                }}>
                  {formatCurrency(peca.valorUnitario)}
                </td>
                <td style={{ 
                  border: "1px solid #000", 
                  padding: "3px 4px",
                  textAlign: "right",
                  fontSize: "8px",
                  fontWeight: "bold"
                }}>
                  {formatCurrency(peca.valorTotal)}
                </td>
              </tr>
            ))}

            {/* Total do Departamento */}
            <tr className="total-row">
              <td 
                colSpan={dias.length + 1}
                style={{ 
                  border: "1px solid #000", 
                  padding: "4px 8px",
                  textAlign: "right",
                  fontSize: "9px",
                  fontWeight: "bold",
                  background: "#e0e0e0"
                }}
              >
                Total do Departamento:
              </td>
              <td style={{ 
                border: "1px solid #000", 
                padding: "4px",
                textAlign: "right",
                fontSize: "9px",
                fontWeight: "bold",
                background: "#e0e0e0"
              }}>
                {totalGeral.quantidade}
              </td>
              <td style={{ 
                border: "1px solid #000", 
                padding: "4px",
                background: "#e0e0e0"
              }}>
              </td>
              <td style={{ 
                border: "1px solid #000", 
                padding: "4px",
                textAlign: "right",
                fontSize: "9px",
                fontWeight: "bold",
                background: "#e0e0e0"
              }}>
                {formatCurrency(totalGeral.valor)}
              </td>
            </tr>

            {/* Total Geral */}
            <tr className="total-geral-row">
              <td 
                colSpan={dias.length + 1}
                style={{ 
                  border: "1px solid #000", 
                  padding: "6px 8px",
                  textAlign: "right",
                  fontSize: "10px",
                  fontWeight: "bold",
                  background: "#d0d0d0"
                }}
              >
                Total Geral:
              </td>
              <td style={{ 
                border: "1px solid #000", 
                padding: "6px 4px",
                textAlign: "right",
                fontSize: "10px",
                fontWeight: "bold",
                background: "#d0d0d0"
              }}>
                {totalGeral.quantidade}
              </td>
              <td style={{ 
                border: "1px solid #000", 
                padding: "6px 4px",
                background: "#d0d0d0"
              }}>
              </td>
              <td style={{ 
                border: "1px solid #000", 
                padding: "6px 4px",
                textAlign: "right",
                fontSize: "10px",
                fontWeight: "bold",
                background: "#d0d0d0"
              }}>
                {formatCurrency(totalGeral.valor)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
