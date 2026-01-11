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
  onPrint?: () => void;
}

export function MapaPecasCliente({
  clienteNome,
  clienteDocumento,
  lancamentos,
  periodoInicio,
  periodoFim,
  numeroCobranca = 1,
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
    return format(date, "MM/yyyy", { locale: ptBR });
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
        valor: acc.valor + lancTotais.valor,
      };
    },
    { quantidade: 0, valor: 0 }
  );

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
            @page { size: A4; margin: 10mm; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 10px; 
              margin: 0; 
              padding: 10px;
              color: #000;
            }
            .header { 
              display: flex; 
              border: 1px solid #000; 
              margin-bottom: 2px;
            }
            .header-logo { 
              width: 80px; 
              border-right: 1px solid #000; 
              padding: 5px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .header-title { 
              flex: 1; 
              padding: 5px; 
              border-right: 1px solid #000;
            }
            .header-date { 
              width: 120px; 
              padding: 5px; 
              font-size: 9px;
            }
            .cliente-nome { 
              border: 1px solid #000; 
              padding: 8px; 
              text-align: center; 
              font-weight: bold; 
              font-size: 12px;
              margin-bottom: 2px;
            }
            .info-row { 
              display: flex; 
              border: 1px solid #000;
              margin-bottom: 2px;
            }
            .info-cell { 
              padding: 4px 8px; 
              border-right: 1px solid #000;
            }
            .info-cell:last-child { border-right: none; }
            .rol-header {
              display: flex;
              background: #f5f5f5;
              border: 1px solid #000;
              font-weight: bold;
              margin-bottom: 0;
            }
            .rol-cell {
              padding: 4px 8px;
              border-right: 1px solid #000;
            }
            .rol-cell:last-child { border-right: none; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 2px;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 3px 5px; 
              text-align: left;
            }
            th { 
              background: #e0e0e0; 
              font-weight: bold;
              font-size: 9px;
            }
            td { font-size: 9px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totais-row { 
              background: #f0f0f0; 
              font-weight: bold;
            }
            .total-geral {
              background: #d0d0d0;
              font-weight: bold;
              font-size: 10px;
            }
            .mt-2 { margin-top: 8px; }
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
        className="bg-white border rounded-lg p-4 font-mono text-xs"
      >
        {/* Header */}
        <div className="flex border border-foreground/20 mb-0.5">
          <div className="w-20 border-r border-foreground/20 p-2 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">LOGO</span>
          </div>
          <div className="flex-1 p-2 border-r border-foreground/20">
            <p className="font-bold text-sm">Mapa de Peças por Cliente</p>
            <p className="text-[10px]">ANJOLAV SERVIÇOS DE LAVANDERIA</p>
          </div>
          <div className="w-28 p-2 text-[9px]">
            <p>Dt.Emissão: {formatDate(new Date().toISOString())}</p>
            <p>Hr.Emissão: {format(new Date(), "HH:mm:ss")}</p>
          </div>
        </div>

        {/* Nome do Cliente */}
        <div className="border border-foreground/20 p-2 text-center font-bold text-sm mb-0.5">
          {clienteNome.toUpperCase()}
        </div>

        {/* Info Row */}
        <div className="flex border border-foreground/20 mb-0.5 text-[10px]">
          <div className="flex-1 p-2 border-r border-foreground/20">
            <p>Cobrança: {numeroCobranca}</p>
            <p>Dt.Emissão: {formatDate(new Date().toISOString())}</p>
            <p>Cliente: {clienteNome.toUpperCase()}</p>
          </div>
          <div className="w-40 p-2">
            <p>Ref. Mês/Ano: {getMesAno()}</p>
            <p className="text-muted-foreground">
              {clienteDocumento || "CPF/CNPJ não informado"}
            </p>
          </div>
        </div>

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
            <div key={lancamento.id} className="mb-2">
              {/* ROL Header */}
              <div className="flex bg-muted/50 border border-foreground/20 text-[10px] font-medium">
                <div className="w-24 p-1 border-r border-foreground/20">
                  ROL: {rolNumber}
                </div>
                <div className="flex-1 p-1 border-r border-foreground/20">
                  DT.ENTRADA: {formatDate(lancamento.data_lancamento)}
                </div>
                <div className="w-24 p-1 border-r border-foreground/20">DEPART.:</div>
                <div className="w-20 p-1">BLOCO:</div>
              </div>

              {/* Itens Table */}
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/30 text-[9px]">
                    <th className="border border-foreground/20 p-1 text-left">
                      DESCRIÇÃO
                    </th>
                    <th className="border border-foreground/20 p-1 text-left w-20">
                      COMPLEMENTO
                    </th>
                    <th className="border border-foreground/20 p-1 text-right w-12">
                      PESO
                    </th>
                    <th className="border border-foreground/20 p-1 text-right w-12">
                      QUANT
                    </th>
                    <th className="border border-foreground/20 p-1 text-right w-16">
                      UNIT.
                    </th>
                    <th className="border border-foreground/20 p-1 text-right w-16">
                      TOTAL
                    </th>
                    <th className="border border-foreground/20 p-1 text-left w-20">
                      OBS
                    </th>
                  </tr>
                </thead>
                <tbody className="text-[9px]">
                  {lancamento.itens.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-foreground/20 p-1">
                        {item.produto_nome.toUpperCase()}
                      </td>
                      <td className="border border-foreground/20 p-1"></td>
                      <td className="border border-foreground/20 p-1 text-right"></td>
                      <td className="border border-foreground/20 p-1 text-right">
                        {item.quantidade}
                      </td>
                      <td className="border border-foreground/20 p-1 text-right">
                        {formatCurrency(item.preco_unitario)}
                      </td>
                      <td className="border border-foreground/20 p-1 text-right">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="border border-foreground/20 p-1"></td>
                    </tr>
                  ))}
                  {/* Totais do ROL */}
                  <tr className="bg-muted/50 font-medium">
                    <td
                      colSpan={3}
                      className="border border-foreground/20 p-1 text-right"
                    >
                      TOTAIS DO ROL:
                    </td>
                    <td className="border border-foreground/20 p-1 text-right">
                      {totaisRol.quantidade}
                    </td>
                    <td className="border border-foreground/20 p-1"></td>
                    <td className="border border-foreground/20 p-1 text-right">
                      {formatCurrency(totaisRol.valor)}
                    </td>
                    <td className="border border-foreground/20 p-1"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Total Geral */}
        <table className="w-full border-collapse mt-2">
          <tbody>
            <tr className="bg-muted font-bold text-[10px]">
              <td className="border border-foreground/20 p-1 text-right">
                TOTAL GERAL
              </td>
              <td className="border border-foreground/20 p-1 text-right w-12">
                {totaisGerais.quantidade}
              </td>
              <td className="border border-foreground/20 p-1 w-16"></td>
              <td className="border border-foreground/20 p-1 text-right w-16">
                {formatCurrency(totaisGerais.valor)}
              </td>
              <td className="border border-foreground/20 p-1 w-20"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
