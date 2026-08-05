import { Bell, ChevronRight, Menu, LayoutGrid } from "lucide-react";
import { useWorkspace, WorkspaceArea } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { useLocation, Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/GlobalSearch";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

const routeNames: Record<string, string> = {
  "/central": "Painel Central",
  "/central/financeiro": "Financeiro Global",
  "/central/contas": "Contas",
  "/central/agenda-eventos": "Agenda de Eventos",
  "/central/relatorios/quilometragem": "Relatórios de Quilometragem",
  "/central/relatorios/mensal": "Relatório Mensal",
  "/central/configuracoes": "Configurações",
  "/industrial": "Painel Industrial",
  "/industrial/clientes": "Clientes",
  "/industrial/produtos": "Produtos & Serviços",
  "/industrial/fornecedores": "Fornecedores",
  "/industrial/agenda": "Agenda Industrial",
  "/industrial/ordens": "Relatório do Fluxo",
  "/industrial/producao": "Produção Industrial",
  "/industrial/lancamentos": "PDV Industrial",
  "/industrial/financeiro": "Financeiro Industrial",
  "/industrial/estoque": "Estoque",
  "/industrial/relatorios/clientes": "Relatórios de Cliente",
  "/industrial/relatorios/proximidade": "Proximidade",
  "/residencial": "Painel Residencial",
  "/residencial/caixa": "PDV Loja",
  "/residencial/clientes": "Clientes",
  "/residencial/agenda": "Agenda Residencial",
  "/residencial/ordens": "Ordens de Serviço",
  "/residencial/producao": "Produção Residencial",
  "/residencial/financeiro": "Financeiro Residencial",
  "/residencial/produtos": "Serviços",
  "/residencial/relatorios/caixa": "Relatório de Caixa",
};

function Breadcrumb() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const name = routeNames[path] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === pathSegments.length - 1;
    
    return { path, name, isLast };
  });

  if (breadcrumbs.length === 0) {
    return (
      <div className="flex items-center text-sm">
        <span className="font-medium text-white">Início</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link to="/" className="text-white/70 hover:text-white transition-colors">
        Início
      </Link>
      {breadcrumbs.map((crumb) => (
        <div key={crumb.path} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
          {crumb.isLast ? (
            <span className="font-medium text-white">{crumb.name}</span>
          ) : (
            <Link to={crumb.path} className="text-white/70 hover:text-white transition-colors">
              {crumb.name}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

export function AppHeader({ title, subtitle, onMenuClick, showMenuButton }: AppHeaderProps) {
  const { activeArea } = useWorkspace();
  const navigate = useNavigate();
  
  const notifications = [
    { id: 1, title: "Nova OS criada", description: "OS #1234 foi registrada", time: "2 min atrás" },
    { id: 2, title: "Fatura vencida", description: "Cliente ABC - R$ 1.500,00", time: "1 hora atrás" },
    { id: 3, title: "Produção concluída", description: "Lote #567 finalizado", time: "3 horas atrás" },
  ];

  const handleAreaChange = (area: WorkspaceArea) => {
    navigate(`/${area}`);
  };

  const areaLabels: Record<WorkspaceArea, string> = {
    central: "Painel Central",
    industrial: "Industrial",
    residencial: "Residencial",
  };

  return (
    <header className={cn(
      "h-14 sm:h-16 shadow-sm flex items-center justify-between pl-4 pr-3 sm:pr-4 sticky top-0 z-30 transition-colors",
      activeArea === "central" ? "bg-[#0b1f33]" : 
      activeArea === "industrial" ? "bg-[#1e3a8a]" : 
      "bg-[#581c87]"
    )}>
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0 text-white/70 hover:text-white hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-white/10 px-3 h-9 rounded-lg">
                <LayoutGrid className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-sm hidden sm:inline">{areaLabels[activeArea]}</span>
                <ChevronRight className="w-3.5 h-3.5 text-white/40 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => handleAreaChange("central")} className={cn(activeArea === "central" && "bg-accent font-semibold")}>
                Painel Central
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAreaChange("industrial")} className={cn(activeArea === "industrial" && "bg-accent font-semibold")}>
                Operação Industrial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAreaChange("residencial")} className={cn(activeArea === "residencial" && "bg-accent font-semibold")}>
                Operação Residencial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-[1px] h-6 bg-white/10 hidden sm:block" />

          <div className="flex flex-col justify-center min-w-0">
            {title ? (
              <>
                <h1 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-white/60 leading-tight truncate hidden sm:block">{subtitle}</p>
                )}
              </>
            ) : (
              <Breadcrumb />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <GlobalSearch />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-white/70 hover:text-white hover:bg-white/10">
              <Bell className="w-5 h-5" />
              <span className={cn(
                "absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full ring-2",
                activeArea === "central" ? "ring-[#1a2332]" : 
                activeArea === "industrial" ? "ring-[#1e3a8a]" : 
                "ring-[#581c87]"
              )} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 border-b border-border">
              <p className="font-semibold text-sm">Notificações</p>
              <p className="text-xs text-muted-foreground">Você tem {notifications.length} novas notificações</p>
            </div>
            {notifications.map((notification) => (
              <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-0.5 py-3 cursor-pointer">
                <p className="text-sm font-medium">{notification.title}</p>
                <p className="text-xs text-muted-foreground">{notification.description}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{notification.time}</p>
              </DropdownMenuItem>
            ))}
            <div className="p-2 border-t border-border">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                Ver todas as notificações
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
