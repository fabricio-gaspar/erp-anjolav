import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Calendar, FileText, Grid, Table2, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientes, useConfiguracaoCliente } from "@/hooks/useClientes";
import { useRelatorioCliente } from "@/hooks/useRelatorioCliente";
import { useContratoCliente } from "@/hooks/useContratosAluguel";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import { MapaMensalPecas } from "@/components/relatorios/MapaMensalPecas";
import { MapaPecasCliente } from "@/components/relatorios/MapaPecasCliente";
import { RelatorioDetalhadoCliente } from "@/components/relatorios/RelatorioDetalhadoCliente";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReportType = "detalhado" | "mapa_pecas" | "mapa_mensal";

// Gerar lista de meses dinamicamente
const generateMonths = () => {
  const months = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = subMonths(today, i);
    months.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return months;
};

const RelatoriosCliente = () => {
  const [selectedClient, setSelectedClient] = useState("");
  const [reportType, setReportType] = useState<ReportType>("mapa_pecas");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedMonths, setSelectedMonths] = useState<string[]>([format(new Date(), "yyyy-MM")]);
  const [showPreview, setShowPreview] = useState(false);

  const { clientes: todosClientes, isLoading: isLoadingClientes } = useClientes();
  const clientes = todosClientes.filter(c => c.classificacao === "industrial");
  const { configuracao } = useConfiguracaoCliente(selectedClient || null);
  const { data: contrato } = useContratoCliente(selectedClient || null);
  const { configuracao: configEmpresa } = useConfiguracoesGerais();
  const empresaNome = configEmpresa?.nome_empresa || "ANJOLAV";
  const logoUrl = configEmpresa?.logo_url || null;

  // Calcular período baseado na seleção
  const getSelectedPeriodo = () => {
    if (selectedMonths.length > 0) {
      // Para múltiplos meses, precisamos parsear corretamente como YYYY-MM
      const dates = selectedMonths.map(m => {
        const [year, month] = m.split("-").map(Number);
        return new Date(year, month - 1, 1);
      });
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      return {
        inicio: format(startOfMonth(minDate), "yyyy-MM-dd"),
        fim: format(endOfMonth(maxDate), "yyyy-MM-dd"),
      };
    } else {
      // Para mês único, parsear YYYY-MM corretamente
      const [year, month] = selectedMonth.split("-").map(Number);
      const date = new Date(year, month - 1, 1);
      return {
        inicio: format(startOfMonth(date), "yyyy-MM-dd"),
        fim: format(endOfMonth(date), "yyyy-MM-dd"),
      };
    }
  };

  const { inicio: periodoInicio, fim: periodoFim } = getSelectedPeriodo();

  const { data: lancamentos, isLoading: isLoadingRelatorio } = useRelatorioCliente(
    selectedClient || null,
    periodoInicio,
    periodoFim
  );

  const months = generateMonths();

  // Atualizar tipo de relatório quando selecionar cliente
  useEffect(() => {
    if (configuracao?.tipo_relatorio) {
      setReportType(configuracao.tipo_relatorio as ReportType);
    }
  }, [configuracao]);

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month]
    );
  };

  const selectedClientData = clientes.find(c => c.id === selectedClient);

  const handleVisualizarRelatorio = () => {
    if (!selectedClient) return;
    setShowPreview(true);
  };

  return (
    <AppLayout title="Relatórios de Cliente" subtitle="Análise detalhada de movimentação por cliente">
      <div className="w-full space-y-8">
        {/* Visual Content Header mirroring high-fidelity layout */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500/90">INTELIGÊNCIA DE DADOS</span>
          </div>
          <h1 className="text-5xl font-black tracking-tightest text-slate-900 leading-[0.95] uppercase">
            Relatórios de Cliente
          </h1>
          <p className="text-[14px] text-slate-400 font-bold uppercase tracking-wider">
            Consolidado histórico de faturamento e volumes por unidade
          </p>
        </div>

        <div className="content-panel p-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Client & Report Type */}
          <div className="space-y-6">
            {/* Client Selection */}
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Cliente</h2>
              </div>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingClientes ? "Carregando..." : "Selecione o cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedClient && configuracao?.tipo_relatorio && (
                <p className="text-xs text-muted-foreground mt-2">
                  Tipo configurado: <span className="font-medium text-primary">
                    {configuracao.tipo_relatorio === "mapa_pecas" ? "Mapa de Peças" :
                     configuracao.tipo_relatorio === "mapa_mensal" ? "Mapa Mensal" : "Detalhado"}
                  </span>
                </p>
              )}
            </div>

            {/* Report Type Selection */}
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Tipo de Relatório</h2>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setReportType("detalhado")}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-colors",
                    reportType === "detalhado"
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FileText
                      className={cn(
                        "w-5 h-5",
                        reportType === "detalhado"
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <div>
                      <p className="font-medium">Relatório Detalhado</p>
                      <p className="text-xs text-muted-foreground">
                        Análise completa com KPIs e gráficos
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setReportType("mapa_pecas")}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-colors",
                    reportType === "mapa_pecas"
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Table2
                      className={cn(
                        "w-5 h-5",
                        reportType === "mapa_pecas"
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <div>
                      <p className="font-medium">Mapa de Peças</p>
                      <p className="text-xs text-muted-foreground">
                        Detalhado por ROL/data de entrada
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setReportType("mapa_mensal")}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-colors",
                    reportType === "mapa_mensal"
                      ? "border-primary bg-primary/5"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Grid
                      className={cn(
                        "w-5 h-5",
                        reportType === "mapa_mensal"
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                    <div>
                      <p className="font-medium">Mapa Mensal</p>
                      <p className="text-xs text-muted-foreground">
                        Matriz com dias do mês
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <Button 
                className="w-full mt-6 gap-2" 
                disabled={!selectedClient || isLoadingRelatorio}
                onClick={handleVisualizarRelatorio}
              >
                {isLoadingRelatorio ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Visualizar Relatório
              </Button>
            </div>
          </div>

          {/* Right Panel - Period Selection */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <h2 className="font-semibold">Período</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione um ou mais meses
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Mês único:</label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setSelectedMonths([]);
                  }}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">
                  Ou selecione múltiplos meses:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {months.map((month) => (
                    <label
                      key={month.value}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMonths.includes(month.value)}
                        onCheckedChange={() => toggleMonth(month.value)}
                      />
                      <span className="text-sm capitalize">{month.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reportType === "mapa_pecas" && "Mapa de Peças"}
              {reportType === "mapa_mensal" && "Mapa Mensal"}
              {reportType === "detalhado" && "Relatório Detalhado"}
              {selectedClientData && ` - ${selectedClientData.razao_social}`}
            </DialogTitle>
          </DialogHeader>

          {reportType === "mapa_pecas" && lancamentos && (
            <MapaPecasCliente
              clienteNome={selectedClientData?.razao_social || ""}
              clienteDocumento={selectedClientData?.cpf_cnpj}
              lancamentos={lancamentos}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              valorContrato={contrato?.valor_servico}
              empresaNome={empresaNome}
              logoUrl={logoUrl}
              onPrint={() => setShowPreview(false)}
            />
          )}

          {reportType === "mapa_mensal" && lancamentos && (
            <MapaMensalPecas
              clienteNome={selectedClientData?.razao_social || ""}
              clienteDocumento={selectedClientData?.cpf_cnpj}
              lancamentos={lancamentos}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              valorContrato={contrato?.valor_servico}
              empresaNome={empresaNome}
              logoUrl={logoUrl}
              onPrint={() => setShowPreview(false)}
            />
          )}

          {reportType === "detalhado" && lancamentos && (
            <RelatorioDetalhadoCliente
              clienteNome={selectedClientData?.razao_social || ""}
              clienteDocumento={selectedClientData?.cpf_cnpj}
              lancamentos={lancamentos}
              periodoInicio={periodoInicio}
              periodoFim={periodoFim}
              valorContrato={contrato?.valor_servico}
              empresaNome={empresaNome}
              logoUrl={logoUrl}
              onPrint={() => setShowPreview(false)}
            />
          )}

        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default RelatoriosCliente;
