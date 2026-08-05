import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTemPermissao } from "@/hooks/usePermissoesUsuario";
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
  BarChart3,
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
  compact?: boolean;
}

const NavItem = ({ to, icon: Icon, label, end = false, compact = false }: NavItemProps) => {
  const temPermissao = useTemPermissao(to);
  const location = useLocation();
  const { isCollapsed } = useSidebarContext();

  if (!temPermissao) return null;
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  const content = (
    <NavLink
      to={to}
      className={cn(
        "group flex items-center gap-3 rounded-lg font-medium transition-all duration-200 relative mx-2",
        compact ? "px-2 py-1.5 text-[11px] gap-1.5" : "px-3 py-2.5 text-sm",
        isActive
          ? "bg-sky-500/15 text-sky-400 font-semibold shadow-sm shadow-sky-500/10"
          : "text-slate-400 hover:bg-slate-800/40 hover:text-white",
        isCollapsed && "justify-center mx-1 px-2"
      )}
    >
      <Icon className={cn("flex-shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
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
        <TooltipContent side="right" className="flex items-center gap-2 bg-white text-slate-700 border-slate-200 shadow-md">
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
  compact?: boolean;
}

const NavGroup = ({ title, icon: GroupIcon, children, defaultOpen = true, compact = false }: NavGroupProps) => {
  const { isCollapsed } = useSidebarContext();
  const location = useLocation();

  const hasActiveChild = Array.isArray(children)
    ? children.some((child: any) => child?.props?.to && location.pathname.startsWith(child.props.to))
    : false;

  const storageKey = `sidebar-group:${title}`;
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultOpen;
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) return stored === "1";
    return defaultOpen || hasActiveChild;
  });

  const toggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const visibleChildren = Array.isArray(children) 
    ? children.filter((child: any) => child !== null) 
    : children;
  
  const visibleCount = Array.isArray(visibleChildren) ? visibleChildren.length : (visibleChildren ? 1 : 0);
  if (visibleCount === 0) return null;

  if (isCollapsed) {
    return <div className="space-y-1 py-1">{children}</div>;
  }

  return (
    <div className="mb-1">
      <button
        onClick={toggle}
        className={cn(
          "flex items-center gap-3 w-full rounded-lg font-medium transition-all duration-200",
          compact ? "px-2 py-1.5 mx-1.5 text-[11px] gap-1.5" : "px-3 py-2.5 mx-2 text-sm",
          (isOpen || hasActiveChild)
            ? "bg-slate-800/50 text-white"
            : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
        )}
        style={{ width: 'calc(100% - 16px)' }}
      >
        <GroupIcon className={cn("flex-shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
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

interface UserSectionProps {
  compact?: boolean;
}

const UserSection = ({ compact = false }: UserSectionProps) => {
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
      "flex items-center w-full rounded-lg hover:bg-slate-800/50 transition-colors text-white",
      compact ? "gap-2 p-1.5" : "gap-3 p-2",
      isCollapsed && "justify-center p-2"
    )}>
      <div className="relative">
        <div className={cn(
          "rounded-full bg-primary/10 flex items-center justify-center overflow-hidden",
          compact ? "w-7 h-7" : "w-9 h-9"
        )}>
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className={cn("text-primary font-semibold", compact ? "text-xs" : "text-sm")}>{getInitials(displayName)}</span>
          )}
        </div>
      </div>
      {!isCollapsed && (
        <div className="flex-1 min-w-0 text-left">
          <p className={cn("font-medium text-slate-200 truncate", compact ? "text-xs" : "text-sm")}>{displayName}</p>
          <p className={cn("text-slate-500 truncate", compact ? "text-[10px]" : "text-xs")}>{displayRole}</p>
        </div>
      )}
      {!isCollapsed && (
        <Settings className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
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
            <TooltipContent side="right" className="bg-white text-slate-700 border-slate-200 shadow-md">
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
        "absolute -right-3 top-6 flex items-center justify-center w-6 h-6 rounded-full bg-white text-slate-600 shadow-lg hover:scale-110 transition-all duration-200 z-50",
        "border border-slate-200"
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
  const { activeArea } = useWorkspace();
  const { configuracao } = useConfiguracoesGerais();
  
  const effectiveCollapsed = isMobile ? false : isCollapsed;
  const compact = !!isMobile;

  const nomeEmpresa = configuracao?.nome_empresa || "AnjoLav";
  const logoUrl = configuracao?.logo_url;
  const primeiraLetra = nomeEmpresa.charAt(0).toUpperCase();

  return (
    <TooltipProvider>
      <aside className={cn(
        "h-screen bg-[#0b1f33] border-r border-slate-800/30 flex flex-col transition-all duration-300",
        isMobile ? "w-full" : "fixed left-0 top-0 z-40",
        !isMobile && (effectiveCollapsed ? "w-16" : "w-56")
      )}>
        {!isMobile && <CollapseButton />}

        {/* Logo */}
        <div className={cn(
          "flex items-center justify-center transition-all border-b border-slate-800/30",
          effectiveCollapsed ? "h-16 px-2" : "h-20 px-4"
        )}>
          <div className="flex items-center gap-3">
            <span className={cn(
              "flex items-center justify-center rounded-lg bg-sky-500 shadow-lg shadow-sky-500/20 shrink-0",
              effectiveCollapsed ? "h-9 w-9" : "h-10 w-10"
            )}>
              <Droplets className={cn("text-white", effectiveCollapsed ? "h-5 w-5" : "h-6 w-6")} />
            </span>
            {!effectiveCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight text-white truncate">AnjoLav ERP</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-cyan-300/80 truncate">Gestão Integrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto space-y-0.5", compact ? "pb-2 pt-1" : "pb-4 pt-2 space-y-1")} onClick={onItemClick}>
          {activeArea === "central" && (
            <>
              <NavItem to="/central" icon={LayoutDashboard} label="Dashboard" end compact={compact} />
              
              <NavGroup title="Ambientes" icon={Building2} defaultOpen compact={compact}>
                <NavItem to="/industrial" icon={Factory} label="Painel Industrial" compact={compact} />
                <NavItem to="/residencial" icon={Building2} label="Painel Residencial" compact={compact} />
              </NavGroup>

              <NavGroup title="Gestão Consolidada" icon={PieChart} defaultOpen compact={compact}>
                <NavItem to="/central/financeiro" icon={DollarSign} label="Financeiro Global" compact={compact} />
                <NavItem to="/central/contas" icon={Wallet} label="Contas" compact={compact} />
                <NavItem to="/central/agenda-eventos" icon={Calendar} label="Agenda de Eventos" compact={compact} />
              </NavGroup>

              <NavGroup title="Administração" icon={Settings} compact={compact}>
                <NavItem to="/central/relatorios/quilometragem" icon={BarChart3} label="Quilometragem" compact={compact} />
                <NavItem to="/central/relatorios/mensal" icon={BarChart3} label="Relatório Mensal" compact={compact} />
                <NavItem to="/central/configuracoes" icon={Settings} label="Configurações" compact={compact} />
              </NavGroup>
            </>
          )}

          {activeArea === "industrial" && (
            <>
              <NavItem to="/industrial" icon={LayoutDashboard} label="Dashboard" end compact={compact} />
              
              <NavGroup title="Clientes e Contratos" icon={Users} defaultOpen compact={compact}>
                <NavItem to="/industrial/clientes" icon={Users} label="Clientes" compact={compact} />
                <NavItem to="/industrial/produtos" icon={Package} label="Produtos/Serviços" compact={compact} />
                <NavItem to="/industrial/fornecedores" icon={Building2} label="Fornecedores" compact={compact} />
              </NavGroup>

              <NavGroup title="Operação" icon={Factory} defaultOpen compact={compact}>
                <NavItem to="/industrial/agenda" icon={Calendar} label="Agenda" compact={compact} />
                <NavItem to="/industrial/ordens" icon={ClipboardList} label="Relatório do Fluxo" compact={compact} />
                <NavItem to="/industrial/producao" icon={Factory} label="Produção" compact={compact} />
              </NavGroup>

              <NavGroup title="Faturamento e Gestão" icon={Wallet} compact={compact}>
                <NavItem to="/industrial/lancamentos" icon={Receipt} label="PDV Industrial" compact={compact} />
                <NavItem to="/industrial/financeiro" icon={DollarSign} label="Financeiro" compact={compact} />
                <NavItem to="/industrial/estoque" icon={Package} label="Estoque" compact={compact} />
              </NavGroup>

              <NavGroup title="Análises" icon={PieChart} compact={compact}>
                <NavItem to="/industrial/relatorios/clientes" icon={FileSpreadsheet} label="Relatório Clientes" compact={compact} />
                <NavItem to="/industrial/relatorios/proximidade" icon={Route} label="Proximidade" compact={compact} />
              </NavGroup>
            </>
          )}

          {activeArea === "residencial" && (
            <>
              <NavItem to="/residencial" icon={LayoutDashboard} label="Dashboard" end compact={compact} />
              
              <NavGroup title="Atendimento" icon={Users} defaultOpen compact={compact}>
                <NavItem to="/residencial/caixa" icon={CreditCard} label="PDV Loja" compact={compact} />
                <NavItem to="/residencial/clientes" icon={Users} label="Clientes" compact={compact} />
              </NavGroup>

              <NavGroup title="Pedidos e Produção" icon={Factory} defaultOpen compact={compact}>
                <NavItem to="/residencial/agenda" icon={Calendar} label="Agenda" compact={compact} />
                <NavItem to="/residencial/ordens" icon={ClipboardList} label="Ordens de Serviço" compact={compact} />
                <NavItem to="/residencial/producao" icon={Factory} label="Produção" compact={compact} />
              </NavGroup>

              <NavGroup title="Caixa e Financeiro" icon={Wallet} compact={compact}>
                <NavItem to="/residencial/financeiro" icon={DollarSign} label="Financeiro" compact={compact} />
                <NavItem to="/residencial/produtos" icon={Package} label="Produtos/Serviços" compact={compact} />
                <NavItem to="/residencial/relatorios/caixa" icon={BarChart3} label="Relatórios de Caixa" compact={compact} />
              </NavGroup>
            </>
          )}


          {/* Bottom items */}
          <div className={cn("border-t border-slate-800", compact ? "pt-2 mt-2" : "pt-4 mt-4")}>
            <NavItem to="/central/configuracoes" icon={Settings} label="Configurações" compact={compact} />
          </div>
        </nav>

        {/* User Section */}
        <div className={cn("border-t border-slate-800", compact ? "p-2" : "p-3")}>
          <UserSection compact={compact} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
