import { Bell, ChevronRight, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

const routeNames: Record<string, string> = {
  "/": "Dashboard",
  "/clientes": "Clientes",
  "/produtos": "Produtos & Serviços",
  "/ordens": "Abrir Retirada",
  "/producao": "Fluxo de Produção",
  "/agenda": "Agenda",
  "/financeiro": "Dashboard Financeiro",
  "/lancamentos": "Lançamentos",
  "/faturamento": "Faturamento",
  "/caixa": "Caixa PDV",
  "/receber": "Contas a Receber",
  "/pagar": "Contas a Pagar",
  "/asaas": "Asaas",
  "/relatorios/clientes": "Relatórios de Cliente",
  "/relatorios/proximidade": "Proximidade",
  "/relatorios/caixa": "Relatório de Caixa",
  "/relatorios/financeiro": "Relatório Financeiro",
  "/configuracoes": "Configurações",
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
        <span className="font-medium text-foreground">Dashboard</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
        Dashboard
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.name}</span>
          ) : (
            <Link to={crumb.path} className="text-muted-foreground hover:text-foreground transition-colors">
              {crumb.name}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

export function AppHeader({ title, subtitle, onMenuClick, showMenuButton }: AppHeaderProps) {
  const notifications = [
    { id: 1, title: "Nova OS criada", description: "OS #1234 foi registrada", time: "2 min atrás" },
    { id: 2, title: "Fatura vencida", description: "Cliente ABC - R$ 1.500,00", time: "1 hora atrás" },
    { id: 3, title: "Produção concluída", description: "Lote #567 finalizado", time: "3 horas atrás" },
  ];

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between pl-0 pr-3 sm:pr-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {showMenuButton && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex flex-col justify-center min-w-0">
          {title ? (
            <>
              <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-slate-500 leading-tight truncate hidden sm:block">{subtitle}</p>
              )}
            </>
          ) : (
            <Breadcrumb />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search button */}
        <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-muted-foreground">
          <Search className="w-4 h-4" />
          <span className="text-sm">Buscar...</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full ring-2 ring-background" />
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
