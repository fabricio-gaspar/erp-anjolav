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
  Bell,
  User,
  Wallet,
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
}

const NavItem = ({ to, icon: Icon, label, end = false, badge }: NavItemProps) => {
  const location = useLocation();
  const { isCollapsed } = useSidebarContext();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  const content = (
    <NavLink
      to={to}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative mx-2",
        isActive
          ? "bg-white/20 text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white",
        isCollapsed && "justify-center mx-1 px-2"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      
      {!isCollapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      
      {!isCollapsed && badge && badge > 0 && (
        <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold bg-white text-sidebar-primary-foreground rounded-full">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      
      {isCollapsed && badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-white text-sidebar-primary-foreground rounded-full">
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
        <TooltipContent side="right" className="flex items-center gap-2 bg-sidebar text-white border-sidebar-border">
          {label}
          {badge && badge > 0 && (
            <span className="flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-semibold bg-white text-sidebar-primary-foreground rounded-full">
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
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const NavGroup = ({ title, icon: GroupIcon, children, defaultOpen = false }: NavGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isCollapsed } = useSidebarContext();
  const location = useLocation();
  
  // Auto-open if any child is active
  const hasActiveChild = Array.isArray(children) 
    ? children.some((child: any) => child?.props?.to && location.pathname.startsWith(child.props.to))
    : false;

  if (isCollapsed) {
    return <div className="space-y-1 py-1">{children}</div>;
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 w-full px-3 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-200",
          (isOpen || hasActiveChild)
            ? "bg-white/10 text-white"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        )}
        style={{ width: 'calc(100% - 16px)' }}
      >
        <GroupIcon className="w-5 h-5 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{title}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200 flex-shrink-0",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200 pl-4",
        isOpen ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
      )}>
        {children}
      </div>
    </div>
  );
};

const SearchBar = () => {
  const { isCollapsed } = useSidebarContext();

  if (isCollapsed) {
    return (
      <div className="px-2 py-3">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button className="w-full flex items-center justify-center p-2.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors">
              <Search className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-sidebar text-white border-sidebar-border">
            Buscar
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/70 bg-white/10 hover:bg-white/15 rounded-lg transition-colors">
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Buscar</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded bg-white/10 px-1.5 font-mono text-[10px] font-medium text-white/50">
          ⌘K
        </kbd>
      </button>
    </div>
  );
};

const UserSection = () => {
  const { isCollapsed } = useSidebarContext();

  const userButton = (
    <button className={cn(
      "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/10 transition-colors",
      isCollapsed && "justify-center p-2"
    )}>
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" 
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">Culaccino_</p>
          <p className="text-xs text-white/60 truncate">UX Designer</p>
        </div>
      )}
      {!isCollapsed && (
        <Settings className="w-4 h-4 text-white/60 hover:text-white transition-colors" />
      )}
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
            <TooltipContent side="right" className="bg-sidebar text-white border-sidebar-border">
              Culaccino_
            </TooltipContent>
          </Tooltip>
        ) : (
          userButton
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={isCollapsed ? "right" : "top"} className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Culaccino_</p>
          <p className="text-xs text-muted-foreground">admin@anjolav.com</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="w-4 h-4 mr-2" />
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
    <button
      onClick={toggleSidebar}
      className={cn(
        "absolute -right-3 top-6 flex items-center justify-center w-6 h-6 rounded-full bg-sidebar text-white shadow-lg hover:scale-110 transition-all duration-200 z-50",
        "border-2 border-white/20"
      )}
    >
      {isCollapsed ? (
        <ChevronRight className="w-3.5 h-3.5" />
      ) : (
        <ChevronLeft className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

interface AppSidebarProps {
  isMobile?: boolean;
  onItemClick?: () => void;
}

export function AppSidebar({ isMobile, onItemClick }: AppSidebarProps) {
  const { isCollapsed } = useSidebarContext();
  
  // In mobile, always show expanded
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  return (
    <TooltipProvider>
      <aside className={cn(
        "h-screen bg-sidebar flex flex-col transition-all duration-300",
        isMobile ? "w-full" : "fixed left-0 top-0 z-40 relative",
        !isMobile && (effectiveCollapsed ? "w-16" : "w-56")
      )}>
        {/* Collapse Button - hide on mobile */}
        {!isMobile && <CollapseButton />}

        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center transition-all",
          effectiveCollapsed ? "px-2 justify-center" : "px-4"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            {!effectiveCollapsed && (
              <span className="font-bold text-base text-white">AnjoLav</span>
            )}
          </div>
        </div>

        {/* Search */}
        {!isMobile && <SearchBar />}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto pb-4 space-y-1" onClick={onItemClick}>
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />

          <NavGroup title="Comercial" icon={Users} defaultOpen>
            <NavItem to="/clientes" icon={Users} label="Clientes" badge={3} />
            <NavItem to="/produtos" icon={Package} label="Produtos" />
          </NavGroup>

          <NavGroup title="Operacional" icon={Factory}>
            <NavItem to="/ordens" icon={ClipboardList} label="Abrir Retirada" />
            <NavItem to="/producao" icon={Factory} label="Produção" badge={12} />
            <NavItem to="/agenda" icon={Calendar} label="Agenda" />
          </NavGroup>

          <NavGroup title="Financeiro" icon={Wallet}>
            <NavItem to="/financeiro" icon={DollarSign} label="Dashboard" />
            <NavItem to="/lancamentos" icon={Receipt} label="Lançamentos" badge={5} />
            <NavItem to="/faturamento" icon={FileText} label="Faturamento" />
            <NavItem to="/caixa" icon={CreditCard} label="Caixa PDV" />
            <NavItem to="/receber" icon={TrendingUp} label="Contas a Receber" badge={2} />
            <NavItem to="/pagar" icon={TrendingDown} label="Contas a Pagar" />
            <NavItem to="/asaas" icon={Building2} label="Asaas" />
          </NavGroup>

          <NavGroup title="Relatórios" icon={PieChart}>
            <NavItem to="/relatorios/clientes" icon={FileSpreadsheet} label="Clientes" />
            <NavItem to="/relatorios/proximidade" icon={Route} label="Proximidade" />
            <NavItem to="/relatorios/caixa" icon={Receipt} label="Caixa" />
            <NavItem to="/relatorios/financeiro" icon={PieChart} label="Financeiro" />
          </NavGroup>

          {/* Bottom items */}
          <div className="pt-4 mt-4 border-t border-white/10">
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
            <div className="mx-2">
              <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200">
                <Bell className="w-5 h-5 flex-shrink-0" />
                {!effectiveCollapsed && <span className="flex-1 text-left">Notificações</span>}
              </button>
            </div>
          </div>
        </nav>

        {/* User Section */}
        <div className="border-t border-white/10 p-3">
          <UserSection />
        </div>
      </aside>
    </TooltipProvider>
  );
}
