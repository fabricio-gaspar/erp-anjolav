import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  Factory,
  Calendar,
  Receipt,
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Building2,
  FileText,
  FileSpreadsheet,
  PieChart,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Route,
  Search,
  Plus,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useSidebarContext } from "@/contexts/SidebarContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  badge?: number;
  accentColor?: string;
}

const NavItem = ({ to, icon: Icon, label, end = false, badge, accentColor = "primary" }: NavItemProps) => {
  const location = useLocation();
  const { isCollapsed } = useSidebarContext();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  const content = (
    <NavLink
      to={to}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        isCollapsed && "justify-center px-2"
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <div className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary transition-all"
        )} />
      )}
      
      {/* Icon container */}
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
        isActive 
          ? "bg-primary/15 text-primary" 
          : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      
      {/* Label */}
      {!isCollapsed && (
        <span className="flex-1">{label}</span>
      )}
      
      {/* Badge */}
      {!isCollapsed && badge && badge > 0 && (
        <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold bg-destructive text-destructive-foreground rounded-full">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      
      {/* Badge for collapsed mode */}
      {isCollapsed && badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {label}
          {badge && badge > 0 && (
            <span className="flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-semibold bg-destructive text-destructive-foreground rounded-full">
              {badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

interface NavGroupProps {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}

const NavGroup = ({ title, icon: GroupIcon, children, defaultOpen = true, accentColor = "muted" }: NavGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isCollapsed } = useSidebarContext();

  if (isCollapsed) {
    return <div className="space-y-1 py-2">{children}</div>;
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wider",
          "text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        )}
      >
        <div className="flex items-center gap-2">
          {GroupIcon && <GroupIcon className="w-3.5 h-3.5" />}
          <span>{title}</span>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      <div className={cn(
        "space-y-0.5 overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        {children}
      </div>
    </div>
  );
};

const QuickActions = () => {
  const { isCollapsed } = useSidebarContext();

  if (isCollapsed) {
    return (
      <div className="p-2 border-b border-border">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button className="w-full flex items-center justify-center p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Ações Rápidas</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-border space-y-2">
      {/* Search */}
      <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg transition-colors">
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      
      {/* Quick action buttons */}
      <div className="flex gap-1.5">
        <NavLink 
          to="/clientes" 
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Cliente
        </NavLink>
        <NavLink 
          to="/ordens" 
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          OS
        </NavLink>
        <NavLink 
          to="/lancamentos" 
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Lançar
        </NavLink>
      </div>
    </div>
  );
};

const UserSection = () => {
  const { isCollapsed } = useSidebarContext();

  const userButton = (
    <button className={cn(
      "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors",
      isCollapsed && "justify-center"
    )}>
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-2 ring-background">
          <span className="text-white font-semibold text-sm">A</span>
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
      </div>
      {!isCollapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-foreground truncate">Administrador</p>
          <p className="text-xs text-muted-foreground truncate">Admin</p>
        </div>
      )}
      {!isCollapsed && <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {userButton}
            </TooltipTrigger>
            <TooltipContent side="right">Administrador</TooltipContent>
          </Tooltip>
        ) : (
          userButton
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={isCollapsed ? "right" : "top"} className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Administrador</p>
          <p className="text-xs text-muted-foreground">admin@anjolav.com</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Users className="w-4 h-4 mr-2" />
          Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="w-4 h-4 mr-2" />
          Preferências
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bell className="w-4 h-4 mr-2" />
          Notificações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const CollapseButton = () => {
  const { isCollapsed, toggleSidebar } = useSidebarContext();

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
            isCollapsed && "px-2"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Recolher menu</span>
            </>
          )}
        </button>
      </TooltipTrigger>
      {isCollapsed && (
        <TooltipContent side="right">Expandir menu</TooltipContent>
      )}
    </Tooltip>
  );
};

export function AppSidebar() {
  const { isCollapsed } = useSidebarContext();

  return (
    <TooltipProvider>
      <aside className={cn(
        "h-screen bg-card border-r border-border flex flex-col fixed left-0 top-0 z-40 transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )}>
        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center border-b border-border transition-all",
          isCollapsed ? "px-2 justify-center" : "px-4"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-primary-foreground font-bold text-base">A</span>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-base text-foreground leading-tight">AnjoLav</span>
                <span className="text-[10px] text-muted-foreground leading-tight">Sistema de Gestão</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />

          <NavGroup title="Comercial" icon={Users}>
            <NavItem to="/clientes" icon={Users} label="Clientes" badge={3} />
            <NavItem to="/produtos" icon={Package} label="Produtos & Serviços" />
          </NavGroup>

          <NavGroup title="Operacional" icon={Factory}>
            <NavItem to="/ordens" icon={ClipboardList} label="Abrir Retirada" />
            <NavItem to="/producao" icon={Factory} label="Fluxo de Produção" badge={12} />
            <NavItem to="/agenda" icon={Calendar} label="Agenda" />
          </NavGroup>

          <NavGroup title="Financeiro" icon={DollarSign}>
            <NavItem to="/financeiro" icon={DollarSign} label="Dashboard" />
            <NavItem to="/lancamentos" icon={Receipt} label="Lançamentos" badge={5} />
            <NavItem to="/faturamento" icon={FileText} label="Faturamento" />
            <NavItem to="/caixa" icon={CreditCard} label="Caixa PDV" />
            <NavItem to="/receber" icon={TrendingUp} label="Contas a Receber" badge={2} />
            <NavItem to="/pagar" icon={TrendingDown} label="Contas a Pagar" />
            <NavItem to="/asaas" icon={Building2} label="Asaas" />
          </NavGroup>

          <NavGroup title="Relatórios" icon={PieChart} defaultOpen={false}>
            <NavItem to="/relatorios/clientes" icon={FileSpreadsheet} label="Relatórios de Cliente" />
            <NavItem to="/relatorios/proximidade" icon={Route} label="Proximidade" />
            <NavItem to="/relatorios/caixa" icon={Receipt} label="Relatório de Caixa" />
            <NavItem to="/relatorios/financeiro" icon={PieChart} label="Relatório Financeiro" />
          </NavGroup>

          <NavGroup title="Sistema" icon={Settings} defaultOpen={false}>
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
          </NavGroup>
        </nav>

        {/* User Section */}
        <div className="border-t border-border p-2">
          <UserSection />
        </div>

        {/* Collapse Button */}
        <div className="border-t border-border">
          <CollapseButton />
        </div>
      </aside>
    </TooltipProvider>
  );
}
