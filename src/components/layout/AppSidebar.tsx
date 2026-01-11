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
  Route,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
}

const NavItem = ({ to, icon: Icon, label, end = false }: NavItemProps) => {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </NavLink>
  );
};

interface NavGroupProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const NavGroup = ({ title, children, defaultOpen = true }: NavGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        {title}
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            isOpen ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {isOpen && <div className="space-y-1">{children}</div>}
    </div>
  );
};

export function AppSidebar() {
  return (
    <aside className="w-56 h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-lg text-foreground">AnjoLav</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />

        <NavGroup title="Comercial">
          <NavItem to="/clientes" icon={Users} label="Clientes" />
          <NavItem to="/produtos" icon={Package} label="Produtos & Serviços" />
        </NavGroup>

        <NavGroup title="Operacional">
          <NavItem to="/ordens" icon={ClipboardList} label="Abrir Retirada" />
          <NavItem to="/producao" icon={Factory} label="Fluxo de Produção" />
          <NavItem to="/agenda" icon={Calendar} label="Agenda" />
        </NavGroup>

        <NavGroup title="Financeiro">
          <NavItem to="/financeiro" icon={DollarSign} label="Dashboard" />
          <NavItem to="/lancamentos" icon={Receipt} label="Lançamentos" />
          <NavItem to="/faturamento" icon={FileText} label="Faturamento" />
          <NavItem to="/caixa" icon={CreditCard} label="Caixa PDV" />
          <NavItem to="/receber" icon={TrendingUp} label="Contas a Receber" />
          <NavItem to="/pagar" icon={TrendingDown} label="Contas a Pagar" />
          <NavItem to="/asaas" icon={Building2} label="Asaas" />
        </NavGroup>

        <NavGroup title="Relatórios">
          <NavItem to="/relatorios/clientes" icon={FileSpreadsheet} label="Relatórios de Cliente" />
          <NavItem to="/relatorios/proximidade" icon={Route} label="Proximidade" />
          <NavItem to="/relatorios/caixa" icon={Receipt} label="Relatório de Caixa" />
          <NavItem to="/relatorios/financeiro" icon={PieChart} label="Relatório Financeiro" />
        </NavGroup>

        <NavGroup title="Configurações" defaultOpen={false}>
          <NavItem to="/configuracoes" icon={Settings} label="Configurações" />
        </NavGroup>
      </nav>

      {/* User */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-warning flex items-center justify-center">
            <span className="text-warning-foreground font-medium text-xs">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Administrador</p>
            <p className="text-xs text-muted-foreground truncate">Admin</p>
          </div>
          <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
