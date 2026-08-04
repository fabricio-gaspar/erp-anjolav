import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import type { LancamentoComItens } from "@/hooks/useRelatorioCliente";

interface MapaPecasClienteProps {
  clienteNome: string;
  clienteDocumento?: string | null;
  lancamentos: LancamentoComItens[];
  periodoInicio: string;
  periodoFim: string;
  valorContrato?: number;
  numeroCobranca?: number;
  empresaNome?: string;
  empresaSubtitulo?: string;
  logoUrl?: string | null;
  onPrint?: () => void;
}

export function MapaPecasCliente({
  clienteNome,
  clienteDocumento,
  lancamentos,
  periodoInicio,
  periodoFim,
  valorContrato = 0,
  numeroCobranca = 1,
  empresaNome = "ANJOLAV",
  empresaSubtitulo = "ANJOLAV SERVIÇOS DE LAVANDERIA",
  logoUrl,
  onPrint,
}: MapaPecasClienteProps) {
  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (date: string) =>
    format(new Date(date), "dd/MM/yyyy", { locale: ptBR });

  const getMesAno = () => {
    const date = new Date(periodoInicio);
    return `${format(date, "MM")} / ${format(date, "yyyy")}`;
  };

  const totaisGerais = lancamentos.reduce(
    (acc, lanc) => {
      const t = lanc.itens.reduce((a, i) => ({ q: a.q + i.quantidade, v: a.v + i.subtotal }), { q: 0, v: 0 });
      return { quantidade: acc.quantidade + t.q, valor: acc.valor + t.v };
    },
    { quantidade: 0, valor: 0 }
  );

  const now = new Date();
  const dataEmissao = format(now, "dd/MM/yyyy");
  const horaEmissao = format(now, "HH:mm:ss");

  const handlePrint = () => {
    const printContent = document.getElementById("mapa-pecas-print");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head>
        <title>Mapa de Peças - ${clienteNome}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 3px 6px; vertical-align: middle; }
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
        id="mapa-pecas-print"
        className="bg-white border rounded-lg p-4 text-[10px] overflow-x-auto"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* CABEÇALHO */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", width: "120px", textAlign: "center", verticalAlign: "middle", padding: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "14px", color: "#0066cc" }}>{empresaNome}</div>
                <div style={{ fontSize: "7px" }}>LAVANDERIA</div>
              </td>
              <td style={{ border: "1px solid #000", textAlign: "center", verticalAlign: "middle", padding: "8px" }}>
                <div style={{ fontWeight: "bold", fontSize: "16px" }}>Mapa de Peças por Cliente</div>
                <div style={{ fontSize: "10px" }}>{empresaSubtitulo}</div>
              </td>
              <td style={{ border: "1px solid #000", width: "140px", textAlign: "right", verticalAlign: "middle", padding: "8px", paddingRight: "10px" }}>
                <div style={{ fontSize: "10px" }}>Dt.Emissão: {dataEmissao}</div>
                <div style={{ fontSize: "10px" }}>Hr.Emissão: {horaEmissao}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* CLIENTE DESTAQUE */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", background: "#FEF9C3", textAlign: "center", fontWeight: "bold", fontSize: "14px", padding: "8px" }}>
                {clienteNome.toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* INFORMAÇÕES */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10px", width: "60%" }}>
                <div>Cobrança: {numeroCobranca}</div>
                <div>Dt.Emissão: {dataEmissao}</div>
              </td>
              <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10px", textAlign: "right", width: "40%" }}>
                Ref. Mês/Ano: {getMesAno()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* CLIENTE INFO */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px" }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10px" }}>
                Cliente: {clienteNome.toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ROLs */}
        {lancamentos.map((lancamento, index) => {
          const rolNumber = 5000 + index;
          const totaisRol = lancamento.itens.reduce(
            (acc, item) => ({ quantidade: acc.quantidade + item.quantidade, valor: acc.valor + item.subtotal }),
            { quantidade: 0, valor: 0 }
          );

          return (
            <div key={lancamento.id} style={{ marginBottom: "8px" }}>
              {/* ROL Header */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "10px", padding: "4px 8px", width: "12%" }}>
                      ROL: {rolNumber}
                    </td>
                    <td style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "10px", padding: "4px 8px", width: "22%" }}>
                      DT.ENTRADA: {formatDate(lancamento.data_lancamento)}
                    </td>
                    <td style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "10px", padding: "4px 8px", width: "22%" }}>
                      PREV.ENTR.: {lancamento.data_entrega ? formatDate(lancamento.data_entrega) : ""}
                    </td>
                    <td style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "10px", padding: "4px 8px", width: "22%" }}>
                      DEPART.:
                    </td>
                    <td style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "10px", padding: "4px 8px", width: "22%" }}>
                      BLOCO:
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Items */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "left", width: "25%" }}>
                      DESCRIÇÃO DA PEÇA
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "center", width: "15%" }}>
                      COMPLEMENTO
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "center", width: "8%" }}>
                      PESO
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "center", width: "7%" }}>
                      Q.CLI.
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "center", width: "7%" }}>
                      QUANT.
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "center", width: "10%" }}>
                      UNIT.
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "center", width: "12%" }}>
                      TOTAL
                    </th>
                    <th style={{ border: "1px solid #000", background: "#FEF9C3", fontWeight: "bold", fontSize: "9px", padding: "4px 6px", textAlign: "left", width: "16%" }}>
                      OBS.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lancamento.itens.map((item) => (
                    <tr key={item.id}>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "left" }}>
                        {item.produto_nome.toUpperCase()}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "center" }}></td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "right" }}></td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "right" }}></td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "right" }}>
                        {item.quantidade}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "right" }}>
                        <span style={{ marginRight: "4px" }}>R$</span>{formatCurrency(item.preco_unitario)}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "right" }}>
                        <span style={{ marginRight: "4px" }}>R$</span>{formatCurrency(item.subtotal)}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "3px 6px", fontSize: "10px", textAlign: "left" }}></td>
                    </tr>
                  ))}
                  {/* Totais do ROL */}
                  <tr>
                    <td colSpan={4} style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10px", textAlign: "right", fontWeight: "bold" }}>
                      TOTAIS DO ROL:
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10px", textAlign: "right", fontWeight: "bold" }}>
                      {totaisRol.quantidade}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10px" }}></td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10px", textAlign: "right", fontWeight: "bold" }}>
                      <span style={{ marginRight: "4px" }}>R$</span>{formatCurrency(totaisRol.valor)}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10px" }}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* CONTRATO */}
        {valorContrato > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #000", background: "#FEF9C3", padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "12px", width: "70%" }}>
                  CONTRATO
                </td>
                <td style={{ border: "1px solid #000", background: "#FEF9C3", padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "12px", width: "30%" }}>
                  R$ {formatCurrency(valorContrato)}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* TOTAL GERAL */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: valorContrato > 0 ? "0" : "12px" }}>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #000", background: "#E5E7EB", padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "12px", width: "70%" }}>
                TOTAL GERAL
              </td>
              <td style={{ border: "1px solid #000", background: "#E5E7EB", padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "12px", width: "30%" }}>
                R$ {formatCurrency(totaisGerais.valor + valorContrato)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}