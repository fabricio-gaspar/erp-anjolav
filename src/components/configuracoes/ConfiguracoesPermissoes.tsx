import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Shield, 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  Factory, 
  Calendar,
  DollarSign,
  CreditCard,
  FileText,
  BarChart3,
  Settings,
  Package,
  Truck,
  CheckCircle2
} from "lucide-react";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useModuloPermissoes, useSavePermissoes, type PermissaoUpdate } from "@/hooks/useModuloPermissoes";
import { cn } from "@/lib/utils";

interface ModuloConfig {
  key: string;
  nome: string;
  descricao: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  categoria: 'OPERACIONAL' | 'FINANCEIRO' | 'RELATÓRIOS' | 'CONFIGURAÇÕES';
}

const MODULOS: ModuloConfig[] = [
  { key: 'dashboard', nome: 'Painel Geral', descricao: 'Visão geral do sistema e métricas', icon: LayoutDashboard, iconColor: 'text-blue-600', iconBg: 'bg-blue-100', categoria: 'OPERACIONAL' },
  { key: 'clientes', nome: 'Clientes', descricao: 'Cadastro e gestão de clientes', icon: Users, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', categoria: 'OPERACIONAL' },
  { key: 'ordens', nome: 'Ordens de Serviço', descricao: 'Gerenciamento de OS', icon: ClipboardList, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', categoria: 'OPERACIONAL' },
  { key: 'producao', nome: 'Produção', descricao: 'Fluxo operacional Kanban', icon: Factory, iconColor: 'text-pink-600', iconBg: 'bg-pink-100', categoria: 'OPERACIONAL' },
  { key: 'agenda', nome: 'Agenda', descricao: 'Calendário de retiradas e entregas', icon: Calendar, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', categoria: 'OPERACIONAL' },
  { key: 'produtos', nome: 'Produtos', descricao: 'Catálogo de produtos e serviços', icon: Package, iconColor: 'text-violet-600', iconBg: 'bg-violet-100', categoria: 'OPERACIONAL' },
  { key: 'faturamento', nome: 'Faturamento', descricao: 'Emissão de notas e cobranças', icon: FileText, iconColor: 'text-amber-600', iconBg: 'bg-amber-100', categoria: 'FINANCEIRO' },
  { key: 'caixa', nome: 'Caixa PDV', descricao: 'Controle de caixa e movimentações', icon: DollarSign, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100', categoria: 'FINANCEIRO' },
  { key: 'contas_receber', nome: 'Contas a Receber', descricao: 'Gestão de recebimentos', icon: CreditCard, iconColor: 'text-blue-600', iconBg: 'bg-blue-100', categoria: 'FINANCEIRO' },
  { key: 'contas_pagar', nome: 'Contas a Pagar', descricao: 'Gestão de pagamentos', icon: Truck, iconColor: 'text-rose-600', iconBg: 'bg-rose-100', categoria: 'FINANCEIRO' },
  { key: 'relatorios', nome: 'Relatórios', descricao: 'Relatórios gerenciais', icon: BarChart3, iconColor: 'text-indigo-600', iconBg: 'bg-indigo-100', categoria: 'RELATÓRIOS' },
  { key: 'configuracoes', nome: 'Configurações', descricao: 'Configurações do sistema', icon: Settings, iconColor: 'text-slate-600', iconBg: 'bg-slate-100', categoria: 'CONFIGURAÇÕES' },
];

const getAvatarColor = (cargo: string) => {
  const cargoLower = cargo?.toLowerCase() || '';
  if (cargoLower.includes('motorista')) return 'bg-emerald-500';
  if (cargoLower.includes('balconista')) return 'bg-blue-500';
  if (cargoLower.includes('auxiliar')) return 'bg-amber-500';
  if (cargoLower.includes('coordenador')) return 'bg-rose-500';
  if (cargoLower.includes('gerente')) return 'bg-purple-500';
  if (cargoLower.includes('admin')) return 'bg-violet-500';
  return 'bg-slate-500';
};

export function ConfiguracoesPermissoes() {
  const { data: funcionarios, isLoading: loadingFuncionarios } = useFuncionarios();
  const { data: permissoesDB, isLoading: loadingPermissoes } = useModuloPermissoes();
  const savePermissoes = useSavePermissoes();
  
  const [selectedModulo, setSelectedModulo] = useState<string>('dashboard');
  const [localPermissoes, setLocalPermissoes] = useState<Record<string, Record<string, boolean>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local permissions from DB
  useEffect(() => {
    if (permissoesDB && funcionarios) {
      const permMap: Record<string, Record<string, boolean>> = {};
      
      funcionarios.forEach(func => {
        permMap[func.id] = {};
        MODULOS.forEach(modulo => {
          const dbPerm = permissoesDB.find(
            p => p.funcionario_id === func.id && p.modulo_key === modulo.key
          );
          permMap[func.id][modulo.key] = dbPerm?.tem_acesso ?? false;
        });
      });
      
      setLocalPermissoes(permMap);
    }
  }, [permissoesDB, funcionarios]);

  const togglePermissao = (funcionarioId: string, moduloKey: string) => {
    setLocalPermissoes(prev => ({
      ...prev,
      [funcionarioId]: {
        ...prev[funcionarioId],
        [moduloKey]: !prev[funcionarioId]?.[moduloKey]
      }
    }));
    setHasChanges(true);
  };

  const setAllPermissoes = (moduloKey: string, value: boolean) => {
    if (!funcionarios) return;
    
    setLocalPermissoes(prev => {
      const newPerm = { ...prev };
      funcionarios.forEach(func => {
        if (!newPerm[func.id]) newPerm[func.id] = {};
        newPerm[func.id][moduloKey] = value;
      });
      return newPerm;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!funcionarios) return;
    
    const permissoesToSave: PermissaoUpdate[] = [];
    
    funcionarios.forEach(func => {
      MODULOS.forEach(modulo => {
        permissoesToSave.push({
          funcionario_id: func.id,
          modulo_key: modulo.key,
          tem_acesso: localPermissoes[func.id]?.[modulo.key] ?? false
        });
      });
    });

    await savePermissoes.mutateAsync(permissoesToSave);
    setHasChanges(false);
  };

  const getAccessCount = (moduloKey: string) => {
    if (!funcionarios) return 0;
    return funcionarios.filter(f => localPermissoes[f.id]?.[moduloKey]).length;
  };

  const selectedModuloConfig = MODULOS.find(m => m.key === selectedModulo);
  const modulosByCategoria = useMemo(() => {
    const grouped: Record<string, ModuloConfig[]> = {};
    MODULOS.forEach(modulo => {
      if (!grouped[modulo.categoria]) grouped[modulo.categoria] = [];
      grouped[modulo.categoria].push(modulo);
    });
    return grouped;
  }, []);

  const isLoading = loadingFuncionarios || loadingPermissoes;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4">
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="col-span-8">
            <Skeleton className="h-[500px] w-full" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Permissões</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie o acesso dos usuários aos módulos do sistema
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || savePermissoes.isPending}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {savePermissoes.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left panel - Module list */}
        <div className="col-span-4">
          <ScrollArea className="h-[500px] pr-4">
            {Object.entries(modulosByCategoria).map(([categoria, modulos]) => (
              <div key={categoria} className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                  {categoria}
                </p>
                <div className="space-y-2">
                  {modulos.map((modulo) => {
                    const Icon = modulo.icon;
                    const accessCount = getAccessCount(modulo.key);
                    const isSelected = selectedModulo === modulo.key;
                    
                    return (
                      <div
                        key={modulo.key}
                        onClick={() => setSelectedModulo(modulo.key)}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all",
                          isSelected 
                            ? "ring-2 ring-blue-500 border-blue-200 bg-blue-50/50" 
                            : "border-border hover:border-blue-200 hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", modulo.iconBg)}>
                              <Icon className={cn("w-5 h-5", modulo.iconColor)} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">
                                {modulo.nome}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {modulo.descricao}
                              </p>
                            </div>
                          </div>
                        </div>
                        {accessCount > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">
                              {accessCount} usuário{accessCount !== 1 ? 's' : ''} com acesso
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Right panel - User permissions */}
        <div className="col-span-8">
          {selectedModuloConfig && (
            <div className="border rounded-lg p-5">
              {/* Module header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", selectedModuloConfig.iconBg)}>
                    <selectedModuloConfig.icon className={cn("w-5 h-5", selectedModuloConfig.iconColor)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedModuloConfig.nome}</h3>
                    <p className="text-sm text-muted-foreground">{selectedModuloConfig.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAllPermissoes(selectedModulo, true)}
                  >
                    Todos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAllPermissoes(selectedModulo, false)}
                  >
                    Nenhum
                  </Button>
                </div>
              </div>

              {/* Access counter */}
              <div className="flex items-center gap-1.5 mb-4 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {getAccessCount(selectedModulo)} de {funcionarios?.length || 0} usuários com acesso
                </span>
              </div>

              {/* Users grid */}
              {!funcionarios || funcionarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhum funcionário cadastrado</p>
                  <p className="text-sm text-muted-foreground/70">
                    Adicione funcionários na aba Equipe
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {funcionarios.filter(f => f.ativo).map((funcionario) => {
                    const hasAccess = localPermissoes[funcionario.id]?.[selectedModulo] ?? false;
                    const initial = funcionario.nome.charAt(0).toUpperCase();
                    
                    return (
                      <div 
                        key={funcionario.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          hasAccess ? "bg-emerald-50/50 border-emerald-200" : "bg-background"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
                            getAvatarColor(funcionario.cargo)
                          )}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">
                              {funcionario.nome}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {funcionario.cargo}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={hasAccess}
                          onCheckedChange={() => togglePermissao(funcionario.id, selectedModulo)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
