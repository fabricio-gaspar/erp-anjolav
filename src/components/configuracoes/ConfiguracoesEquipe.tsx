import { useCallback, useDeferredValue, useState, useMemo, useEffect, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FuncionarioAvatarHeader } from "./FuncionarioAvatarHeader";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Plus, 
  Pencil, 
  Mail, 
  Key, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Search,
  Car,
  UserCheck,
  AlertTriangle,
  Phone,
  CreditCard,
  Calendar,
  Link as LinkIcon,
  Copy,
  Building2,
  Factory,
  Store,
  ShieldCheck,
  FileText,
  Wallet,
  Archive,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Undo2,
  Gift,
} from "lucide-react";
import { FichaFuncionarioModal } from "./FichaFuncionarioModal";
import { FuncionarioFolhaInline } from "./FuncionarioFolhaInline";
import { BeneficiosCatalogoTab } from "./BeneficiosCatalogoTab";
import { useFolhaPagamento, useFolhaResumo, useGerarFolhaMes, useFecharFolhaMes } from "@/hooks/useFolhaPagamento";
import { Lock, Play, Wallet as WalletIcon } from "lucide-react";
import { 
  useFuncionarios, 
  useCreateFuncionario, 
  useArchiveFuncionario,
  useUpdateFuncionario,
  useToggleFuncionarioStatus,
  useChangePassword,
  type Funcionario,
  type EmployeeAccessProfile,
} from "@/hooks/useFuncionarios";
import { useEmployeeDirectory, useEmployeeDirectorySummary } from "@/hooks/useEmployeeDirectory";
import { useMotoristas, type Motorista, type MotoristaInsert } from "@/hooks/useMotoristas";
import { useDriverDirectory, useDriverDirectorySummary } from "@/hooks/useDriverDirectory";
import { useVeiculos, type Veiculo, type VeiculoInsert } from "@/hooks/useVeiculos";
import { useVehicleDirectory, useVehicleDirectorySummary } from "@/hooks/useVehicleDirectory";
import {
  DRIVER_DIRECTORY_PAGE_SIZE,
  normalizeDriverDirectoryPage,
  type DriverDirectoryStatus,
  type DriverLicenseStatus,
} from "@/lib/driverDirectory";
import {
  VEHICLE_DIRECTORY_PAGE_SIZE,
  normalizeVehicleDirectoryPage,
  type VehicleDirectoryStatus,
} from "@/lib/vehicleDirectory";
import {
  EMPLOYEE_DIRECTORY_PAGE_SIZE,
  normalizeEmployeeDirectoryPage,
  type EmployeeDirectoryStatus,
} from "@/lib/employeeDirectory";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// Helper function for initials
const getInitials = (name: string): string => {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const getAvatarExtension = (file: File): string => {
  const extension = AVATAR_EXTENSION_BY_MIME[file.type];
  if (!extension || file.size <= 0 || file.size > 2 * 1024 * 1024) {
    throw new Error("Arquivo de avatar inválido");
  }
  return extension;
};

const getAvatarStoragePath = (
  value: string | null | undefined,
  tenantId: string,
): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/avatars/";
    const markerIndex = url.pathname.indexOf(marker);
    if (url.protocol !== "https:" || markerIndex < 0) return null;
    const storagePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    return storagePath.startsWith(`${tenantId}/funcionarios/`) && !storagePath.includes("..")
      ? storagePath
      : null;
  } catch {
    return null;
  }
};

// ===== CONSTANTS =====
const CARGOS = [
  "ADMINISTRADOR",
  "OPERADOR DE PRODUÇÃO",
  "MOTORISTA",
  "BALCONISTA",
  "AUXILIAR",
  "COORDENADOR(A)",
  "GERENTE",
  "SUPERVISOR(A)",
  "ADMINISTRATIVO",
  "RECEPCIONISTA",
];

const DEPARTAMENTOS = [
  "Produção",
  "Logística",
  "Lavanderia",
  "Administração",
  "Comercial",
  "Financeiro",
  "RH",
];

const ACCESS_PROFILE_OPTIONS: ReadonlyArray<{
  value: EmployeeAccessProfile;
  label: string;
  description: string;
}> = [
  {
    value: "pdv_domestico",
    label: "PDV Doméstico",
    description: "Abre o PDV Doméstico com clientes, serviços, ROLs, delivery, produção e faturamento do setor.",
  },
  {
    value: "pdv_industrial",
    label: "PDV Industrial",
    description: "Abre o PDV Industrial com clientes, serviços, ROLs, delivery, produção e faturamento do setor.",
  },
  {
    value: "administracao",
    label: "Administração",
    description: "Abre o Painel Administrativo e as configurações.",
  },
];

const TIPOS_VEICULO = [
  "Carro",
  "Moto",
  "Van",
  "Caminhão",
  "Utilitário",
];

// ===== UTILITY FUNCTIONS =====
const formatTelefone = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

const formatPlaca = (value: string) => {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
};

const formatCNH = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 11);
};

const getCNHStatus = (validade: string | null): { status: "ok" | "warning" | "expired"; label: string; color: string } => {
  if (!validade) return { status: "ok", label: "Sem data", color: "secondary" };
  
  const validadeDate = parseISO(validade);
  if (!isValid(validadeDate)) return { status: "ok", label: "Data inválida", color: "secondary" };
  
  const today = new Date();
  const days = differenceInDays(validadeDate, today);
  
  if (days < 0) return { status: "expired", label: "Vencida", color: "destructive" };
  if (days <= 30) return { status: "warning", label: `Vence em ${days}d`, color: "warning" };
  return { status: "ok", label: format(validadeDate, "dd/MM/yyyy"), color: "secondary" };
};

// ===== KPI CARD COMPONENT =====
interface KPICardProps {
  title: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  color: string;
  alert?: { count: number; label: string };
}

function KPICard({ title, value, total, icon, color, alert }: KPICardProps) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${color}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground sm:text-sm">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground sm:text-2xl">{value}</span>
            <span className="text-xs text-muted-foreground sm:text-sm">/ {total} total</span>
          </div>
        </div>
        {alert && alert.count > 0 && (
          <Badge variant="destructive" className="animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {alert.count} {alert.label}
          </Badge>
        )}
      </div>
    </Card>
  );
}

// ===== MAIN COMPONENT =====
export function ConfiguracoesEquipe() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("equipe");
  const activeTab = requestedSection === "motoristas" || requestedSection === "veiculos" || requestedSection === "beneficios"
    ? requestedSection
    : "funcionarios";
  const setActiveTab = (section: string) => {
    const next = new URLSearchParams(searchParams);
    if (section === "funcionarios") next.delete("equipe");
    else next.set("equipe", section);
    setSearchParams(next, { replace: true });
  };
  
  // Funcionários state and hooks
  const { data: funcionarios = [] } = useFuncionarios({ enabled: activeTab === "motoristas" });
  const createFuncionario = useCreateFuncionario();
  const archiveFuncionario = useArchiveFuncionario();
  const updateFuncionario = useUpdateFuncionario();
  const toggleFuncionarioStatus = useToggleFuncionarioStatus();
  const { data: employeeSummary } = useEmployeeDirectorySummary();
  
  // Motoristas state and hooks
  const { 
    createMotorista,
    updateMotorista,
    setMotoristaStatus,
  } = useMotoristas({ enabled: false });
  const { data: driverSummary, isLoading: loadingMotoristas } = useDriverDirectorySummary();
  
  // Veículos state and hooks
  const { 
    createVeiculo,
    updateVeiculo,
    setVeiculoStatus,
  } = useVeiculos({ enabled: false });
  const { data: vehicleSummary } = useVehicleDirectorySummary();

  // KPIs
  const funcionariosAtivos = employeeSummary?.active ?? 0;
  const motoristasAtivos = driverSummary?.active ?? 0;
  const veiculosAtivos = vehicleSummary?.active ?? 0;
  const cnhVencendo = driverSummary?.licenseAttention ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KPICard
          title="Funcionários Ativos"
          value={funcionariosAtivos}
          total={employeeSummary?.total ?? 0}
          icon={<Users className="w-6 h-6 text-orange-600" />}
          color="bg-orange-100"
        />
        <KPICard
          title="Motoristas Ativos"
          value={motoristasAtivos}
          total={driverSummary?.total ?? 0}
          icon={<UserCheck className="w-6 h-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <KPICard
          title="Veículos Ativos"
          value={veiculosAtivos}
          total={vehicleSummary?.total ?? 0}
          icon={<Car className="w-6 h-6 text-green-600" />}
          color="bg-green-100"
        />
        <KPICard
          title="CNH em atenção"
          value={cnhVencendo}
          total={driverSummary?.total ?? 0}
          icon={<CreditCard className="w-6 h-6 text-red-600" />}
          color="bg-red-100"
        />
      </div>

      {/* Sub-Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="funcionarios" className="gap-2">
            <Users className="w-4 h-4" />
            Funcionários
          </TabsTrigger>
          <TabsTrigger value="motoristas" className="gap-2">
            <UserCheck className="w-4 h-4" />
            Motoristas
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-2">
            <Car className="w-4 h-4" />
            Veículos
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="gap-2">
            <Gift className="w-4 h-4" />
            Benefícios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="funcionarios">
          <FuncionariosTab
            activeEmployeeCount={funcionariosAtivos}
            createFuncionario={createFuncionario}
            updateFuncionario={updateFuncionario}
            archiveFuncionario={archiveFuncionario}
            toggleStatus={toggleFuncionarioStatus}
          />
        </TabsContent>

        <TabsContent value="motoristas">
          <MotoristasTab
            funcionarios={funcionarios}
            isLoading={loadingMotoristas}
            createMotorista={createMotorista}
            updateMotorista={updateMotorista}
            setMotoristaStatus={setMotoristaStatus}
          />
        </TabsContent>

        <TabsContent value="veiculos">
          <VeiculosTab
            createVeiculo={createVeiculo}
            updateVeiculo={updateVeiculo}
            setVeiculoStatus={setVeiculoStatus}
          />
        </TabsContent>

        <TabsContent value="beneficios">
          <BeneficiosCatalogoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== FUNCIONÁRIOS TAB =====
interface FuncionariosTabProps {
  activeEmployeeCount: number;
  createFuncionario: ReturnType<typeof useCreateFuncionario>;
  updateFuncionario: ReturnType<typeof useUpdateFuncionario>;
  archiveFuncionario: ReturnType<typeof useArchiveFuncionario>;
  toggleStatus: ReturnType<typeof useToggleFuncionarioStatus>;
}

function FuncionariosTab({
  activeEmployeeCount,
  createFuncionario,
  updateFuncionario,
  archiveFuncionario,
  toggleStatus,
}: FuncionariosTabProps) {
  const { activeTenant, tenants, switchTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSwitchingTenant, setIsSwitchingTenant] = useState(false);
  const [createdAccess, setCreatedAccess] = useState<{
    link: string;
    email: string;
    tenantName: string;
    profile: EmployeeAccessProfile;
  } | null>(null);
  const searchTerm = searchParams.get("funcionario_q") ?? "";
  const deferredSearch = useDeferredValue(searchTerm);
  const requestedStatus = searchParams.get("funcionario_situacao");
  const statusFilter: EmployeeDirectoryStatus = requestedStatus === "active" || requestedStatus === "inactive"
    ? requestedStatus
    : "all";
  const requestedDepartment = searchParams.get("funcionario_departamento") ?? "all";
  const departmentFilter = requestedDepartment === "all" || DEPARTAMENTOS.includes(requestedDepartment)
    ? requestedDepartment
    : "all";
  const page = normalizeEmployeeDirectoryPage(searchParams.get("funcionario_pagina"));
  const [archiveItem, setArchiveItem] = useState<Funcionario | null>(null);
  const [editItem, setEditItem] = useState<Funcionario | null>(null);
  const [fichaItem, setFichaItem] = useState<Funcionario | null>(null);
  const [passwordItem, setPasswordItem] = useState<Funcionario | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const changePassword = useChangePassword();
  const {
    data: directory,
    isLoading,
    isFetching,
    error: directoryError,
    refetch,
  } = useEmployeeDirectory({
    page,
    pageSize: EMPLOYEE_DIRECTORY_PAGE_SIZE,
    search: deferredSearch,
    status: statusFilter,
    department: departmentFilter,
  });
  const funcionarios = useMemo(() => directory?.funcionarios ?? [], [directory?.funcionarios]);
  const totalEmployees = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmployees / EMPLOYEE_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalEmployees === 0 ? 0 : (page - 1) * EMPLOYEE_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * EMPLOYEE_DIRECTORY_PAGE_SIZE, totalEmployees);

  const updateDirectoryParams = useCallback((updates: {
    search?: string;
    status?: EmployeeDirectoryStatus;
    department?: string;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.search !== undefined) {
      if (updates.search) next.set("funcionario_q", updates.search);
      else next.delete("funcionario_q");
    }
    if (updates.status !== undefined) {
      if (updates.status === "all") next.delete("funcionario_situacao");
      else next.set("funcionario_situacao", updates.status);
    }
    if (updates.department !== undefined) {
      if (updates.department === "all") next.delete("funcionario_departamento");
      else next.set("funcionario_departamento", updates.department);
    }
    const nextPage = updates.page ?? (updates.search !== undefined || updates.status !== undefined || updates.department !== undefined ? 1 : page);
    if (nextPage <= 1) next.delete("funcionario_pagina");
    else next.set("funcionario_pagina", String(nextPage));
    setSearchParams(next, { replace: true });
  }, [page, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isLoading && totalEmployees > 0 && page > totalPages) {
      updateDirectoryParams({ page: totalPages });
    }
  }, [isLoading, page, totalEmployees, totalPages, updateDirectoryParams]);

  // Folha do mês corrente (sempre)
  const competencia = format(new Date(), "yyyy-MM-01");
  const competenciaLabel = format(new Date(), "MM/yyyy");
  const visibleEmployeeIds = useMemo(() => funcionarios.map((employee) => employee.id), [funcionarios]);
  const {
    data: folhasMes = [],
    error: folhasError,
    refetch: refetchFolhas,
  } = useFolhaPagamento(competencia, visibleEmployeeIds);
  const {
    data: folhaResumo,
    error: folhaResumoError,
    refetch: refetchFolhaResumo,
    isFetching: isFetchingFolhaResumo,
  } = useFolhaResumo(competencia);
  const gerarFolha = useGerarFolhaMes();
  const fecharFolha = useFecharFolhaMes();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFechar, setShowFechar] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));

  const folhaPorFunc = useMemo(() => {
    const m = new Map<string, typeof folhasMes[number]>();
    folhasMes.forEach((f) => m.set(f.funcionario_id, f));
    return m;
  }, [folhasMes]);

  const abertasCount = folhaResumo?.abertas ?? 0;
  
  const [formData, setFormData] = useState({
    nome: "",
    cargo: "OPERADOR DE PRODUÇÃO",
    departamento: "Produção",
    telefone: "",
    cpf: "",
    email: "",
    login: "",
    accessProfile: "pdv_domestico" as EmployeeAccessProfile,
    data_admissao: "",
    carga_horaria: "44",
    dias_trabalhados: ["seg", "ter", "qua", "qui", "sex"],
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setFormData({
      nome: "",
      cargo: "OPERADOR DE PRODUÇÃO",
      departamento: "Produção",
      telefone: "",
      cpf: "",
      email: "",
      login: "",
      accessProfile: "pdv_domestico",
      data_admissao: "",
      carga_horaria: "44",
      dias_trabalhados: ["seg", "ter", "qua", "qui", "sex"],
    });
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAvatarChange = (file: File | null, previewUrl: string | null) => {
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  };

  const handleTenantSelection = async (tenantId: string) => {
    if (tenantId === activeTenant?.id) return;
    setIsSwitchingTenant(true);
    try {
      await switchTenant(tenantId);
    } finally {
      setIsSwitchingTenant(false);
    }
  };

  const handleCopyAccessLink = async () => {
    if (!createdAccess) return;
    try {
      await navigator.clipboard.writeText(createdAccess.link);
      toast.success("Link de ativação copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link manualmente.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.login.trim() || !formData.email.trim() || !activeTenant) return;

    let uploadedAvatarPath: string | null = null;
    let employeeMutationStarted = false;
    try {
      setIsUploading(true);
      let avatarUrl: string | undefined = undefined;

      // Upload avatar if file exists
      if (avatarFile) {
        if (!activeTenant) throw new Error("Empresa ativa não identificada");
        const fileExt = getAvatarExtension(avatarFile);
        const filePath = `${activeTenant.id}/funcionarios/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Erro ao fazer upload da foto');
        } else {
          uploadedAvatarPath = filePath;
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      employeeMutationStarted = true;
      const result = await createFuncionario.mutateAsync({
        nome: formData.nome,
        cargo: formData.cargo,
        departamento: formData.departamento,
        telefone: formData.telefone || undefined,
        cpf: formData.cpf || undefined,
        email: formData.email || undefined,
        login: formData.login,
        accessProfile: formData.accessProfile,
        inviteRedirectTo: `${window.location.origin}/reset-password`,
        avatar_url: avatarUrl,
      });

      if (result.accessLink) {
        setCreatedAccess({
          link: result.accessLink,
          email: formData.email,
          tenantName: activeTenant.name,
          profile: formData.accessProfile,
        });
      }

      resetForm();
      setIsFormOpen(false);
    } catch (error) {
      if (uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([uploadedAvatarPath]);
        if (cleanupError) console.error("Falha ao remover avatar órfão", cleanupError);
      }
      if (!employeeMutationStarted) {
        toast.error(error instanceof Error ? error.message : "Erro ao cadastrar funcionário");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleStatus = (funcionario: Funcionario) => {
    if (funcionario.ativo) {
      setArchiveItem(funcionario);
      return;
    }
    toggleStatus.mutate({ id: funcionario.id, ativo: true });
  };

  return (
    <div className="space-y-4">
      {/* Collapsible Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="h-auto w-full justify-between p-0 text-left hover:bg-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Novo usuário e funcionário</h3>
                  <p className="text-sm text-muted-foreground">
                    Vincule à empresa, defina o painel e gere o link de ativação
                  </p>
                </div>
              </div>
              {isFormOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Header */}
              <FuncionarioAvatarHeader
                nome={formData.nome}
                cargo={formData.cargo}
                departamento={formData.departamento}
                avatarUrl={avatarPreview}
                onAvatarChange={handleAvatarChange}
              />

              {/* Dados Pessoais */}
              <div>
                <h4 className="text-sm font-semibold text-orange-600 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Dados Pessoais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-name">Nome Completo *</Label>
                    <Input
                      id="new-employee-name"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Digite o nome completo"
                      required
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo *</Label>
                    <Select
                      value={formData.cargo}
                      onValueChange={(value) => setFormData({ ...formData, cargo: value })}
                    >
                      <SelectTrigger aria-label="Cargo do novo funcionário">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CARGOS.map((cargo) => (
                          <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Departamento</Label>
                    <Select
                      value={formData.departamento}
                      onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                    >
                      <SelectTrigger aria-label="Departamento do novo funcionário">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTAMENTOS.map((depto) => (
                          <SelectItem key={depto} value={depto}>{depto}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Telefone
                    </Label>
                    <Input
                      id="new-employee-phone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-cpf" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      CPF
                    </Label>
                    <Input
                      id="new-employee-cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      className="text-base md:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Dados RH */}
              <div>
                <h4 className="text-sm font-semibold text-emerald-600 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Dados de RH
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-admission">Data de Admissão</Label>
                    <Input
                      id="new-employee-admission"
                      type="date"
                      value={formData.data_admissao}
                      onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-hours">Carga Horária (h/semana)</Label>
                    <Input
                      id="new-employee-hours"
                      type="number"
                      value={formData.carga_horaria}
                      onChange={(e) => setFormData({ ...formData, carga_horaria: e.target.value })}
                      min={1}
                      max={60}
                      inputMode="numeric"
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias Trabalhados</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "seg", label: "Seg" },
                        { key: "ter", label: "Ter" },
                        { key: "qua", label: "Qua" },
                        { key: "qui", label: "Qui" },
                        { key: "sex", label: "Sex" },
                        { key: "sab", label: "Sáb" },
                        { key: "dom", label: "Dom" },
                      ].map((d) => (
                        <Button
                          key={d.key}
                          type="button"
                          size="sm"
                          variant={formData.dias_trabalhados.includes(d.key) ? "default" : "outline"}
                          className="h-7 text-xs px-2"
                          onClick={() => {
                            const dias = formData.dias_trabalhados.includes(d.key)
                              ? formData.dias_trabalhados.filter((x) => x !== d.key)
                              : [...formData.dias_trabalhados, d.key];
                            setFormData({ ...formData, dias_trabalhados: dias });
                          }}
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Empresa, painel e convite */}
              <div className="border border-primary/30 bg-primary/5 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Empresa, painel e ativação
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  O usuário receberá acesso somente à empresa e ao painel definidos abaixo. A senha será criada pelo próprio usuário no link de ativação.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Empresa do usuário *
                    </Label>
                    <Select
                      value={activeTenant?.id ?? ""}
                      onValueChange={(value) => void handleTenantSelection(value)}
                      disabled={isSwitchingTenant || tenants.length === 0}
                    >
                      <SelectTrigger aria-label="Empresa do novo usuário">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O vínculo será gravado na empresa ativa selecionada.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil de abertura *</Label>
                    <Select
                      value={formData.accessProfile}
                      onValueChange={(value: EmployeeAccessProfile) => setFormData({ ...formData, accessProfile: value })}
                    >
                      <SelectTrigger aria-label="Perfil de acesso do novo usuário">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCESS_PROFILE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {ACCESS_PROFILE_OPTIONS.find((option) => option.value === formData.accessProfile)?.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-email">Email para ativação *</Label>
                    <Input
                      id="new-employee-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="usuario@empresa.com"
                      required
                      className="text-base md:text-sm"
                      skipUppercase
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-employee-login">Nome de Usuário *</Label>
                    <Input
                      id="new-employee-login"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      placeholder="nome.usuario"
                      required
                      className="text-base md:text-sm"
                      skipUppercase
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setIsFormOpen(false); }}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={createFuncionario.isPending || isUploading || isSwitchingTenant || !activeTenant}>
                  {(createFuncionario.isPending || isUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cadastrar e gerar link
                </Button>
              </div>
            </form>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Folha do Mês — Barra de Ações */}
      <Card className="flex flex-col items-stretch gap-3 bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <WalletIcon className="w-4 h-4 text-primary" />
          Folha de {competenciaLabel}
        </div>
        <div className="text-xs text-muted-foreground">
          {activeEmployeeCount} ativo(s) · {folhaResumo?.total ?? 0} folhas · {abertasCount} aberta(s)
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => gerarFolha.mutate(competencia)}
            disabled={gerarFolha.isPending}
          >
            {gerarFolha.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Gerar Folha do Mês
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setShowFechar(true)}
            disabled={abertasCount === 0}
          >
            <Lock className="w-4 h-4 mr-2" />
            Fechar Folha
          </Button>
        </div>
        {(folhasError || folhaResumoError) && (
          <div className="flex w-full flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Não foi possível carregar a folha desta competência.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isFetchingFolhaResumo}
              onClick={() => void Promise.all([refetchFolhas(), refetchFolhaResumo()])}
            >
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_14rem]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, login, cargo, contato ou CPF..."
              value={searchTerm}
              onChange={(e) => updateDirectoryParams({ search: e.target.value })}
              className="pl-10 text-base md:text-sm"
              aria-label="Pesquisar funcionários por nome, login, cargo, contato ou CPF"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: EmployeeDirectoryStatus) => updateDirectoryParams({ status: value })}>
            <SelectTrigger aria-label="Filtrar funcionários por situação">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Arquivados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={(value) => updateDirectoryParams({ department: value })}>
            <SelectTrigger aria-label="Filtrar funcionários por departamento">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {DEPARTAMENTOS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : directoryError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div><p className="font-medium text-foreground">Não foi possível carregar os funcionários</p><p className="text-sm text-muted-foreground">Tente novamente sem perder os filtros atuais.</p></div>
            <Button type="button" variant="outline" onClick={() => void refetch()}><RotateCcw className="h-4 w-4" />Tentar novamente</Button>
          </div>
        ) : funcionarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou cadastre um novo funcionário.</p>
          </div>
        ) : (
          <>
            {isFetching && <div className="h-1 w-full animate-pulse bg-primary/60" aria-label="Atualizando funcionários" />}
            <div className="grid gap-3 p-3 md:hidden">
              {funcionarios.map((func) => {
                const expanded = expandedId === func.id;
                const folha = folhaPorFunc.get(func.id) || null;
                return (
                  <article key={func.id} className={`rounded-xl border p-4 ${func.ativo ? "bg-card" : "bg-muted/30 opacity-80"}`}>
                    <div className="flex items-start gap-3">
                      <Avatar className="h-11 w-11 shrink-0"><AvatarImage src={func.avatar_url || undefined} alt={func.nome} /><AvatarFallback className="bg-purple-100 font-semibold text-purple-700">{getInitials(func.nome)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1"><p className="truncate font-semibold text-foreground">{func.nome}</p><p className="truncate text-sm text-muted-foreground">{func.cargo}{func.departamento ? ` · ${func.departamento}` : ""}</p></div>
                      <Badge variant={func.ativo ? "default" : "outline"}>{func.ativo ? "Ativo" : "Arquivado"}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Login</dt><dd className="truncate font-medium text-primary">{func.login}</dd></div><div><dt className="text-xs text-muted-foreground">Telefone</dt><dd className="text-foreground">{func.telefone || "Não informado"}</dd></div></dl>
                    <div className="mt-4 flex flex-wrap gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => setFichaItem(func)} aria-label={`Abrir ficha de ${func.nome}`}><FileText className="h-4 w-4 text-blue-600" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditItem(func)} aria-label={`Editar funcionário ${func.nome}`}><Pencil className="h-4 w-4" /></Button>
                      {func.user_id && <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setPasswordItem(func); setNewPassword(""); }} aria-label={`Alterar senha de ${func.nome}`}><Key className="h-4 w-4 text-primary" /></Button>}
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleToggleStatus(func)} disabled={archiveFuncionario.isPending || toggleStatus.isPending} aria-label={`${func.ativo ? "Arquivar" : "Reativar"} funcionário ${func.nome}`}>{func.ativo ? <Archive className="h-4 w-4 text-orange-600" /> : <Undo2 className="h-4 w-4 text-emerald-600" />}</Button>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-3 w-full justify-between" onClick={() => setExpandedId(expanded ? null : func.id)} aria-expanded={expanded}>Folha e benefícios<ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} /></Button>
                    {expanded && <div className="mt-3"><FuncionarioFolhaInline folha={folha} competenciaLabel={competenciaLabel} /></div>}
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela de funcionários" tabIndex={0}>
              <Table className="min-w-[1040px]">
                <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead className="w-24">Situação</TableHead><TableHead className="w-14">Foto</TableHead><TableHead>Nome</TableHead><TableHead>Cargo / Depto.</TableHead><TableHead>Telefone</TableHead><TableHead>Login</TableHead><TableHead className="w-44 text-center">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {funcionarios.map((func) => {
                    const expanded = expandedId === func.id;
                    const folha = folhaPorFunc.get(func.id) || null;
                    return (
                      <Fragment key={func.id}>
                        <TableRow className={!func.ativo ? "opacity-70" : ""}>
                          <TableCell><Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setExpandedId(expanded ? null : func.id)} aria-label={`Folha e benefícios de ${func.nome}`} aria-expanded={expanded}><ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} /></Button></TableCell>
                          <TableCell><Badge variant={func.ativo ? "default" : "outline"}>{func.ativo ? "Ativo" : "Arquivado"}</Badge></TableCell>
                          <TableCell><Avatar className="h-10 w-10"><AvatarImage src={func.avatar_url || undefined} alt={func.nome} /><AvatarFallback className="bg-purple-100 font-semibold text-purple-700">{getInitials(func.nome)}</AvatarFallback></Avatar></TableCell>
                          <TableCell className="font-medium">{func.nome}</TableCell><TableCell className="text-muted-foreground">{func.cargo}{func.departamento ? ` / ${func.departamento}` : ""}</TableCell><TableCell className="text-muted-foreground">{func.telefone || "—"}</TableCell><TableCell className="font-medium text-primary">{func.login}</TableCell>
                          <TableCell><div className="flex items-center justify-center gap-1"><Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFichaItem(func)} aria-label={`Abrir ficha de ${func.nome}`}><FileText className="h-4 w-4 text-blue-600" /></Button><Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditItem(func)} aria-label={`Editar funcionário ${func.nome}`}><Pencil className="h-4 w-4" /></Button>{func.user_id && <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setPasswordItem(func); setNewPassword(""); }} aria-label={`Alterar senha de ${func.nome}`}><Key className="h-4 w-4 text-primary" /></Button>}<Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleToggleStatus(func)} disabled={archiveFuncionario.isPending || toggleStatus.isPending} aria-label={`${func.ativo ? "Arquivar" : "Reativar"} funcionário ${func.nome}`}>{func.ativo ? <Archive className="h-4 w-4 text-orange-600" /> : <Undo2 className="h-4 w-4 text-emerald-600" />}</Button></div></TableCell>
                        </TableRow>
                        {expanded && <TableRow className="bg-muted/10 hover:bg-muted/10"><TableCell colSpan={8} className="p-3"><FuncionarioFolhaInline folha={folha} competenciaLabel={competenciaLabel} /></TableCell></TableRow>}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!isLoading && !directoryError && totalEmployees > 0 && (
          <nav className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de funcionários">
            <p className="text-sm text-muted-foreground">Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalEmployees} funcionários</p>
            <div className="flex items-center justify-between gap-2 sm:justify-end"><Button type="button" variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page - 1 })} disabled={page <= 1 || isFetching} aria-label="Página anterior de funcionários"><ChevronLeft className="h-4 w-4" />Anterior</Button><span className="min-w-24 text-center text-sm font-medium">Página {page} de {totalPages}</span><Button type="button" variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page + 1 })} disabled={page >= totalPages || isFetching} aria-label="Próxima página de funcionários">Próxima<ChevronRight className="h-4 w-4" /></Button></div>
          </nav>
        )}
      </Card>

      {/* Fechar Folha Dialog */}
      <AlertDialog open={showFechar} onOpenChange={setShowFechar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar folha de {competenciaLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Será criada uma conta a pagar (categoria "folha_pagamento") por funcionário em
              aberto, com vencimento na data informada. O valor lançado é salário + benefícios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Data de Pagamento</Label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await fecharFolha.mutateAsync({ competencia, dataPagamento });
                setShowFechar(false);
              }}
            >
              Confirmar Fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ficha Completa */}
      <FichaFuncionarioModal
        open={!!fichaItem}
        onOpenChange={(o) => !o && setFichaItem(null)}
        funcionario={fichaItem}
      />

      {/* Edit Modal */}
      <EditFuncionarioModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        funcionario={editItem}
        onSave={updateFuncionario}
      />

      {/* Generated access link */}
      <Dialog open={Boolean(createdAccess)} onOpenChange={(open) => { if (!open) setCreatedAccess(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Acesso criado com segurança
            </DialogTitle>
            <DialogDescription>
              Envie este link somente para o usuário cadastrado. Ele definirá a senha antes do primeiro acesso.
            </DialogDescription>
          </DialogHeader>
          {createdAccess && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empresa</p>
                  <p className="mt-1 flex items-center gap-2 font-semibold">
                    <Building2 className="h-4 w-4 text-primary" />
                    {createdAccess.tenantName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Painel inicial</p>
                  <p className="mt-1 flex items-center gap-2 font-semibold">
                    {createdAccess.profile === "pdv_industrial"
                      ? <Factory className="h-4 w-4 text-primary" />
                      : createdAccess.profile === "pdv_domestico"
                      ? <Store className="h-4 w-4 text-primary" />
                      : <ShieldCheck className="h-4 w-4 text-primary" />}
                    {ACCESS_PROFILE_OPTIONS.find((option) => option.value === createdAccess.profile)?.label}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="generated-access-link">Link de ativação de {createdAccess.email}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="generated-access-link"
                    value={createdAccess.link}
                    readOnly
                    className="font-mono text-xs"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button type="button" className="shrink-0 gap-2" onClick={() => void handleCopyAccessLink()}>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreatedAccess(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <AlertDialog open={Boolean(archiveItem)} onOpenChange={open => { if (!open) setArchiveItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveItem?.nome}</strong> será desativado e perderá as permissões desta empresa. Folha, produção, rotas e auditoria continuarão preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!archiveItem) return;
                archiveFuncionario.mutate(archiveItem.id, { onSuccess: () => setArchiveItem(null) });
              }}
              disabled={archiveFuncionario.isPending}
            >
              {archiveFuncionario.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Arquivar funcionário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Modal */}
      <Dialog open={!!passwordItem} onOpenChange={() => setPasswordItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Alterar Senha
            </DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{passwordItem?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 12 caracteres"
                minLength={12}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordItem(null)}>Cancelar</Button>
            <Button
              disabled={!newPassword || newPassword.length < 12 || changePassword.isPending}
              onClick={async () => {
                if (passwordItem?.user_id) {
                  await changePassword.mutateAsync({ userId: passwordItem.user_id, newPassword });
                  setPasswordItem(null);
                  setNewPassword("");
                }
              }}
            >
              {changePassword.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== EDIT FUNCIONARIO MODAL =====
interface EditFuncionarioModalProps {
  open: boolean;
  onClose: () => void;
  funcionario: Funcionario | null;
  onSave: ReturnType<typeof useUpdateFuncionario>;
}

function EditFuncionarioModal({ open, onClose, funcionario, onSave }: EditFuncionarioModalProps) {
  const { activeTenant } = useAuth();
  const [formData, setFormData] = useState({
    nome: "",
    cargo: "",
    departamento: "",
    telefone: "",
    cpf: "",
    email: "",
    login: "",
    data_admissao: "",
    carga_horaria: "44",
    dias_trabalhados: ["seg", "ter", "qua", "qui", "sex"] as string[],
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Update form when funcionario changes
  useEffect(() => {
    if (funcionario) {
      setFormData({
        nome: funcionario.nome,
        cargo: funcionario.cargo,
        departamento: funcionario.departamento || "",
        telefone: funcionario.telefone || "",
        cpf: funcionario.cpf || "",
        email: funcionario.email || "",
        login: funcionario.login,
        data_admissao: funcionario.data_admissao || "",
        carga_horaria: String(funcionario.carga_horaria || 44),
        dias_trabalhados: funcionario.dias_trabalhados || ["seg", "ter", "qua", "qui", "sex"],
      });
      setAvatarUrl(funcionario.avatar_url || null);
      setAvatarFile(null);
    }
  }, [funcionario]);

  const handleAvatarChange = (file: File | null, previewUrl: string | null) => {
    setAvatarFile(file);
    if (previewUrl) {
      setAvatarUrl(previewUrl);
    } else if (!file) {
      setAvatarUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcionario || !activeTenant) {
      toast.error("Empresa ativa não identificada");
      return;
    }
    
    let uploadedAvatarPath: string | null = null;
    let employeeMutationStarted = false;
    try {
      setIsUploading(true);
      let finalAvatarUrl: string | null = avatarUrl;

      // Upload new avatar if file exists
      if (avatarFile) {
        const fileExt = getAvatarExtension(avatarFile);
        const filePath = `${activeTenant.id}/funcionarios/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Erro ao fazer upload da foto');
        } else {
          uploadedAvatarPath = filePath;
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalAvatarUrl = publicUrl;
        }
      }

      employeeMutationStarted = true;
      await onSave.mutateAsync({
        id: funcionario.id,
        nome: formData.nome,
        cargo: formData.cargo,
        departamento: formData.departamento || null,
        telefone: formData.telefone || null,
        cpf: formData.cpf || null,
        email: formData.email || null,
        login: formData.login,
        avatar_url: finalAvatarUrl,
        data_admissao: formData.data_admissao || null,
        carga_horaria: formData.carga_horaria ? Number(formData.carga_horaria) : null,
        dias_trabalhados: formData.dias_trabalhados.length > 0 ? formData.dias_trabalhados : null,
      });

      const previousAvatarPath = getAvatarStoragePath(funcionario.avatar_url, activeTenant.id);
      if (previousAvatarPath && previousAvatarPath !== uploadedAvatarPath && funcionario.avatar_url !== finalAvatarUrl) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([previousAvatarPath]);
        if (cleanupError) console.error("Falha ao remover avatar substituído", cleanupError);
      }
      
      onClose();
    } catch (error) {
      if (uploadedAvatarPath) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([uploadedAvatarPath]);
        if (cleanupError) console.error("Falha ao remover avatar órfão", cleanupError);
      }
      if (!employeeMutationStarted) {
        toast.error(error instanceof Error ? error.message : "Erro ao atualizar funcionário");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Header */}
          <FuncionarioAvatarHeader
            nome={formData.nome}
            cargo={formData.cargo}
            departamento={formData.departamento}
            avatarUrl={avatarUrl}
            onAvatarChange={handleAvatarChange}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Login *</Label>
              <Input value={formData.login} onChange={(e) => setFormData({ ...formData, login: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={formData.cargo} onValueChange={(v) => setFormData({ ...formData, cargo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARGOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={formData.departamento} onValueChange={(v) => setFormData({ ...formData, departamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de Admissão</Label>
              <Input type="date" value={formData.data_admissao} onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Carga Horária (h/semana)</Label>
              <Input type="number" value={formData.carga_horaria} onChange={(e) => setFormData({ ...formData, carga_horaria: e.target.value })} min={1} max={60} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Dias Trabalhados</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "seg", label: "Seg" },
                  { key: "ter", label: "Ter" },
                  { key: "qua", label: "Qua" },
                  { key: "qui", label: "Qui" },
                  { key: "sex", label: "Sex" },
                  { key: "sab", label: "Sáb" },
                  { key: "dom", label: "Dom" },
                ].map((d) => (
                  <Button
                    key={d.key}
                    type="button"
                    size="sm"
                    variant={formData.dias_trabalhados.includes(d.key) ? "default" : "outline"}
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      const dias = formData.dias_trabalhados.includes(d.key)
                        ? formData.dias_trabalhados.filter((x) => x !== d.key)
                        : [...formData.dias_trabalhados, d.key];
                      setFormData({ ...formData, dias_trabalhados: dias });
                    }}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={onSave.isPending || isUploading}>
              {(onSave.isPending || isUploading) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== MOTORISTAS TAB =====
interface MotoristasTabProps {
  funcionarios: Funcionario[];
  isLoading: boolean;
  createMotorista: ReturnType<typeof useMotoristas>["createMotorista"];
  updateMotorista: ReturnType<typeof useMotoristas>["updateMotorista"];
  setMotoristaStatus: ReturnType<typeof useMotoristas>["setMotoristaStatus"];
}

function MotoristasTab({
  funcionarios,
  isLoading: isSummaryLoading,
  createMotorista,
  updateMotorista,
  setMotoristaStatus,
}: MotoristasTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Motorista | null>(null);
  const [archiveItem, setArchiveItem] = useState<Motorista | null>(null);
  const searchTerm = searchParams.get("motorista_q") ?? "";
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const page = normalizeDriverDirectoryPage(searchParams.get("motorista_pagina"));
  const requestedStatus = searchParams.get("motorista_situacao");
  const statusFilter: DriverDirectoryStatus = requestedStatus === "active" || requestedStatus === "inactive"
    ? requestedStatus
    : "all";
  const requestedLicense = searchParams.get("motorista_cnh");
  const licenseFilter: DriverLicenseStatus = requestedLicense === "valid" || requestedLicense === "warning"
    || requestedLicense === "expired" || requestedLicense === "missing"
    ? requestedLicense
    : "all";
  const {
    data: directory,
    isLoading,
    isFetching,
    error: directoryError,
    refetch,
  } = useDriverDirectory({
    page,
    pageSize: DRIVER_DIRECTORY_PAGE_SIZE,
    search: deferredSearchTerm,
    status: statusFilter,
    licenseStatus: licenseFilter,
  });
  const motoristas = directory?.motoristas ?? [];
  const totalDrivers = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalDrivers / DRIVER_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalDrivers === 0 ? 0 : (page - 1) * DRIVER_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * DRIVER_DIRECTORY_PAGE_SIZE, totalDrivers);

  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    cnh: "",
    cnh_validade: "",
    funcionario_id: "",
  });

  const updateDirectoryParams = useCallback((updates: {
    query?: string;
    status?: DriverDirectoryStatus;
    license?: DriverLicenseStatus;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.query !== undefined) {
      if (updates.query.trim()) next.set("motorista_q", updates.query);
      else next.delete("motorista_q");
    }
    if (updates.status !== undefined) {
      if (updates.status === "all") next.delete("motorista_situacao");
      else next.set("motorista_situacao", updates.status);
    }
    if (updates.license !== undefined) {
      if (updates.license === "all") next.delete("motorista_cnh");
      else next.set("motorista_cnh", updates.license);
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set("motorista_pagina", String(updates.page));
      else next.delete("motorista_pagina");
    }
    if (updates.query !== undefined || updates.status !== undefined || updates.license !== undefined) {
      next.delete("motorista_pagina");
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasFilters = Boolean(searchTerm || statusFilter !== "all" || licenseFilter !== "all");
  const clearFilters = () => updateDirectoryParams({ query: "", status: "all", license: "all" });

  useEffect(() => {
    if (isLoading || totalDrivers === 0 || page <= totalPages) return;
    updateDirectoryParams({ page: totalPages });
  }, [isLoading, page, totalDrivers, totalPages, updateDirectoryParams]);

  const resetForm = () => {
    setFormData({ nome: "", telefone: "", email: "", cnh: "", cnh_validade: "", funcionario_id: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;

    try {
      await createMotorista.mutateAsync({
        nome: formData.nome.trim(),
        telefone: formData.telefone || null,
        email: formData.email.trim().toLocaleLowerCase("pt-BR") || null,
        cnh: formData.cnh || null,
        cnh_validade: formData.cnh_validade || null,
        funcionario_id: formData.funcionario_id || null,
        ativo: true,
      });
      resetForm();
      setIsFormOpen(false);
    } catch {
      // The hook displays the error; the entered data remains available for retry.
    }
  };

  const handleToggleStatus = (motorista: Motorista) => {
    if (motorista.ativo) {
      setArchiveItem(motorista);
      return;
    }
    setMotoristaStatus.mutate({ id: motorista.id, ativo: true });
  };

  const getFuncionarioNome = (id: string | null) => {
    if (!id) return null;
    const func = funcionarios.find(f => f.id === id);
    return func?.nome || null;
  };

  return (
    <div className="space-y-4">
      {/* Collapsible Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="h-auto w-full justify-between p-0 text-left hover:bg-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Novo Motorista</h3>
                  <p className="text-sm text-muted-foreground">Cadastrar motorista com CNH</p>
                </div>
              </div>
              {isFormOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-driver-name">Nome completo *</Label>
                  <Input id="new-driver-name" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required className="text-base md:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-driver-phone">Telefone</Label>
                  <Input id="new-driver-phone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })} placeholder="(00) 00000-0000" className="text-base md:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-driver-email">E-mail</Label>
                  <Input id="new-driver-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="text-base md:text-sm" skipUppercase />
                </div>
              </div>

              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Documentação CNH
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-driver-license">Número da CNH</Label>
                    <Input id="new-driver-license" value={formData.cnh} onChange={(e) => setFormData({ ...formData, cnh: formatCNH(e.target.value) })} placeholder="00000000000" maxLength={11} inputMode="numeric" className="text-base md:text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-driver-license-date">Validade da CNH</Label>
                    <Input id="new-driver-license-date" type="date" value={formData.cnh_validade} onChange={(e) => setFormData({ ...formData, cnh_validade: e.target.value })} className="text-base md:text-sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-driver-employee" className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Vincular a Funcionário (opcional)
                </Label>
                <Select value={formData.funcionario_id || "none"} onValueChange={(v) => setFormData({ ...formData, funcionario_id: v === "none" ? "" : v })}>
                  <SelectTrigger id="new-driver-employee">
                    <SelectValue placeholder="Selecione um funcionário..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {funcionarios.filter(f => f.ativo).map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setIsFormOpen(false); }}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2" disabled={createMotorista.isPending}>
                  {createMotorista.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cadastrar
                </Button>
              </div>
            </form>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_220px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nome, CNH, telefone ou e-mail"
              aria-label="Pesquisar motoristas por nome, CNH, telefone ou e-mail"
              value={searchTerm}
              onChange={(event) => updateDirectoryParams({ query: event.target.value })}
              className="pl-10 text-base md:text-sm"
              skipUppercase
            />
          </div>
          <Select value={statusFilter} onValueChange={value => updateDirectoryParams({ status: value as DriverDirectoryStatus })}>
            <SelectTrigger aria-label="Filtrar motoristas por situação">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Arquivados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={licenseFilter} onValueChange={value => updateDirectoryParams({ license: value as DriverLicenseStatus })}>
            <SelectTrigger aria-label="Filtrar motoristas pela validade da CNH">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda situação de CNH</SelectItem>
              <SelectItem value="valid">Válida por mais de 30 dias</SelectItem>
              <SelectItem value="warning">Vence em até 30 dias</SelectItem>
              <SelectItem value="expired">CNH Vencida</SelectItem>
              <SelectItem value="missing">Sem validade informada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Consulta limitada à empresa ativa; arquivados permanecem no histórico.</p>
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={clearFilters}>
              <RotateCcw className="h-4 w-4" />Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isFetching && !isLoading && <p className="px-4 pt-3 text-xs text-muted-foreground" role="status">Atualizando motoristas…</p>}
        {isLoading || isSummaryLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : directoryError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center text-destructive" role="alert">
            <p>Não foi possível carregar os motoristas.</p>
            <Button type="button" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        ) : motoristas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium text-foreground">{hasFilters ? "Nenhum motorista encontrado" : "Nenhum motorista cadastrado"}</p>
            <Button type="button" variant="link" onClick={hasFilters ? clearFilters : () => setIsFormOpen(true)}>
              {hasFilters ? "Limpar filtros" : "Cadastrar primeiro motorista"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {motoristas.map((m) => {
                const cnhStatus = getCNHStatus(m.cnh_validade);
                return (
                  <article key={m.id} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{m.nome}</p>
                        <p className="mt-1 break-words text-sm text-muted-foreground">{m.telefone || m.email || "Contato não informado"}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditItem(m)} aria-label={`Editar motorista ${m.nome}`}><Pencil className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleToggleStatus(m)} disabled={setMotoristaStatus.isPending} aria-label={`${m.ativo ? "Arquivar" : "Reativar"} motorista ${m.nome}`}>
                          {m.ativo ? <Archive className="h-4 w-4 text-orange-600" /> : <Undo2 className="h-4 w-4 text-emerald-600" />}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={m.ativo ? "default" : "outline"}>{m.ativo ? "Ativo" : "Arquivado"}</Badge>
                      <Badge variant={cnhStatus.color as "default" | "secondary" | "destructive"} className={cnhStatus.status === "warning" ? "bg-yellow-500 text-yellow-950" : ""}>{cnhStatus.label}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-2 text-sm min-[390px]:grid-cols-2">
                      <div><dt className="text-xs text-muted-foreground">CNH</dt><dd className="font-mono text-foreground">{m.cnh || "Não informada"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Funcionário vinculado</dt><dd className="text-foreground">{getFuncionarioNome(m.funcionario_id) || "Nenhum"}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela de motoristas" tabIndex={0}>
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Situação</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>CNH</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center w-28">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {motoristas.map((m) => {
                    const cnhStatus = getCNHStatus(m.cnh_validade);
                    return (
                      <TableRow key={m.id} className={!m.ativo ? "opacity-70" : ""}>
                        <TableCell><Badge variant={m.ativo ? "default" : "outline"}>{m.ativo ? "Ativo" : "Arquivado"}</Badge></TableCell>
                        <TableCell><p className="font-medium">{m.nome}</p><p className="text-xs text-muted-foreground">{m.telefone || m.email || "Contato não informado"}</p></TableCell>
                        <TableCell className="font-mono text-sm">{m.cnh || "—"}</TableCell>
                        <TableCell><Badge variant={cnhStatus.color as "default" | "secondary" | "destructive"} className={cnhStatus.status === "warning" ? "bg-yellow-500 text-yellow-950" : ""}>{cnhStatus.label}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{getFuncionarioNome(m.funcionario_id) || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditItem(m)} aria-label={`Editar motorista ${m.nome}`}><Pencil className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleToggleStatus(m)} disabled={setMotoristaStatus.isPending} aria-label={`${m.ativo ? "Arquivar" : "Reativar"} motorista ${m.nome}`}>
                              {m.ativo ? <Archive className="h-4 w-4 text-orange-600" /> : <Undo2 className="h-4 w-4 text-emerald-600" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!isLoading && !directoryError && totalDrivers > 0 && (
          <nav className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de motoristas">
            <p className="text-sm text-muted-foreground">Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalDrivers} motoristas</p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page - 1 })} disabled={page <= 1 || isFetching} aria-label="Página anterior de motoristas"><ChevronLeft className="h-4 w-4" />Anterior</Button>
              <span className="min-w-24 text-center text-sm font-medium">Página {page} de {totalPages}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page + 1 })} disabled={page >= totalPages || isFetching} aria-label="Próxima página de motoristas">Próxima<ChevronRight className="h-4 w-4" /></Button>
            </div>
          </nav>
        )}
      </Card>

      {/* Edit Modal */}
      <EditMotoristaModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        motorista={editItem}
        funcionarios={funcionarios}
        onSave={updateMotorista}
      />

      {/* Archive Dialog */}
      <AlertDialog open={Boolean(archiveItem)} onOpenChange={open => { if (!open) setArchiveItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar motorista</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveItem?.nome}</strong> deixará de aparecer em novas atribuições. Rotas, agendas, pedidos e ocorrências já vinculados continuarão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!archiveItem) return;
                setMotoristaStatus.mutate(
                  { id: archiveItem.id, ativo: false },
                  { onSuccess: () => setArchiveItem(null) },
                );
              }}
              disabled={setMotoristaStatus.isPending}
            >
              {setMotoristaStatus.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Arquivar motorista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== EDIT MOTORISTA MODAL =====
interface EditMotoristaModalProps {
  open: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  funcionarios: Funcionario[];
  onSave: ReturnType<typeof useMotoristas>["updateMotorista"];
}

function EditMotoristaModal({ open, onClose, motorista, funcionarios, onSave }: EditMotoristaModalProps) {
  const [formData, setFormData] = useState({ nome: "", telefone: "", email: "", cnh: "", cnh_validade: "", funcionario_id: "" });

  useEffect(() => {
    if (motorista) {
      setFormData({
        nome: motorista.nome,
        telefone: motorista.telefone || "",
        email: motorista.email || "",
        cnh: motorista.cnh || "",
        cnh_validade: motorista.cnh_validade || "",
        funcionario_id: motorista.funcionario_id || "",
      });
    }
  }, [motorista]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motorista) return;
    try {
      await onSave.mutateAsync({
        id: motorista.id,
        nome: formData.nome.trim(),
        telefone: formData.telefone || null,
        email: formData.email.trim().toLocaleLowerCase("pt-BR") || null,
        cnh: formData.cnh || null,
        cnh_validade: formData.cnh_validade || null,
        funcionario_id: formData.funcionario_id || null,
      });
      onClose();
    } catch {
      // The hook displays the error; keep the dialog data available for retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Motorista</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required className="text-base md:text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })} className="text-base md:text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="text-base md:text-sm" skipUppercase />
            </div>
            <div className="space-y-2">
              <Label>CNH</Label>
              <Input value={formData.cnh} onChange={(e) => setFormData({ ...formData, cnh: formatCNH(e.target.value) })} inputMode="numeric" className="text-base md:text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Validade CNH</Label>
              <Input type="date" value={formData.cnh_validade} onChange={(e) => setFormData({ ...formData, cnh_validade: e.target.value })} className="text-base md:text-sm" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Funcionário Vinculado</Label>
              <Select value={formData.funcionario_id || "none"} onValueChange={(v) => setFormData({ ...formData, funcionario_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {funcionarios.filter(f => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={onSave.isPending}>
              {onSave.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== VEÍCULOS TAB =====
interface VeiculosTabProps {
  createVeiculo: ReturnType<typeof useVeiculos>["createVeiculo"];
  updateVeiculo: ReturnType<typeof useVeiculos>["updateVeiculo"];
  setVeiculoStatus: ReturnType<typeof useVeiculos>["setVeiculoStatus"];
}

function VeiculosTab({
  createVeiculo,
  updateVeiculo,
  setVeiculoStatus,
}: VeiculosTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const searchTerm = searchParams.get("veiculo_q") ?? "";
  const deferredSearch = useDeferredValue(searchTerm);
  const requestedStatus = searchParams.get("veiculo_situacao");
  const statusFilter: VehicleDirectoryStatus = requestedStatus === "active" || requestedStatus === "inactive"
    ? requestedStatus
    : "all";
  const requestedType = searchParams.get("veiculo_tipo") ?? "all";
  const typeFilter = requestedType === "all" || TIPOS_VEICULO.includes(requestedType)
    ? requestedType
    : "all";
  const page = normalizeVehicleDirectoryPage(searchParams.get("veiculo_pagina"));
  const [archiveItem, setArchiveItem] = useState<Veiculo | null>(null);
  const [editItem, setEditItem] = useState<Veiculo | null>(null);
  const {
    data: directory,
    isLoading,
    isFetching,
    error: directoryError,
    refetch,
  } = useVehicleDirectory({
    page,
    pageSize: VEHICLE_DIRECTORY_PAGE_SIZE,
    search: deferredSearch,
    status: statusFilter,
    type: typeFilter,
  });
  const veiculos = directory?.veiculos ?? [];
  const totalVehicles = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalVehicles / VEHICLE_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalVehicles === 0 ? 0 : (page - 1) * VEHICLE_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * VEHICLE_DIRECTORY_PAGE_SIZE, totalVehicles);

  const updateDirectoryParams = useCallback((updates: {
    search?: string;
    status?: VehicleDirectoryStatus;
    type?: string;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.search !== undefined) {
      if (updates.search) next.set("veiculo_q", updates.search);
      else next.delete("veiculo_q");
    }
    if (updates.status !== undefined) {
      if (updates.status === "all") next.delete("veiculo_situacao");
      else next.set("veiculo_situacao", updates.status);
    }
    if (updates.type !== undefined) {
      if (updates.type === "all") next.delete("veiculo_tipo");
      else next.set("veiculo_tipo", updates.type);
    }
    const nextPage = updates.page ?? (updates.search !== undefined || updates.status !== undefined || updates.type !== undefined ? 1 : page);
    if (nextPage <= 1) next.delete("veiculo_pagina");
    else next.set("veiculo_pagina", String(nextPage));
    setSearchParams(next, { replace: true });
  }, [page, searchParams, setSearchParams]);

  useEffect(() => {
    if (!isLoading && totalVehicles > 0 && page > totalPages) {
      updateDirectoryParams({ page: totalPages });
    }
  }, [isLoading, page, totalPages, totalVehicles, updateDirectoryParams]);
  
  const [formData, setFormData] = useState({ placa: "", modelo: "", tipo: "Carro", cor: "", ano: "" });

  const resetForm = () => {
    setFormData({ placa: "", modelo: "", tipo: "Carro", cor: "", ano: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa.trim() || !formData.modelo.trim()) return;

    try {
      await createVeiculo.mutateAsync({
        placa: formData.placa.trim().toUpperCase(),
        modelo: formData.modelo.trim(),
        tipo: formData.tipo || null,
        cor: formData.cor.trim() || null,
        ano: formData.ano ? Number.parseInt(formData.ano, 10) : null,
        ativo: true,
      });
      resetForm();
      setIsFormOpen(false);
    } catch {
      // The hook displays the error; keep the form available for retry.
    }
  };

  const handleToggleStatus = (veiculo: Veiculo) => {
    if (veiculo.ativo) {
      setArchiveItem(veiculo);
      return;
    }
    setVeiculoStatus.mutate({ id: veiculo.id, ativo: true });
  };

  return (
    <div className="space-y-4">
      {/* Collapsible Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="h-auto w-full justify-between p-0 text-left hover:bg-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Novo Veículo</h3>
                  <p className="text-sm text-muted-foreground">Cadastrar veículo da frota</p>
                </div>
              </div>
              {isFormOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-vehicle-plate">Placa *</Label>
                  <Input id="new-vehicle-plate" value={formData.placa} onChange={(e) => setFormData({ ...formData, placa: formatPlaca(e.target.value) })} placeholder="ABC-1D23" required className="text-base uppercase md:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-vehicle-model">Modelo *</Label>
                  <Input id="new-vehicle-model" value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} placeholder="Ex: Fiat Fiorino" required className="text-base md:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger aria-label="Tipo do novo veículo"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-vehicle-color">Cor</Label>
                  <Input id="new-vehicle-color" value={formData.cor} onChange={(e) => setFormData({ ...formData, cor: e.target.value })} placeholder="Ex: Branco" className="text-base md:text-sm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-vehicle-year">Ano</Label>
                  <Input id="new-vehicle-year" type="number" value={formData.ano} onChange={(e) => setFormData({ ...formData, ano: e.target.value })} placeholder="Ex: 2023" min="1950" max="2100" inputMode="numeric" className="text-base md:text-sm" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setIsFormOpen(false); }}>Cancelar</Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 gap-2" disabled={createVeiculo.isPending}>
                  {createVeiculo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cadastrar
                </Button>
              </div>
            </form>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, modelo, tipo ou cor..."
              value={searchTerm}
              onChange={(e) => updateDirectoryParams({ search: e.target.value })}
              className="pl-10 text-base md:text-sm"
              aria-label="Pesquisar veículos por placa, modelo, tipo ou cor"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: VehicleDirectoryStatus) => updateDirectoryParams({ status: value })}>
            <SelectTrigger aria-label="Filtrar veículos por situação"><SelectValue placeholder="Situação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Arquivados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value) => updateDirectoryParams({ type: value })}>
            <SelectTrigger aria-label="Filtrar veículos por tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPOS_VEICULO.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : directoryError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <div><p className="font-medium text-foreground">Não foi possível carregar os veículos</p><p className="text-sm text-muted-foreground">Tente novamente sem perder os filtros atuais.</p></div>
            <Button type="button" variant="outline" onClick={() => void refetch()}><RotateCcw className="h-4 w-4" />Tentar novamente</Button>
          </div>
        ) : veiculos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Car className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum veículo encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou cadastre um novo veículo.</p>
          </div>
        ) : (
          <>
            {isFetching && <div className="h-1 w-full animate-pulse bg-primary/60" aria-label="Atualizando veículos" />}
            <div className="grid gap-3 p-3 md:hidden">
              {veiculos.map((vehicle) => (
                <article key={vehicle.id} className={`rounded-xl border p-4 ${vehicle.ativo ? "bg-card" : "bg-muted/30 opacity-80"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-mono text-lg font-bold text-foreground">{vehicle.placa}</p><p className="truncate text-sm font-medium text-foreground">{vehicle.modelo}</p></div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditItem(vehicle)} aria-label={`Editar veículo ${vehicle.placa}`}><Pencil className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => handleToggleStatus(vehicle)} disabled={setVeiculoStatus.isPending} aria-label={`${vehicle.ativo ? "Arquivar" : "Reativar"} veículo ${vehicle.placa}`}>
                        {vehicle.ativo ? <Archive className="h-4 w-4 text-orange-600" /> : <Undo2 className="h-4 w-4 text-emerald-600" />}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2"><Badge variant={vehicle.ativo ? "default" : "outline"}>{vehicle.ativo ? "Ativo" : "Arquivado"}</Badge>{vehicle.tipo && <Badge variant="secondary">{vehicle.tipo}</Badge>}</div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Cor</dt><dd className="text-foreground">{vehicle.cor || "Não informada"}</dd></div><div><dt className="text-xs text-muted-foreground">Ano</dt><dd className="text-foreground">{vehicle.ano || "Não informado"}</dd></div></dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela de veículos" tabIndex={0}>
              <Table className="min-w-[820px]">
                <TableHeader><TableRow><TableHead className="w-24">Situação</TableHead><TableHead>Placa</TableHead><TableHead>Modelo</TableHead><TableHead>Tipo</TableHead><TableHead>Cor</TableHead><TableHead>Ano</TableHead><TableHead className="w-28 text-center">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {veiculos.map((vehicle) => (
                    <TableRow key={vehicle.id} className={!vehicle.ativo ? "opacity-70" : ""}>
                      <TableCell><Badge variant={vehicle.ativo ? "default" : "outline"}>{vehicle.ativo ? "Ativo" : "Arquivado"}</Badge></TableCell>
                      <TableCell className="font-mono font-bold">{vehicle.placa}</TableCell><TableCell className="font-medium">{vehicle.modelo}</TableCell><TableCell className="text-muted-foreground">{vehicle.tipo || "—"}</TableCell><TableCell className="text-muted-foreground">{vehicle.cor || "—"}</TableCell><TableCell className="text-muted-foreground">{vehicle.ano || "—"}</TableCell>
                      <TableCell><div className="flex items-center justify-center gap-1"><Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditItem(vehicle)} aria-label={`Editar veículo ${vehicle.placa}`}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleToggleStatus(vehicle)} disabled={setVeiculoStatus.isPending} aria-label={`${vehicle.ativo ? "Arquivar" : "Reativar"} veículo ${vehicle.placa}`}>{vehicle.ativo ? <Archive className="h-4 w-4 text-orange-600" /> : <Undo2 className="h-4 w-4 text-emerald-600" />}</Button></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {!isLoading && !directoryError && totalVehicles > 0 && (
          <nav className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de veículos">
            <p className="text-sm text-muted-foreground">Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalVehicles} veículos</p>
            <div className="flex items-center justify-between gap-2 sm:justify-end"><Button type="button" variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page - 1 })} disabled={page <= 1 || isFetching} aria-label="Página anterior de veículos"><ChevronLeft className="h-4 w-4" />Anterior</Button><span className="min-w-24 text-center text-sm font-medium">Página {page} de {totalPages}</span><Button type="button" variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page + 1 })} disabled={page >= totalPages || isFetching} aria-label="Próxima página de veículos">Próxima<ChevronRight className="h-4 w-4" /></Button></div>
          </nav>
        )}
      </Card>

      {/* Edit Modal */}
      <EditVeiculoModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        veiculo={editItem}
        onSave={updateVeiculo}
      />

      {/* Archive Dialog */}
      <AlertDialog open={Boolean(archiveItem)} onOpenChange={open => { if (!open) setArchiveItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar veículo</AlertDialogTitle>
            <AlertDialogDescription><strong>{archiveItem?.placa}</strong> deixará de aparecer em novas atribuições. Rotas, pedidos, quilometragens e ocorrências já vinculados continuarão preservados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (archiveItem) setVeiculoStatus.mutate({ id: archiveItem.id, ativo: false }, { onSuccess: () => setArchiveItem(null) }); }} disabled={setVeiculoStatus.isPending}>
              {setVeiculoStatus.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Arquivar veículo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== EDIT VEÍCULO MODAL =====
interface EditVeiculoModalProps {
  open: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
  onSave: ReturnType<typeof useVeiculos>["updateVeiculo"];
}

function EditVeiculoModal({ open, onClose, veiculo, onSave }: EditVeiculoModalProps) {
  const [formData, setFormData] = useState({ placa: "", modelo: "", tipo: "", cor: "", ano: "" });

  useEffect(() => {
    if (veiculo) {
      setFormData({
        placa: veiculo.placa,
        modelo: veiculo.modelo,
        tipo: veiculo.tipo || "",
        cor: veiculo.cor || "",
        ano: veiculo.ano?.toString() || "",
      });
    }
  }, [veiculo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!veiculo) return;
    try {
      await onSave.mutateAsync({
        id: veiculo.id,
        placa: formData.placa.trim().toUpperCase(),
        modelo: formData.modelo.trim(),
        tipo: formData.tipo || null,
        cor: formData.cor.trim() || null,
        ano: formData.ano ? Number.parseInt(formData.ano, 10) : null,
      });
      onClose();
    } catch {
      // The hook displays the error; keep the dialog data available for retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Veículo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-vehicle-plate">Placa *</Label>
              <Input id="edit-vehicle-plate" value={formData.placa} onChange={(e) => setFormData({ ...formData, placa: formatPlaca(e.target.value) })} required className="text-base uppercase md:text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vehicle-model">Modelo *</Label>
              <Input id="edit-vehicle-model" value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} required className="text-base md:text-sm" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger aria-label="Tipo do veículo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vehicle-color">Cor</Label>
              <Input id="edit-vehicle-color" value={formData.cor} onChange={(e) => setFormData({ ...formData, cor: e.target.value })} className="text-base md:text-sm" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-vehicle-year">Ano</Label>
              <Input id="edit-vehicle-year" type="number" value={formData.ano} onChange={(e) => setFormData({ ...formData, ano: e.target.value })} min="1950" max="2100" inputMode="numeric" className="text-base md:text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={onSave.isPending}>
              {onSave.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
