import { useState } from "react";
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
import { Users, Calendar, FileText, Grid, Table2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportType = "detalhado" | "mapa_pecas" | "mapa_mensal";

const months = [
  { value: "2026-01", label: "Janeiro 2026" },
  { value: "2025-12", label: "Dezembro 2025" },
  { value: "2025-11", label: "Novembro 2025" },
  { value: "2025-10", label: "Outubro 2025" },
  { value: "2025-09", label: "Setembro 2025" },
  { value: "2025-08", label: "Agosto 2025" },
  { value: "2025-07", label: "Julho 2025" },
  { value: "2025-06", label: "Junho 2025" },
  { value: "2025-05", label: "Maio 2025" },
  { value: "2025-04", label: "Abril 2025" },
  { value: "2025-03", label: "Março 2025" },
  { value: "2025-02", label: "Fevereiro 2025" },
];

const RelatoriosCliente = () => {
  const [selectedClient, setSelectedClient] = useState("");
  const [reportType, setReportType] = useState<ReportType>("detalhado");
  const [selectedMonth, setSelectedMonth] = useState("2026-01");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month]
    );
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Relatórios para Cliente
          </h1>
          <p className="text-sm text-muted-foreground">
            Gere mapas de peças e relatórios mensais para enviar aos clientes
          </p>
        </div>

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
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fabricio">FABRICIO GASPAR</SelectItem>
                  <SelectItem value="garden">GARDEN HOUSE</SelectItem>
                  <SelectItem value="anjolav">Anjolav Serviços</SelectItem>
                </SelectContent>
              </Select>
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

              <Button className="w-full mt-6 gap-2" disabled={!selectedClient}>
                <Eye className="w-4 h-4" />
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
                  onChange={(e) => setSelectedMonth(e.target.value)}
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
                      <span className="text-sm">{month.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default RelatoriosCliente;
