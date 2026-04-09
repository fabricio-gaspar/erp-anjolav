import { useState, useMemo } from "react";
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
  Trash2, 
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
  Check,
  X
} from "lucide-react";
import { 
  useFuncionarios, 
  useCreateFuncionario, 
  useDeleteFuncionario,
  useUpdateFuncionario,
  useToggleFuncionarioStatus,
  useChangePassword,
  type Funcionario
} from "@/hooks/useFuncionarios";
import { useMotoristas, type Motorista, type MotoristaInsert } from "@/hooks/useMotoristas";
import { useVeiculos, type Veiculo, type VeiculoInsert } from "@/hooks/useVeiculos";
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
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            <span className="text-sm text-muted-foreground">/ {total} total</span>
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
  const [activeTab, setActiveTab] = useState("funcionarios");
  
  // Funcionários state and hooks
  const { data: funcionarios = [], isLoading: loadingFuncionarios } = useFuncionarios();
  const createFuncionario = useCreateFuncionario();
  const deleteFuncionario = useDeleteFuncionario();
  const updateFuncionario = useUpdateFuncionario();
  const toggleFuncionarioStatus = useToggleFuncionarioStatus();
  
  // Motoristas state and hooks
  const { 
    motoristas = [], 
    isLoading: loadingMotoristas,
    createMotorista,
    updateMotorista,
    deleteMotorista 
  } = useMotoristas();
  
  // Veículos state and hooks
  const { 
    veiculos = [], 
    isLoading: loadingVeiculos,
    createVeiculo,
    updateVeiculo,
    deleteVeiculo 
  } = useVeiculos();

  // KPIs
  const funcionariosAtivos = funcionarios.filter(f => f.ativo).length;
  const motoristasAtivos = motoristas.filter(m => m.ativo).length;
  const veiculosAtivos = veiculos.filter(v => v.ativo).length;
  const cnhVencendo = motoristas.filter(m => {
    if (!m.cnh_validade) return false;
    const status = getCNHStatus(m.cnh_validade);
    return status.status === "warning" || status.status === "expired";
  }).length;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Funcionários Ativos"
          value={funcionariosAtivos}
          total={funcionarios.length}
          icon={<Users className="w-6 h-6 text-orange-600" />}
          color="bg-orange-100"
        />
        <KPICard
          title="Motoristas Ativos"
          value={motoristasAtivos}
          total={motoristas.length}
          icon={<UserCheck className="w-6 h-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <KPICard
          title="Veículos Ativos"
          value={veiculosAtivos}
          total={veiculos.length}
          icon={<Car className="w-6 h-6 text-green-600" />}
          color="bg-green-100"
        />
        <KPICard
          title="Motoristas"
          value={motoristasAtivos}
          total={motoristas.length}
          icon={<CreditCard className="w-6 h-6 text-red-600" />}
          color="bg-red-100"
          alert={cnhVencendo > 0 ? { count: cnhVencendo, label: "CNH" } : undefined}
        />
      </div>

      {/* Sub-Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
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
        </TabsList>

        <TabsContent value="funcionarios">
          <FuncionariosTab
            funcionarios={funcionarios}
            isLoading={loadingFuncionarios}
            createFuncionario={createFuncionario}
            updateFuncionario={updateFuncionario}
            deleteFuncionario={deleteFuncionario}
            toggleStatus={toggleFuncionarioStatus}
          />
        </TabsContent>

        <TabsContent value="motoristas">
          <MotoristasTab
            motoristas={motoristas}
            funcionarios={funcionarios}
            isLoading={loadingMotoristas}
            createMotorista={createMotorista}
            updateMotorista={updateMotorista}
            deleteMotorista={deleteMotorista}
          />
        </TabsContent>

        <TabsContent value="veiculos">
          <VeiculosTab
            veiculos={veiculos}
            isLoading={loadingVeiculos}
            createVeiculo={createVeiculo}
            updateVeiculo={updateVeiculo}
            deleteVeiculo={deleteVeiculo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== FUNCIONÁRIOS TAB =====
interface FuncionariosTabProps {
  funcionarios: Funcionario[];
  isLoading: boolean;
  createFuncionario: ReturnType<typeof useCreateFuncionario>;
  updateFuncionario: ReturnType<typeof useUpdateFuncionario>;
  deleteFuncionario: ReturnType<typeof useDeleteFuncionario>;
  toggleStatus: ReturnType<typeof useToggleFuncionarioStatus>;
}

function FuncionariosTab({
  funcionarios,
  isLoading,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  toggleStatus,
}: FuncionariosTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Funcionario | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    cargo: "OPERADOR DE PRODUÇÃO",
    departamento: "Produção",
    telefone: "",
    cpf: "",
    email: "",
    login: "",
    senha: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const filteredData = useMemo(() => {
    return funcionarios.filter(f => {
      const matchesSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           f.login.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "active" && f.ativo) ||
                           (statusFilter === "inactive" && !f.ativo);
      return matchesSearch && matchesStatus;
    });
  }, [funcionarios, searchTerm, statusFilter]);

  const resetForm = () => {
    setFormData({
      nome: "",
      cargo: "OPERADOR DE PRODUÇÃO",
      departamento: "Produção",
      telefone: "",
      cpf: "",
      email: "",
      login: "",
      senha: "",
    });
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleAvatarChange = (file: File | null, previewUrl: string | null) => {
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.login.trim() || !formData.senha.trim()) return;

    try {
      setIsUploading(true);
      let avatarUrl: string | undefined = undefined;

      // Upload avatar if file exists
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `funcionarios/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Erro ao fazer upload da foto');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      await createFuncionario.mutateAsync({
        nome: formData.nome,
        cargo: formData.cargo,
        departamento: formData.departamento,
        telefone: formData.telefone || undefined,
        cpf: formData.cpf || undefined,
        email: formData.email || undefined,
        login: formData.login,
        senha: formData.senha,
        avatar_url: avatarUrl,
      });

      resetForm();
      setIsFormOpen(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteFuncionario.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    await toggleStatus.mutateAsync({ id, ativo: !currentStatus });
  };

  return (
    <div className="space-y-4">
      {/* Collapsible Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Novo Funcionário</h3>
                  <p className="text-sm text-muted-foreground">
                    Cadastrar novo membro da equipe
                  </p>
                </div>
              </div>
              {isFormOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
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
                    <Label>Nome Completo *</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Digite o nome completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo *</Label>
                    <Select
                      value={formData.cargo}
                      onValueChange={(value) => setFormData({ ...formData, cargo: value })}
                    >
                      <SelectTrigger>
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
                      <SelectTrigger>
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
                    <Label className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Telefone
                    </Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      CPF
                    </Label>
                    <Input
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
              </div>

              {/* Credenciais */}
              <div className="border border-primary/30 bg-primary/5 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Credenciais de Acesso
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  O funcionário poderá fazer login usando email OU nome de usuário
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Email (opcional)</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="usuario@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome de Usuário *</Label>
                    <Input
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      placeholder="nome.usuario"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha de Acesso *</Label>
                    <Input
                      type="password"
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); setIsFormOpen(false); }}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={createFuncionario.isPending || isUploading}>
                  {(createFuncionario.isPending || isUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cadastrar
                </Button>
              </div>
            </form>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou login..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: "all" | "active" | "inactive") => setStatusFilter(v)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Status</TableHead>
                <TableHead className="w-14">Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo / Depto</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Login</TableHead>
                <TableHead className="text-center w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((func) => (
                <TableRow key={func.id} className={!func.ativo ? "opacity-60" : ""}>
                  <TableCell>
                    <Badge variant={func.ativo ? "default" : "secondary"} className={func.ativo ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                      {func.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={func.avatar_url || undefined} alt={func.nome} />
                      <AvatarFallback className="bg-purple-100 text-purple-700 font-semibold">
                        {getInitials(func.nome)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{func.nome}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {func.cargo} {func.departamento && `/ ${func.departamento}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{func.telefone || "-"}</TableCell>
                  <TableCell className="text-primary font-medium">{func.login}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(func)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(func.id, func.ativo)} disabled={toggleStatus.isPending}>
                        {func.ativo ? <X className="w-4 h-4 text-orange-500" /> : <Check className="w-4 h-4 text-emerald-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(func.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Edit Modal */}
      <EditFuncionarioModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        funcionario={editItem}
        onSave={updateFuncionario}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este funcionário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {deleteFuncionario.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [formData, setFormData] = useState({
    nome: "",
    cargo: "",
    departamento: "",
    telefone: "",
    cpf: "",
    email: "",
    login: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Update form when funcionario changes
  useMemo(() => {
    if (funcionario) {
      setFormData({
        nome: funcionario.nome,
        cargo: funcionario.cargo,
        departamento: funcionario.departamento || "",
        telefone: funcionario.telefone || "",
        cpf: funcionario.cpf || "",
        email: funcionario.email || "",
        login: funcionario.login,
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
    if (!funcionario) return;
    
    try {
      setIsUploading(true);
      let finalAvatarUrl: string | undefined = avatarUrl || undefined;

      // Upload new avatar if file exists
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `funcionarios/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Erro ao fazer upload da foto');
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
          finalAvatarUrl = publicUrl;
        }
      }

      await onSave.mutateAsync({
        id: funcionario.id,
        nome: formData.nome,
        cargo: formData.cargo,
        departamento: formData.departamento || undefined,
        telefone: formData.telefone || undefined,
        cpf: formData.cpf || undefined,
        email: formData.email || undefined,
        login: formData.login,
        avatar_url: finalAvatarUrl,
      });
      
      onClose();
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
  motoristas: Motorista[];
  funcionarios: Funcionario[];
  isLoading: boolean;
  createMotorista: ReturnType<typeof useMotoristas>["createMotorista"];
  updateMotorista: ReturnType<typeof useMotoristas>["updateMotorista"];
  deleteMotorista: ReturnType<typeof useMotoristas>["deleteMotorista"];
}

function MotoristasTab({
  motoristas,
  funcionarios,
  isLoading,
  createMotorista,
  updateMotorista,
  deleteMotorista,
}: MotoristasTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "warning">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Motorista | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    cnh: "",
    cnh_validade: "",
    funcionario_id: "",
  });

  const filteredData = useMemo(() => {
    return motoristas.filter(m => {
      const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase());
      if (statusFilter === "all") return matchesSearch;
      if (statusFilter === "active") return matchesSearch && m.ativo;
      const cnhStatus = getCNHStatus(m.cnh_validade);
      if (statusFilter === "expired") return matchesSearch && cnhStatus.status === "expired";
      if (statusFilter === "warning") return matchesSearch && cnhStatus.status === "warning";
      return matchesSearch;
    });
  }, [motoristas, searchTerm, statusFilter]);

  const resetForm = () => {
    setFormData({ nome: "", telefone: "", email: "", cnh: "", cnh_validade: "", funcionario_id: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;

    await createMotorista.mutateAsync({
      nome: formData.nome,
      telefone: formData.telefone || null,
      email: formData.email || null,
      cnh: formData.cnh || null,
      cnh_validade: formData.cnh_validade || null,
      funcionario_id: formData.funcionario_id || null,
      ativo: true,
    });

    resetForm();
    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMotorista.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (motorista: Motorista) => {
    await updateMotorista.mutateAsync({ id: motorista.id, ativo: !motorista.ativo });
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
            <div className="flex items-center justify-between cursor-pointer">
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
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>

              <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Documentação CNH
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número da CNH</Label>
                    <Input value={formData.cnh} onChange={(e) => setFormData({ ...formData, cnh: formatCNH(e.target.value) })} placeholder="00000000000" maxLength={11} />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade da CNH</Label>
                    <Input type="date" value={formData.cnh_validade} onChange={(e) => setFormData({ ...formData, cnh_validade: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Vincular a Funcionário (opcional)
                </Label>
                <Select value={formData.funcionario_id || "none"} onValueChange={(v) => setFormData({ ...formData, funcionario_id: v === "none" ? "" : v })}>
                  <SelectTrigger>
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="warning">CNH Vencendo</SelectItem>
              <SelectItem value="expired">CNH Vencida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum motorista encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CNH</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-center w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((m) => {
                const cnhStatus = getCNHStatus(m.cnh_validade);
                return (
                  <TableRow key={m.id} className={!m.ativo ? "opacity-60" : ""}>
                    <TableCell>
                      <Badge variant={m.ativo ? "default" : "secondary"} className={m.ativo ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="font-mono text-sm">{m.cnh || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={cnhStatus.color as "default" | "secondary" | "destructive"} className={cnhStatus.status === "warning" ? "bg-yellow-500 text-yellow-950" : ""}>
                        {cnhStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getFuncionarioNome(m.funcionario_id) || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(m)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(m)} disabled={updateMotorista.isPending}>
                          {m.ativo ? <X className="w-4 h-4 text-orange-500" /> : <Check className="w-4 h-4 text-emerald-500" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(m.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este motorista?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {deleteMotorista.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Excluir
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

  useMemo(() => {
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
    await onSave.mutateAsync({
      id: motorista.id,
      nome: formData.nome,
      telefone: formData.telefone || null,
      email: formData.email || null,
      cnh: formData.cnh || null,
      cnh_validade: formData.cnh_validade || null,
      funcionario_id: formData.funcionario_id || null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Motorista</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Nome *</Label>
              <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: formatTelefone(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CNH</Label>
              <Input value={formData.cnh} onChange={(e) => setFormData({ ...formData, cnh: formatCNH(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Validade CNH</Label>
              <Input type="date" value={formData.cnh_validade} onChange={(e) => setFormData({ ...formData, cnh_validade: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
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
  veiculos: Veiculo[];
  isLoading: boolean;
  createVeiculo: ReturnType<typeof useVeiculos>["createVeiculo"];
  updateVeiculo: ReturnType<typeof useVeiculos>["updateVeiculo"];
  deleteVeiculo: ReturnType<typeof useVeiculos>["deleteVeiculo"];
}

function VeiculosTab({
  veiculos,
  isLoading,
  createVeiculo,
  updateVeiculo,
  deleteVeiculo,
}: VeiculosTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Veiculo | null>(null);
  
  const [formData, setFormData] = useState({ placa: "", modelo: "", tipo: "Carro", cor: "", ano: "" });

  const filteredData = useMemo(() => {
    return veiculos.filter(v => {
      const matchesSearch = v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           v.modelo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "active" && v.ativo) ||
                           (statusFilter === "inactive" && !v.ativo);
      return matchesSearch && matchesStatus;
    });
  }, [veiculos, searchTerm, statusFilter]);

  const resetForm = () => {
    setFormData({ placa: "", modelo: "", tipo: "Carro", cor: "", ano: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.placa.trim() || !formData.modelo.trim()) return;

    await createVeiculo.mutateAsync({
      placa: formData.placa.toUpperCase(),
      modelo: formData.modelo,
      tipo: formData.tipo || null,
      cor: formData.cor || null,
      ano: formData.ano ? parseInt(formData.ano) : null,
      ativo: true,
    });

    resetForm();
    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteVeiculo.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (veiculo: Veiculo) => {
    await updateVeiculo.mutateAsync({ id: veiculo.id, ativo: !veiculo.ativo });
  };

  return (
    <div className="space-y-4">
      {/* Collapsible Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
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
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Placa *</Label>
                  <Input value={formData.placa} onChange={(e) => setFormData({ ...formData, placa: formatPlaca(e.target.value) })} placeholder="ABC-1D23" required className="uppercase" />
                </div>
                <div className="space-y-2">
                  <Label>Modelo *</Label>
                  <Input value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} placeholder="Ex: Fiat Fiorino" required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input value={formData.cor} onChange={(e) => setFormData({ ...formData, cor: e.target.value })} placeholder="Ex: Branco" />
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input type="number" value={formData.ano} onChange={(e) => setFormData({ ...formData, ano: e.target.value })} placeholder="Ex: 2023" min="1990" max="2030" />
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por placa ou modelo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Car className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum veículo encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Status</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="text-center w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((v) => (
                <TableRow key={v.id} className={!v.ativo ? "opacity-60" : ""}>
                  <TableCell>
                    <Badge variant={v.ativo ? "default" : "secondary"} className={v.ativo ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                      {v.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono font-bold">{v.placa}</TableCell>
                  <TableCell className="font-medium">{v.modelo}</TableCell>
                  <TableCell className="text-muted-foreground">{v.tipo || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.cor || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{v.ano || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(v)}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(v)} disabled={updateVeiculo.isPending}>
                        {v.ativo ? <X className="w-4 h-4 text-orange-500" /> : <Check className="w-4 h-4 text-emerald-500" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(v.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Edit Modal */}
      <EditVeiculoModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        veiculo={editItem}
        onSave={updateVeiculo}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover este veículo?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {deleteVeiculo.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Excluir
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

  useMemo(() => {
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
    await onSave.mutateAsync({
      id: veiculo.id,
      placa: formData.placa.toUpperCase(),
      modelo: formData.modelo,
      tipo: formData.tipo || null,
      cor: formData.cor || null,
      ano: formData.ano ? parseInt(formData.ano) : null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Veículo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <Input value={formData.placa} onChange={(e) => setFormData({ ...formData, placa: formatPlaca(e.target.value) })} required className="uppercase" />
            </div>
            <div className="space-y-2">
              <Label>Modelo *</Label>
              <Input value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_VEICULO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input value={formData.cor} onChange={(e) => setFormData({ ...formData, cor: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Ano</Label>
              <Input type="number" value={formData.ano} onChange={(e) => setFormData({ ...formData, ano: e.target.value })} min="1990" max="2030" />
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
