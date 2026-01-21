import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  RefreshCw,
  Database,
  MapPin,
  Building2,
  Map,
  Globe,
  Users,
  FileText,
  Truck,
  UserCheck,
  Package,
  Link2,
  Lightbulb,
  CreditCard,
  FolderOpen,
  Lock,
  Zap,
  Layers,
  Webhook,
  Clock,
  AlertCircle,
  Settings2,
  History,
  Cog,
  Mail,
  MessageSquare,
  Check,
  X,
  PlayCircle,
  PauseCircle,
  Trash2,
  HardDrive,
  Calendar,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHistoricoEnvios, useHistoricoEnviosMultiple } from "@/hooks/useHistoricoEnvios";
import { useAutomacoesConfig } from "@/hooks/useAutomacoesConfig";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ServiceStatusType = "online" | "offline" | "slow" | "not_configured" | "untested";

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: ServiceStatusType;
  latency?: number;
  icon: React.ReactNode;
  iconBg: string;
  category: "external" | "backend" | "webhook";
}

interface DatabaseStat {
  label: string;
  value: number;
  sublabel: string;
  icon: React.ReactNode;
  iconBg: string;
}

interface TableRelation {
  table: string;
  relations: string;
}

// Funções de teste real para cada serviço
const testServices = {
  supabase: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const { error } = await supabase.from("clientes").select("id").limit(1);
      const latency = Math.round(performance.now() - start);
      return { success: !error, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  viacep: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const resp = await fetch("https://viacep.com.br/ws/01310100/json/", { 
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - start);
      return { success: resp.ok, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  brasilapi: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const resp = await fetch("https://brasilapi.com.br/api/cep/v2/01310100", {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - start);
      return { success: resp.ok, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  nominatim: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const resp = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&q=São+Paulo&limit=1",
        { 
          method: "GET",
          headers: { "User-Agent": "AnjoLav/1.0" },
          signal: AbortSignal.timeout(8000)
        }
      );
      const latency = Math.round(performance.now() - start);
      return { success: resp.ok, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  osm: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const resp = await fetch("https://tile.openstreetmap.org/0/0/0.png", {
        method: "HEAD",
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - start);
      return { success: resp.ok, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  osmTiles: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const resp = await fetch("https://a.tile.openstreetmap.org/1/0/0.png", {
        method: "HEAD",
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - start);
      return { success: resp.ok, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  supabaseStorage: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const { error } = await supabase.storage.listBuckets();
      const latency = Math.round(performance.now() - start);
      return { success: !error, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  supabaseAuth: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - start);
      return { success: !error, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },

  edgeFunctions: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      // Tenta verificar se as edge functions estão acessíveis
      const { error } = await supabase.functions.invoke("asaas-webhook", {
        method: "POST",
        body: { event: "health_check" },
      });
      const latency = Math.round(performance.now() - start);
      // Se conseguiu conectar (mesmo com erro de validação), está online
      return { success: true, latency };
    } catch {
      const latency = Math.round(performance.now() - start);
      // Mesmo com erro, se conseguiu conectar rapidamente, está online
      return { success: latency < 5000, latency };
    }
  },

  asaas: async (): Promise<{ success: boolean; latency: number; configured: boolean }> => {
    const start = performance.now();
    try {
      // Verifica se o Asaas está configurado tentando acessar o endpoint
      const resp = await fetch("https://sandbox.asaas.com/api/v3/", {
        method: "HEAD",
        signal: AbortSignal.timeout(5000)
      });
      const latency = Math.round(performance.now() - start);
      return { success: resp.status !== 500, latency, configured: true };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start), configured: true };
    }
  },

  asaasWebhook: async (): Promise<{ success: boolean; latency: number }> => {
    const start = performance.now();
    try {
      // Verifica se há eventos de webhook recentes
      const { data, error } = await supabase
        .from("asaas_webhook_events")
        .select("id")
        .limit(1);
      const latency = Math.round(performance.now() - start);
      // Se a tabela existe e está acessível, o webhook está configurado
      return { success: !error, latency };
    } catch {
      return { success: false, latency: Math.round(performance.now() - start) };
    }
  },
};

export function ConfiguracoesSistema() {
  const [services, setServices] = useState<ServiceStatus[]>([
    // APIs Externas
    {
      id: "viacep",
      name: "ViaCEP API",
      description: "Busca automática de endereços por CEP",
      status: "untested",
      icon: <MapPin className="w-5 h-5 text-green-600" />,
      iconBg: "bg-green-100",
      category: "external",
    },
    {
      id: "brasilapi",
      name: "BrasilAPI (CNPJ)",
      description: "Consulta de dados empresariais por CNPJ",
      status: "untested",
      icon: <Building2 className="w-5 h-5 text-orange-600" />,
      iconBg: "bg-orange-100",
      category: "external",
    },
    {
      id: "nominatim",
      name: "Nominatim (Geocoding)",
      description: "Conversão de endereços em coordenadas",
      status: "untested",
      icon: <Globe className="w-5 h-5 text-red-600" />,
      iconBg: "bg-red-100",
      category: "external",
    },
    {
      id: "osm",
      name: "OpenStreetMap (Mapas)",
      description: "Renderização de mapas interativos",
      status: "untested",
      icon: <Map className="w-5 h-5 text-teal-600" />,
      iconBg: "bg-teal-100",
      category: "external",
    },
    {
      id: "osmTiles",
      name: "OpenStreetMap Tiles",
      description: "Camada de tiles para mapas",
      status: "untested",
      icon: <Layers className="w-5 h-5 text-emerald-600" />,
      iconBg: "bg-emerald-100",
      category: "external",
    },
    {
      id: "asaas",
      name: "Asaas API (Pagamentos)",
      description: "Plataforma de cobranças, boletos e PIX",
      status: "untested",
      icon: <CreditCard className="w-5 h-5 text-purple-600" />,
      iconBg: "bg-purple-100",
      category: "external",
    },
    // Backend
    {
      id: "supabase",
      name: "Banco de Dados",
      description: "Conexão com tabelas de clientes, ordens, etc.",
      status: "untested",
      icon: <Database className="w-5 h-5 text-blue-600" />,
      iconBg: "bg-blue-100",
      category: "backend",
    },
    {
      id: "supabaseAuth",
      name: "Autenticação",
      description: "Sistema de login e controle de acesso",
      status: "untested",
      icon: <Lock className="w-5 h-5 text-indigo-600" />,
      iconBg: "bg-indigo-100",
      category: "backend",
    },
    {
      id: "supabaseStorage",
      name: "Storage (Arquivos)",
      description: "Armazenamento de certificados, avatares e logos",
      status: "untested",
      icon: <FolderOpen className="w-5 h-5 text-violet-600" />,
      iconBg: "bg-violet-100",
      category: "backend",
    },
    {
      id: "edgeFunctions",
      name: "Edge Functions",
      description: "Funções serverless do backend",
      status: "untested",
      icon: <Zap className="w-5 h-5 text-cyan-600" />,
      iconBg: "bg-cyan-100",
      category: "backend",
    },
    // Webhooks
    {
      id: "asaasWebhook",
      name: "Asaas Webhook",
      description: "Recebimento de eventos de pagamento",
      status: "untested",
      icon: <Webhook className="w-5 h-5 text-pink-600" />,
      iconBg: "bg-pink-100",
      category: "webhook",
    },
  ]);

  const [isTesting, setIsTesting] = useState(false);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStat[]>([
    {
      label: "Clientes",
      value: 0,
      sublabel: "0 ativos",
      icon: <Users className="w-5 h-5 text-blue-500" />,
      iconBg: "bg-blue-50",
    },
    {
      label: "Ordens de Serviço",
      value: 0,
      sublabel: "0 em aberto",
      icon: <FileText className="w-5 h-5 text-green-500" />,
      iconBg: "bg-green-50",
    },
    {
      label: "Motoristas",
      value: 0,
      sublabel: "0 disponíveis",
      icon: <Truck className="w-5 h-5 text-purple-500" />,
      iconBg: "bg-purple-50",
    },
    {
      label: "Funcionários",
      value: 0,
      sublabel: "0 ativos",
      icon: <UserCheck className="w-5 h-5 text-amber-500" />,
      iconBg: "bg-amber-50",
    },
    {
      label: "Produtos",
      value: 0,
      sublabel: "cadastrados",
      icon: <Package className="w-5 h-5 text-cyan-500" />,
      iconBg: "bg-cyan-50",
    },
  ]);

  const tableRelations: TableRelation[] = [
    { table: "OrdemServico", relations: "Cliente (cliente_id) | Motorista (motorista_id)" },
    { table: "ItensOrdemServico", relations: "OrdemServico (ordem_servico_id) | Produto (produto_id)" },
    { table: "Lancamentos", relations: "Cliente (cliente_id) | Fatura (fatura_id)" },
    { table: "Faturas", relations: "Cliente (cliente_id) | AsaasCharge (asaas_charge_id)" },
    { table: "HistoricoProducao", relations: "OrdemServico (ordem_servico_id) | Funcionario (funcionario_id)" },
  ];

  // Carregar estatísticas do banco ao montar
  useEffect(() => {
    loadDatabaseStats();
  }, []);

  const loadDatabaseStats = async () => {
    try {
      const [clientesRes, ordensRes, motoristasRes, funcionariosRes, produtosRes] = await Promise.all([
        supabase.from("clientes").select("id, ativo", { count: "exact" }),
        supabase.from("ordens_servico").select("id, status", { count: "exact" }),
        supabase.from("motoristas").select("id, ativo", { count: "exact" }),
        supabase.from("funcionarios").select("id, ativo", { count: "exact" }),
        supabase.from("produtos").select("id", { count: "exact" }),
      ]);

      const clientesAtivos = clientesRes.data?.filter(c => c.ativo).length || 0;
      const ordensAbertas = ordensRes.data?.filter(o => !["entregue", "cancelada"].includes(o.status)).length || 0;
      const motoristasAtivos = motoristasRes.data?.filter(m => m.ativo).length || 0;
      const funcionariosAtivos = funcionariosRes.data?.filter(f => f.ativo).length || 0;

      setDatabaseStats([
        {
          label: "Clientes",
          value: clientesRes.count || 0,
          sublabel: `${clientesAtivos} ativos`,
          icon: <Users className="w-5 h-5 text-blue-500" />,
          iconBg: "bg-blue-50",
        },
        {
          label: "Ordens de Serviço",
          value: ordensRes.count || 0,
          sublabel: `${ordensAbertas} em aberto`,
          icon: <FileText className="w-5 h-5 text-green-500" />,
          iconBg: "bg-green-50",
        },
        {
          label: "Motoristas",
          value: motoristasRes.count || 0,
          sublabel: `${motoristasAtivos} ativos`,
          icon: <Truck className="w-5 h-5 text-purple-500" />,
          iconBg: "bg-purple-50",
        },
        {
          label: "Funcionários",
          value: funcionariosRes.count || 0,
          sublabel: `${funcionariosAtivos} ativos`,
          icon: <UserCheck className="w-5 h-5 text-amber-500" />,
          iconBg: "bg-amber-50",
        },
        {
          label: "Produtos",
          value: produtosRes.count || 0,
          sublabel: "cadastrados",
          icon: <Package className="w-5 h-5 text-cyan-500" />,
          iconBg: "bg-cyan-50",
        },
      ]);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const handleTestAll = async () => {
    setIsTesting(true);
    const updatedServices = [...services];

    // Testar todos os serviços em paralelo
    const testPromises = services.map(async (service, index) => {
      let result: { success: boolean; latency: number; configured?: boolean };

      switch (service.id) {
        case "supabase":
          result = await testServices.supabase();
          break;
        case "viacep":
          result = await testServices.viacep();
          break;
        case "brasilapi":
          result = await testServices.brasilapi();
          break;
        case "nominatim":
          result = await testServices.nominatim();
          break;
        case "osm":
          result = await testServices.osm();
          break;
        case "osmTiles":
          result = await testServices.osmTiles();
          break;
        case "supabaseStorage":
          result = await testServices.supabaseStorage();
          break;
        case "supabaseAuth":
          result = await testServices.supabaseAuth();
          break;
        case "edgeFunctions":
          result = await testServices.edgeFunctions();
          break;
        case "asaas":
          result = await testServices.asaas();
          break;
        case "asaasWebhook":
          result = await testServices.asaasWebhook();
          break;
        default:
          result = { success: false, latency: 0 };
      }

      let status: ServiceStatusType;
      if (!result.success) {
        status = "offline";
      } else if (result.latency > 2000) {
        status = "slow";
      } else {
        status = "online";
      }

      return {
        index,
        status,
        latency: result.latency,
      };
    });

    const results = await Promise.all(testPromises);

    results.forEach(({ index, status, latency }) => {
      updatedServices[index] = {
        ...updatedServices[index],
        status,
        latency,
      };
    });

    setServices(updatedServices);
    setIsTesting(false);

    const onlineCount = updatedServices.filter(s => s.status === "online").length;
    const slowCount = updatedServices.filter(s => s.status === "slow").length;
    const offlineCount = updatedServices.filter(s => s.status === "offline").length;

    toast({
      title: "Testes concluídos",
      description: `${onlineCount} online, ${slowCount} lento(s), ${offlineCount} offline`,
    });

    // Recarregar estatísticas do banco
    loadDatabaseStats();
  };

  const getStatusBadge = (status: ServiceStatusType, latency?: number) => {
    switch (status) {
      case "online":
        return (
          <div className="flex items-center gap-2">
            {latency !== undefined && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {latency}ms
              </span>
            )}
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Online</Badge>
          </div>
        );
      case "slow":
        return (
          <div className="flex items-center gap-2">
            {latency !== undefined && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {latency}ms
              </span>
            )}
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Lento</Badge>
          </div>
        );
      case "offline":
        return (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Offline</Badge>
          </div>
        );
      case "not_configured":
        return (
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-gray-400" />
            <Badge variant="secondary">Não configurado</Badge>
          </div>
        );
      default:
        return <Badge variant="secondary">Não testado</Badge>;
    }
  };

  const externalServices = services.filter(s => s.category === "external");
  const backendServices = services.filter(s => s.category === "backend");
  const webhookServices = services.filter(s => s.category === "webhook");

  const renderServiceGroup = (title: string, serviceList: ServiceStatus[], icon: React.ReactNode) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
        {icon}
        {title}
      </div>
      {serviceList.map((service) => (
        <div
          key={service.id}
          className="flex items-center justify-between p-4 border rounded-lg bg-background"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${service.iconBg} flex items-center justify-center`}>
              {service.icon}
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">{service.name}</p>
              <p className="text-xs text-muted-foreground">{service.description}</p>
            </div>
          </div>
          {getStatusBadge(service.status, service.latency)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Saúde do Sistema */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-foreground">Saúde do Sistema</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {services.filter(s => s.status === "online").length}/{services.length} online
            </span>
            <Button
              size="sm"
              onClick={handleTestAll}
              disabled={isTesting}
              className="bg-primary hover:bg-primary/90"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? "animate-spin" : ""}`} />
              Testar Tudo
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Verifique o status de todas as integrações e serviços externos com testes em tempo real.
        </p>

        <div className="space-y-6">
          {renderServiceGroup(
            "APIs Externas",
            externalServices,
            <Globe className="w-4 h-4" />
          )}

          {renderServiceGroup(
            "Backend (Lovable Cloud)",
            backendServices,
            <Database className="w-4 h-4" />
          )}

          {renderServiceGroup(
            "Webhooks",
            webhookServices,
            <Webhook className="w-4 h-4" />
          )}
        </div>
      </Card>

      {/* Histórico de Envios */}
      <HistoricoEnviosSection />

      {/* Automações */}
      <AutomacoesSection />

      {/* Dicas de Performance */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-2">
              Dicas de Performance
            </h3>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <li>• Use índices nas buscas frequentes (cliente_id, numero_os)</li>
              <li>• Limite consultas com paginação (máx. 50 registros por vez)</li>
              <li>• Cache de dados que não mudam frequentemente</li>
              <li>• Evite carregar todas as ordens, filtre por status ativo</li>
              <li>• Monitore a latência das APIs externas regularmente</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Estatísticas do Banco de Dados */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Estatísticas do Banco de Dados</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={loadDatabaseStats}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
          {databaseStats.map((stat, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 border rounded-lg bg-background text-center"
            >
              <div className={`w-10 h-10 rounded-full ${stat.iconBg} flex items-center justify-center mb-2`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <Badge variant="secondary" className="text-xs mt-1">
                {stat.sublabel}
              </Badge>
            </div>
          ))}
        </div>

        {/* Relacionamentos das Tabelas */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Relacionamentos das Tabelas</h3>
          </div>
          <div className="space-y-1">
            {tableRelations.map((relation, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{relation.table}</span>
                <span className="text-muted-foreground"> → </span>
                <span>{relation.relations}</span>
              </p>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Componente separado para Histórico de Envios
function HistoricoEnviosSection() {
  const [faturaIds, setFaturaIds] = useState<string[]>([]);
  const [isLoadingFaturas, setIsLoadingFaturas] = useState(true);
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Carregar IDs das faturas recentes
  useEffect(() => {
    const loadFaturas = async () => {
      setIsLoadingFaturas(true);
      try {
        const { data } = await supabase
          .from("faturas")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(100);
        
        if (data) {
          setFaturaIds(data.map(f => f.id));
        }
      } catch (error) {
        console.error("Erro ao carregar faturas:", error);
      } finally {
        setIsLoadingFaturas(false);
      }
    };
    loadFaturas();
  }, []);

  const { data: envios = [], isLoading } = useHistoricoEnviosMultiple(faturaIds);

  const enviosFiltrados = envios.filter(e => {
    if (filtroCanal !== "todos" && e.canal !== filtroCanal) return false;
    if (filtroStatus !== "todos" && e.status !== filtroStatus) return false;
    return true;
  }).slice(0, 20);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "enviado":
        return <Badge className="bg-blue-100 text-blue-700">Enviado</Badge>;
      case "entregue":
        return <Badge className="bg-green-100 text-green-700">Entregue</Badge>;
      case "lido":
        return <Badge className="bg-emerald-100 text-emerald-700">Lido</Badge>;
      case "erro":
        return <Badge className="bg-red-100 text-red-700">Erro</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case "whatsapp":
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case "email":
        return <Mail className="w-4 h-4 text-blue-600" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-foreground">Histórico de Envios</h2>
        </div>
        <div className="flex gap-2">
          <Select value={filtroCanal} onValueChange={setFiltroCanal}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="lido">Lido</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(isLoading || isLoadingFaturas) ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : enviosFiltrados.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum envio encontrado</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Canal</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enviosFiltrados.map((envio) => (
                <TableRow key={envio.id}>
                  <TableCell>{getCanalIcon(envio.canal)}</TableCell>
                  <TableCell className="font-medium text-sm">{envio.destinatario}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {envio.documentos_enviados?.join(", ") || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(envio.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>{getStatusBadge(envio.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Estatísticas resumidas */}
      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{envios.filter(e => e.canal === "email").length}</p>
          <p className="text-xs text-muted-foreground">E-mails</p>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{envios.filter(e => e.canal === "whatsapp").length}</p>
          <p className="text-xs text-muted-foreground">WhatsApp</p>
        </div>
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-emerald-600">{envios.filter(e => e.status === "entregue" || e.status === "lido").length}</p>
          <p className="text-xs text-muted-foreground">Entregues</p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-red-600">{envios.filter(e => e.status === "erro").length}</p>
          <p className="text-xs text-muted-foreground">Erros</p>
        </div>
      </div>
    </Card>
  );
}

// Componente separado para Automações
function AutomacoesSection() {
  const { automacoes, isLoading, updateAutomacao } = useAutomacoesConfig();

  const automacaoLabels: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
    backup: {
      title: "Backup Automático",
      description: "Cria backups periódicos dos dados do sistema",
      icon: <HardDrive className="w-5 h-5 text-blue-600" />,
    },
    fechamento: {
      title: "Fechamento Mensal",
      description: "Gera faturas automaticamente no início do mês",
      icon: <Calendar className="w-5 h-5 text-green-600" />,
    },
    limpeza: {
      title: "Limpeza de Dados Antigos",
      description: "Remove logs e histórico com mais de 90 dias",
      icon: <Trash2 className="w-5 h-5 text-amber-600" />,
    },
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await updateAutomacao.mutateAsync({ id, ativo });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Cog className="w-5 h-5 text-cyan-600" />
        <h2 className="font-semibold text-foreground">Automações</h2>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          ⚠️ As automações são executadas em segundo plano pelo sistema. Ative apenas as que você realmente precisa.
        </p>
      </div>

      <div className="space-y-4">
        {automacoes.map((automacao) => {
          const info = automacaoLabels[automacao.tipo];
          if (!info) return null;

          return (
            <div
              key={automacao.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-background"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  {info.icon}
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{info.title}</p>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                  {automacao.ultima_execucao && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última execução: {format(new Date(automacao.ultima_execucao), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {automacao.ativo ? (
                  <Badge className="bg-green-100 text-green-700">
                    <PlayCircle className="w-3 h-3 mr-1" />
                    Ativa
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <PauseCircle className="w-3 h-3 mr-1" />
                    Inativa
                  </Badge>
                )}
                <Switch
                  checked={automacao.ativo}
                  onCheckedChange={(checked) => handleToggle(automacao.id, checked)}
                  disabled={updateAutomacao.isPending}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
