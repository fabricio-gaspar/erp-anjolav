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
  numeroCobranca?: number;
  empresaNome?: string;
  empresaSubtitulo?: string;
  onPrint?: () => void;
}

export function MapaPecasCliente({
  clienteNome,
  clienteDocumento,
  lancamentos,
  periodoInicio,
  periodoFim,
  numeroCobranca = 1,
  empresaNome = "ANJOLAV",
  empresaSubtitulo = "ANJOLAV SERVIÇOS DE LAVANDERIA",
  onPrint,
}: MapaPecasClienteProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getMesAno = () => {
    const date = new Date(periodoInicio);
    const mes = format(date, "MM", { locale: ptBR });
    const ano = format(date, "yyyy", { locale: ptBR });
    return `${mes} / ${ano}`;
  };

  // Calcular totais gerais
  const totaisGerais = lancamentos.reduce(
    (acc, lanc) => {
      const lancTotais = lanc.itens.reduce(
        (itemAcc, item) => ({
          quantidade: itemAcc.quantidade + item.quantidade,
          valor: acc.valor + item.subtotal,
        }),
        { quantidade: 0, valor: 0 }
      );
      return {
        quantidade: acc.quantidade + lancTotais.quantidade,
        valor: acc.valor + lanc.itens.reduce((s, i) => s + i.subtotal, 0),
      };
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
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Mapa de Peças - ${clienteNome}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 11px; 
              margin: 0; 
              padding: 10px;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 4px;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 4px 6px; 
            }
            .header-table td { border: 1px solid #000; }
            .logo-cell { 
              width: 100px; 
              text-align: center;
              vertical-align: middle;
              padding: 8px;
            }
            .logo-icon { 
              color: #2563eb;
              font-size: 24px;
              font-weight: bold;
            }
            .title-cell { 
              text-align: center; 
              vertical-align: middle;
            }
            .title-main { 
              font-size: 16px; 
              font-weight: bold; 
            }
            .title-sub { 
              font-size: 11px; 
            }
            .date-cell { 
              width: 160px; 
              font-size: 10px;
              text-align: right;
              vertical-align: middle;
            }
            .cliente-row td { 
              background: #fef9c3; 
              text-align: center; 
              font-weight: bold; 
              font-size: 13px;
              padding: 8px;
            }
            .info-row td { padding: 6px 8px; }
            .rol-header td {
              background: #fef9c3;
              font-weight: bold;
              font-size: 10px;
              padding: 4px 8px;
            }
            .items-table th { 
              background: #fef9c3;
              font-weight: bold;
              font-size: 10px;
              text-align: center;
            }
            .items-table td { 
              font-size: 10px;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .totais-row td { 
              font-weight: bold;
              font-size: 10px;
            }
            .total-geral td {
              background: #e5e7eb;
              font-weight: bold;
              font-size: 11px;
              padding: 6px 8px;
            }
            .spacer { height: 8px; border: none; }
            .no-border { border: none !important; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
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
        id="mapa-pecas-print"
        className="bg-white border rounded-lg p-4 text-[11px] overflow-x-auto"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* Header Table */}
        <table className="w-full border-collapse mb-1" style={{ borderColor: "#000" }}>
          <tbody>
            <tr>
              <td className="border border-black w-[100px] text-center align-middle p-2">
                <div className="flex flex-col items-center">
                  <span className="text-blue-600 text-2xl">💧</span>
                  <span className="font-bold text-xs">{empresaNome}</span>
                </div>
              </td>
              <td className="border border-black text-center align-middle p-2">
                <div className="font-bold text-base">Mapa de Peças por Cliente</div>
                <div className="text-[11px]">{empresaSubtitulo}</div>
              </td>
              <td className="border border-black w-[160px] text-right align-middle p-2 text-[10px]">
                <div>Dt.Emissão: {dataEmissao}</div>
                <div>Hr.Emissão: {horaEmissao}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Cliente Nome Row */}
        <table className="w-full border-collapse mb-1">
          <tbody>
            <tr>
              <td className="border border-black bg-yellow-100 text-center font-bold text-[13px] p-2">
                {clienteNome.toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Info Row */}
        <table className="w-full border-collapse mb-1">
          <tbody>
            <tr>
              <td className="border border-black p-2 align-top" style={{ width: "50%" }}>
                <div>Cobrança: {numeroCobranca}</div>
                <div>Dt.Emissão: {dataEmissao}</div>
              </td>
              <td className="border border-black p-2 text-right align-top" style={{ width: "50%" }}>
                <div>Ref. Mês/Ano: {getMesAno()}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Cliente Info Row */}
        <table className="w-full border-collapse mb-2">
          <tbody>
            <tr>
              <td className="border border-black p-2">
                Cliente: {clienteNome.toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Lançamentos (ROLs) */}
        {lancamentos.map((lancamento, index) => {
          const rolNumber = 5000 + index;
          const totaisRol = lancamento.itens.reduce(
            (acc, item) => ({
              quantidade: acc.quantidade + item.quantidade,
              valor: acc.valor + item.subtotal,
            }),
            { quantidade: 0, valor: 0 }
          );

          return (
            <div key={lancamento.id} className="mb-3">
              {/* ROL Header */}
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="border border-black bg-yellow-100 font-bold text-[10px] p-1" style={{ width: "35%" }}>
                      ROL: {rolNumber}
                    </td>
                    <td className="border border-black bg-yellow-100 font-bold text-[10px] p-1" style={{ width: "25%" }}>
                      DT.ENTRADA: {formatDate(lancamento.data_lancamento)}
                    </td>
                    <td className="border border-black bg-yellow-100 font-bold text-[10px] p-1" style={{ width: "20%" }}>
                      DEPART.:
                    </td>
                    <td className="border border-black bg-yellow-100 font-bold text-[10px] p-1" style={{ width: "20%" }}>
                      BLOCO:
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Items Table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-left">
                      DESCRIÇÃO DA PEÇA
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-center" style={{ width: "120px" }}>
                      COMPLEMENTO
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-center" style={{ width: "60px" }}>
                      PESO
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-center" style={{ width: "60px" }}>
                      QUANT.
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-center" style={{ width: "60px" }}>
                      UNIT.
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-center" style={{ width: "70px" }}>
                      TOTAL
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[10px] p-1 text-left" style={{ width: "100px" }}>
                      OBSERVAÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lancamento.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-black p-1 text-[10px]">
                        {item.produto_nome.toUpperCase()}
                      </td>
                      <td className="border border-black p-1 text-[10px] text-center"></td>
                      <td className="border border-black p-1 text-[10px] text-right"></td>
                      <td className="border border-black p-1 text-[10px] text-right">
                        {item.quantidade}
                      </td>
                      <td className="border border-black p-1 text-[10px] text-right">
                        {formatCurrency(item.preco_unitario)}
                      </td>
                      <td className="border border-black p-1 text-[10px] text-right">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="border border-black p-1 text-[10px]"></td>
                    </tr>
                  ))}
                  {/* Totais do ROL */}
                  <tr>
                    <td colSpan={3} className="border border-black p-1 text-[10px] text-right font-bold">
                      TOTAIS DO ROL:
                    </td>
                    <td className="border border-black p-1 text-[10px] text-right font-bold">
                      {totaisRol.quantidade}
                    </td>
                    <td className="border border-black p-1 text-[10px]"></td>
                    <td className="border border-black p-1 text-[10px] text-right font-bold">
                      {formatCurrency(totaisRol.valor)}
                    </td>
                    <td className="border border-black p-1 text-[10px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Total Geral */}
        <table className="w-full border-collapse mt-3">
          <tbody>
            <tr>
              <td className="border border-black bg-gray-200 p-2 text-right font-bold text-[11px]" style={{ width: "60%" }}>
                TOTAL GERAL
              </td>
              <td className="border border-black bg-gray-200 p-2 text-right font-bold text-[11px]" style={{ width: "10%" }}>
                {totaisGerais.quantidade}
              </td>
              <td className="border border-black bg-gray-200 p-2" style={{ width: "10%" }}></td>
              <td className="border border-black bg-gray-200 p-2 text-right font-bold text-[11px]" style={{ width: "20%" }}>
                {formatCurrency(totaisGerais.valor)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
