import { Building2, ChevronRight, Menu, LayoutGrid } from "lucide-react";
import { useWorkspace, WorkspaceArea } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
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

export function AppHeader({ title, subtitle, onMenuClick, showMenuButton }: AppHeaderProps) {
  const { activeArea } = useWorkspace();
  const { activeTenant, tenants, switchTenant } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
      "h-[82px] shadow-none flex items-center justify-between px-6 sticky top-0 z-30 transition-colors border-b border-slate-200 shrink-0",
      activeArea === "central" ? "bg-[#0b1f33]" : "bg-white/95"
    )}>
      <div className="flex items-center gap-4 w-full">
        {showMenuButton && (
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0 text-white/70 hover:text-white hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex items-center gap-5 w-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={cn(
                "gap-2 px-3 h-10 rounded-xl transition-colors shrink-0",
                activeArea === "central" ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100"
              )}>
                <LayoutGrid className={cn("w-5 h-5", activeArea === "central" ? "text-sky-400" : "text-blue-600")} />
                <span className="font-black text-[13px] uppercase tracking-wider hidden sm:inline">{areaLabels[activeArea]}</span>
                <ChevronRight className={cn("w-3.5 h-3.5 rotate-90", activeArea === "central" ? "text-white/40" : "text-slate-400")} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2 rounded-xl">
              <DropdownMenuItem onClick={() => handleAreaChange("central")} className={cn("rounded-lg mb-1", activeArea === "central" && "bg-slate-100 font-black")}>
                Painel Central
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAreaChange("industrial")} className={cn("rounded-lg mb-1", activeArea === "industrial" && "bg-slate-100 font-black")}>
                Operação Industrial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAreaChange("residencial")} className={cn("rounded-lg", activeArea === "residencial" && "bg-slate-100 font-black")}>
                Operação Residencial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className={cn("w-[1px] h-8 shrink-0", activeArea === "central" ? "bg-white/10" : "bg-slate-200")} />

          <div className="flex flex-col justify-center min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className={cn("text-xl font-black tracking-tight truncate", activeArea === "central" ? "text-white" : "text-slate-900")}>
                {title || (routeNames[location.pathname] || "AnjoLav")}
              </h1>
            </div>
            <p className={cn("text-[11px] font-bold uppercase tracking-widest truncate", activeArea === "central" ? "text-white/50" : "text-slate-400")}>
              {subtitle || "AnjoLav ERP"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {activeTenant && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "max-w-48 gap-2",
                  activeArea === "central" ? "text-white hover:bg-white/10" : "text-slate-700",
                )}
                aria-label={`Empresa ativa: ${activeTenant.name}`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="hidden truncate text-xs font-bold md:inline">{activeTenant.name}</span>
                {tenants.length > 1 && <ChevronRight className="h-3 w-3 rotate-90 opacity-60" />}
              </Button>
            </DropdownMenuTrigger>
            {tenants.length > 1 && (
              <DropdownMenuContent align="end" className="w-64">
                {tenants.map((tenant) => (
                  <DropdownMenuItem
                    key={tenant.id}
                    onClick={() => void switchTenant(tenant.id)}
                    className={cn(tenant.id === activeTenant.id && "bg-muted font-bold")}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="truncate">{tenant.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        )}
        <GlobalSearch />
      </div>
    </header>
  );
}
