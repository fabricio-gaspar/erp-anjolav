import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAccess } from "@/hooks/usePermissoesUsuario";
import {
  getAppRoute,
  getSidebarNavigationGroups,
  type AppRouteDefinition,
  type NavigationGroup,
} from "@/lib/appRoutes";
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
  Droplets,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Children, isValidElement, useState, type ElementType, type ReactElement, type ReactNode } from "react";
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
  route: AppRouteDefinition;
  icon: ElementType;
  compact?: boolean;
}

const NavItem = ({ route, icon: Icon, compact = false }: NavItemProps) => {
  const location = useLocation();
  const { isCollapsed } = useSidebarContext();
  const end = route.path === `/${route.area}`;

  const isActive = end ? location.pathname === route.path : location.pathname.startsWith(route.path);

  const content = (
    <NavLink
      to={route.path}
      className={cn(
        "group flex items-center gap-3 rounded-lg font-black transition-all duration-200 relative mx-3",
        compact ? "px-2 py-1.5 text-[10px] gap-1.5" : "px-3 py-2.5 text-[13px]",
        isActive
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        isCollapsed && "justify-center mx-1 px-2"
      )}
    >
      <Icon className={cn("flex-shrink-0", compact ? "w-4 h-4" : "w-5 h-5")} />
      {!isCollapsed && (
        <span className="flex-1 truncate">{route.label}</span>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2 bg-popover text-popover-foreground border-border shadow-md">
          {route.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

interface NavGroupProps {
  title: string;
  icon: ElementType;
  children: ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
}

const NavGroup = ({ title, icon: GroupIcon, children, defaultOpen = true, compact = false }: NavGroupProps) => {
  const { isCollapsed } = useSidebarContext();
  const location = useLocation();

  const childItems = Children.toArray(children).filter(
    (child): child is ReactElement<NavItemProps> => isValidElement<NavItemProps>(child),
  );
  const hasActiveChild = childItems.some((child) => location.pathname.startsWith(child.props.route.path));

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
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // Browsers may deny storage in private or embedded contexts.
      }
      return next;
    });
  };

  const visibleCount = childItems.length;
  if (visibleCount === 0) return null;

  if (isCollapsed) {
    return <div className="space-y-1 py-1">{children}</div>;
  }

  return (
    <div className="mb-1">
      <button
        onClick={toggle}
        className={cn(
          "flex items-center gap-3 w-full rounded-lg font-black transition-all duration-200",
          compact ? "px-2 py-1.5 mx-1.5 text-[10px] gap-1.5" : "px-3 py-2.5 mx-2 text-[12px]",
          (isOpen || hasActiveChild)
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
  const { activeArea } = useWorkspace();
  const navigate = useNavigate();
  const { user, funcionario, signOut } = useAuth();
  const { canAccessRoute } = useNavigationAccess();
  const settingsRoute = getAppRoute("/central/configuracoes");
  const canOpenSettings = activeArea === "central" && !!settingsRoute && canAccessRoute(settingsRoute);

  const handleMeuPerfil = () => {
    if (settingsRoute && canOpenSettings) navigate(`${settingsRoute.path}?tab=equipe`);
  };

  const handlePreferencias = () => {
    if (settingsRoute && canOpenSettings) navigate(`${settingsRoute.path}?tab=geral`);
  };

  const handleNotificacoes = () => {
    if (settingsRoute && canOpenSettings) navigate(`${settingsRoute.path}?tab=sistema`);
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
      "flex items-center w-full rounded-lg hover:bg-accent transition-colors text-foreground",
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
          <p className={cn("font-medium text-foreground truncate", compact ? "text-xs" : "text-sm")}>{displayName}</p>
          <p className={cn("text-muted-foreground truncate", compact ? "text-[10px]" : "text-xs")}>{displayRole}</p>
        </div>
      )}
      {!isCollapsed && (
        <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
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
            <TooltipContent side="right" className="bg-popover text-popover-foreground border-border shadow-md">
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
        {canOpenSettings && (
          <>
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
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSair} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NAVIGATION_GROUP_ICONS: Record<NavigationGroup, ElementType> = {
  "central-dashboard": LayoutDashboard,
  "workspace-switcher": Building2,
  "central-management": PieChart,
  "central-admin": Settings,
  "industrial-dashboard": LayoutDashboard,
  "industrial-customers": Users,
  "industrial-operations": Factory,
  "industrial-billing": Wallet,
  "industrial-analysis": PieChart,
  "residential-dashboard": LayoutDashboard,
  "residential-service": Users,
  "residential-operations": Factory,
  "residential-billing": Wallet,
};

const ROUTE_ICONS: Readonly<Record<string, ElementType>> = {
  "/central": LayoutDashboard,
  "/central/financeiro": DollarSign,
  "/central/contas": Wallet,
  "/central/agenda-eventos": Calendar,
  "/central/relatorios/quilometragem": Route,
  "/central/relatorios/mensal": BarChart3,
  "/central/configuracoes": Settings,
  "/central/auditoria": ShieldCheck,
  "/industrial": LayoutDashboard,
  "/industrial/clientes": Users,
  "/industrial/produtos": Package,
  "/industrial/fornecedores": Building2,
  "/industrial/agenda": Calendar,
  "/industrial/ordens": ClipboardList,
  "/industrial/producao": Factory,
  "/industrial/caixa": CreditCard,
  "/industrial/lancamentos": Receipt,
  "/industrial/financeiro": DollarSign,
  "/industrial/estoque": Package,
  "/industrial/relatorios/clientes": FileSpreadsheet,
  "/industrial/relatorios/proximidade": Route,
  "/residencial": LayoutDashboard,
  "/residencial/caixa": CreditCard,
  "/residencial/lancamentos": Receipt,
  "/residencial/clientes": Users,
  "/residencial/agenda": Calendar,
  "/residencial/ordens": ClipboardList,
  "/residencial/producao": Factory,
  "/residencial/financeiro": DollarSign,
  "/residencial/produtos": Package,
  "/residencial/relatorios/caixa": BarChart3,
};

const CollapseButton = () => {
  const { isCollapsed, toggleSidebar } = useSidebarContext();

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
      "absolute -right-3 top-6 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-all duration-200 z-50",
        "border border-background"
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
  const { canAccessRoute } = useNavigationAccess();
  
  const effectiveCollapsed = isMobile ? false : isCollapsed;
  const compact = !!isMobile;

  const nomeEmpresa = configuracao?.nome_empresa || "AnjoLav";
  const logoUrl = configuracao?.logo_url;
  const primeiraLetra = nomeEmpresa.charAt(0).toUpperCase();
  const navigationGroups = getSidebarNavigationGroups(activeArea)
    .map((group) => ({
      ...group,
      routes: group.routes.filter((route) => canAccessRoute(route)),
    }))
    .filter((group) => group.routes.length > 0);

  return (
    <TooltipProvider>
      <aside className={cn(
        "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
        isMobile ? "w-full" : "fixed left-0 top-0 z-40",
        !isMobile && (effectiveCollapsed ? "w-16" : "w-56")
      )}>
        {!isMobile && <CollapseButton />}

        {/* Logo */}
        <div className={cn(
          "flex items-center justify-center transition-all border-b border-border",
          effectiveCollapsed ? "h-16 px-2" : "h-20 px-4"
        )}>
          <div className="flex items-center gap-3">
            <span className={cn(
              "flex items-center justify-center rounded-lg bg-primary shadow-md shadow-primary/20 shrink-0",
              effectiveCollapsed ? "h-9 w-9" : "h-10 w-10"
            )}>
              <Droplets className={cn("text-primary-foreground", effectiveCollapsed ? "h-5 w-5" : "h-6 w-6")} />
            </span>
            {!effectiveCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight text-foreground truncate">AnjoLav ERP</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-primary truncate">Gestão Integrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto space-y-0.5", compact ? "pb-2 pt-1" : "pb-4 pt-2 space-y-1")} onClick={onItemClick}>
          {navigationGroups.map((group) => {
            const items = group.routes.map((route) => (
              <NavItem
                key={route.path}
                route={route}
                icon={ROUTE_ICONS[route.path] ?? LayoutDashboard}
                compact={compact}
              />
            ));

            if (!group.label) {
              return <div key={group.id} className="space-y-1 py-1">{items}</div>;
            }

            return (
              <NavGroup
                key={group.id}
                title={group.label}
                icon={NAVIGATION_GROUP_ICONS[group.id]}
                defaultOpen
                compact={compact}
              >
                {items}
              </NavGroup>
            );
          })}
        </nav>

        {/* User Section */}
        <div className={cn("border-t border-border", compact ? "p-2" : "p-3")}>
          <UserSection compact={compact} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
