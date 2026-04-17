import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Download,
  Upload,
  AlertTriangle,
  Trash2,
  LayoutGrid,
  Search,
  RefreshCcw,
  FileJson,
  Table,
  Users,
  Truck,
  Receipt,
  Factory,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useDataManagement, exportEntityData, exportAllData, deleteAllData, deleteEntityData, importAllData, EntityStats } from "@/hooks/useDataManagement";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bomb } from "lucide-react";

const categoryLabels = {
  cadastros: { label: "Cadastros", icon: Users, color: "bg-blue-500" },
  operacional: { label: "Operacional", icon: Truck, color: "bg-green-500" },
  financeiro: { label: "Financeiro", icon: Receipt, color: "bg-amber-500" },
  producao: { label: "Produção", icon: Factory, color: "bg-purple-500" },
};

export function ConfiguracoesDados() {
  const { data, isLoading, refetch, isRefetching } = useDataManagement();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showEmptyFilter, setShowEmptyFilter] = useState<string>("all");
  const [deleteEntity, setDeleteEntity] = useState<EntityStats | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingEntity, setIsDeletingEntity] = useState(false);

  const filteredEntities = useMemo(() => {
    if (!data?.entities) return [];
    
    return data.entities.filter((entity) => {
      const matchesSearch = 
        entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = categoryFilter === "all" || entity.category === categoryFilter;
      
      const matchesEmpty = 
        showEmptyFilter === "all" ||
        (showEmptyFilter === "with_data" && entity.count > 0) ||
        (showEmptyFilter === "empty" && entity.count === 0);
      
      return matchesSearch && matchesCategory && matchesEmpty;
    });
  }, [data?.entities, searchTerm, categoryFilter, showEmptyFilter]);

  const handleExportEntity = async (entity: EntityStats) => {
    if (entity.count === 0) {
      toast({
        title: "Sem dados",
        description: `Não há registros de ${entity.description} para exportar.`,
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData = await exportEntityData(entity.table);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity.table}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação concluída",
        description: `${entity.count} registro(s) de ${entity.name} exportados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async (entity: EntityStats) => {
    if (entity.count === 0) {
      toast({
        title: "Sem dados",
        description: `Não há registros de ${entity.description} para exportar.`,
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData = await exportEntityData(entity.table);
      
      if (exportData.length === 0) {
        toast({ title: "Sem dados", variant: "destructive" });
        return;
      }

      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(";"),
        ...exportData.map((row) =>
          headers.map((h) => {
            const value = row[h];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value).replace(/;/g, ",");
          }).join(";")
        ),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entity.table}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação CSV concluída",
        description: `${entity.count} registro(s) exportados.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllBackup = async () => {
    setIsExportingAll(true);
    try {
      const allData = await exportAllData();
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_completo_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Backup completo exportado",
        description: `Todos os dados foram exportados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro no backup",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsExportingAll(false);
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const backupData = JSON.parse(text);
        
        // Validar se é um backup válido
        if (typeof backupData !== 'object' || Array.isArray(backupData)) {
          throw new Error("Formato de backup inválido. Esperado um objeto JSON.");
        }

        const tableCount = Object.keys(backupData).length;
        const recordCount = Object.values(backupData).reduce(
          (sum: number, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
          0
        );

        toast({
          title: "Iniciando importação...",
          description: `Importando ${recordCount} registros de ${tableCount} tabelas.`,
        });

        const result = await importAllData(backupData);

        if (result.errors.length > 0) {
          console.error("Erros na importação:", result.errors);
          toast({
            title: "Importação parcial",
            description: `${result.imported} registros importados. ${result.skipped} ignorados. ${result.errors.length} erros.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Backup importado com sucesso!",
            description: `${result.imported} registros restaurados.`,
          });
        }

        refetch();
      } catch (error) {
        console.error("Erro ao importar backup:", error);
        toast({
          title: "Erro ao importar backup",
          description: error instanceof Error ? error.message : "O arquivo selecionado não é um JSON válido.",
          variant: "destructive",
        });
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  const handleConfirmDelete = async () => {
    if (!deleteEntity) return;

    try {
      // Note: Actual deletion would require proper cascade handling
      toast({
        title: "Exclusão solicitada",
        description: `A exclusão de ${deleteEntity.name} requer confirmação adicional do administrador do sistema.`,
      });
    } catch (error) {
      toast({
        title: "Erro na exclusão",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setDeleteEntity(null);
    }
  };

  const handleResetSystem = async () => {
    if (resetConfirmText !== "ZERAR TUDO") return;

    setIsResetting(true);
    try {
      const result = await deleteAllData();
      
      if (result.errors.length > 0) {
        toast({
          title: "Exclusão parcial",
          description: `${result.deleted} tabelas limpas. ${result.errors.length} erros encontrados.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sistema zerado com sucesso",
          description: "Todos os dados foram removidos. O sistema está pronto para começar do zero.",
        });
      }
      
      refetch();
    } catch (error) {
      toast({
        title: "Erro ao zerar sistema",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
      setResetConfirmText("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            onClick={handleExportAllBackup}
            disabled={isExportingAll}
            className="bg-primary hover:bg-primary/90"
          >
            {isExportingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar Backup Completo
          </Button>
          <Button variant="outline" onClick={handleImportBackup} disabled={isImporting}>
            {isImporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {isImporting ? "Importando..." : "Importar Backup Completo"}
          </Button>
        </div>
      </Card>

      {/* Zerar Sistema */}
      <Card className="p-6 border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex items-center gap-2 mb-2">
          <Bomb className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-red-600">Zerar Sistema</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Remove <strong>TODOS</strong> os dados do sistema de uma só vez. Use esta opção para começar do zero.
          <span className="block mt-1 text-red-600 font-medium">
            ⚠️ Esta ação é IRREVERSÍVEL. Faça backup antes de prosseguir.
          </span>
        </p>

        <Button
          variant="destructive"
          onClick={() => setShowResetConfirm(true)}
          className="bg-red-600 hover:bg-red-700"
          disabled={data?.totalRecords === 0}
        >
          <Bomb className="w-4 h-4 mr-2" />
          Zerar Todos os Dados ({data?.totalRecords || 0} registros)
        </Button>
      </Card>

      {/* Visão Geral dos Dados com KPIs */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Visão Geral dos Dados</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Atualizado: {data?.lastUpdated ? format(data.lastUpdated, "HH:mm:ss", { locale: ptBR }) : "-"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCcw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Category KPIs */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-3xl font-bold text-primary">{data?.totalRecords || 0}</p>
            <p className="text-xs text-muted-foreground">registros no sistema</p>
          </Card>

          {Object.entries(categoryLabels).map(([key, { label, icon: Icon, color }]) => (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded ${color}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {data?.categories[key as keyof typeof data.categories] || 0}
              </p>
              <p className="text-xs text-muted-foreground">registros</p>
            </Card>
          ))}
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-4 gap-3">
          {data?.entities.map((entity) => {
            const catInfo = categoryLabels[entity.category];
            return (
              <div
                key={entity.key}
                className="p-3 border rounded-lg bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{entity.description}</p>
                  <Badge variant="outline" className="text-[10px] px-1">
                    {catInfo.label}
                  </Badge>
                </div>
                <p className="text-xl font-semibold text-foreground">{entity.count}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Gerenciar Dados por Entidade */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Table className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Gerenciar Dados por Entidade</h2>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>
          
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar entidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              <SelectItem value="cadastros">Cadastros</SelectItem>
              <SelectItem value="operacional">Operacional</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
            </SelectContent>
          </Select>

          <Select value={showEmptyFilter} onValueChange={setShowEmptyFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="with_data">Com Dados</SelectItem>
              <SelectItem value="empty">Vazios</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="ml-auto">
            {filteredEntities.length} entidade(s)
          </Badge>
        </div>

        {/* Entity Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas ({data?.entities.length || 0})</TabsTrigger>
            <TabsTrigger value="cadastros">
              Cadastros ({data?.entities.filter(e => e.category === "cadastros").length || 0})
            </TabsTrigger>
            <TabsTrigger value="operacional">
              Operacional ({data?.entities.filter(e => e.category === "operacional").length || 0})
            </TabsTrigger>
            <TabsTrigger value="financeiro">
              Financeiro ({data?.entities.filter(e => e.category === "financeiro").length || 0})
            </TabsTrigger>
            <TabsTrigger value="producao">
              Produção ({data?.entities.filter(e => e.category === "producao").length || 0})
            </TabsTrigger>
          </TabsList>

          {["all", "cadastros", "operacional", "financeiro", "producao"].map((tabValue) => (
            <TabsContent key={tabValue} value={tabValue} className="space-y-2">
              {filteredEntities
                .filter((e) => tabValue === "all" || e.category === tabValue)
                .map((entity) => {
                  const catInfo = categoryLabels[entity.category];
                  return (
                    <div
                      key={entity.key}
                      className={`flex items-center justify-between p-4 border rounded-lg bg-background border-l-4 ${
                        entity.count > 0 ? "border-l-primary" : "border-l-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded ${catInfo.color}`}>
                          <catInfo.icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{entity.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {entity.table}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{entity.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {entity.count > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                {entity.count} registro(s)
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <XCircle className="w-3 h-3" />
                                Sem registros
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportCSV(entity)}
                          disabled={entity.count === 0 || isExporting}
                          className="text-xs"
                        >
                          <Table className="w-3 h-3 mr-1" />
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportEntity(entity)}
                          disabled={entity.count === 0 || isExporting}
                          className="text-xs"
                        >
                          <FileJson className="w-3 h-3 mr-1" />
                          JSON
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteEntity(entity)}
                          disabled={entity.count === 0}
                          className="text-xs"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              
              {filteredEntities.filter((e) => tabValue === "all" || e.category === tabValue).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma entidade encontrada com os filtros aplicados.</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntity} onOpenChange={() => setDeleteEntity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a excluir <strong>todos os {deleteEntity?.count} registro(s)</strong> de{" "}
                <strong>{deleteEntity?.name}</strong>.
              </p>
              <p className="text-red-600 font-medium">
                Esta ação é IRREVERSÍVEL e pode afetar dados relacionados em outras tabelas.
              </p>
              <p>
                Recomendamos exportar um backup antes de prosseguir.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => deleteEntity && handleExportEntity(deleteEntity)}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Primeiro
            </Button>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset System Confirmation Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={(open) => {
        setShowResetConfirm(open);
        if (!open) setResetConfirmText("");
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Bomb className="w-5 h-5" />
              Zerar Sistema Completamente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a excluir <strong>TODOS OS {data?.totalRecords || 0} REGISTROS</strong> do sistema.
              </p>
              <div className="p-3 bg-red-100 dark:bg-red-950 rounded-lg border border-red-300 dark:border-red-800">
                <p className="text-red-700 dark:text-red-300 font-medium text-sm">
                  ⚠️ Esta ação é IRREVERSÍVEL!
                </p>
                <ul className="text-red-600 dark:text-red-400 text-xs mt-2 space-y-1">
                  <li>• Todos os clientes serão removidos</li>
                  <li>• Todas as ordens de serviço serão perdidas</li>
                  <li>• Todo o histórico financeiro será apagado</li>
                  <li>• Todos os produtos e preços serão excluídos</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Digite <span className="font-mono bg-muted px-1 rounded">ZERAR TUDO</span> para confirmar:
                </p>
                <Input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
                  placeholder="Digite ZERAR TUDO"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <Button 
              variant="outline" 
              onClick={() => {
                handleExportAllBackup();
              }}
              className="w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Backup Primeiro
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetSystem}
              disabled={resetConfirmText !== "ZERAR TUDO" || isResetting}
              className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
            >
              {isResetting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bomb className="w-4 h-4 mr-2" />
              )}
              Zerar Sistema
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
