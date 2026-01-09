import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  Trash2,
  LayoutGrid,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DataStat {
  label: string;
  value: number;
}

interface EntityData {
  name: string;
  description: string;
  count: number;
  key: string;
}

const dataStats: DataStat[] = [
  { label: "Cadastro de clientes", value: 3 },
  { label: "Ordens de serviço", value: 2 },
  { label: "Lançamentos de consumo", value: 4 },
  { label: "Faturas emitidas", value: 1 },
  { label: "Movimentações financeiras", value: 1 },
  { label: "Vendas do PDV", value: 0 },
  { label: "Caixas abertos/fechados", value: 2 },
  { label: "Processos de produção", value: 0 },
  { label: "Controle de qualidade", value: 0 },
  { label: "Entregas realizadas", value: 0 },
  { label: "Exclusões na agenda", value: 0 },
  { label: "Cobranças do Asaas", value: 0 },
  { label: "Produtos e serviços", value: 20 },
  { label: "Preços personalizados", value: 23 },
  { label: "Cadastro de fornecedores", value: 0 },
  { label: "Categorias financeiras", value: 0 },
];

const entities: EntityData[] = [
  { name: "Cliente", description: "Cadastro de clientes", count: 3, key: "clientes" },
  { name: "OrdemServico", description: "Ordens de serviço", count: 2, key: "ordens" },
  { name: "Consumo", description: "Lançamentos de consumo", count: 4, key: "consumo" },
  { name: "Fatura", description: "Faturas emitidas", count: 1, key: "faturas" },
  { name: "MovimentacaoFinanceira", description: "Movimentações financeiras", count: 1, key: "movimentacoes" },
  { name: "VendaPDV", description: "Vendas do PDV", count: 0, key: "vendas" },
  { name: "Caixa", description: "Caixas abertos/fechados", count: 2, key: "caixas" },
  { name: "ProcessoProducao", description: "Processos de produção", count: 0, key: "processos" },
];

export function ConfiguracoesDados() {
  const handleExportBackup = () => {
    toast({
      title: "Exportando backup...",
      description: "O download do backup completo será iniciado em breve.",
    });
  };

  const handleImportBackup = () => {
    toast({
      title: "Importar backup",
      description: "Selecione um arquivo de backup para restaurar.",
    });
  };

  const handleExportEntity = (entity: EntityData) => {
    if (entity.count === 0) {
      toast({
        title: "Sem dados",
        description: `Não há registros de ${entity.description} para exportar.`,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Exportando dados...",
      description: `Exportando ${entity.count} registro(s) de ${entity.description}.`,
    });
  };

  const handleDeleteEntity = (entity: EntityData) => {
    if (entity.count === 0) {
      toast({
        title: "Sem dados",
        description: `Não há registros de ${entity.description} para excluir.`,
        variant: "destructive",
      });
      return;
    }
    const confirmed = window.confirm(
      `ATENÇÃO: Esta ação é irreversível!\n\nDeseja realmente excluir todos os ${entity.count} registro(s) de ${entity.description}?`
    );
    if (confirmed) {
      toast({
        title: "Dados excluídos",
        description: `${entity.count} registro(s) de ${entity.description} foram excluídos.`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Zona de Perigo Alert */}
      <Alert className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-700 dark:text-red-300">
          <span className="font-semibold">Zona de Perigo:</span> As ações nesta seção são irreversíveis. Recomendamos fazer backup antes de excluir qualquer dado.
        </AlertDescription>
      </Alert>

      {/* Backup e Restauração Completa */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Download className="w-5 h-5 text-amber-600" />
          <h2 className="font-semibold text-amber-600">Backup e Restauração Completa</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Exporte ou importe todos os dados do sistema de uma só vez.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={handleExportBackup}
            className="bg-primary hover:bg-primary/90"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Backup Completo
          </Button>
          <Button
            variant="outline"
            onClick={handleImportBackup}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar Backup Completo
          </Button>
        </div>
      </Card>

      {/* Visão Geral dos Dados */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Visão Geral dos Dados</h2>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {dataStats.map((stat, index) => (
            <div
              key={index}
              className="p-3 border rounded-lg bg-background"
            >
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-xl font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Excluir Dados por Entidade */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-red-500" />
          <h2 className="font-semibold text-foreground">Excluir Dados por Entidade</h2>
        </div>

        <div className="space-y-2">
          {entities.map((entity) => (
            <div
              key={entity.key}
              className="flex items-center justify-between p-4 border rounded-lg bg-background border-l-4 border-l-primary"
            >
              <div>
                <p className="font-semibold text-primary">{entity.name}</p>
                <p className="text-xs text-muted-foreground">{entity.description}</p>
                <p className="text-xs text-muted-foreground">{entity.count} registro(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportEntity(entity)}
                  disabled={entity.count === 0}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Exportar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteEntity(entity)}
                  disabled={entity.count === 0}
                  className="text-xs"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
