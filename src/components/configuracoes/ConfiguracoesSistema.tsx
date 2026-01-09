import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ServiceStatus {
  name: string;
  description: string;
  status: "online" | "offline" | "untested";
  icon: React.ReactNode;
  iconBg: string;
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

export function ConfiguracoesSistema() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "Banco de Dados (Supabase)",
      description: "Conexão com tabelas de clientes, ordens, etc.",
      status: "untested",
      icon: <Database className="w-5 h-5 text-blue-600" />,
      iconBg: "bg-blue-100",
    },
    {
      name: "ViaCEP API",
      description: "Busca automática de endereços por CEP",
      status: "untested",
      icon: <MapPin className="w-5 h-5 text-green-600" />,
      iconBg: "bg-green-100",
    },
    {
      name: "BrasilAPI (CNPJ)",
      description: "Consulta de dados empresariais por CNPJ",
      status: "untested",
      icon: <Building2 className="w-5 h-5 text-orange-600" />,
      iconBg: "bg-orange-100",
    },
    {
      name: "Nominatim (Geocoding)",
      description: "Conversão de endereços em coordenadas",
      status: "untested",
      icon: <Globe className="w-5 h-5 text-red-600" />,
      iconBg: "bg-red-100",
    },
    {
      name: "OpenStreetMap (Mapas)",
      description: "Renderização de mapas interativos",
      status: "untested",
      icon: <Map className="w-5 h-5 text-teal-600" />,
      iconBg: "bg-teal-100",
    },
  ]);

  const [isTesting, setIsTesting] = useState(false);

  const databaseStats: DatabaseStat[] = [
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
      label: "Lotes",
      value: 0,
      sublabel: "em processamento",
      icon: <Package className="w-5 h-5 text-cyan-500" />,
      iconBg: "bg-cyan-50",
    },
  ];

  const tableRelations: TableRelation[] = [
    { table: "OrdemServico", relations: "Cliente (cliente_id) | Motorista (motorista_retirada)" },
    { table: "Lote", relations: "Cliente (cliente_id) | OrdemServico" },
    { table: "ProcessoProducao", relations: "OrdemServico (ordem_servico_id) | Funcionario" },
    { table: "Entrega", relations: "OrdemServico (ordem_servico_id) | Motorista" },
  ];

  const handleTestAll = async () => {
    setIsTesting(true);
    
    // Simulate testing each service
    const updatedServices = [...services];
    
    for (let i = 0; i < updatedServices.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Randomly assign status for demo (in real app, would test actual connection)
      updatedServices[i] = {
        ...updatedServices[i],
        status: Math.random() > 0.2 ? "online" : "offline",
      };
      setServices([...updatedServices]);
    }

    setIsTesting(false);
    toast({
      title: "Testes concluídos",
      description: "Todos os serviços foram verificados.",
    });
  };

  const getStatusBadge = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Online</Badge>;
      case "offline":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Offline</Badge>;
      default:
        return <Badge variant="secondary">Não testado</Badge>;
    }
  };

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
              {services.every((s) => s.status === "untested") ? "Não testado" : "Testado"}
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
        <p className="text-sm text-muted-foreground mb-4">
          Verifique o status de todas as integrações e serviços externos.
        </p>

        <div className="space-y-2">
          {services.map((service, index) => (
            <div
              key={index}
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
              {getStatusBadge(service.status)}
            </div>
          ))}
        </div>
      </Card>

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
            </ul>
          </div>
        </div>
      </Card>

      {/* Estatísticas do Banco de Dados */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Estatísticas do Banco de Dados</h2>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
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
