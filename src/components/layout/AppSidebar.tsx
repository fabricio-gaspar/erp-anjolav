import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
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
  Wallet,
  PieChart,
  FileSpreadsheet,
  Route,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
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
}

const NavItem = ({ to, icon: Icon, label, end = false }: NavItemProps) => {
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

const NavGroup = ({ title, icon: GroupIcon, children, defaultOpen = true }: NavGroupProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { isCollapsed } = useSidebarContext();
  const location = useLocation();
  
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

const UserSection = () => {
  const { isCollapsed } = useSidebarContext();
  const navigate = useNavigate();
  const { user, funcionario, signOut } = useAuth();

  const handleMeuPerfil = () => {
    navigate("/configuracoes?tab=equipe");
  };

  const handlePreferencias = () => {
    navigate("/configuracoes?tab=geral");
  };

  const handleNotificacoes = () => {
    navigate("/configuracoes?tab=sistema");
  };

  const handleSair = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = funcionario?.nome || user?.email?.split("@")[0] || "Usuário";
  const displayRole = funcionario?.cargo || "Operador";
  const displayEmail = user?.email || "user@anjolav.com";
  const avatarUrl = funcionario?.avatar_url || null;
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const userButton = (
    <button className={cn(
      "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/10 transition-colors",
      isCollapsed && "justify-center p-2"
    )}>
      <div className="relative">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white text-sm font-semibold">{getInitials(displayName)}</span>
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          <p className="text-xs text-white/60 truncate">{displayRole}</p>
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
              {displayName}
            </TooltipContent>
          </Tooltip>
        ) : (
          userButton
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={isCollapsed ? "right" : "top"} className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{displayEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleMeuPerfil}>
          <User className="w-4 h-4 mr-2" />
          Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePreferencias}>
          <Settings className="w-4 h-4 mr-2" />
          Preferências
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNotificacoes}>
          <Bell className="w-4 h-4 mr-2" />
          Notificações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSair} className="text-destructive focus:text-destructive">
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
  const { configuracao } = useConfiguracoesGerais();
  
  const effectiveCollapsed = isMobile ? false : isCollapsed;

  const nomeEmpresa = configuracao?.nome_empresa || "AnjoLav";
  const logoUrl = configuracao?.logo_url;
  const primeiraLetra = nomeEmpresa.charAt(0).toUpperCase();

  return (
    <TooltipProvider>
      <aside className={cn(
        "h-screen bg-sidebar flex flex-col transition-all duration-300",
        isMobile ? "w-full" : "fixed left-0 top-0 z-40",
        !isMobile && (effectiveCollapsed ? "w-16" : "w-56")
      )}>
        {!isMobile && <CollapseButton />}

        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center justify-center transition-all",
          effectiveCollapsed ? "px-2" : "px-3"
        )}>
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={nomeEmpresa}
              className={cn(
                "object-contain",
                effectiveCollapsed ? "h-8 max-w-[40px]" : "h-9 max-w-[180px]"
              )}
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center">
                <span className="text-white font-bold text-lg">{primeiraLetra}</span>
              </div>
              {!effectiveCollapsed && (
                <span className="font-bold text-base text-white">{nomeEmpresa}</span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto pb-4 pt-2 space-y-1" onClick={onItemClick}>
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />

          <NavGroup title="Comercial" icon={Users} defaultOpen>
            <NavItem to="/clientes" icon={Users} label="Clientes" />
            <NavItem to="/produtos" icon={Package} label="Produtos" />
            <NavItem to="/fornecedores" icon={Building2} label="Fornecedores" />
          </NavGroup>

          <NavGroup title="Operacional" icon={Factory}>
            <NavItem to="/ordens" icon={ClipboardList} label="Abrir Retirada" />
            <NavItem to="/producao" icon={Factory} label="Produção" />
            <NavItem to="/agenda" icon={Calendar} label="Agenda" />
            <NavItem to="/estoque" icon={Package} label="Estoque" />
          </NavGroup>

          <NavGroup title="Financeiro" icon={Wallet}>
            <NavItem to="/financeiro" icon={DollarSign} label="Visão Geral" />
            <NavItem to="/lancamentos" icon={Receipt} label="Lançamentos" />
            <NavItem to="/caixa" icon={CreditCard} label="Caixa PDV" />
            <NavItem to="/contas" icon={Wallet} label="Contas" />
          </NavGroup>

          <NavGroup title="Relatórios" icon={PieChart}>
            <NavItem to="/relatorios/clientes" icon={FileSpreadsheet} label="Clientes" />
            <NavItem to="/relatorios/proximidade" icon={Route} label="Proximidade" />
          </NavGroup>

          {/* Bottom items */}
          <div className="pt-4 mt-4 border-t border-white/10">
            <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
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
