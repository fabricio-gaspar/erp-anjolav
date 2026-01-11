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
  numeroCobranca?: number;
  empresaNome?: string;
  empresaSubtitulo?: string;
  logoUrl?: string | null;
  onPrint?: () => void;
}

export function RelatorioDetalhadoCliente({
  clienteNome,
  clienteDocumento,
  lancamentos,
  periodoInicio,
  periodoFim,
  numeroCobranca = 1,
  empresaNome = "ANJOLAV",
  empresaSubtitulo = "ANJOLAV SERVIÇOS DE LAVANDERIA",
  logoUrl,
  onPrint,
}: RelatorioDetalhadoClienteProps) {
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
          valor: itemAcc.valor + item.subtotal,
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
    const printContent = document.getElementById("relatorio-detalhado-print");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Mapa de Peças - ${clienteNome}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              font-size: 10px; 
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
              padding: 3px 6px; 
              vertical-align: middle;
            }
            .header-table { margin-bottom: 0; }
            .header-table td { height: 50px; }
            .logo-cell { 
              width: 120px; 
              text-align: center;
              padding: 8px;
            }
            .logo-icon { 
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .logo-icon svg {
              width: 32px;
              height: 32px;
              fill: #0066cc;
            }
            .logo-text {
              font-weight: bold;
              font-size: 11px;
              margin-top: 2px;
            }
            .title-cell { 
              text-align: center; 
            }
            .title-main { 
              font-size: 16px; 
              font-weight: bold;
              margin-bottom: 2px;
            }
            .title-sub { 
              font-size: 10px; 
            }
            .date-cell { 
              width: 140px; 
              font-size: 10px;
              text-align: right;
              padding-right: 10px;
            }
            .cliente-destaque { 
              background: #FEF9C3 !important; 
              text-align: center; 
              font-weight: bold; 
              font-size: 14px;
              padding: 8px !important;
            }
            .info-section { margin-bottom: 0; }
            .info-section td { 
              padding: 5px 8px; 
              font-size: 10px;
            }
            .info-left { text-align: left; width: 50%; }
            .info-right { text-align: right; width: 50%; }
            .cliente-info td {
              padding: 5px 8px;
              font-size: 10px;
            }
            .rol-section { margin-top: 8px; }
            .rol-header td {
              background: #FEF9C3 !important;
              font-weight: bold;
              font-size: 10px;
              padding: 4px 8px !important;
            }
            .items-header th { 
              background: #FEF9C3 !important;
              font-weight: bold;
              font-size: 9px;
              text-align: center;
              padding: 4px 6px !important;
            }
            .items-header th:first-child {
              text-align: left;
            }
            .item-row td { 
              font-size: 10px;
              padding: 3px 6px !important;
            }
            .item-row td:first-child {
              text-align: left;
            }
            .text-right { text-align: right !important; }
            .text-center { text-align: center !important; }
            .text-left { text-align: left !important; }
            .totais-rol td { 
              font-weight: bold;
              font-size: 10px;
              padding: 4px 6px !important;
            }
            .total-geral-section {
              margin-top: 12px;
            }
            .total-geral td {
              background: #E5E7EB !important;
              font-weight: bold;
              font-size: 11px;
              padding: 8px !important;
            }
            .spacer { height: 4px; }
            .no-border { border: none !important; background: transparent !important; }
            .col-descricao { width: 28%; }
            .col-complemento { width: 18%; }
            .col-peso { width: 8%; }
            .col-quant { width: 8%; }
            .col-unit { width: 8%; }
            .col-total { width: 10%; }
            .col-obs { width: 20%; }
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
        id="relatorio-detalhado-print"
        className="bg-white border rounded-lg p-4 text-[10px] overflow-x-auto"
        style={{ fontFamily: "Arial, sans-serif" }}
      >
        {/* ============ CABEÇALHO PRINCIPAL ============ */}
        <table className="w-full border-collapse header-table" style={{ marginBottom: 0 }}>
          <tbody>
            <tr>
              {/* Logo / Nome da Empresa */}
              <td className="border border-black w-[120px] text-center align-middle p-2">
                <div className="flex flex-col items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-blue-600 fill-current">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span className="font-bold text-[11px] mt-1">{empresaNome}</span>
                </div>
              </td>
              {/* Título */}
              <td className="border border-black text-center align-middle p-2">
                <div className="font-bold text-[16px]">Mapa de Peças por Cliente</div>
                <div className="text-[10px]">{empresaSubtitulo}</div>
              </td>
              {/* Data/Hora Emissão */}
              <td className="border border-black w-[140px] text-right align-middle p-2 pr-3">
                <div className="text-[10px]">Dt.Emissão: {dataEmissao}</div>
                <div className="text-[10px]">Hr.Emissão: {horaEmissao}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ NOME DO CLIENTE EM DESTAQUE ============ */}
        <table className="w-full border-collapse" style={{ marginBottom: 0 }}>
          <tbody>
            <tr>
              <td className="border border-black bg-yellow-100 text-center font-bold text-[14px] py-2">
                {clienteNome.toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ INFORMAÇÕES DE COBRANÇA ============ */}
        <table className="w-full border-collapse info-section" style={{ marginBottom: 0 }}>
          <tbody>
            <tr>
              <td className="border border-black p-2 align-top text-[10px]" style={{ width: "60%" }}>
                <div>Cobrança: {numeroCobranca}</div>
                <div>Dt.Emissão: {dataEmissao}</div>
              </td>
              <td className="border border-black p-2 text-right align-top text-[10px]" style={{ width: "40%" }}>
                <div>Ref. Mês/Ano: {getMesAno()}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ CLIENTE INFO ============ */}
        <table className="w-full border-collapse" style={{ marginBottom: "8px" }}>
          <tbody>
            <tr>
              <td className="border border-black p-2 text-[10px]">
                Cliente: {clienteNome.toUpperCase()}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ============ LANÇAMENTOS (ROLs) ============ */}
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
            <div key={lancamento.id} className="mb-2 rol-section">
              {/* ROL Header */}
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td 
                      className="border border-black bg-yellow-100 font-bold text-[10px] p-1"
                      style={{ width: "15%" }}
                    >
                      <span className="font-bold">ROL: </span>{rolNumber}
                    </td>
                    <td 
                      className="border border-black bg-yellow-100 font-bold text-[10px] p-1"
                      style={{ width: "25%" }}
                    >
                      <span className="font-bold">DT.ENTRADA: </span>{formatDate(lancamento.data_lancamento)}
                    </td>
                    <td 
                      className="border border-black bg-yellow-100 font-bold text-[10px] p-1"
                      style={{ width: "30%" }}
                    >
                      <span className="font-bold">DEPART.:</span>
                    </td>
                    <td 
                      className="border border-black bg-yellow-100 font-bold text-[10px] p-1"
                      style={{ width: "30%" }}
                    >
                      <span className="font-bold">BLOCO:</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Items Table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-left col-descricao">
                      DESCRIÇÃO DA PEÇA
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-center col-complemento">
                      COMPLEMENTO
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-center col-peso">
                      PESO
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-center col-quant">
                      QUANT.
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-center col-unit">
                      UNIT.
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-center col-total">
                      TOTAL
                    </th>
                    <th className="border border-black bg-yellow-100 font-bold text-[9px] p-1 text-left col-obs">
                      OBSERVAÇÕES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lancamento.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-black p-1 text-[10px] text-left">
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
                      <td className="border border-black p-1 text-[10px] text-left"></td>
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

        {/* ============ TOTAL GERAL ============ */}
        <table className="w-full border-collapse mt-4 total-geral-section">
          <tbody>
            <tr>
              <td 
                className="border border-black bg-gray-200 p-2 text-right font-bold text-[11px]" 
                style={{ width: "55%" }}
              >
                TOTAL GERAL
              </td>
              <td 
                className="border border-black bg-gray-200 p-2 text-right font-bold text-[11px]" 
                style={{ width: "15%" }}
              >
                {totaisGerais.quantidade}
              </td>
              <td 
                className="border border-black bg-gray-200 p-2" 
                style={{ width: "10%" }}
              ></td>
              <td 
                className="border border-black bg-gray-200 p-2 text-right font-bold text-[11px]" 
                style={{ width: "20%" }}
              >
                {formatCurrency(totaisGerais.valor)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
